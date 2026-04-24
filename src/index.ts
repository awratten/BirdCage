import { drawGrid, drawRoundedRect, fillRoundedRect, drawText } from "./cage.js";

let SECRET_WORD = "HELLO";

const MAX_ROWS = 6;
const MAX_COLS = 5;
const CANVAS_WIDTH = window.innerWidth > 600 ? Math.min(500, window.innerWidth) : window.innerWidth; // Full width on mobile
const GRID_SIZE = CANVAS_WIDTH / MAX_COLS;

const DRAW_DEBUG_GRID = true;

const FONT_SIZE = GRID_SIZE * 0.5;

const KEYBOARD_PADDING = 10;
const KEYBOARD_HEIGHT = 120;
const KEY_H = 35;
const KEY_GAP = 4;
const KEY_RADIUS = 4;
const SPECIAL_KEY_FRACTION = 0.13; // fraction of canvas width for Enter/Backspace keys
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
canvas.width = width;
canvas.height = height + KEYBOARD_HEIGHT + KEYBOARD_PADDING; // Extra space for keyboard

let redrawPending = false;

const AllWords = await loadListOfWords("src/words.txt");

async function loadListOfWords(url: string): Promise<string[]> {
    const response = await fetch(url);
    const text = await response.text();
    return text.split("\n").map(w => w.trim()).filter(w => w.length === MAX_COLS);
}

async function pickFromWordList(url: string): Promise<string> {
    // const response = await fetch(url);
    // const text = await response.text();
    // const words = text.split("\n").map(w => w.trim()).filter(w => w.length === MAX_COLS);
    
    return AllWords[Math.floor(Math.random() * AllWords.length)]!.toUpperCase();
}


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
        drawGrid(ctx!, 0, 0, width, height, gridSize, gridSize);
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

function getKeyW(key: string, unit: number): number {
    return (key === "ENT" || key === "⌫") ? width * SPECIAL_KEY_FRACTION : unit;
}

function getKeyBgColor(key: string): string {
    if (key === "ENT" || key === "\u232B") return "#878a8c";
    return keyColors.get(key) ?? "#D3D6DA";
}

function getKeyTextColor(key: string): string {
    return getKeyBgColor(key) === "#D3D6DA" ? "#000" : "#fff";
}

function updateKeyColors() {
    keyColors = new Map();
    for (const guess of guesses) {
        const letters = guess.toUpperCase().split("");
        const colors = colorsForGuess(guess);
        for (let col = 0; col < letters.length; col++) {
            const letter = letters[col]!;
            const rawColor = colors[col]!;
            const newColor = rawColor === "#EEE" ? "#787c7e" : rawColor;
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
    const kbY = height + KEYBOARD_PADDING;
    const unit = (width - 9 * KEY_GAP) / 10; // unit width based on widest row (10 keys)

    KB_ROWS.forEach((row, rowIdx) => {
        const rowWidth = row.reduce((s, k) => s + getKeyW(k, unit), 0) + (row.length - 1) * KEY_GAP;
        const startX = (width - rowWidth) / 2;
        const rowY = kbY + rowIdx * (KEY_H + KEY_GAP);

        let xCursor = startX;
        row.forEach((key, i) => {
            const kw = getKeyW(key, unit);
            fillRoundedRect(ctx!, xCursor, rowY, kw, KEY_H, KEY_RADIUS, getKeyBgColor(key));
            const label = key === "⌫" ? "\u232B" : key;
            const fontSize = Math.round(unit * 0.6);
            drawText(ctx!, label, xCursor + kw / 2, rowY + KEY_H / 2, getKeyTextColor(key),
                `${fontSize}px Arial`, "center", "middle");
            keyHitAreas.push({ key, x: xCursor, y: rowY, w: kw, h: KEY_H });
            xCursor += kw + (i < row.length - 1 ? KEY_GAP : 0);
        });
    });
}


function drawCharacter(char: string, row: number, col: number) {
    char = char.toUpperCase();
    const x = gridSize * col + gridSize / 2;
    const y = gridSize * row + gridSize / 2+2;
    drawText(ctx!, char, x, y, "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
}

function drawRoundRect(row: number, col: number, color: string) {
    const padding = gridSize * 0.1;
    const x = gridSize * col + padding / 2;
    const y = gridSize * row + padding / 2;
    const size = gridSize - padding;
    fillRoundedRect(ctx!, x, y, size, size, 10, color);
}

function colorsForGuess(word: string): string[] {
    const guess = word.toUpperCase().split("");
    const secret = SECRET_WORD.split("");
    const result: string[] = new Array(MAX_COLS).fill("#EEE");

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
        const letter = guess[i]!;
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
    const modal = document.getElementById("modal")!;
    const title = document.getElementById("modal-title")!;
    const wordEl = document.getElementById("modal-word")!;
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
    updateKeyColors();
    checkGameState();
    if (currentState === "won" || currentState === "lost") {
        setTimeout(showGameEndModal, 400);
    }
}

function drawWord(word: string, row: number) {
    word = word.toUpperCase();
    const letters = word.split("");
    if (letters.length !== MAX_COLS) {
        throw new Error(`Word must have exactly ${MAX_COLS} letters`);
    }
    const colors = colorsForGuess(word);
    for (let col = 0; col < MAX_COLS; col++) {
        drawRoundRect(row, col, colors[col]!);
        drawCharacter(letters[col]!, row, col);
    }
}

let lastKeyPressTime = 0;
const KEY_PRESS_DEBOUNCE = 50; // 50ms debounce window

function handleKeyInput(key: string) {
    const now = Date.now();
    if (now - lastKeyPressTime < KEY_PRESS_DEBOUNCE) {
        return; // Ignore duplicate key presses within debounce window
    }
    lastKeyPressTime = now;

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
    handleKeyInput(e.key);
});

function handleCanvasClick(clientX: number, clientY: number) {
    if (canvas === null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top) * scaleY;
    for (const hit of keyHitAreas) {
        if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
            handleKeyInput(hit.key);
            break;
        }
    }
}

canvas.addEventListener("mousedown", (e: MouseEvent) => {
    handleCanvasClick(e.clientX, e.clientY);
});

canvas.addEventListener("touchstart", (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
        handleCanvasClick(touch.clientX, touch.clientY);
    }
});

pickFromWordList("src/words.txt").then(word => {
    SECRET_WORD = word;
    // SECRET_WORD = "HELLO";
    // console.log("Secret word:", SECRET_WORD);
    requestRedraw();
});

