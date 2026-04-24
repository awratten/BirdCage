export function drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = "#000",
    lineWidth: number = 1
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

export function drawRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string = "#000",
    lineWidth: number = 1
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string = "#000"
): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}

export function drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string = "#000",
    lineWidth: number = 1
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

export function fillCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string = "#000"
): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    gridWidth: number,
    gridHeight: number,
    color: string = "#AAA",
    lineWidth: number = 1
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (let x = 0; x <= width; x += gridWidth) {
        ctx.beginPath();
        ctx.moveTo(x + offsetX, offsetY);
        ctx.lineTo(x + offsetX, height + offsetY);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridHeight) {
        ctx.beginPath();
        ctx.moveTo(offsetX, y + offsetY);
        ctx.lineTo(width + offsetX, y + offsetY);
        ctx.stroke();
    }
    ctx.restore();
}

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string = "#000",
    font: string = "16px sans-serif",
    textAlign: CanvasTextAlign = "left",
    textBaseline: CanvasTextBaseline = "top"
): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y);
    ctx.restore();
}

export function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: string = "#000",
    lineWidth: number = 1
): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

export function fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: string = "#000"
): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function clearCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): void {
    ctx.clearRect(0, 0, width, height);
}
