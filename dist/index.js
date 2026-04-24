import { drawGrid, drawRoundedRect, fillRoundedRect, drawText } from "./cage.js";
let SECRET_WORD = "";
const MAX_GUESS = 6;
const MAX_ROWS = MAX_GUESS;
const MAX_COLS = 5;
const CANVAS_WIDTH = window.innerWidth > 600 ? Math.min(500, window.innerWidth) : window.innerWidth; // Full width on mobile
const GRID_SIZE = CANVAS_WIDTH / MAX_COLS;
const GRID_COLOR = "#DDD";
const DRAW_DEBUG_GRID = true;
const FONT_SIZE = GRID_SIZE * 0.5;
const KEYBOARD_PADDING = 10;
const KEYBOARD_HEIGHT_PERCENTAGE = 0.25; // 25% of viewport height
const MIN_KEYBOARD_HEIGHT = 80;
const MAX_KEYBOARD_HEIGHT = 220;
const KEY_GAP = 4;
const KEY_RADIUS = 6;
const SPECIAL_KEY_FRACTION = 0.13; // fraction of canvas width for Enter/Backspace keys
const PIXEL_RATIO = (300 / 96);
const FLIP_DURATION = 350; // ms for a single tile flip
const FLIP_DELAY = 100; // ms pause between each tile
const SHAKE_DURATION = 400; // ms for the invalid-word shake
const SHAKE_AMPLITUDE = 3; // px horizontal offset at peak
// Mutable keyboard dimensions that update on resize
let KEYBOARD_HEIGHT = calculateKeyboardHeight();
let KEY_W = (CANVAS_WIDTH / 10) - 5;
let KEY_H = (KEYBOARD_HEIGHT / 3) - 5;
function calculateKeyboardHeight() {
    const targetHeight = window.innerHeight * KEYBOARD_HEIGHT_PERCENTAGE;
    return Math.max(MIN_KEYBOARD_HEIGHT, Math.min(MAX_KEYBOARD_HEIGHT, targetHeight));
}
const KB_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENT", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];
let guesses = [];
let currentGuess = "";
let currentRow = 0;
let usedKeys = new Set();
let currentState = "playing";
let keyColors = new Map();
let gridColors = [];
let keyHitAreas = [];
let flipAnim = { active: false, row: 0, tile: 0, startTime: 0 };
let shakeAnim = { active: false, startTime: 0 };
const canvas = document.getElementById("viewport");
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Could not get canvas context");
}
const gridSize = GRID_SIZE;
const width = GRID_SIZE * MAX_COLS;
const height = GRID_SIZE * MAX_ROWS;
// Apply DPI scaling to internal resolution
canvas.width = width * PIXEL_RATIO;
canvas.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) * PIXEL_RATIO;
// Set display size (physical size) in CSS
canvas.style.width = width + "px";
canvas.style.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) + "px";
// Scale the context to match internal resolution
ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
// Enable anti-aliasing for text and images
ctx.imageSmoothingEnabled = true;
let redrawPending = false;
// Function to update keyboard dimensions on viewport changes
function updateKeyboardDimensions() {
    const newKeyboardHeight = calculateKeyboardHeight();
    if (newKeyboardHeight !== KEYBOARD_HEIGHT) {
        KEYBOARD_HEIGHT = newKeyboardHeight;
        KEY_H = (KEYBOARD_HEIGHT / 3) - 5;
        canvas.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) * PIXEL_RATIO;
        canvas.style.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) + "px";
        requestRedraw();
    }
}
// Listen for window resize and orientation changes
window.addEventListener("resize", updateKeyboardDimensions);
window.addEventListener("orientationchange", updateKeyboardDimensions);
async function loadListOfWords(url) {
    const response = await fetch(url);
    const text = await response.text();
    return text.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length === MAX_COLS);
}
const SolutionWords = await loadListOfWords("src/solutions_nyt.txt");
const NonSolutionWords = await loadListOfWords("src/nonsolutions_nyt.txt");
const AllWords = [...SolutionWords, ...NonSolutionWords];
SECRET_WORD = SolutionWords[Math.floor(Math.random() * SolutionWords.length)].toUpperCase();
function requestRedraw() {
    if (!redrawPending) {
        redrawPending = true;
        requestAnimationFrame(render);
    }
}
function render() {
    if (canvas === null || ctx === null)
        return;
    redrawPending = false;
    ctx.clearRect(0, 0, width, canvas.height);
    if (DRAW_DEBUG_GRID) {
        drawGrid(ctx, 0, 0, width, height, gridSize, gridSize, GRID_COLOR);
    }
    for (let row = 0; row < guesses.length; row++) {
        if (flipAnim.active && row === flipAnim.row) {
            drawWordAnimating(row);
        }
        else {
            drawWord(guesses[row], row);
        }
    }
    const letters = currentGuess.split("");
    const shakeOffset = getShakeOffset();
    if (shakeOffset !== 0)
        ctx.save(), ctx.translate(shakeOffset, 0);
    for (let col = 0; col < letters.length; col++) {
        drawCharacter(letters[col], currentRow, col);
    }
    if (shakeOffset !== 0)
        ctx.restore();
    drawOnScreenKeyboard();
    if (flipAnim.active) {
        const now = performance.now();
        const elapsed = now - flipAnim.startTime;
        if (elapsed >= FLIP_DURATION + FLIP_DELAY) {
            flipAnim.tile++;
            if (flipAnim.tile >= MAX_COLS) {
                flipAnim.active = false;
                updateKeyboardColors();
                checkGameState();
                if (currentState === "won" || currentState === "lost") {
                    setTimeout(showGameEndModal, 400);
                }
            }
            else {
                flipAnim.startTime = performance.now();
            }
        }
        requestAnimationFrame(render);
    }
    if (shakeAnim.active) {
        requestAnimationFrame(render);
    }
}
function getKeyW(key) {
    return (key === "ENT" || key === "⌫") ? width * SPECIAL_KEY_FRACTION : KEY_W;
}
function getKeyBgColor(key) {
    if (key === "ENT" || key === "\u232B")
        return "#878a8c";
    return keyColors.get(key) ?? "#D3D6DA";
}
function getKeyTextColor(key) {
    if (key === "ENT" || key === "\u232B")
        return "#fff";
    const bg = getKeyBgColor(key);
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000" : "#fff";
}
function updateGridColors() {
    gridColors = guesses.map(guess => colorsForGuess(guess));
}
function updateKeyboardColors() {
    keyColors = new Map();
    for (let i = 0; i < guesses.length; i++) {
        const letters = guesses[i].toUpperCase().split("");
        const colors = gridColors[i];
        for (let col = 0; col < letters.length; col++) {
            const letter = letters[col];
            const rawColor = colors[col];
            const newColor = rawColor === "#DDD" || rawColor === "#EEE" ? "#878a8c" : rawColor;
            const existing = keyColors.get(letter);
            if (existing === "#6aaa64")
                continue;
            if (newColor === "#6aaa64" || newColor === "#c9b458" && existing !== "#6aaa64" || !existing) {
                keyColors.set(letter, newColor);
            }
        }
    }
}
function drawOnScreenKeyboard() {
    keyHitAreas = [];
    const kbY = height + KEYBOARD_PADDING;
    KB_ROWS.forEach((row, rowIdx) => {
        const rowWidth = row.reduce((s, k) => s + getKeyW(k), 0) + (row.length - 1) * KEY_GAP;
        const startX = (width - rowWidth) / 2;
        const rowY = kbY + rowIdx * (KEY_H + KEY_GAP);
        let xCursor = startX;
        row.forEach((key, i) => {
            const kw = getKeyW(key);
            fillRoundedRect(ctx, xCursor, rowY, kw, KEY_H, KEY_RADIUS, getKeyBgColor(key));
            const label = key === "⌫" ? "\u232B" : key;
            const fontSize = Math.round(KEY_W * 0.6);
            drawText(ctx, label, xCursor + kw / 2, rowY + KEY_H / 2 + 2, getKeyTextColor(key), `${fontSize}px Arial`, "center", "middle");
            keyHitAreas.push({ key, x: xCursor, y: rowY, w: kw, h: KEY_H });
            xCursor += kw + (i < row.length - 1 ? KEY_GAP : 0);
        });
    });
}
function drawCharacter(char, row, col) {
    char = char.toUpperCase();
    const x = gridSize * col + gridSize / 2;
    const y = gridSize * row + gridSize / 2 + 2;
    drawText(ctx, char, x, y, "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
}
function drawRoundRect(row, col, color) {
    const padding = gridSize * 0.1;
    const x = gridSize * col + padding / 2;
    const y = gridSize * row + padding / 2;
    const size = gridSize - padding;
    fillRoundedRect(ctx, x, y, size, size, 10, color);
}
// Draws a single tile mid-flip. progress 0→0.5: squish (unrevealed), 0.5→1: unsquish (revealed color).
function drawFlipTile(row, col, char, progress) {
    const padding = gridSize * 0.1;
    const x = gridSize * col + padding / 2;
    const y = gridSize * row + padding / 2;
    const size = gridSize - padding;
    const centerY = gridSize * row + gridSize / 2;
    let scaleY;
    let bgColor;
    if (progress <= 0.5) {
        scaleY = 1 - 2 * progress;
        bgColor = "#EEE";
    }
    else {
        scaleY = 2 * progress - 1;
        bgColor = gridColors[row]?.[col] ?? "#DDD";
    }
    ctx.save();
    ctx.translate(0, centerY);
    ctx.scale(1, Math.max(scaleY, 0.001)); // avoid zero-scale ctx state
    ctx.translate(0, -centerY);
    fillRoundedRect(ctx, x, y, size, size, 10, bgColor);
    drawText(ctx, char.toUpperCase(), gridSize * col + gridSize / 2, gridSize * row + gridSize / 2 + 2, "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
    ctx.restore();
}
// Draws a guess row that is currently mid-animation.
function drawWordAnimating(row) {
    const word = guesses[row].toUpperCase();
    const letters = word.split("");
    const elapsed = performance.now() - flipAnim.startTime;
    const tileProgress = Math.min(elapsed / FLIP_DURATION, 1);
    for (let col = 0; col < MAX_COLS; col++) {
        if (col < flipAnim.tile) {
            // Already revealed — draw normally with final color
            drawRoundRect(row, col, gridColors[row]?.[col] ?? "#DDD");
            drawCharacter(letters[col], row, col);
        }
        else if (col === flipAnim.tile) {
            // Currently flipping
            drawFlipTile(row, col, letters[col], tileProgress);
        }
        else {
            // Not yet flipped — letter only, no colored background (matches pre-submit look)
            drawCharacter(letters[col], row, col);
        }
    }
}
function colorsForGuess(word) {
    const guess = word.toUpperCase().split("");
    const secret = SECRET_WORD.split("");
    const result = new Array(MAX_COLS).fill("#DDD");
    // First pass: mark greens and count unmatched secret letters
    const unmatchedSecret = {};
    for (let i = 0; i < MAX_COLS; i++) {
        if (guess[i] === secret[i]) {
            result[i] = "#6aaa64";
        }
        else {
            unmatchedSecret[secret[i]] = (unmatchedSecret[secret[i]] ?? 0) + 1;
        }
    }
    // Second pass: mark yellows, consuming one unmatched secret letter each time
    for (let i = 0; i < MAX_COLS; i++) {
        if (result[i] === "#6aaa64")
            continue;
        const letter = guess[i];
        if ((unmatchedSecret[letter] ?? 0) > 0) {
            result[i] = "#c9b458";
            unmatchedSecret[letter]--;
        }
    }
    return result;
}
function checkGameState() {
    if (guesses[guesses.length - 1] === SECRET_WORD) {
        currentState = "won";
    }
    else if (guesses.length >= MAX_ROWS) {
        currentState = "lost";
    }
    else {
        currentState = "playing";
    }
}
function showGameEndModal() {
    const modal = document.getElementById("modal");
    const title = document.getElementById("modal-title");
    const wordEl = document.getElementById("modal-word");
    if (currentState === "won") {
        title.textContent = `You got it in ${guesses.length}!`;
        wordEl.textContent = `The word was ${SECRET_WORD}`;
    }
    else {
        title.textContent = "Better luck next time";
        wordEl.textContent = `The word was ${SECRET_WORD}`;
    }
    modal.classList.remove("hidden");
}
document.getElementById("modal-btn").addEventListener("click", () => {
    location.reload();
});
function getShakeOffset() {
    if (!shakeAnim.active)
        return 0;
    const elapsed = performance.now() - shakeAnim.startTime;
    if (elapsed >= SHAKE_DURATION) {
        shakeAnim.active = false;
        return 0;
    }
    const progress = elapsed / SHAKE_DURATION;
    return SHAKE_AMPLITUDE * Math.sin(progress * Math.PI * 4) * (1 - progress);
}
function startShakeAnimation() {
    shakeAnim = { active: true, startTime: performance.now() };
    requestAnimationFrame(render);
}
function startFlipAnimation(row) {
    flipAnim = { active: true, row, tile: 0, startTime: performance.now() };
    requestAnimationFrame(render);
}
function guessWord(word) {
    checkGameState();
    // check if the guess is in the list of valid words words.txt)
    if (!AllWords.includes(currentGuess.toLowerCase())) {
        startShakeAnimation();
        return;
    }
    guesses.push(currentGuess);
    usedKeys = new Set([...usedKeys, ...currentGuess.split("")]);
    currentGuess = "";
    updateGridColors();
    // updateKeyboardColors and checkGameState are deferred to the end of the flip animation
    startFlipAnimation(guesses.length - 1);
}
function drawWord(word, row) {
    word = word.toUpperCase();
    const letters = word.split("");
    if (letters.length !== MAX_COLS) {
        throw new Error(`Word must have exactly ${MAX_COLS} letters`);
    }
    const colors = gridColors[row] ?? colorsForGuess(word);
    for (let col = 0; col < MAX_COLS; col++) {
        drawRoundRect(row, col, colors[col]);
        drawCharacter(letters[col], row, col);
    }
}
let lastKeyPressTime = 0;
const KEY_PRESS_DEBOUNCE = 100; // 100ms debounce window for safety
let lastInputSource = null;
function handleKeyInput(key, source) {
    const now = Date.now();
    // Prevent duplicate inputs from keyboard events (keyboard repeats)
    if (source === "keyboard" && now - lastKeyPressTime < KEY_PRESS_DEBOUNCE && lastInputSource === "keyboard") {
        return;
    }
    lastKeyPressTime = now;
    lastInputSource = source;
    if (flipAnim.active)
        return;
    currentRow = guesses.length;
    if (currentRow >= MAX_ROWS)
        return;
    if (key === "Backspace" || key === "Bksp" || key === "⌫") {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            requestRedraw();
        }
    }
    else if (key === "Enter" || key === "ENT") {
        if (currentState === "playing" && currentGuess.length === MAX_COLS) {
            guessWord(currentGuess);
            requestRedraw();
        }
    }
    else if (key.length === 1 && /^[A-Za-z]$/.test(key)) {
        if (currentState === "playing" && currentGuess.length < MAX_COLS) {
            currentGuess += key.toUpperCase();
            requestRedraw();
        }
    }
}
document.addEventListener("keydown", (e) => {
    handleKeyInput(e.key, "keyboard");
});
function handleCanvasClick(clientX, clientY, source) {
    if (canvas === null)
        return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    for (const hit of keyHitAreas) {
        if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
            handleKeyInput(hit.key, source);
            break;
        }
    }
}
canvas.addEventListener("mouseup", (e) => {
    handleCanvasClick(e.clientX, e.clientY, "mouse");
});
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touch) {
        handleCanvasClick(touch.clientX, touch.clientY, "touch");
    }
}, { passive: false });
requestRedraw();
//# sourceMappingURL=index.js.map