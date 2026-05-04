import { fillRoundedRect, drawText } from "../cage.js";
var GameState;
(function (GameState) {
    GameState["Playing"] = "playing";
    GameState["Won"] = "won";
    GameState["Lost"] = "lost";
})(GameState || (GameState = {}));
export function createWeaverGame(canvas, ctx) {
    // Keyboard sizing and layout mirrors Wordle so keys feel identical.
    const MAX_COLS = 4;
    const MAX_VISIBLE_GUESSES = 2;
    const KEYBOARD_PADDING = 10;
    const KEYBOARD_HEIGHT_PCT = 0.25;
    const MIN_KEYBOARD_HEIGHT = 80;
    const MAX_KEYBOARD_HEIGHT = 220;
    const KEY_GAP = 4;
    const KEY_RADIUS = 6;
    const SPECIAL_KEY_FRACTION = 0.13;
    const PIXEL_RATIO = 300 / 96;
    const MENU_BAR_HEIGHT = 48;
    const BASE_COLS = MAX_COLS;
    let GRID_SIZE = 0;
    let FONT_SIZE = 0;
    let BOARD_TOP = 0;
    let BOARD_COLS = BASE_COLS;
    let BOARD_ROWS = 3;
    let startWord = "WIND";
    let targetWord = "SAIL";
    let guesses = [];
    let gameState = GameState.Playing;
    let validWords = new Set();
    let wordList = [];
    let wildcardBuckets = new Map();
    let optimalMoves = 0;
    let optimalWordsBetween = 0;
    const KB_ROWS = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENT", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
    ];
    let CANVAS_WIDTH = 0;
    let PLAYFIELD_HEIGHT = 0;
    let KEYBOARD_HEIGHT = 0;
    let KEY_W = 0;
    let KEY_H = 0;
    let keyHitAreas = [];
    let userInput = "";
    let lastAction = "Start typing to wire your new game logic.";
    let redrawPending = false;
    let animFrameId = null;
    let destroyed = false;
    let _onKeyDown = () => { };
    let _onResize = () => { };
    let _onOrientationChange = () => { };
    let _onMouseUp = () => { };
    let _onTouchStart = () => { };
    let _onModalBtn = () => { };
    function calcKeyboardHeight() {
        const t = window.innerHeight * KEYBOARD_HEIGHT_PCT;
        return Math.max(MIN_KEYBOARD_HEIGHT, Math.min(MAX_KEYBOARD_HEIGHT, t));
    }
    async function loadWords(url) {
        const response = await fetch(url);
        const text = await response.text();
        return Array.from(new Set(text
            .split("\n")
            .map((w) => w.trim().toUpperCase())
            .filter((w) => w.length === MAX_COLS)));
    }
    function isValidWord(word) {
        return validWords.has(word.toUpperCase());
    }
    function randomIndex(maxExclusive) {
        return Math.floor(Math.random() * maxExclusive);
    }
    function buildWildcardBuckets(words) {
        const buckets = new Map();
        for (const word of words) {
            for (let i = 0; i < MAX_COLS; i++) {
                const pattern = `${word.slice(0, i)}*${word.slice(i + 1)}`;
                const list = buckets.get(pattern);
                if (list) {
                    list.push(word);
                }
                else {
                    buckets.set(pattern, [word]);
                }
            }
        }
        return buckets;
    }
    function getNeighbors(word) {
        const neighbors = new Set();
        for (let i = 0; i < MAX_COLS; i++) {
            const pattern = `${word.slice(0, i)}*${word.slice(i + 1)}`;
            const bucket = wildcardBuckets.get(pattern);
            if (!bucket)
                continue;
            for (const candidate of bucket) {
                if (candidate !== word)
                    neighbors.add(candidate);
            }
        }
        return Array.from(neighbors);
    }
    function getShortestMoveCount(start, target) {
        if (start === target)
            return 0;
        const queue = [start];
        const distance = new Map([[start, 0]]);
        for (let head = 0; head < queue.length; head++) {
            const current = queue[head];
            const currentDistance = distance.get(current);
            for (const next of getNeighbors(current)) {
                if (distance.has(next))
                    continue;
                const nextDistance = currentDistance + 1;
                if (next === target)
                    return nextDistance;
                distance.set(next, nextDistance);
                queue.push(next);
            }
        }
        return -1;
    }
    function getShortestPath(start, target) {
        if (start === target)
            return [start];
        const queue = [start];
        const parent = new Map([[start, null]]);
        for (let head = 0; head < queue.length; head++) {
            const current = queue[head];
            for (const next of getNeighbors(current)) {
                if (parent.has(next))
                    continue;
                parent.set(next, current);
                if (next === target) {
                    const path = [];
                    let cursor = target;
                    while (cursor !== null) {
                        path.push(cursor);
                        cursor = parent.get(cursor) ?? null;
                    }
                    path.reverse();
                    return path;
                }
                queue.push(next);
            }
        }
        return [];
    }
    function getPuzzleMetrics(start, target) {
        if (start === target) {
            return { valid: false, optimalMoves: 0, optimalWordsBetween: 0 };
        }
        const optimalMoves = getShortestMoveCount(start, target);
        if (optimalMoves <= 0) {
            return { valid: false, optimalMoves: 0, optimalWordsBetween: 0 };
        }
        return {
            valid: true,
            optimalMoves,
            optimalWordsBetween: Math.max(0, optimalMoves - 1),
        };
    }
    function pickRandomPuzzlePair(words) {
        if (words.length < 2) {
            throw new Error("Need at least two words to create a Weaver puzzle");
        }
        const maxAttempts = Math.min(2000, words.length * 20);
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const start = words[randomIndex(words.length)];
            const target = words[randomIndex(words.length)];
            if (target === start)
                continue;
            const metrics = getPuzzleMetrics(start, target);
            if (!metrics.valid)
                continue;
            return { start, target, optimalMoves: metrics.optimalMoves, optimalWordsBetween: metrics.optimalWordsBetween };
        }
        for (const start of words) {
            for (const target of words) {
                const metrics = getPuzzleMetrics(start, target);
                if (!metrics.valid)
                    continue;
                return {
                    start,
                    target,
                    optimalMoves: metrics.optimalMoves,
                    optimalWordsBetween: metrics.optimalWordsBetween,
                };
            }
        }
        throw new Error("Could not find a connected start/target pair");
    }
    function differsByOneLetter(candidate, previous) {
        if (candidate.length !== previous.length)
            return false;
        let diffCount = 0;
        for (let i = 0; i < candidate.length; i++) {
            if (candidate[i] !== previous[i]) {
                diffCount++;
                if (diffCount > 1)
                    return false;
            }
        }
        return diffCount === 1;
    }
    function getBoardCols() {
        let longest = Math.max(BASE_COLS, startWord.length, targetWord.length, userInput.length);
        for (const guess of getVisibleGuesses()) {
            longest = Math.max(longest, guess.length);
        }
        return longest;
    }
    function getVisibleGuesses() {
        if (guesses.length <= MAX_VISIBLE_GUESSES)
            return guesses;
        return guesses.slice(guesses.length - MAX_VISIBLE_GUESSES);
    }
    function getCollapsedGuessCount() {
        return Math.max(0, guesses.length - MAX_VISIBLE_GUESSES);
    }
    function getBoardRows() {
        // start row + optional collapsed row + visible guesses + optional input row + target row
        const collapsedRowCount = getCollapsedGuessCount() > 0 ? 1 : 0;
        const visibleGuessRows = getVisibleGuesses().length;
        const inputRowCount = gameState === GameState.Playing ? 1 : 0;
        return visibleGuessRows + collapsedRowCount + 2 + inputRowCount;
    }
    function calculateDimensions() {
        const constraint = Math.min(window.innerWidth, window.innerHeight - MENU_BAR_HEIGHT);
        CANVAS_WIDTH = window.innerWidth > 600 ? Math.min(500, constraint) : constraint;
        BOARD_COLS = getBoardCols();
        BOARD_ROWS = getBoardRows();
        GRID_SIZE = CANVAS_WIDTH / BOARD_COLS;
        FONT_SIZE = GRID_SIZE * 0.5;
        BOARD_TOP = Math.round(GRID_SIZE * 0.12);
        KEYBOARD_HEIGHT = calcKeyboardHeight();
        KEY_W = (CANVAS_WIDTH / 10) - 5;
        KEY_H = (KEYBOARD_HEIGHT / 3) - 5;
        PLAYFIELD_HEIGHT = Math.round(BOARD_TOP + GRID_SIZE * BOARD_ROWS + GRID_SIZE * 0.12);
    }
    function resizeCanvas() {
        canvas.width = CANVAS_WIDTH * PIXEL_RATIO;
        canvas.height = (PLAYFIELD_HEIGHT + KEYBOARD_HEIGHT + KEYBOARD_PADDING) * PIXEL_RATIO;
        canvas.style.width = `${CANVAS_WIDTH}px`;
        canvas.style.height = `${PLAYFIELD_HEIGHT + KEYBOARD_HEIGHT + KEYBOARD_PADDING}px`;
        ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
        ctx.imageSmoothingEnabled = true;
    }
    function updateDimensions() {
        const oldWidth = CANVAS_WIDTH;
        const oldHeight = KEYBOARD_HEIGHT;
        const oldPlayfieldHeight = PLAYFIELD_HEIGHT;
        const oldGridSize = GRID_SIZE;
        calculateDimensions();
        if (oldWidth !== CANVAS_WIDTH
            || oldHeight !== KEYBOARD_HEIGHT
            || oldPlayfieldHeight !== PLAYFIELD_HEIGHT
            || oldGridSize !== GRID_SIZE) {
            resizeCanvas();
            requestRedraw();
        }
    }
    function requestRedraw() {
        if (!redrawPending && !destroyed) {
            redrawPending = true;
            animFrameId = requestAnimationFrame(render);
        }
    }
    function getKeyW(key) {
        return (key === "ENT" || key === "⌫") ? CANVAS_WIDTH * SPECIAL_KEY_FRACTION : KEY_W;
    }
    function getKeyBgColor(key) {
        if (key === "ENT" || key === "⌫")
            return "#878a8c";
        return "#D3D6DA";
    }
    function getKeyTextColor(key) {
        return (key === "ENT" || key === "⌫") ? "#fff" : "#111";
    }
    function drawRoundRect(row, col, color = "#EEE") {
        const padding = GRID_SIZE * 0.1;
        const x = GRID_SIZE * col + padding / 2;
        const y = BOARD_TOP + GRID_SIZE * row + padding / 2;
        const size = GRID_SIZE - padding;
        fillRoundedRect(ctx, x, y, size, size, 10, color);
    }
    function drawCharacter(char, row, col, color = "#000") {
        char = char.toUpperCase();
        const x = GRID_SIZE * col + GRID_SIZE / 2;
        const y = BOARD_TOP + GRID_SIZE * row + GRID_SIZE / 2 + 2;
        drawText(ctx, char, x, y, color, `${Math.round(FONT_SIZE)}px Arial`, "center", "middle");
    }
    function isCorrectColumnLetter(letter, col) {
        if (!letter)
            return false;
        return letter.toUpperCase() === (targetWord[col] ?? "").toUpperCase();
    }
    function drawWord(word, row, checkAgainstTarget = false) {
        const letters = word.toUpperCase().split("");
        for (let col = 0; col < BOARD_COLS; col++) {
            const letter = letters[col];
            const isCorrect = checkAgainstTarget && isCorrectColumnLetter(letter, col);
            const tileColor = isCorrect ? "#6aaa64" : "#EEE";
            const textColor = isCorrect ? "#fff" : "#000";
            drawRoundRect(row, col, tileColor);
            if (letter) {
                drawCharacter(letter, row, col, textColor);
            }
        }
    }
    function wasTargetLetterGuessed(letter, col) {
        if (!letter)
            return false;
        for (const guess of guesses) {
            if ((guess[col] ?? "").toUpperCase() === letter.toUpperCase())
                return true;
        }
        return false;
    }
    function drawTargetWord(targetWord, row) {
        const letters = targetWord.toUpperCase().split("");
        for (let col = 0; col < BOARD_COLS; col++) {
            const letter = letters[col];
            const isRevealed = letter ? wasTargetLetterGuessed(letter, col) : false;
            const tileColor = isRevealed ? "#6aaa64" : "#EEE";
            const textColor = isRevealed ? "#fff" : "#000";
            drawRoundRect(row, col, tileColor);
            if (letter) {
                drawCharacter(letter, row, col, textColor);
            }
        }
    }
    function drawCollapsedGuessesRow(row, hiddenCount) {
        for (let col = 0; col < BOARD_COLS; col++) {
            drawRoundRect(row, col, "#DDD");
        }
        const label = hiddenCount === 1 ? "1 older guess" : `${hiddenCount} older guesses`;
        drawText(ctx, label, CANVAS_WIDTH / 2, BOARD_TOP + GRID_SIZE * row + GRID_SIZE / 2 + 1, "#666", `${Math.round(FONT_SIZE * 0.32)}px Arial`, "center", "middle");
    }
    function drawWeaverWords() {
        const visibleGuesses = getVisibleGuesses();
        const collapsedGuessCount = getCollapsedGuessCount();
        let row = 0;
        drawWord(startWord, row++);
        if (collapsedGuessCount > 0) {
            drawCollapsedGuessesRow(row++, collapsedGuessCount);
        }
        for (let i = 0; i < visibleGuesses.length; i++) {
            drawWord(visibleGuesses[i], row + i, true);
        }
        row += visibleGuesses.length;
        const hasInputRow = gameState === GameState.Playing;
        if (hasInputRow) {
            drawWord(userInput, row++);
        }
        drawTargetWord(targetWord, row);
    }
    function drawOnScreenKeyboard() {
        keyHitAreas = [];
        const kbY = PLAYFIELD_HEIGHT + KEYBOARD_PADDING;
        KB_ROWS.forEach((row, rowIdx) => {
            const rowWidth = row.reduce((s, k) => s + getKeyW(k), 0) + (row.length - 1) * KEY_GAP;
            const startX = (CANVAS_WIDTH - rowWidth) / 2;
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
    function render() {
        if (destroyed)
            return;
        redrawPending = false;
        ctx.clearRect(0, 0, CANVAS_WIDTH, PLAYFIELD_HEIGHT + KEYBOARD_HEIGHT + KEYBOARD_PADDING);
        drawWeaverWords();
        drawOnScreenKeyboard();
    }
    function showWonModal() {
        const modal = document.getElementById("modal");
        const title = document.getElementById("modal-title");
        const wordEl = document.getElementById("modal-word");
        if (!modal || !title || !wordEl)
            return;
        title.textContent = `You got it in ${guesses.length}!`;
        wordEl.textContent = `Optimal path: ${optimalMoves} move(s), ${optimalWordsBetween} word(s) between ${startWord} and ${targetWord}.`;
        modal.classList.remove("hidden");
    }
    function makeGuess(word) {
        const guess = word.toUpperCase();
        guesses.push(guess);
        if (guess === targetWord.toUpperCase()) {
            gameState = GameState.Won;
            lastAction = `You won with ${guess}!`;
            showWonModal();
        }
        else {
            lastAction = `Submitted: ${guess}`;
        }
    }
    function handleTemplateInput(key) {
        if (gameState !== GameState.Playing) {
            lastAction = "Game is already finished";
            requestRedraw();
            return;
        }
        if (key === "Backspace" || key === "Bksp" || key === "⌫") {
            userInput = userInput.slice(0, -1);
            lastAction = "Deleted one character";
        }
        else if (key === "Enter" || key === "ENT") {
            if (userInput.length === MAX_COLS) {
                const guess = userInput.toUpperCase();
                const previousWord = (guesses[guesses.length - 1] ?? startWord).toUpperCase();
                if (!isValidWord(guess)) {
                    lastAction = `${guess} is not in the word list`;
                }
                else if (!differsByOneLetter(guess, previousWord)) {
                    lastAction = `Guess must differ by exactly one letter from ${previousWord}`;
                }
                else {
                    makeGuess(guess);
                    userInput = "";
                }
            }
            else {
                lastAction = `Guess must be exactly ${MAX_COLS} letters`;
            }
        }
        else if (key.length === 1 && /^[A-Za-z]$/.test(key)) {
            if (userInput.length < MAX_COLS) {
                userInput += key.toUpperCase();
                lastAction = `Added ${key.toUpperCase()}`;
            }
            else {
                lastAction = `Guess cannot exceed ${MAX_COLS} letters`;
            }
        }
        updateDimensions();
        requestRedraw();
    }
    function handleCanvasClick(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        for (const hit of keyHitAreas) {
            if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
                handleTemplateInput(hit.key);
                break;
            }
        }
    }
    async function start() {
        if (validWords.size === 0) {
            const loadedWords = await loadWords("src/4word.txt");
            wordList = loadedWords;
            validWords = new Set(loadedWords);
            wildcardBuckets = buildWildcardBuckets(wordList);
        }
        const puzzle = pickRandomPuzzlePair(wordList);
        startWord = puzzle.start;
        targetWord = puzzle.target;
        optimalMoves = puzzle.optimalMoves;
        optimalWordsBetween = puzzle.optimalWordsBetween;
        const optimalPath = getShortestPath(startWord, targetWord);
        // if (optimalPath.length > 0) {
        // 	console.debug(
        // 		`[Weaver] optimal path (${optimalPath.length - 1} moves): ${optimalPath.join(" -> ")}`
        // 	);
        // }
        destroyed = false;
        userInput = "";
        guesses = [];
        gameState = GameState.Playing;
        lastAction = `Build a ladder from ${startWord} to ${targetWord}. Optimal: ${optimalWordsBetween} words between.`;
        redrawPending = false;
        document.getElementById("modal")?.classList.add("hidden");
        calculateDimensions();
        resizeCanvas();
        _onKeyDown = (e) => handleTemplateInput(e.key);
        _onResize = updateDimensions;
        _onOrientationChange = updateDimensions;
        _onMouseUp = (e) => handleCanvasClick(e.clientX, e.clientY);
        _onTouchStart = (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            if (touch)
                handleCanvasClick(touch.clientX, touch.clientY);
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
    function destroy() {
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
//# sourceMappingURL=weaver.js.map