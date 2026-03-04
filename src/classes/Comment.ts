// src/classes/Comment.ts

import { User } from "./User";

export interface CommentData {
    id: number;
    content: string;
    createdAt: string;
    likesCount: number;
    isLikedByUser: boolean;
    userId: number;
    userName: string;
    userUsername: string;
    userImage: string | null;
    userNameColor: string | null;
}

export class Comment {
    readonly id: number;
    readonly content: string;
    readonly createdAt: Date;
    readonly likesCount: number;
    readonly isLiked: boolean;
    readonly username: string;
    readonly coinSymbol: string;

    private _user: User | null = null;

    constructor(data: CommentData, coinSymbol: string) {
        this.id = data.id;
        this.content = data.content;
        this.createdAt = new Date(data.createdAt);
        this.likesCount = data.likesCount;
        this.isLiked = data.isLikedByUser;
        this.username = data.userUsername;
        this.coinSymbol = coinSymbol;

        // Resolve user in background
        User._fetch(data.userId).then((user) => {
            this._user = user;
        });
    }

    get user(): User | null {
        return this._user;
    }

    async resolveUser(): Promise<User | null> {
        if (this._user) return this._user;
        this._user = await User._fetch(this.username);
        return this._user;
    }

    toJSON() {
        return {
            id: this.id,
            content: this.content,
            createdAt: this.createdAt,
            likesCount: this.likesCount,
            isLiked: this.isLiked,
            username: this.username,
            coinSymbol: this.coinSymbol,
        };
    }

    toString(): string {
        return `Comment(${this.username} on ${this.coinSymbol}: "${this.content}")`;
    }
}
