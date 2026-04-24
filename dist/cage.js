export function drawLine(ctx, x1, y1, x2, y2, color = "#000", lineWidth = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}
export function drawRect(ctx, x, y, w, h, color = "#000", lineWidth = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}
export function fillRect(ctx, x, y, w, h, color = "#000") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}
export function drawCircle(ctx, x, y, radius, color = "#000", lineWidth = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
export function fillCircle(ctx, x, y, radius, color = "#000") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
export function drawGrid(ctx, offsetX, offsetY, width, height, gridWidth, gridHeight, color = "#AAA", lineWidth = 1) {
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
export function drawText(ctx, text, x, y, color = "#000", font = "16px sans-serif", textAlign = "left", textBaseline = "top") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y);
    ctx.restore();
}
export function drawRoundedRect(ctx, x, y, w, h, radius, color = "#000", lineWidth = 1) {
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
export function fillRoundedRect(ctx, x, y, w, h, radius, color = "#000") {
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
export function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
}
//# sourceMappingURL=cage.js.map