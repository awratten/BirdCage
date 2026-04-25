export var GameId;
(function (GameId) {
    GameId["Wordle"] = "wordle";
})(GameId || (GameId = {}));
export const GAME_REGISTRY = [
    {
        id: GameId.Wordle,
        displayName: "Wordle",
        load: () => import("./games/wordle.js").then(m => m.createWordleGame),
    },
];
//# sourceMappingURL=registry.js.map