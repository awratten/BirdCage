import type { GameFactory } from "./types.js";
export declare enum GameId {
    Wordle = "wordle",
    Weaver = "weaver"
}
export interface GameEntry {
    id: GameId;
    displayName: string;
    load(): Promise<GameFactory>;
}
export declare const GAME_REGISTRY: GameEntry[];
//# sourceMappingURL=registry.d.ts.map