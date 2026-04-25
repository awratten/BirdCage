export interface Game {
    start(): Promise<void>;
    destroy(): void;
}
export type GameFactory = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Game;
//# sourceMappingURL=types.d.ts.map