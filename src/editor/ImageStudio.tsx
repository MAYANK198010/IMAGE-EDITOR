import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  ArrowDownToLine, ArrowDown, ArrowUp, Eye, EyeOff, FlipHorizontal, FlipVertical,
  Image as ImageIcon, Layers3, Lock, LockOpen, Plus, RotateCcw, Trash2, Type,
  Copy, Crop, Square, Frame, Undo2, Redo2, SlidersHorizontal, Sparkles,
  Maximize2, ZoomIn, ZoomOut, Upload, WandSparkles,
} from "lucide-react";
import type { AdjustmentState, EditableLayer, ImageEditDocument, TextLayer, ShapeLayer, FrameLayer } from "./types";
import {
  DEFAULT_ADJUSTMENTS, FILTER_PRESETS, FULL_CROP, clamp, createFrameLayer,
  createImageLayer, createShapeLayer, createTextLayer, hitTestLayer, makeId,
  renderImageDocument, rotatedDimensions,
} from "./image-renderer";

type Props = { onStatus: (message: string) => void };

const INITIAL_DOCUMENT: ImageEditDocument = {
  adjustments: DEFAULT_ADJUSTMENTS,
  crop: FULL_CROP,
  rotation: 0,
  flipX: false,
  flipY: false,
  layers: [],
  selectedLayerId: null,
};

type DragState = {
  id: string;
  startX: number;
  startY: number;
  initial: EditableLayer;
  resizing: boolean;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ImageStudio({ onStatus }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("Untitled image");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [doc, setDoc] = useState<ImageEditDocument>(INITIAL_DOCUMENT);
  const [history, setHistory] = useState<ImageEditDocument[]>([]);
  const [future, setFuture] = useState<ImageEditDocument[]>([]);
  const [zoom, setZoom] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageTab, setImageTab] = useState<"layers" | "effects" | "crop" | "export">("layers");
  const [exportFormat, setExportFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [exportSize, setExportSize] = useState<"original" | "1080" | "2k" | "4k">("original");
  const [quality, setQuality] = useState(92);
  const [dragging, setDragging] = useState(false);

  const baseInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const overlayUrls = useRef<string[]>([]);
  const latestDoc = useRef(doc);

  useEffect(() => { latestDoc.current = doc; }, [doc]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      if (cancelled) return;
      setImage(element);
      setDoc(INITIAL_DOCUMENT);
      setHistory([]);
      setFuture([]);
      onStatus("Image loaded. Add text, frames, shapes or image layers.");
    };
    element.onerror = () => {
      if (!cancelled) onStatus("This image could not be decoded by the browser.");
    };
    element.src = imageUrl;
    return () => { cancelled = true; element.onload = null; element.onerror = null; URL.revokeObjectURL(imageUrl); };
  }, [imageUrl, onStatus]);

  useEffect(() => {
    if (!image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      renderImageDocument(canvas, image, doc, { selection: !showOriginal, previewOriginal: showOriginal });
    } catch (error) {
      onStatus(error instanceof Error ? `Preview error: ${error.message}` : "Could not render the image preview.");
    }
  }, [image, doc, showOriginal, onStatus]);

  useEffect(() => () => {
    overlayUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const pushHistory = useCallback((snapshot = latestDoc.current) => {
    setHistory((items) => [...items.slice(-49), snapshot]);
    setFuture([]);
  }, []);

  const commit = useCallback((updater: (current: ImageEditDocument) => ImageEditDocument) => {
    pushHistory(latestDoc.current);
    setDoc((current) => updater(current));
  }, [pushHistory]);

  const selectedLayer = useMemo(
    () => doc.layers.find((layer) => layer.id === doc.selectedLayerId),
    [doc.layers, doc.selectedLayerId],
  );

  const updateLayer = (id: string, updater: (layer: EditableLayer) => EditableLayer, keepHistory = true) => {
    if (keepHistory) pushHistory();
    setDoc((current) => ({
      ...current,
      layers: current.layers.map((layer) => layer.id === id ? updater(layer) : layer),
    }));
  };

  const loadBaseImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onStatus("Choose an image file such as PNG, JPG, WebP or GIF.");
      return;
    }
    setImage(null);
    setImageUrl(URL.createObjectURL(file));
    setImageName(file.name);
    setZoom(1);
  };

  const addLayer = (layer: EditableLayer) => {
    commit((current) => ({
      ...current,
      layers: [...current.layers, layer],
      selectedLayerId: layer.id,
    }));
    onStatus(`${layer.name} added. Drag it on the canvas to position it.`);
  };

  const addText = () => addLayer(createTextLayer("Your headline"));
  const addShape = (shape: "rectangle" | "ellipse" | "line" | "star") => addLayer(createShapeLayer(shape));
  const addFrame = (style: "classic" | "polaroid" | "film" | "neon" | "double") => addLayer(createFrameLayer(style));

  const addImageOverlay = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onStatus("Choose an image file for the image layer.");
      return;
    }
    const url = URL.createObjectURL(file);
    overlayUrls.current.push(url);
    const element = new window.Image();
    element.onload = () => {
      const layer = createImageLayer(element, url, file.name);
      addLayer(layer);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      overlayUrls.current = overlayUrls.current.filter((entry) => entry !== url);
      onStatus("The image layer could not be decoded.");
    };
    element.src = url;
  };

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((items) => [...items, doc]);
    setHistory((items) => items.slice(0, -1));
    setDoc(previous);
    onStatus("Image change undone");
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setHistory((items) => [...items, doc]);
    setFuture((items) => items.slice(0, -1));
    setDoc(next);
    onStatus("Image change restored");
  };

  const resetAdjustments = () => {
    commit((current) => ({ ...current, adjustments: DEFAULT_ADJUSTMENTS }));
    onStatus("Image effects reset");
  };

  const applyPreset = (values: Partial<AdjustmentState>) => {
    commit((current) => ({
      ...current,
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...values },
    }));
    onStatus("Filter preset applied");
  };

  const setCropRatio = (ratio: "original" | "free" | "1:1" | "4:5" | "16:9" | "9:16") => {
    if (!image || ratio === "free") return;
    if (ratio === "original") {
      commit((current) => ({ ...current, crop: FULL_CROP }));
      return;
    }
    const dimensions = rotatedDimensions(image, doc.rotation);
    const imageRatio = dimensions.width / dimensions.height;
    const target = ratio === "1:1" ? 1 : ratio === "4:5" ? 4 / 5 : ratio === "16:9" ? 16 / 9 : 9 / 16;
    const width = target > imageRatio ? 1 : target / imageRatio;
    const height = target > imageRatio ? imageRatio / target : 1;
    commit((current) => ({
      ...current,
      crop: { x: (1 - width) / 2, y: (1 - height) / 2, width, height },
    }));
    onStatus(`Crop ratio set to ${ratio}`);
  };

  const updateCrop = (key: keyof ImageEditDocument["crop"], value: number) => {
    pushHistory();
    setDoc((current) => {
      const crop = { ...current.crop, [key]: value };
      crop.width = clamp(crop.width, 0.15, 1);
      crop.height = clamp(crop.height, 0.15, 1);
      crop.x = clamp(crop.x, 0, 1 - crop.width);
      crop.y = clamp(crop.y, 0, 1 - crop.height);
      return { ...current, crop };
    });
  };

  const rotate = (degrees: number) => {
    commit((current) => ({ ...current, rotation: (current.rotation + degrees + 360) % 360, crop: FULL_CROP }));
  };

  const changeAdjustment = (key: keyof AdjustmentState, value: number) => {
    setDoc((current) => ({ ...current, adjustments: { ...current.adjustments, [key]: value } }));
  };

  const onCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (!canvas.width || !canvas.height) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const active = doc.layers.find((layer) => layer.id === doc.selectedLayerId);
    let targetId: string | null = null;
    let resizing = false;

    if (active && !active.locked) {
      const right = (active.x + active.width) * canvas.width;
      const bottom = (active.y + active.height) * canvas.height;
      if (Math.abs(x - right) < 18 && Math.abs(y - bottom) < 18) {
        targetId = active.id;
        resizing = true;
      }
    }
    if (!targetId) targetId = hitTestLayer(doc.layers, x, y, canvas.width, canvas.height);

    if (!targetId) {
      setDoc((current) => ({ ...current, selectedLayerId: null }));
      return;
    }
    const layer = doc.layers.find((item) => item.id === targetId);
    if (!layer) return;
    setDoc((current) => ({ ...current, selectedLayerId: targetId }));
    if (layer.locked) return;
    pushHistory(doc);
    dragRef.current = { id: targetId, startX: x, startY: y, initial: layer, resizing };
    canvas.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = event.currentTarget;
    if (!drag || !canvas.width || !canvas.height) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const dx = (x - drag.startX) / canvas.width;
    const dy = (y - drag.startY) / canvas.height;

    setDoc((current) => ({
      ...current,
      layers: current.layers.map((layer) => {
        if (layer.id !== drag.id) return layer;
        if (drag.resizing) {
          return {
            ...layer,
            width: clamp(drag.initial.width + dx, 0.04, 1 - drag.initial.x),
            height: clamp(drag.initial.height + dy, 0.04, 1 - drag.initial.y),
          };
        }
        return {
          ...layer,
          x: clamp(drag.initial.x + dx, -0.25, 1.1),
          y: clamp(drag.initial.y + dy, -0.25, 1.1),
        };
      }),
    }));
  };

  const onCanvasPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reorderLayer = (layerId: string, direction: -1 | 1) => {
    commit((current) => {
      const index = current.layers.findIndex((layer) => layer.id === layerId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.layers.length) return current;
      const layers = [...current.layers];
      [layers[index], layers[next]] = [layers[next], layers[index]];
      return { ...current, layers };
    });
  };

  const duplicateLayer = (layer: EditableLayer) => {
    const duplicate = { ...layer, id: makeId(), name: `${layer.name} copy`, x: clamp(layer.x + 0.025, 0, 0.9), y: clamp(layer.y + 0.025, 0, 0.9) } as EditableLayer;
    addLayer(duplicate);
  };

  const removeLayer = (layerId: string) => {
    commit((current) => ({
      ...current,
      layers: current.layers.filter((layer) => layer.id !== layerId),
      selectedLayerId: current.selectedLayerId === layerId ? null : current.selectedLayerId,
    }));
    onStatus("Layer removed");
  };

  const exportImage = () => {
    if (!image) {
      onStatus("Import an image before exporting.");
      return;
    }
    try {
      const preview = canvasRef.current;
      if (!preview) return;
      const longEdge = Math.max(preview.width, preview.height);
      const targetLongEdge = exportSize === "original" ? longEdge : exportSize === "1080" ? 1920 : exportSize === "2k" ? 2560 : 3840;
      const scale = targetLongEdge / longEdge;
      const output = document.createElement("canvas");
      renderImageDocument(output, image, doc, { scale, selection: false });
      output.toBlob((blob) => {
        if (!blob) {
          onStatus("Export failed. Try a smaller output size; browser canvas memory is limited.");
          return;
        }
        const extension = exportFormat === "image/jpeg" ? "jpg" : exportFormat === "image/webp" ? "webp" : "png";
        downloadBlob(blob, `${imageName.replace(/\.[^.]+$/, "")}-${exportSize}-edited.${extension}`);
        onStatus(`${targetLongEdge}px ${extension.toUpperCase()} export ready`);
      }, exportFormat, exportFormat === "image/png" ? undefined : quality / 100);
    } catch {
      onStatus("The browser could not allocate this export size. Reduce the resolution and retry.");
    }
  };

  const layer = selectedLayer;

  return (
    <div className="studio-grid image-studio">
      <aside className="studio-toolbar">
        <button onClick={() => baseInputRef.current?.click()}><Upload/><span>Open</span></button>
        <button onClick={addText} disabled={!image}><Type/><span>Text</span></button>
        <button onClick={() => addShape("rectangle")} disabled={!image}><Square/><span>Shape</span></button>
        <button onClick={() => addFrame("classic")} disabled={!image}><Frame/><span>Frame</span></button>
        <button onClick={() => overlayInputRef.current?.click()} disabled={!image}><ImageIcon/><span>Image layer</span></button>
      </aside>

      <section className="studio-main">
        <div className="studio-toolbar-row">
          <div className="doc-label"><ImageIcon size={15}/><span>{imageName}</span></div>
          <div className="studio-actions">
            <button className="mini-tool" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={15}/></button>
            <button className="mini-tool" onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={15}/></button>
            <button className="mini-tool" onClick={() => rotate(-90)} disabled={!image} title="Rotate left"><RotateCcw size={15}/></button>
            <button className="mini-tool" onClick={() => commit((current) => ({ ...current, flipX: !current.flipX }))} disabled={!image} title="Flip horizontally"><FlipHorizontal size={15}/></button>
            <button className="mini-tool" onClick={() => commit((current) => ({ ...current, flipY: !current.flipY }))} disabled={!image} title="Flip vertically"><FlipVertical size={15}/></button>
            <button className="mini-tool" onClick={() => setZoom((value) => clamp(value - 0.1, 0.3, 2))} title="Zoom out"><ZoomOut size={15}/></button>
            <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
            <button className="mini-tool" onClick={() => setZoom((value) => clamp(value + 0.1, 0.3, 2))} title="Zoom in"><ZoomIn size={15}/></button>
            <button className="mini-tool" onClick={() => setZoom(1)} title="Fit"><Maximize2 size={15}/></button>
            <button className="mini-tool original-button" onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)} disabled={!image} title="Hold to see original"><Eye size={15}/></button>
          </div>
        </div>
        <div className={dragging ? "studio-canvas-area is-dragging" : "studio-canvas-area"}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); loadBaseImage(event.dataTransfer.files[0]); }}>
          {image ? (
            <div className="studio-canvas-wrap" style={{ transform: `scale(${zoom})` }}>
              <canvas
                ref={canvasRef}
                className="editor-canvas"
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerCancel={onCanvasPointerUp}
                aria-label="Interactive image composition"
              />
            </div>
          ) : (
            <div className="studio-empty">
              <div className="empty-art"><Layers3 size={37}/></div>
              <h2>Start with an image</h2>
              <p>Open a photo, then add independent text, image, shape and frame layers.</p>
              <button className="primary-button" onClick={() => baseInputRef.current?.click()}><Upload size={16}/> Import image</button>
              <small>PNG · JPG · WEBP · GIF</small>
            </div>
          )}
          <div className="studio-canvas-footer">
            <span>{image ? `${canvasRef.current?.width ?? image.naturalWidth} × ${canvasRef.current?.height ?? image.naturalHeight} px` : "No image loaded"}</span>
            <span>{doc.layers.length} editable layer{doc.layers.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="studio-bottom">
          <div className="bottom-heading"><strong>FILTERS & EFFECTS</strong><small>Non-destructive image adjustments</small></div>
          <div className="filter-preset-row">
            {FILTER_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => applyPreset(preset.values)} disabled={!image}>
                <span className={`filter-tile filter-${preset.name.toLowerCase()}`}>{imageUrl && <img src={imageUrl} alt=""/>}</span>
                <small>{preset.name}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="studio-properties">
        <div className="property-tabs">
          {(["layers", "effects", "crop", "export"] as const).map((tab) => (
            <button key={tab} className={imageTab === tab ? "active" : ""} onClick={() => setImageTab(tab)}>
              {tab === "layers" ? <Layers3 size={14}/> : tab === "effects" ? <WandSparkles size={14}/> : tab === "crop" ? <Crop size={14}/> : <ArrowDownToLine size={14}/>}
              {tab}
            </button>
          ))}
        </div>

        {imageTab === "layers" && (
          <div className="property-section">
            <div className="property-heading"><strong>Layers</strong><button onClick={addText} disabled={!image} aria-label="Add text layer"><Plus size={15}/></button></div>
            {!doc.layers.length && <p className="empty-hint">No overlay layers yet. Add text, a shape, a frame or another image.</p>}
            <div className="layer-list">
              {[...doc.layers].reverse().map((item) => (
                <div key={item.id} className={doc.selectedLayerId === item.id ? "layer-card selected" : "layer-card"}>
                  <button className="layer-select" onClick={() => setDoc((current) => ({ ...current, selectedLayerId: item.id }))}>
                    {item.type === "text" ? <Type size={15}/> : item.type === "shape" ? <Square size={15}/> : item.type === "frame" ? <Frame size={15}/> : <ImageIcon size={15}/>}
                    <span>{item.name}</span>
                  </button>
                  <button className="layer-icon" onClick={() => updateLayer(item.id, (old) => ({ ...old, visible: !old.visible }))} title={item.visible ? "Hide layer" : "Show layer"}>
                    {item.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                  </button>
                  <button className="layer-icon" onClick={() => updateLayer(item.id, (old) => ({ ...old, locked: !old.locked }))} title={item.locked ? "Unlock layer" : "Lock layer"}>
                    {item.locked ? <Lock size={14}/> : <LockOpen size={14}/>}
                  </button>
                  <button className="layer-icon" onClick={() => duplicateLayer(item)} title="Duplicate"><Copy size={13}/></button>
                  <button className="layer-icon" onClick={() => removeLayer(item.id)} title="Delete"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
            {layer && (
              <div className="layer-properties">
                <div className="property-heading"><strong>Selected: {layer.name}</strong></div>
                <label className="field-control">Layer name<input value={layer.name} onChange={(event) => updateLayer(layer.id, (old) => ({ ...old, name: event.target.value }), false)} onBlur={() => pushHistory()} /></label>
                <label className="range-control"><span><b>Opacity</b><output>{Math.round(layer.opacity * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={(event) => updateLayer(layer.id, (old) => ({ ...old, opacity: Number(event.target.value) }), false)} onPointerDown={() => pushHistory()} /></label>
                <label className="range-control"><span><b>Rotation</b><output>{layer.rotation}°</output></span><input type="range" min="-180" max="180" value={layer.rotation} onChange={(event) => updateLayer(layer.id, (old) => ({ ...old, rotation: Number(event.target.value) }), false)} onPointerDown={() => pushHistory()} /></label>
                <label className="field-control">Blend mode<select value={layer.blend} onChange={(event) => updateLayer(layer.id, (old) => ({ ...old, blend: event.target.value as GlobalCompositeOperation }))}><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="lighten">Lighten</option><option value="darken">Darken</option></select></label>
                <div className="layer-order-actions"><button onClick={() => reorderLayer(layer.id, -1)}><ArrowDown size={14}/> Send back</button><button onClick={() => reorderLayer(layer.id, 1)}><ArrowUp size={14}/> Bring forward</button></div>
                {layer.type === "text" && (
                  <>
                    <label className="field-control">Text<textarea rows={3} value={layer.text} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, text: event.target.value } : old, false)} onBlur={() => pushHistory()} /></label>
                    <div className="two-fields">
                      <label className="field-control">Text colour<input type="color" value={layer.color} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, color: event.target.value } : old)} /></label>
                      <label className="field-control">Font<select value={layer.fontFamily} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, fontFamily: event.target.value } : old)}><option>Arial</option><option>Georgia</option><option>Impact</option><option>Verdana</option><option>Courier New</option></select></label>
                    </div>
                    <label className="range-control"><span><b>Size</b><output>{Math.round(layer.fontSize * 100)}% width</output></span><input type="range" min="2" max="18" step="0.5" value={layer.fontSize * 100} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, fontSize: Number(event.target.value) / 100 } : old)} onPointerDown={() => pushHistory()} /></label>
                    <div className="two-fields">
                      <label className="field-control">Weight<select value={layer.fontWeight} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, fontWeight: event.target.value } : old)}><option value="400">Regular</option><option value="700">Bold</option><option value="900">Black</option></select></label>
                      <label className="field-control">Align<select value={layer.align} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, align: event.target.value as CanvasTextAlign } : old)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                    </div>
                    <label className="check-setting"><input type="checkbox" checked={layer.italic} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, italic: event.target.checked } : old)}/> Italic</label>
                    <label className="check-setting"><input type="checkbox" checked={layer.shadow} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, shadow: event.target.checked } : old)}/> Shadow</label>
                    <div className="two-fields">
                      <label className="field-control">Outline<input type="color" value={layer.outline} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, outline: event.target.value } : old)} /></label>
                      <label className="range-control"><span><b>Outline width</b><output>{layer.outlineWidth}</output></span><input type="range" min="0" max="6" value={layer.outlineWidth} onChange={(event) => updateLayer(layer.id, (old) => old.type === "text" ? { ...old, outlineWidth: Number(event.target.value) } : old)} /></label>
                    </div>
                  </>
                )}
                {layer.type === "shape" && (
                  <>
                    <label className="field-control">Shape<select value={layer.shape} onChange={(event) => updateLayer(layer.id, (old) => old.type === "shape" ? { ...old, shape: event.target.value as ShapeLayer["shape"] } : old)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option><option value="star">Star</option></select></label>
                    <div className="two-fields">
                      <label className="field-control">Fill<input type="color" value={layer.fill === "transparent" ? "#000000" : layer.fill} onChange={(event) => updateLayer(layer.id, (old) => old.type === "shape" ? { ...old, fill: event.target.value } : old)} /></label>
                      <label className="field-control">Stroke<input type="color" value={layer.stroke} onChange={(event) => updateLayer(layer.id, (old) => old.type === "shape" ? { ...old, stroke: event.target.value } : old)} /></label>
                    </div>
                    <label className="range-control"><span><b>Stroke width</b><output>{layer.strokeWidth}</output></span><input type="range" min="0" max="8" step="0.2" value={layer.strokeWidth} onChange={(event) => updateLayer(layer.id, (old) => old.type === "shape" ? { ...old, strokeWidth: Number(event.target.value) } : old)} /></label>
                  </>
                )}
                {layer.type === "frame" && (
                  <>
                    <label className="field-control">Frame style<select value={layer.style} onChange={(event) => updateLayer(layer.id, (old) => old.type === "frame" ? { ...old, style: event.target.value as FrameLayer["style"] } : old)}><option value="classic">Classic border</option><option value="double">Double line</option><option value="polaroid">Polaroid</option><option value="film">Film strip</option><option value="neon">Neon glow</option></select></label>
                    <div className="two-fields">
                      <label className="field-control">Primary<input type="color" value={layer.color} onChange={(event) => updateLayer(layer.id, (old) => old.type === "frame" ? { ...old, color: event.target.value } : old)} /></label>
                      <label className="field-control">Secondary<input type="color" value={layer.secondaryColor} onChange={(event) => updateLayer(layer.id, (old) => old.type === "frame" ? { ...old, secondaryColor: event.target.value } : old)} /></label>
                    </div>
                    <label className="range-control"><span><b>Thickness</b><output>{layer.thickness}</output></span><input type="range" min="1" max="20" value={layer.thickness} onChange={(event) => updateLayer(layer.id, (old) => old.type === "frame" ? { ...old, thickness: Number(event.target.value) } : old)} /></label>
                  </>
                )}
                {layer.type === "image" && <p className="empty-hint">Drag this image on the canvas. Resize it using the small handle in the lower-right corner.</p>}
              </div>
            )}
          </div>
        )}

        {imageTab === "effects" && (
          <div className="property-section">
            <div className="property-heading"><strong>Image adjustments</strong><button onClick={resetAdjustments} disabled={!image}>Reset</button></div>
            {([
              ["Brightness", "brightness", 0, 200, "%"],
              ["Contrast", "contrast", 0, 200, "%"],
              ["Saturation", "saturation", 0, 200, "%"],
              ["Blur", "blur", 0, 18, "px"],
              ["Grayscale", "grayscale", 0, 100, "%"],
              ["Sepia", "sepia", 0, 100, "%"],
              ["Hue", "hue", -180, 180, "°"],
              ["Invert", "invert", 0, 100, "%"],
              ["Vignette", "vignette", 0, 100, "%"],
              ["Film grain", "grain", 0, 60, "%"],
            ] as const).map(([label, key, min, max, unit]) => (
              <label className="range-control effect-slider" key={key}>
                <span><b>{label}</b><output>{doc.adjustments[key]}{unit}</output></span>
                <input type="range" min={min} max={max} value={doc.adjustments[key]} onPointerDown={() => pushHistory()} onChange={(event) => changeAdjustment(key, Number(event.target.value))} onPointerUp={() => onStatus(`${label} updated`)} disabled={!image}/>
              </label>
            ))}
          </div>
        )}

        {imageTab === "crop" && (
          <div className="property-section">
            <div className="property-heading"><strong>Crop & framing</strong><button onClick={() => setCropRatio("original")} disabled={!image}>Reset</button></div>
            <div className="crop-ratios">
              {(["original", "free", "1:1", "4:5", "16:9", "9:16"] as const).map((ratio) => <button key={ratio} onClick={() => setCropRatio(ratio)} disabled={!image}>{ratio === "original" ? "Original" : ratio === "free" ? "Free" : ratio}</button>)}
            </div>
            {([
              ["Width", "width"],
              ["Height", "height"],
              ["Horizontal", "x"],
              ["Vertical", "y"],
            ] as const).map(([label, key]) => (
              <label className="range-control effect-slider" key={key}>
                <span><b>{label}</b><output>{Math.round(doc.crop[key] * 100)}%</output></span>
                <input type="range" min={key === "width" || key === "height" ? 15 : 0} max={key === "width" || key === "height" ? 100 : 85} value={doc.crop[key] * 100} onPointerDown={() => pushHistory()} onChange={(event) => updateCrop(key, Number(event.target.value) / 100)} disabled={!image}/>
              </label>
            ))}
            <p className="empty-hint">Crop remains editable until export. Drag overlay layers directly on the preview.</p>
          </div>
        )}

        {imageTab === "export" && (
          <div className="property-section">
            <div className="property-heading"><strong>Export image</strong></div>
            <label className="field-control">File format<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as typeof exportFormat)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
            <label className="field-control">Resolution<select value={exportSize} onChange={(event) => setExportSize(event.target.value as typeof exportSize)}><option value="original">Original resolution</option><option value="1080">Full HD · 1920px</option><option value="2k">2K · 2560px</option><option value="4k">4K · 3840px long edge</option></select></label>
            {exportFormat !== "image/png" && <label className="range-control effect-slider"><span><b>Quality</b><output>{quality}%</output></span><input type="range" min="50" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/></label>}
            <p className="empty-hint">4K export renders at 3840px on the longest edge. Very large canvases may be limited by your device's available memory.</p>
            <button className="primary-button export-wide" onClick={exportImage} disabled={!image}><ArrowDownToLine size={16}/> Export image</button>
          </div>
        )}
      </aside>

      <input ref={baseInputRef} type="file" accept="image/*" hidden onChange={(event) => loadBaseImage(event.target.files?.[0])}/>
      <input ref={overlayInputRef} type="file" accept="image/*" hidden onChange={(event) => addImageOverlay(event.target.files?.[0])}/>
    </div>
  );
}
