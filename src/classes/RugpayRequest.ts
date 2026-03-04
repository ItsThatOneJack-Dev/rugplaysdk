import User, { RugpayTransaction } from "./User";
import UserFactory from "./User";
import { interpretResponse } from "../helpers/interpretResponse";
import { results } from "./results";
import { sdkFetch } from "../helpers/sdkFetch";

const VAAQ_CHECK_URL = "https://api.vaaq.dev/rugplay/v1/check";

export class RugpayRequest {
    readonly id: string;
    readonly amount: number;
    readonly creatorUsername: string;
    readonly channel: InstanceType<any>;
    readonly createdAt: Date;

    creator: typeof User | null;
    fulfillerUsername: string | null;
    status: "pending" | "completed";

    constructor({
        id,
        amount,
        creatorUsername,
        channel,
        createdAt,
        creator = null,
        fulfillerUsername = null,
        status = "pending",
    }: {
        id: string;
        amount: number;
        creatorUsername: string;
        channel: InstanceType<any>;
        createdAt?: Date | string;
        creator?: typeof User | null;
        fulfillerUsername?: string | null;
        status?: "pending" | "completed";
    }) {
        this.id = id;
        this.amount = amount;
        this.creatorUsername = creatorUsername;
        this.channel = channel;
        this.createdAt = createdAt ? new Date(createdAt as string) : new Date();
        this.creator = creator;
        this.fulfillerUsername = fulfillerUsername;
        this.status = status;
    }

    get completed(): boolean {
        return this.status === "completed";
    }

    async resolveCreator(): Promise<typeof User | null> {
        if (this.creator) return this.creator;
        this.creator = await (UserFactory as any)(this.creatorUsername);
        return this.creator;
    }

    async toTransaction(): Promise<RugpayTransaction> {
        const [creator, recipient] = await Promise.all([
            User._fetch(this.creatorUsername),
            this.fulfillerUsername
                ? User._fetch(this.fulfillerUsername)
                : Promise.resolve(null),
        ]);

        return {
            type: "RUGPAY",
            id: this.id,
            amount: this.amount,
            creatorUsername: this.creatorUsername,
            recipientUsername: this.fulfillerUsername ?? null,
            payerUsername: this.fulfillerUsername ?? null,
            status: this.status,
            createdAt: this.createdAt,
            creator,
            recipient,
        };
    }

    async complete(): Promise<unknown> {
        if (this.completed)
            throw new Error(
                "RugplaySDK: This rugpay request has already been completed.",
            );

        const me = await User.me();
        if (!me) return results.FAILURE;

        if (me.username === this.creatorUsername)
            throw new Error(
                "RugplaySDK: Cannot complete your own rugpay request.",
            );

        // Get the creator as a User and use their sendCash method
        const creator = await this.resolveCreator();
        if (!creator) return results.FAILURE;

        const transferResult = await me.sendCash(this.amount);
        if (transferResult !== results.SUCCESS) return transferResult;

        const res = await sdkFetch(VAAQ_CHECK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: this.id.toUpperCase(),
                status: "completed",
                sender: me.username,
            }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (data.status === "success") {
            this.status = "completed";
            this.fulfillerUsername = me.username;
            return results.SUCCESS;
        }

        return results.FAILURE;
    }

    async check(): Promise<unknown> {
        const res = await sdkFetch(
            `${VAAQ_CHECK_URL}?id=${this.id.toUpperCase()}`,
        );
        if (!res.ok) return null;

        const data = await res.json();
        this.status = data.status;
        if (data.recipient_username)
            this.fulfillerUsername = data.recipient_username;
        return data;
    }
}
