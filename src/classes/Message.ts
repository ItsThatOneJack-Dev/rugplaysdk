import User from "./User";
import { RugpayRequest } from "./RugpayRequest";

const RUGPAY_PATTERN = /^RUGPAY REQUEST (\d+(?:\.\d+)?)\/([A-Z0-9]+)$/;
const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

export class Message {
    readonly id: number;
    readonly channel: InstanceType<any>;
    readonly content: string;
    readonly timestamp: Date;
    readonly senderUsername: string;
    readonly mentions: string[];
    readonly type: "text" | "rugpay";
    readonly rugpay: RugpayRequest | null;

    sender: typeof User | null;

    constructor({
        id,
        channel,
        content,
        timestamp,
        senderUsername,
        sender = null,
    }: {
        id: number;
        channel: InstanceType<any>;
        content: string;
        timestamp: Date | string;
        senderUsername: string;
        sender?: typeof User | null;
    }) {
        this.id = id;
        this.channel = channel;
        this.content = content;
        this.timestamp = new Date(timestamp as string);
        this.senderUsername = senderUsername;
        this.sender = sender;
        this.mentions = [...(content?.matchAll(MENTION_PATTERN) ?? [])].map(
            (m) => m[1],
        );

        const rugpayMatch = content?.match(RUGPAY_PATTERN);
        if (rugpayMatch) {
            this.type = "rugpay";
            this.rugpay = new RugpayRequest({
                id: rugpayMatch[2],
                amount: parseFloat(rugpayMatch[1]),
                creatorUsername: senderUsername,
                channel,
                createdAt: this.timestamp,
            });
        } else {
            this.type = "text";
            this.rugpay = null;
        }
    }

    async resolveSender(): Promise<typeof User | null> {
        if (this.sender) return this.sender;
        const { default: UserFactory } = await import("./User");
        this.sender = await (UserFactory as any)(this.senderUsername);
        return this.sender;
    }

    async reply(content: string): Promise<unknown> {
        return this.channel.sendMessage(content);
    }
}
