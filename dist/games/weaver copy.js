import { fillRoundedRect, drawText } from "../cage.js";
export function createWeaverGame(canvas, ctx) {
    // Keyboard sizing and layout mirrors Wordle so keys feel identical.
    const KEYBOARD_PADDING = 10;
    const KEYBOARD_HEIGHT_PCT = 0.25;
    const MIN_KEYBOARD_HEIGHT = 80;
    const MAX_KEYBOARD_HEIGHT = 220;
    const KEY_GAP = 4;
    const KEY_RADIUS = 6;
    const SPECIAL_KEY_FRACTION = 0.13;
    const PIXEL_RATIO = 300 / 96;
    const MENU_BAR_HEIGHT = 48;
    const KB_ROWS = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENT", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
    ];
    const MAX_INPUT_CHARS = 12;
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
    function calcKeyboardHeight() {
        const t = window.innerHeight * KEYBOARD_HEIGHT_PCT;
        return Math.max(MIN_KEYBOARD_HEIGHT, Math.min(MAX_KEYBOARD_HEIGHT, t));
    }
    function calculateDimensions() {
        const constraint = Math.min(window.innerWidth, window.innerHeight - MENU_BAR_HEIGHT);
        CANVAS_WIDTH = window.innerWidth > 600 ? Math.min(500, constraint) : constraint;
        KEYBOARD_HEIGHT = calcKeyboardHeight();
        KEY_W = (CANVAS_WIDTH / 10) - 5;
        KEY_H = (KEYBOARD_HEIGHT / 3) - 5;
        PLAYFIELD_HEIGHT = Math.max(180, Math.round(CANVAS_WIDTH * 0.9));
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
        calculateDimensions();
        if (oldWidth !== CANVAS_WIDTH || oldHeight !== KEYBOARD_HEIGHT) {
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
    function drawTemplatePanel() {
        const panelX = 20;
        const panelY = 18;
        const panelW = CANVAS_WIDTH - 40;
        const panelH = PLAYFIELD_HEIGHT - 36;
        fillRoundedRect(ctx, panelX, panelY, panelW, panelH, 14, "#f5f5f5");
        drawText(ctx, "New Game Template", panelX + 16, panelY + 18, "#1f2937", "bold 20px Arial");
        drawText(ctx, "TODO: Replace this panel with your game scene.", panelX + 16, panelY + 54, "#374151", "16px Arial");
        drawText(ctx, "Input buffer:", panelX + 16, panelY + 90, "#111827", "bold 14px Arial");
        drawText(ctx, userInput || "(empty)", panelX + 16, panelY + 113, "#111827", "20px Arial");
        drawText(ctx, `Last action: ${lastAction}`, panelX + 16, panelY + 148, "#4b5563", "14px Arial");
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
        drawTemplatePanel();
        drawOnScreenKeyboard();
    }
    function handleTemplateInput(key) {
        if (key === "Backspace" || key === "Bksp" || key === "⌫") {
            userInput = userInput.slice(0, -1);
            lastAction = "Deleted one character";
        }
        else if (key === "Enter" || key === "ENT") {
            lastAction = userInput.length > 0 ? `Submit placeholder: ${userInput}` : "Submit placeholder: (empty)";
        }
        else if (key.length === 1 && /^[A-Za-z]$/.test(key)) {
            if (userInput.length < MAX_INPUT_CHARS) {
                userInput += key.toUpperCase();
                lastAction = `Added ${key.toUpperCase()}`;
            }
        }
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
        destroyed = false;
        userInput = "";
        lastAction = "Start typing to wire your new game logic.";
        redrawPending = false;
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
        document.addEventListener("keydown", _onKeyDown);
        window.addEventListener("resize", _onResize);
        window.addEventListener("orientationchange", _onOrientationChange);
        canvas.addEventListener("mouseup", _onMouseUp);
        canvas.addEventListener("touchstart", _onTouchStart, { passive: false });
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return { start, destroy };
}
//# sourceMappingURL=weaver%20copy.js.map