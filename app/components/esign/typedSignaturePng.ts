/** Browser-only: script-style typed signature as PNG, cropped to the ink. */

function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 12) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return source;
  const pad = 8;
  const sx = Math.max(0, left - pad);
  const sy = Math.max(0, top - pad);
  const sw = Math.min(width - sx, right - left + 1 + pad * 2);
  const sh = Math.min(height - sy, bottom - top + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const octx = out.getContext("2d");
  if (!octx) return source;
  octx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function trimSignatureCanvas(source: HTMLCanvasElement): string {
  return trimCanvas(source).toDataURL("image/png");
}

export function typedSignaturePng(name: string): string {
  const text = name.trim();
  if (!text || typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "italic 72px Georgia, 'Times New Roman', serif";
  ctx.fillText(text, 24, 140);
  return trimCanvas(canvas).toDataURL("image/png");
}
