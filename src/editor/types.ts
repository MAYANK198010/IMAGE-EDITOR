export type AdjustmentState = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hue: number;
  invert: number;
  vignette: number;
  grain: number;
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayerBase = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  blend: GlobalCompositeOperation;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  italic: boolean;
  align: CanvasTextAlign;
  outline: string;
  outlineWidth: number;
  shadow: boolean;
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rectangle" | "ellipse" | "line" | "star";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
};

export type FrameLayer = LayerBase & {
  type: "frame";
  style: "classic" | "polaroid" | "film" | "neon" | "double";
  color: string;
  secondaryColor: string;
  thickness: number;
};

export type ImageLayer = LayerBase & {
  type: "image";
  sourceUrl: string;
  image: HTMLImageElement | null;
};

export type EditableLayer = TextLayer | ShapeLayer | FrameLayer | ImageLayer;

export type ImageEditDocument = {
  adjustments: AdjustmentState;
  crop: CropRect;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  layers: EditableLayer[];
  selectedLayerId: string | null;
};
