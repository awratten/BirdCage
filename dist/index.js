import { GAME_REGISTRY } from "./registry.js";
// ─── canvas setup ────────────────────────────────────────────────────────────
const canvasEl = document.getElementById("viewport");
if (!(canvasEl instanceof HTMLCanvasElement))
    throw new Error("Canvas element not found");
const canvas = canvasEl;
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull)
    throw new Error("Could not get canvas context");
const ctx = ctxOrNull;
// ─── game menu ───────────────────────────────────────────────────────────────
let currentGame = null;
const menuNav = document.getElementById("menu-nav");
const hamburger = document.getElementById("hamburger");
if (menuNav) {
    for (const entry of GAME_REGISTRY) {
        const a = document.createElement("a");
        a.href = "#";
        a.className = "menu-item";
        a.textContent = entry.displayName;
        a.addEventListener("click", (e) => {
            e.preventDefault();
            void loadGame(entry);
            menuNav.classList.remove("open");
        });
        menuNav.appendChild(a);
    }
}
hamburger?.addEventListener("click", () => {
    menuNav?.classList.toggle("open");
});
// ─── game loader ─────────────────────────────────────────────────────────────
async function loadGame(entry) {
    currentGame?.destroy();
    currentGame = null;
    const factory = await entry.load();
    const game = factory(canvas, ctx);
    currentGame = game;
    await game.start();
}
// Load the default game (first entry in the registry)
await loadGame(GAME_REGISTRY[0]);
//# sourceMappingURL=index.js.map