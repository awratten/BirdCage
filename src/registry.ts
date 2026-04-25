import type { GameFactory } from "./types.js";

export enum GameId {
    Wordle = "wordle",
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
];
