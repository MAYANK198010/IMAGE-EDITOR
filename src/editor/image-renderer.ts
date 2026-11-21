import type { AdjustmentState, CropRect, EditableLayer, ImageEditDocument } from "./types";

export const DEFAULT_ADJUSTMENTS: AdjustmentState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  invert: 0,
  vignette: 0,
  grain: 0,
};

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export const FILTER_PRESETS: Array<{ name: string; values: Partial<AdjustmentState> }> = [
  { name: "Original", values: {} },
  { name: "Mono", values: { grayscale: 100, saturation: 0 } },
  { name: "Warm", values: { sepia: 32, saturation: 112, contrast: 106 } },
  { name: "Cool", values: { saturation: 90, contrast: 108, hue: 12 } },
  { name: "Fade", values: { contrast: 84, brightness: 108, saturation: 78 } },
  { name: "Punch", values: { contrast: 128, saturation: 130 } },
  { name: "Vintage", values: { sepia: 45, saturation: 82, contrast: 94, vignette: 25, grain: 8 } },
  { name: "Dream", values: { brightness: 108, saturation: 115, blur: 0.4, vignette: 12 } },
  { name: "Negative", values: { invert: 100, saturation: 80 } },
];

export function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rotatedDimensions(image: HTMLImageElement, degrees: number) {
  const quarterTurn = Math.abs(degrees % 180) === 90;
  return quarterTurn
    ? { width: image.naturalHeight, height: image.naturalWidth }
    : { width: image.naturalWidth, height: image.naturalHeight };
}

export function filterString(adjustments: AdjustmentState) {
  return [
    `brightness(${adjustments.brightness}%)`,
    `contrast(${adjustments.contrast}%)`,
    `saturate(${adjustments.saturation}%)`,
    `blur(${adjustments.blur}px)`,
    `grayscale(${adjustments.grayscale}%)`,
    `sepia(${adjustments.sepia}%)`,
    `hue-rotate(${adjustments.hue}deg)`,
    `invert(${adjustments.invert}%)`,
  ].join(" ");
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawTextLayer(context: CanvasRenderingContext2D, layer: Extract<EditableLayer, { type: "text" }>, width: number, height: number) {
  const x = layer.x * width;
  const y = layer.y * height;
  const boxWidth = Math.max(20, layer.width * width);
  const boxHeight = Math.max(20, layer.height * height);
  const fontSize = Math.max(8, layer.fontSize * width);
  context.save();
  context.translate(x + boxWidth / 2, y + boxHeight / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.font = `${layer.italic ? "italic " : ""}${layer.fontWeight} ${fontSize}px ${layer.fontFamily}`;
  context.textAlign = layer.align;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.shadowColor = layer.shadow ? "rgba(0,0,0,.65)" : "transparent";
  context.shadowBlur = layer.shadow ? fontSize * 0.24 : 0;
  context.shadowOffsetY = layer.shadow ? fontSize * 0.1 : 0;
  const lines = wrapText(context, layer.text, boxWidth * 0.94);
  const lineHeight = fontSize * 1.18;
  const totalHeight = lines.length * lineHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;
  const anchorX = layer.align === "left" ? -boxWidth / 2 : layer.align === "right" ? boxWidth / 2 : 0;
  context.fillStyle = layer.color;
  if (layer.outlineWidth > 0) {
    context.strokeStyle = layer.outline;
    context.lineWidth = layer.outlineWidth * width * 0.006;
  }
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    if (layer.outlineWidth > 0) context.strokeText(line, anchorX, lineY, boxWidth);
    context.fillText(line, anchorX, lineY, boxWidth);
  });
  context.restore();
}

function drawShapeLayer(context: CanvasRenderingContext2D, layer: Extract<EditableLayer, { type: "shape" }>, width: number, height: number) {
  const x = layer.x * width;
  const y = layer.y * height;
  const w = layer.width * width;
  const h = layer.height * height;
  context.save();
  context.translate(x + w / 2, y + h / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.beginPath();
  if (layer.shape === "ellipse") context.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (layer.shape === "line") {
    context.moveTo(-w / 2, 0);
    context.lineTo(w / 2, 0);
  } else if (layer.shape === "star") {
    const points = 5;
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? Math.min(w, h) / 2 : Math.min(w, h) / 4;
      const angle = -Math.PI / 2 + (i * Math.PI) / points;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  } else roundedRect(context, -w / 2, -h / 2, w, h, layer.radius * width);
  if (layer.shape !== "line" && layer.fill !== "transparent") {
    context.fillStyle = layer.fill;
    context.fill();
  }
  if (layer.strokeWidth > 0) {
    context.strokeStyle = layer.stroke;
    context.lineWidth = layer.strokeWidth * width * 0.004;
    context.stroke();
  }
  context.restore();
}

function drawFrameLayer(context: CanvasRenderingContext2D, layer: Extract<EditableLayer, { type: "frame" }>, width: number, height: number) {
  const inset = Math.max(4, layer.thickness * width * 0.006);
  const line = Math.max(2, inset * 0.12);
  context.save();
  if (layer.style === "polaroid") {
    context.fillStyle = layer.color;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";
    context.fillRect(inset, inset, width - inset * 2, height - inset * 2 - inset * 0.9);
    context.globalCompositeOperation = "source-over";
  } else if (layer.style === "film") {
    context.fillStyle = layer.color;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";
    context.fillRect(inset * 1.5, inset, width - inset * 3, height - inset * 2);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = layer.secondaryColor;
    const perforation = Math.max(5, inset * 0.5);
    const holeSize = Math.max(2, inset * 0.18);
    for (let x = inset * 0.45; x < width - inset * 0.4; x += perforation) {
      context.fillRect(x, inset * 0.35, holeSize, holeSize);
      context.fillRect(x, height - inset * 0.35 - holeSize, holeSize, holeSize);
    }
  } else if (layer.style === "neon") {
    context.shadowColor = layer.color;
    context.shadowBlur = inset * 1.4;
    context.strokeStyle = layer.color;
    context.lineWidth = line * 2;
    context.strokeRect(inset * 1.5, inset * 1.5, width - inset * 3, height - inset * 3);
  } else {
    context.strokeStyle = layer.color;
    context.lineWidth = inset;
    context.strokeRect(inset / 2, inset / 2, width - inset, height - inset);
    if (layer.style === "double") {
      context.strokeStyle = layer.secondaryColor;
      context.lineWidth = line;
      context.strokeRect(inset * 1.7, inset * 1.7, width - inset * 3.4, height - inset * 3.4);
    }
  }
  context.restore();
}

function drawImageLayer(context: CanvasRenderingContext2D, layer: Extract<EditableLayer, { type: "image" }>, width: number, height: number) {
  if (!layer.image) return;
  const x = layer.x * width;
  const y = layer.y * height;
  const w = layer.width * width;
  const h = layer.height * height;
  context.save();
  context.translate(x + w / 2, y + h / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.drawImage(layer.image, -w / 2, -h / 2, w, h);
  context.restore();
}

function layerBounds(layer: EditableLayer, width: number, height: number) {
  return {
    x: layer.x * width,
    y: layer.y * height,
    width: layer.width * width,
    height: layer.height * height,
  };
}

export function hitTestLayer(layers: EditableLayer[], x: number, y: number, width: number, height: number) {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!layer.visible || layer.locked) continue;
    const bounds = layerBounds(layer, width, height);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const angle = (-layer.rotation * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + cx;
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + cy;
    if (localX >= bounds.x && localX <= bounds.x + bounds.width && localY >= bounds.y && localY <= bounds.y + bounds.height) {
      return layer.id;
    }
  }
  return null;
}

export function renderImageDocument(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  documentState: ImageEditDocument,
  options: { scale?: number; selection?: boolean; previewOriginal?: boolean } = {},
) {
  const scale = Math.max(0.1, options.scale ?? 1);
  const { width: sourceWidth, height: sourceHeight } = rotatedDimensions(image, documentState.rotation);
  const crop = options.previewOriginal ? FULL_CROP : documentState.crop;
  const cropX = Math.round(crop.x * sourceWidth);
  const cropY = Math.round(crop.y * sourceHeight);
  const outputWidth = Math.max(1, Math.round(crop.width * sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(crop.height * sourceHeight * scale));
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const transformed = document.createElement("canvas");
  transformed.width = sourceWidth;
  transformed.height = sourceHeight;
  const transformedContext = transformed.getContext("2d");
  if (!transformedContext) return;
  transformedContext.save();
  transformedContext.translate(sourceWidth / 2, sourceHeight / 2);
  transformedContext.rotate((options.previewOriginal ? 0 : documentState.rotation) * Math.PI / 180);
  transformedContext.scale(
    options.previewOriginal ? 1 : documentState.flipX ? -1 : 1,
    options.previewOriginal ? 1 : documentState.flipY ? -1 : 1,
  );
  if (!options.previewOriginal) {
    transformedContext.filter = filterString(documentState.adjustments);
  }
  transformedContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  transformedContext.restore();

  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(
    transformed,
    cropX, cropY, outputWidth / scale, outputHeight / scale,
    0, 0, outputWidth, outputHeight,
  );

  const width = outputWidth;
  const height = outputHeight;
  if (!options.previewOriginal) {
    const layers = documentState.layers;
    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = clamp(layer.opacity, 0, 1);
      ctx.globalCompositeOperation = layer.blend;
      if (layer.type === "text") drawTextLayer(ctx, layer, width, height);
      else if (layer.type === "shape") drawShapeLayer(ctx, layer, width, height);
      else if (layer.type === "frame") drawFrameLayer(ctx, layer, width, height);
      else drawImageLayer(ctx, layer, width, height);
      ctx.restore();
    }

    if (documentState.adjustments.vignette > 0) {
      const intensity = documentState.adjustments.vignette / 100;
      const radius = Math.max(width, height) * 0.72;
      const vignette = ctx.createRadialGradient(width / 2, height / 2, radius * 0.28, width / 2, height / 2, radius);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, `rgba(0,0,0,${intensity * 0.78})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    if (documentState.adjustments.grain > 0) {
      const grainCanvas = document.createElement("canvas");
      grainCanvas.width = 96;
      grainCanvas.height = 96;
      const grainContext = grainCanvas.getContext("2d");
      if (grainContext) {
        const data = grainContext.createImageData(96, 96);
        for (let i = 0; i < data.data.length; i += 4) {
          const value = Math.floor(Math.random() * 255);
          data.data[i] = value;
          data.data[i + 1] = value;
          data.data[i + 2] = value;
          data.data[i + 3] = 255;
        }
        grainContext.putImageData(data, 0, 0);
        ctx.save();
        ctx.globalAlpha = documentState.adjustments.grain / 250;
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = ctx.createPattern(grainCanvas, "repeat") ?? "transparent";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
  }

  if (options.selection && documentState.selectedLayerId) {
    const selected = documentState.layers.find((layer) => layer.id === documentState.selectedLayerId);
    if (selected) {
      const bounds = layerBounds(selected, width, height);
      ctx.save();
      ctx.strokeStyle = "#b9a8ff";
      ctx.lineWidth = Math.max(1, width * 0.0018);
      ctx.setLineDash([Math.max(5, width * 0.008), Math.max(3, width * 0.004)]);
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#6d5bd0";
      ctx.lineWidth = Math.max(1, width * 0.001);
      ctx.fillRect(bounds.x + bounds.width - 6, bounds.y + bounds.height - 6, 12, 12);
      ctx.strokeRect(bounds.x + bounds.width - 6, bounds.y + bounds.height - 6, 12, 12);
      ctx.restore();
    }
  }
}

export function defaultLayerBase(name: string): LayerBase {
  return {
    id: makeId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
    rotation: 0,
    blend: "source-over",
  };
}

export function createTextLayer(text = "Your text", color = "#ffffff"): EditableLayer {
  return {
    ...defaultLayerBase("Text"),
    type: "text",
    text,
    color,
    fontFamily: "Arial",
    fontSize: 0.075,
    fontWeight: "700",
    italic: false,
    align: "center",
    outline: "#16131e",
    outlineWidth: 2,
    shadow: true,
    x: 0.1,
    y: 0.72,
    width: 0.8,
    height: 0.2,
  };
}

export function createShapeLayer(shape: "rectangle" | "ellipse" | "line" | "star" = "rectangle"): EditableLayer {
  return {
    ...defaultLayerBase(shape[0].toUpperCase() + shape.slice(1)),
    type: "shape",
    shape,
    fill: shape === "line" ? "transparent" : "#9b89ef",
    stroke: "#ffffff",
    strokeWidth: 1.2,
    radius: 4,
    x: 0.28,
    y: 0.28,
    width: 0.44,
    height: 0.32,
  };
}

export function createFrameLayer(style: "classic" | "polaroid" | "film" | "neon" | "double" = "classic"): EditableLayer {
  return {
    ...defaultLayerBase(`${style[0].toUpperCase() + style.slice(1)} frame`),
    type: "frame",
    style,
    color: style === "neon" ? "#b7a0ff" : "#f5f1e8",
    secondaryColor: "#d8c49b",
    thickness: style === "polaroid" ? 12 : 4,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
}

export function createImageLayer(image: HTMLImageElement, sourceUrl: string, name: string): EditableLayer {
  return {
    ...defaultLayerBase(name),
    type: "image",
    sourceUrl,
    image,
    x: 0.15,
    y: 0.15,
    width: 0.7,
    height: 0.7,
  };
}
