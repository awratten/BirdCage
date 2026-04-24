import { drawGrid, drawRoundedRect, fillRoundedRect, drawText } from "./cage.js";

let SECRET_WORD: string = "";

const MAX_GUESS: number = 6;
const MAX_ROWS: number = MAX_GUESS;
const MAX_COLS: number = 5;
const CANVAS_WIDTH: number = window.innerWidth > 600 ? Math.min(500, window.innerWidth) : window.innerWidth; // Full width on mobile
const GRID_SIZE: number = CANVAS_WIDTH / MAX_COLS;

const GRID_COLOR: string= "#DDD"

const DRAW_DEBUG_GRID: boolean = true;

const FONT_SIZE: number = GRID_SIZE * 0.5;

const KEYBOARD_PADDING: number = 10;
const KEYBOARD_HEIGHT_PERCENTAGE: number = 0.25; // 25% of viewport height
const MIN_KEYBOARD_HEIGHT: number = 80;
const MAX_KEYBOARD_HEIGHT: number = 220;
const KEY_GAP: number = 4;
const KEY_RADIUS: number = 6;
const SPECIAL_KEY_FRACTION: number = 0.13; // fraction of canvas width for Enter/Backspace keys
const PIXEL_RATIO: number = (300/96);

// Mutable keyboard dimensions that update on resize
let KEYBOARD_HEIGHT: number = calculateKeyboardHeight();
let KEY_W: number = (CANVAS_WIDTH / 10) - 5;
let KEY_H: number = (KEYBOARD_HEIGHT / 3) - 5;

function calculateKeyboardHeight(): number {
    const targetHeight = window.innerHeight * KEYBOARD_HEIGHT_PERCENTAGE;
    return Math.max(MIN_KEYBOARD_HEIGHT, Math.min(MAX_KEYBOARD_HEIGHT, targetHeight));
}
const KB_ROWS: string[][] = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENT","Z","X","C","V","B","N","M","⌫"],
];


let guesses: string[] = [];
let currentGuess: string = "";
let currentRow: number = 0;

let usedKeys: Set<string> = new Set();

let currentState: "playing" | "won" | "lost" = "playing";

let keyColors: Map<string, string> = new Map();
let gridColors: string[][] = [];

interface KeyHitArea {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
let keyHitAreas: KeyHitArea[] = [];



const canvas = document.getElementById("viewport") as HTMLCanvasElement | null;
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found");
}

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
if (!ctx) {
    throw new Error("Could not get canvas context");
}

const gridSize: number = GRID_SIZE;
const width: number = GRID_SIZE * MAX_COLS;
const height: number = GRID_SIZE * MAX_ROWS;

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

let redrawPending: boolean = false;

// Function to update keyboard dimensions on viewport changes
function updateKeyboardDimensions() {
    const newKeyboardHeight: number = calculateKeyboardHeight();
    if (newKeyboardHeight !== KEYBOARD_HEIGHT) {
        KEYBOARD_HEIGHT = newKeyboardHeight;
        KEY_H = (KEYBOARD_HEIGHT / 3) - 5;
        canvas!.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) * PIXEL_RATIO;
        canvas!.style.height = (height + KEYBOARD_HEIGHT + KEYBOARD_PADDING) + "px";
        requestRedraw();
    }
}

// Listen for window resize and orientation changes
window.addEventListener("resize", updateKeyboardDimensions);
window.addEventListener("orientationchange", updateKeyboardDimensions);

async function loadListOfWords(url: string): Promise<string[]> {
    const response = await fetch(url);
    const text: string = await response.text();
    return text.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length === MAX_COLS);
}

const SolutionWords = await loadListOfWords("src/solutions_nyt.txt");
const NonSolutionWords = await loadListOfWords("src/nonsolutions_nyt.txt");
const AllWords = [...SolutionWords, ...NonSolutionWords];

SECRET_WORD = SolutionWords[Math.floor(Math.random() * SolutionWords.length)]!.toUpperCase();


function requestRedraw() {
    if (!redrawPending) {
        redrawPending = true;
        requestAnimationFrame(render);
    }
}

function render() {
    if (canvas === null || ctx === null) return;

    redrawPending = false;
    ctx!.clearRect(0, 0, width, canvas.height);
    if (DRAW_DEBUG_GRID) {
        drawGrid(ctx!, 0, 0, width, height, gridSize, gridSize, GRID_COLOR);
    }

    for (let row = 0; row < guesses.length; row++) {
        drawWord(guesses[row]!, row);
    }

    const letters = currentGuess.split("");
    for (let col = 0; col < letters.length; col++) {
        drawCharacter(letters[col]!, currentRow, col);
    }

    drawOnScreenKeyboard();
}

function getKeyW(key: string): number {
    return (key === "ENT" || key === "⌫") ? width * SPECIAL_KEY_FRACTION : KEY_W;
}

function getKeyBgColor(key: string): string {
    if (key === "ENT" || key === "\u232B") return "#878a8c";
    return keyColors.get(key) ?? "#D3D6DA";
}

function getKeyTextColor(key: string): string {
    if (key === "ENT" || key === "\u232B") return "#fff";
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
        const letters = guesses[i]!.toUpperCase().split("");
        const colors = gridColors[i]!;
        for (let col = 0; col < letters.length; col++) {
            const letter = letters[col]!;
            const rawColor = colors[col]!;
            const newColor = rawColor === "#DDD" || rawColor === "#EEE" ? "#878a8c" : rawColor;
            const existing = keyColors.get(letter);
            if (existing === "#6aaa64") continue;
            if (newColor === "#6aaa64" || newColor === "#c9b458" && existing !== "#6aaa64" || !existing) {
                keyColors.set(letter, newColor);
            }
        }
    }
}

function drawOnScreenKeyboard() {
    keyHitAreas = [];
    const kbY: number = height + KEYBOARD_PADDING;

    KB_ROWS.forEach((row, rowIdx) => {
        const rowWidth: number = row.reduce((s, k) => s + getKeyW(k), 0) + (row.length - 1) * KEY_GAP;
        const startX: number = (width - rowWidth) / 2;
        const rowY: number = kbY + rowIdx * (KEY_H + KEY_GAP);

        let xCursor = startX;
        row.forEach((key, i) => {
            const kw: number = getKeyW(key);
            fillRoundedRect(ctx!, xCursor, rowY, kw, KEY_H, KEY_RADIUS, getKeyBgColor(key));
            const label: string = key === "⌫" ? "\u232B" : key;
            const fontSize: number = Math.round(KEY_W * 0.6);
            drawText(ctx!, label, xCursor + kw / 2, rowY + KEY_H / 2+2, getKeyTextColor(key),
                `${fontSize}px Arial`, "center", "middle");
            keyHitAreas.push({ key, x: xCursor, y: rowY, w: kw, h: KEY_H });
            xCursor += kw + (i < row.length - 1 ? KEY_GAP : 0);
        });
    });
}


function drawCharacter(char: string, row: number, col: number) {
    char = char.toUpperCase();
    const x: number = gridSize * col + gridSize / 2;
    const y: number = gridSize * row + gridSize / 2+2;
    drawText(ctx!, char, x, y, "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
}

function drawRoundRect(row: number, col: number, color: string) {
    const padding = gridSize * 0.1;
    const x: number = gridSize * col + padding / 2;
    const y: number = gridSize * row + padding / 2;
    const size: number = gridSize - padding;
    fillRoundedRect(ctx!, x, y, size, size, 10, color);
}

function colorsForGuess(word: string): string[] {
    const guess:  string[] = word.toUpperCase().split("");
    const secret: string[] = SECRET_WORD.split("");
    const result: string[] = new Array(MAX_COLS).fill("#DDD");

    // First pass: mark greens and count unmatched secret letters
    const unmatchedSecret: Record<string, number> = {};
    for (let i = 0; i < MAX_COLS; i++) {
        if (guess[i] === secret[i]) {
            result[i] = "#6aaa64";
        } else {
            unmatchedSecret[secret[i]!] = (unmatchedSecret[secret[i]!] ?? 0) + 1;
        }
    }

    // Second pass: mark yellows, consuming one unmatched secret letter each time
    for (let i = 0; i < MAX_COLS; i++) {
        if (result[i] === "#6aaa64") continue;
        const letter: string = guess[i]!;
        if ((unmatchedSecret[letter] ?? 0) > 0) {
            result[i] = "#c9b458";
            unmatchedSecret[letter]!--;
        }
    }

    return result;
}

function checkGameState() {
    if (guesses[guesses.length - 1] === SECRET_WORD) {
        currentState = "won";
    } else if (guesses.length >= MAX_ROWS) {
        currentState = "lost";
    } else {
        currentState = "playing";
    }
}

function showGameEndModal() {
    const modal: HTMLElement = document.getElementById("modal")!;
    const title: HTMLElement = document.getElementById("modal-title")!;
    const wordEl: HTMLElement = document.getElementById("modal-word")!;
    if (currentState === "won") {
        title.textContent = `You got it in ${guesses.length}!`;
        wordEl.textContent = `The word was ${SECRET_WORD}`;
    } else {
        title.textContent = "Better luck next time";
        wordEl.textContent = `The word was ${SECRET_WORD}`;
    }
    modal.classList.remove("hidden");
}

document.getElementById("modal-btn")!.addEventListener("click", () => {
    location.reload();
});

function guessWord(word: string) {
    checkGameState();
    // check if the guess is in the list of valid words words.txt)
    if (!AllWords.includes(currentGuess.toLowerCase())) {
        return;
    }
    guesses.push(currentGuess);
    currentGuess = "";
    usedKeys = new Set([...usedKeys, ...currentGuess.split("")]);
    // console.log("Used keys:", usedKeys);
    updateGridColors();
    updateKeyboardColors();
    checkGameState();
    if (currentState === "won" || currentState === "lost") {
        setTimeout(showGameEndModal, 400);
    }
}

function drawWord(word: string, row: number) {
    word = word.toUpperCase();
    const letters: string[] = word.split("");
    if (letters.length !== MAX_COLS) {
        throw new Error(`Word must have exactly ${MAX_COLS} letters`);
    }
    const colors = gridColors[row] ?? colorsForGuess(word);
    for (let col = 0; col < MAX_COLS; col++) {
        drawRoundRect(row, col, colors[col]!);
        drawCharacter(letters[col]!, row, col);
    }
}

let lastKeyPressTime: number = 0;
const KEY_PRESS_DEBOUNCE: number = 100; // 100ms debounce window for safety
let lastInputSource: "keyboard" | "touch" | "mouse" | null = null;

function handleKeyInput(key: string, source: "keyboard" | "touch" | "mouse") {
    const now: number = Date.now();
    
    // Prevent duplicate inputs from keyboard events (keyboard repeats)
    if (source === "keyboard" && now - lastKeyPressTime < KEY_PRESS_DEBOUNCE && lastInputSource === "keyboard") {
        return;
    }
    
    lastKeyPressTime = now;
    lastInputSource = source;

    currentRow = guesses.length;
    if (currentRow >= MAX_ROWS) return;

    if (key === "Backspace" || key === "Bksp" || key === "⌫") {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            requestRedraw();
        }
    } else if (key === "Enter" || key === "ENT") {
        if (currentState === "playing" && currentGuess.length === MAX_COLS) {
            guessWord(currentGuess);
            requestRedraw();
        }
    } else if (key.length === 1 && /^[A-Za-z]$/.test(key)) {
        if (currentState === "playing" && currentGuess.length < MAX_COLS) {
            currentGuess += key.toUpperCase();
            requestRedraw();
        }
    }
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
    handleKeyInput(e.key, "keyboard");
});

function handleCanvasClick(clientX: number, clientY: number, source: "mouse" | "touch") {
    if (canvas === null) return;
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

canvas.addEventListener("mouseup", (e: MouseEvent) => {
    handleCanvasClick(e.clientX, e.clientY, "mouse");
});

canvas.addEventListener("touchstart", (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touch) {
        handleCanvasClick(touch.clientX, touch.clientY, "touch");
    }
}, { passive: false });

requestRedraw();


