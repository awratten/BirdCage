import type { Game } from "../types.js";
import { drawGrid, fillRoundedRect, drawText } from "../cage.js";

// ─── module-level enums & interfaces (unexported) ────────────────────────────

enum GameState {
    Playing = "playing",
    Won     = "won",
    Lost    = "lost",
}

enum LetterState {
    Correct = "correct",
    Present = "present",
    Absent  = "absent",
}

interface KeyHitArea {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface FlipAnimation {
    active:    boolean;
    row:       number;
    tile:      number;
    startTime: number;
}

interface ShakeAnimation {
    active:    boolean;
    startTime: number;
}

// ─── factory ─────────────────────────────────────────────────────────────────

export function createWordleGame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Game {

    // Constants (fixed for the lifetime of this factory instance)
    const MAX_GUESS           = 6;
    const MAX_ROWS            = MAX_GUESS;
    const MAX_COLS            = 5;
    const GRID_COLOR          = "#DDD";
    const DRAW_DEBUG_GRID     = true;
    const KEYBOARD_PADDING    = 10;
    const KEYBOARD_HEIGHT_PCT = 0.25;
    const MIN_KEYBOARD_HEIGHT = 80;
    const MAX_KEYBOARD_HEIGHT = 220;
    const KEY_GAP             = 4;
    const KEY_RADIUS          = 6;
    const SPECIAL_KEY_FRACTION = 0.13;
    const PIXEL_RATIO         = 300 / 96;
    const FLIP_DURATION       = 350;
    const FLIP_DELAY          = 100;
    const SHAKE_DURATION      = 400;
    const SHAKE_AMPLITUDE     = 3;
    const KEY_PRESS_DEBOUNCE  = 50;
    const MENU_BAR_HEIGHT     = 48;

    const KB_ROWS: string[][] = [
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["ENT","Z","X","C","V","B","N","M","⌫"],
    ];

    // ─── mutable dimensions (recalculated on resize) ───────────────────────────

    let CANVAS_WIDTH: number;
    let GRID_SIZE: number;
    let FONT_SIZE: number;
    let gridWidth: number;
    let gridHeight: number;
    let KEYBOARD_HEIGHT: number;
    let KEY_W: number;
    let KEY_H: number;

    let SECRET_WORD  = "";
    let AllWords: string[] = [];
    let guesses: string[]  = [];
    let currentGuess = "";
    let currentRow   = 0;
    let usedKeys     = new Set<string>();
    let keyColors    = new Map<string, string>();
    let gridColors: LetterState[][] = [];
    let currentState = GameState.Playing;

    let redrawPending = false;
    let animFrameId: number | null = null;
    let destroyed     = false;

    let flipAnim: FlipAnimation   = { active: false, row: 0, tile: 0, startTime: 0 };
    let shakeAnim: ShakeAnimation = { active: false, startTime: 0 };
    let keyHitAreas: KeyHitArea[] = [];

    let lastKeyPressTime = 0;
    let lastInputSource: "keyboard" | "touch" | "mouse" | null = null;

    // Event listener references (assigned/replaced each start())
    let _onKeyDown: (e: KeyboardEvent) => void          = () => {};
    let _onResize: () => void                            = () => {};
    let _onOrientationChange: () => void                 = () => {};
    let _onMouseUp: (e: MouseEvent) => void              = () => {};
    let _onTouchStart: (e: TouchEvent) => void           = () => {};
    let _onModalBtn: () => void                          = () => {};

    // ─── helpers ─────────────────────────────────────────────────────────────

    function calculateDimensions(): void {
        // Use the smaller of width and height (minus menu bar) to constrain grid
        const constraint = Math.min(window.innerWidth, window.innerHeight - MENU_BAR_HEIGHT);
        
        // Calculate canvas width based on constraint, with reasonable bounds
        CANVAS_WIDTH = window.innerWidth > 600 ? Math.min(500, constraint) : constraint;
        
        // All grid dimensions flow from CANVAS_WIDTH
        GRID_SIZE   = CANVAS_WIDTH / MAX_COLS;
        FONT_SIZE   = GRID_SIZE * 0.5;
        gridWidth   = GRID_SIZE * MAX_COLS;
        gridHeight  = GRID_SIZE * MAX_ROWS;
        
        // Keyboard dimensions
        KEYBOARD_HEIGHT = calcKeyboardHeight();
        KEY_W           = (CANVAS_WIDTH / 10) - 5;
        KEY_H           = (KEYBOARD_HEIGHT / 3) - 5;
    }

    function calcKeyboardHeight(): number {
        const t = window.innerHeight * KEYBOARD_HEIGHT_PCT;
        return Math.max(MIN_KEYBOARD_HEIGHT, Math.min(MAX_KEYBOARD_HEIGHT, t));
    }

    function resizeCanvas(): void {
        canvas.width        = gridWidth * PIXEL_RATIO;
        canvas.height       = (gridHeight + KEYBOARD_HEIGHT + KEYBOARD_PADDING) * PIXEL_RATIO;
        canvas.style.width  = gridWidth + "px";
        canvas.style.height = (gridHeight + KEYBOARD_HEIGHT + KEYBOARD_PADDING) + "px";
        ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
        ctx.imageSmoothingEnabled = true;
    }

    function updateKeyboardDimensions(): void {
        const oldWidth  = gridWidth;
        const oldHeight = KEYBOARD_HEIGHT;
        
        calculateDimensions();
        
        // Check if anything actually changed
        if (oldWidth !== gridWidth || oldHeight !== KEYBOARD_HEIGHT) {
            resizeCanvas();
            requestRedraw();
        }
    }

    async function loadWords(url: string): Promise<string[]> {
        const r = await fetch(url);
        const t = await r.text();
        return t.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length === MAX_COLS);
    }

    function letterStateColor(s: LetterState): string {
        switch (s) {
            case LetterState.Correct: return "#6aaa64";
            case LetterState.Present: return "#c9b458";
            case LetterState.Absent:  return "#DDD";
        }
    }

    function letterStateKeyColor(s: LetterState): string {
        switch (s) {
            case LetterState.Correct: return "#6aaa64";
            case LetterState.Present: return "#c9b458";
            case LetterState.Absent:  return "#878a8c";
        }
    }

    function getKeyW(key: string): number {
        return (key === "ENT" || key === "⌫") ? gridWidth * SPECIAL_KEY_FRACTION : KEY_W;
    }

    function getKeyBgColor(key: string): string {
        if (key === "ENT" || key === "\u232B") return "#878a8c";
        return keyColors.get(key) ?? "#D3D6DA";
    }

    function getKeyTextColor(key: string): string {
        if (key === "ENT" || key === "\u232B") return "#fff";
        const bg = getKeyBgColor(key);
        const r  = parseInt(bg.slice(1, 3), 16);
        const g  = parseInt(bg.slice(3, 5), 16);
        const b  = parseInt(bg.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? "#000" : "#fff";
    }

    // ─── render scheduling ───────────────────────────────────────────────────

    function requestRedraw(): void {
        if (!redrawPending && !destroyed) {
            redrawPending = true;
            animFrameId   = requestAnimationFrame(render);
        }
    }

    function scheduleNextFrame(): void {
        if (!destroyed) {
            animFrameId = requestAnimationFrame(render);
        }
    }

    // ─── rendering ───────────────────────────────────────────────────────────

    function render(): void {
        if (destroyed) return;
        redrawPending = false;

        ctx.clearRect(0, 0, gridWidth, gridHeight + KEYBOARD_HEIGHT + KEYBOARD_PADDING);

        if (DRAW_DEBUG_GRID) {
            drawGrid(ctx, 0, 0, gridWidth, gridHeight, GRID_SIZE, GRID_SIZE, GRID_COLOR);
        }

        for (let row = 0; row < guesses.length; row++) {
            if (flipAnim.active && row === flipAnim.row) {
                drawWordAnimating(row);
            } else {
                drawWord(guesses[row]!, row);
            }
        }

        const letters     = currentGuess.split("");
        const shakeOffset = getShakeOffset();
        if (shakeOffset !== 0) { ctx.save(); ctx.translate(shakeOffset, 0); }
        for (let col = 0; col < letters.length; col++) {
            const char = letters[col];
            if (!char) continue;
            drawCharacter(char, currentRow, col);
        }
        if (shakeOffset !== 0) ctx.restore();

        drawOnScreenKeyboard();

        if (flipAnim.active) {
            const elapsed = performance.now() - flipAnim.startTime;
            if (elapsed >= FLIP_DURATION + FLIP_DELAY) {
                flipAnim.tile++;
                if (flipAnim.tile >= MAX_COLS) {
                    flipAnim.active = false;
                    updateKeyboardColors();
                    checkGameState();
                    if (currentState === GameState.Won || currentState === GameState.Lost) {
                        setTimeout(showGameEndModal, 400);
                    }
                } else {
                    flipAnim.startTime = performance.now();
                }
            }
            scheduleNextFrame();
        }

        if (shakeAnim.active) {
            scheduleNextFrame();
        }
    }

    function drawCharacter(char: string, row: number, col: number): void {
        char    = char.toUpperCase();
        const x = GRID_SIZE * col + GRID_SIZE / 2;
        const y = GRID_SIZE * row + GRID_SIZE / 2 + 2;
        drawText(ctx, char, x, y, "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
    }

    function drawRoundRect(row: number, col: number, color: string): void {
        const padding = GRID_SIZE * 0.1;
        const x       = GRID_SIZE * col + padding / 2;
        const y       = GRID_SIZE * row + padding / 2;
        const size    = GRID_SIZE - padding;
        fillRoundedRect(ctx, x, y, size, size, 10, color);
    }

    function drawFlipTile(row: number, col: number, char: string, progress: number): void {
        const padding = GRID_SIZE * 0.1;
        const x       = GRID_SIZE * col + padding / 2;
        const y       = GRID_SIZE * row + padding / 2;
        const size    = GRID_SIZE - padding;
        const centerY = GRID_SIZE * row + GRID_SIZE / 2;

        let scaleY: number;
        let bgColor: string;
        if (progress <= 0.5) {
            scaleY  = 1 - 2 * progress;
            bgColor = "#EEE";
        } else {
            scaleY  = 2 * progress - 1;
            bgColor = letterStateColor(gridColors[row]?.[col] ?? LetterState.Absent);
        }

        ctx.save();
        ctx.translate(0, centerY);
        ctx.scale(1, Math.max(scaleY, 0.001));
        ctx.translate(0, -centerY);
        fillRoundedRect(ctx, x, y, size, size, 10, bgColor);
        drawText(ctx, char.toUpperCase(),
            GRID_SIZE * col + GRID_SIZE / 2, GRID_SIZE * row + GRID_SIZE / 2 + 2,
            "#000", `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
        ctx.restore();
    }

    function drawWordAnimating(row: number): void {
        const word         = guesses[row]!.toUpperCase();
        const letters      = word.split("");
        const elapsed      = performance.now() - flipAnim.startTime;
        const tileProgress = Math.min(elapsed / FLIP_DURATION, 1);

        for (let col = 0; col < MAX_COLS; col++) {
            if (col < flipAnim.tile) {
                drawRoundRect(row, col, letterStateColor(gridColors[row]?.[col] ?? LetterState.Absent));
                drawCharacter(letters[col]!, row, col);
            } else if (col === flipAnim.tile) {
                drawFlipTile(row, col, letters[col]!, tileProgress);
            } else {
                drawCharacter(letters[col]!, row, col);
            }
        }
    }

    function drawWord(word: string, row: number): void {
        word = word.toUpperCase();
        const letters = word.split("");
        if (letters.length !== MAX_COLS) throw new Error(`Word must have exactly ${MAX_COLS} letters`);
        const states = gridColors[row] ?? colorsForGuess(word);
        for (let col = 0; col < MAX_COLS; col++) {
            drawRoundRect(row, col, letterStateColor(states[col]!));
            drawCharacter(letters[col]!, row, col);
        }
    }

    function drawOnScreenKeyboard(): void {
        keyHitAreas    = [];
        const kbY = gridHeight + KEYBOARD_PADDING;

        KB_ROWS.forEach((row, rowIdx) => {
            const rowWidth = row.reduce((s, k) => s + getKeyW(k), 0) + (row.length - 1) * KEY_GAP;
            const startX   = (gridWidth - rowWidth) / 2;
            const rowY     = kbY + rowIdx * (KEY_H + KEY_GAP);

            let xCursor = startX;
            row.forEach((key, i) => {
                const kw    = getKeyW(key);
                fillRoundedRect(ctx, xCursor, rowY, kw, KEY_H, KEY_RADIUS, getKeyBgColor(key));
                const label    = key === "⌫" ? "\u232B" : key;
                const fontSize = Math.round(KEY_W * 0.6);
                drawText(ctx, label, xCursor + kw / 2, rowY + KEY_H / 2 + 2,
                    getKeyTextColor(key), `${fontSize}px Arial`, "center", "middle");
                keyHitAreas.push({ key, x: xCursor, y: rowY, w: kw, h: KEY_H });
                xCursor += kw + (i < row.length - 1 ? KEY_GAP : 0);
            });
        });
    }

    // ─── game logic ──────────────────────────────────────────────────────────

    function colorsForGuess(word: string): LetterState[] {
        const guess  = word.toUpperCase().split("");
        const secret = SECRET_WORD.split("");
        const result: LetterState[] = new Array(MAX_COLS).fill(LetterState.Absent);

        const unmatchedSecret: Record<string, number> = {};
        for (let i = 0; i < MAX_COLS; i++) {
            if (guess[i] === secret[i]) {
                result[i] = LetterState.Correct;
            } else {
                unmatchedSecret[secret[i]!] = (unmatchedSecret[secret[i]!] ?? 0) + 1;
            }
        }

        for (let i = 0; i < MAX_COLS; i++) {
            if (result[i] === LetterState.Correct) continue;
            const letter = guess[i]!;
            if ((unmatchedSecret[letter] ?? 0) > 0) {
                result[i] = LetterState.Present;
                unmatchedSecret[letter]!--;
            }
        }

        return result;
    }

    function updateGridColors(): void {
        gridColors = guesses.map(g => colorsForGuess(g));
    }

    function updateKeyboardColors(): void {
        keyColors = new Map();
        for (let i = 0; i < guesses.length; i++) {
            const letters = guesses[i]!.toUpperCase().split("");
            const states  = gridColors[i]!;
            for (let col = 0; col < letters.length; col++) {
                const letter   = letters[col]!;
                const state    = states[col]!;
                const newColor = letterStateKeyColor(state);
                const existing = keyColors.get(letter);
                if (existing === letterStateColor(LetterState.Correct)) continue;
                if (state === LetterState.Correct ||
                    (state === LetterState.Present && existing !== letterStateColor(LetterState.Correct)) ||
                    !existing) {
                    keyColors.set(letter, newColor);
                }
            }
        }
    }

    function checkGameState(): void {
        if (guesses[guesses.length - 1] === SECRET_WORD) {
            currentState = GameState.Won;
        } else if (guesses.length >= MAX_ROWS) {
            currentState = GameState.Lost;
        } else {
            currentState = GameState.Playing;
        }
    }

    function showGameEndModal(): void {
        const modal  = document.getElementById("modal");
        const title  = document.getElementById("modal-title");
        const wordEl = document.getElementById("modal-word");
        if (!modal || !title || !wordEl) return;
        if (currentState === GameState.Won) {
            title.textContent  = `You got it in ${guesses.length}!`;
            wordEl.textContent = `The word was ${SECRET_WORD}`;
        } else {
            title.textContent  = "Better luck next time";
            wordEl.textContent = `The word was ${SECRET_WORD}`;
        }
        modal.classList.remove("hidden");
    }

    function guessWord(_word: string): void {
        checkGameState();
        if (!AllWords.includes(currentGuess.toLowerCase())) {
            startShakeAnimation();
            return;
        }
        guesses.push(currentGuess);
        usedKeys     = new Set([...usedKeys, ...currentGuess.split("")]);
        currentGuess = "";
        updateGridColors();
        startFlipAnimation(guesses.length - 1);
    }

    // ─── animations ──────────────────────────────────────────────────────────

    function getShakeOffset(): number {
        if (!shakeAnim.active) return 0;
        const elapsed = performance.now() - shakeAnim.startTime;
        if (elapsed >= SHAKE_DURATION) { shakeAnim.active = false; return 0; }
        const progress = elapsed / SHAKE_DURATION;
        return SHAKE_AMPLITUDE * Math.sin(progress * Math.PI * 4) * (1 - progress);
    }

    function startShakeAnimation(): void {
        shakeAnim = { active: true, startTime: performance.now() };
        scheduleNextFrame();
    }

    function startFlipAnimation(row: number): void {
        flipAnim = { active: true, row, tile: 0, startTime: performance.now() };
        scheduleNextFrame();
    }

    // ─── input ───────────────────────────────────────────────────────────────

    function handleKeyInput(key: string, source: "keyboard" | "touch" | "mouse"): void {
        const now = Date.now();
        if (source === "keyboard" && now - lastKeyPressTime < KEY_PRESS_DEBOUNCE && lastInputSource === "keyboard") return;
        lastKeyPressTime = now;
        lastInputSource  = source;

        if (flipAnim.active) return;

        currentRow = guesses.length;
        if (currentRow >= MAX_ROWS) return;

        if (key === "Backspace" || key === "Bksp" || key === "⌫") {
            if (currentGuess.length > 0) {
                currentGuess = currentGuess.slice(0, -1);
                requestRedraw();
            }
        } else if (key === "Enter" || key === "ENT") {
            if (currentState === GameState.Playing && currentGuess.length === MAX_COLS) {
                guessWord(currentGuess);
                requestRedraw();
            }
        } else if (key.length === 1 && /^[A-Za-z]$/.test(key)) {
            if (currentState === GameState.Playing && currentGuess.length < MAX_COLS) {
                currentGuess += key.toUpperCase();
                requestRedraw();
            }
        }
    }

    function handleCanvasClick(clientX: number, clientY: number, source: "mouse" | "touch"): void {
        const rect = canvas.getBoundingClientRect();
        const mx   = clientX - rect.left;
        const my   = clientY - rect.top;
        for (const hit of keyHitAreas) {
            if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
                handleKeyInput(hit.key, source);
                break;
            }
        }
    }

    // ─── lifecycle ───────────────────────────────────────────────────────────

    async function start(): Promise<void> {
        destroyed = false;

        // Reset all game state
        SECRET_WORD   = "";
        guesses       = [];
        currentGuess  = "";
        currentRow    = 0;
        usedKeys      = new Set();
        keyColors     = new Map();
        gridColors    = [];
        currentState  = GameState.Playing;
        redrawPending = false;
        flipAnim      = { active: false, row: 0, tile: 0, startTime: 0 };
        shakeAnim     = { active: false, startTime: 0 };
        
        // Calculate all dimensions based on current viewport
        calculateDimensions();
        resizeCanvas();

        const [solWords, nonsolWords] = await Promise.all([
            loadWords("src/solutions_nyt.txt"),
            loadWords("src/nonsolutions_nyt.txt"),
        ]);
        AllWords    = [...solWords, ...nonsolWords];
        SECRET_WORD = solWords[Math.floor(Math.random() * solWords.length)]!.toUpperCase();

        // Ensure modal is hidden from any prior game session
        document.getElementById("modal")?.classList.add("hidden");

        // Register event listeners (fresh references each time for clean removal)
        _onKeyDown           = (e: KeyboardEvent) => handleKeyInput(e.key, "keyboard");
        _onResize            = updateKeyboardDimensions;
        _onOrientationChange = updateKeyboardDimensions;
        _onMouseUp           = (e: MouseEvent) => handleCanvasClick(e.clientX, e.clientY, "mouse");
        _onTouchStart        = (e: TouchEvent) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            if (touch) handleCanvasClick(touch.clientX, touch.clientY, "touch");
        };
        _onModalBtn = () => {
            destroy();
            void start();
        };

        document.addEventListener("keydown", _onKeyDown);
        window.addEventListener("resize", _onResize);
        window.addEventListener("orientationchange", _onOrientationChange);
        canvas.addEventListener("mouseup", _onMouseUp);
        canvas.addEventListener("touchstart", _onTouchStart, { passive: false });
        document.getElementById("modal-btn")?.addEventListener("click", _onModalBtn);

        requestRedraw();
    }

    function destroy(): void {
        destroyed = true;
        if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        document.removeEventListener("keydown", _onKeyDown);
        window.removeEventListener("resize", _onResize);
        window.removeEventListener("orientationchange", _onOrientationChange);
        canvas.removeEventListener("mouseup", _onMouseUp);
        canvas.removeEventListener("touchstart", _onTouchStart);
        document.getElementById("modal-btn")?.removeEventListener("click", _onModalBtn);
        document.getElementById("modal")?.classList.add("hidden");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return { start, destroy };
}
