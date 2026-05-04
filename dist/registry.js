export var GameId;
(function (GameId) {
    GameId["Wordle"] = "wordle";
    GameId["Weaver"] = "weaver";
})(GameId || (GameId = {}));
export const GAME_REGISTRY = [
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
//# sourceMappingURL=registry.js.map