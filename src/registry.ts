import type { GameFactory } from "./types.js";

export enum GameId {
    Wordle = "wordle",
    Weaver = "weaver",
}

export interface GameEntry {
    id: GameId;
    displayName: string;
    load(): Promise<GameFactory>;
}

export const GAME_REGISTRY: GameEntry[] = [
    {
        id: GameId.Wordle,
        displayName: "Wordle",
        load: () => import("./games/wordle.js").then(m => m.createWordleGame),
    },
    {
        id: GameId.Weaver,
        displayName: "Weaver",
        load: () => import("./games/weaver.js").then(m => m.createWeaverGame),
    },
];
