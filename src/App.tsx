import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  Aperture, ArrowDownToLine, AudioLines, Check, ChevronDown, CircleHelp,
  Crop, Eye, Film, FlipHorizontal, FlipVertical, FolderOpen, Image as ImageIcon,
  Layers3, Maximize2, Music2, Pause, Play, Redo2, RotateCcw, Scissors,
  SlidersHorizontal, Sparkles, Type, Undo2, Upload, Video, WandSparkles,
  ZoomIn, ZoomOut,
} from "lucide-react";

type Mode = "image" | "video";
type ImagePanel = "adjust" | "crop";
type CropRatio = "original" | "free" | "1:1" | "4:5" | "16:9" | "9:16";
type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hue: number;
  invert: number;
};
type CropRect = { x: number; y: number; width: number; height: number };
type EditState = {
  adjustments: Adjustments;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  crop: CropRect;
  cropRatio: CropRatio;
  text: string;
  textEnabled: boolean;
  textColor: string;
  textSize: number;
  textX: number;
  textY: number;
};

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  invert: 0,
};
const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const DEFAULT_EDIT: EditState = {
  adjustments: DEFAULT_ADJUSTMENTS,
  rotation: 0,
  flipX: false,
  flipY: false,
  crop: FULL_CROP,
  cropRatio: "original",
  text: "",
  textEnabled: false,
  textColor: "#ffffff",
  textSize: 5,
  textX: 50,
  textY: 84,
};
const PRESETS: { name: string; values: Partial<Adjustments>; className: string }[] = [
  { name: "Original", values: {}, className: "preset-original" },
  { name: "Mono", values: { grayscale: 100, saturation: 0 }, className: "preset-mono" },
  { name: "Warm", values: { sepia: 35, saturation: 112, contrast: 106 }, className: "preset-warm" },
  { name: "Cool", values: { saturation: 88, contrast: 108, hue: 12, brightness: 104 }, className: "preset-cool" },
  { name: "Fade", values: { contrast: 82, brightness: 108, saturation: 78 }, className: "preset-fade" },
  { name: "Punch", values: { contrast: 132, saturation: 132 }, className: "preset-punch" },
  { name: "Vintage", values: { sepia: 45, saturation: 82, contrast: 92, hue: -8 }, className: "preset-vintage" },
  { name: "Negative", values: { invert: 100, saturation: 80 }, className: "preset-negative" },
];
const CROP_RATIOS: CropRatio[] = ["original", "free", "1:1", "4:5", "16:9", "9:16"];

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getFilterCss(adjustments: Adjustments): string {
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

function getRotatedSize(image: HTMLImageElement, rotation: number) {
  const quarterTurn = Math.abs(rotation % 180) === 90;
  return quarterTurn
    ? { width: image.naturalHeight, height: image.naturalWidth }
    : { width: image.naturalWidth, height: image.naturalHeight };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const [mode, setMode] = useState<Mode>("image");
  const [imagePanel, setImagePanel] = useState<ImagePanel>("adjust");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("Untitled image");
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT);
  const [history, setHistory] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const historyGesture = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"image/png" | "image/jpeg">("image/png");
  const [jpegQuality, setJpegQuality] = useState(92);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("No video selected");
  const [videoDuration, setVideoDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const [status, setStatus] = useState("Ready");
  const [showHelp, setShowHelp] = useState(false);
  const [dragging, setDragging] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const updateEdit = (updater: (current: EditState) => EditState) => {
    setEdit((current) => updater(current));
  };

  const commitEdit = (updater: (current: EditState) => EditState) => {
    setHistory((items) => [...items.slice(-39), edit]);
    setFuture([]);
    historyGesture.current = false;
    updateEdit(updater);
    setShowOriginal(false);
  };

  const beginEditGesture = () => {
    if (historyGesture.current) return;
    historyGesture.current = true;
    setHistory((items) => [...items.slice(-39), edit]);
    setFuture([]);
    setShowOriginal(false);
  };

  const endEditGesture = () => {
    historyGesture.current = false;
  };

  const undo = () => {
    if (!history.length) return;
    setFuture((items) => [...items, edit]);
    setEdit(history[history.length - 1]);
    setHistory((items) => items.slice(0, -1));
    setShowOriginal(false);
    setStatus("Undo applied");
  };

  const redo = () => {
    if (!future.length) return;
    setHistory((items) => [...items, edit]);
    setEdit(future[future.length - 1]);
    setFuture((items) => items.slice(0, -1));
    setShowOriginal(false);
    setStatus("Redo applied");
  };

  const loadImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose a supported image file.");
      return;
    }
    setImageUrl(URL.createObjectURL(file));
    setImageName(file.name);
    setEdit(DEFAULT_EDIT);
    setHistory([]);
    setFuture([]);
    setZoom(1);
    setStatus("Image loaded");
  };

  useEffect(() => {
    if (!imageUrl) {
      setImageElement(null);
      setCanvasSize({ width: 0, height: 0 });
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setImageElement(image);
      setCanvasSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (!cancelled) setStatus("The selected image could not be opened.");
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const rotation = showOriginal ? 0 : edit.rotation;
    const { width: sourceWidth, height: sourceHeight } = getRotatedSize(imageElement, rotation);
    const crop = showOriginal ? FULL_CROP : edit.crop;
    const cropX = Math.round(crop.x * sourceWidth);
    const cropY = Math.round(crop.y * sourceHeight);
    const cropWidth = Math.max(1, Math.round(crop.width * sourceWidth));
    const cropHeight = Math.max(1, Math.round(crop.height * sourceHeight));

    const transformed = document.createElement("canvas");
    transformed.width = sourceWidth;
    transformed.height = sourceHeight;
    const transformedContext = transformed.getContext("2d");
    const context = canvas.getContext("2d");
    if (!transformedContext || !context) return;

    transformedContext.clearRect(0, 0, sourceWidth, sourceHeight);
    transformedContext.save();
    transformedContext.translate(sourceWidth / 2, sourceHeight / 2);
    transformedContext.rotate((rotation * Math.PI) / 180);
    transformedContext.scale(showOriginal ? 1 : edit.flipX ? -1 : 1, showOriginal ? 1 : edit.flipY ? -1 : 1);
    transformedContext.filter = showOriginal ? "none" : getFilterCss(edit.adjustments);
    transformedContext.drawImage(imageElement, -imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);
    transformedContext.restore();

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    context.clearRect(0, 0, cropWidth, cropHeight);
    context.drawImage(transformed, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    if (!showOriginal && edit.textEnabled && edit.text.trim()) {
      context.save();
      const fontSize = Math.max(12, Math.round(cropWidth * edit.textSize / 100));
      context.font = `700 ${fontSize}px Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(0,0,0,.72)";
      context.lineWidth = Math.max(2, fontSize * 0.12);
      context.fillStyle = edit.textColor;
      const x = cropWidth * edit.textX / 100;
      const y = cropHeight * edit.textY / 100;
      context.strokeText(edit.text, x, y, cropWidth * 0.9);
      context.fillText(edit.text, x, y, cropWidth * 0.9);
      context.restore();
    }
  }, [imageElement, edit, showOriginal]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  useEffect(() => {
    if (!videoUrl) {
      setVideoDuration(0);
      setPlayhead(0);
      setTrimStart(0);
      setTrimEnd(0);
      setIsPlaying(false);
    }
  }, [videoUrl]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const changeAdjustment = (key: keyof Adjustments, value: number) => {
    updateEdit((current) => ({
      ...current,
      adjustments: { ...current.adjustments, [key]: value },
    }));
  };

  const applyPreset = (values: Partial<Adjustments>) => {
    commitEdit((current) => ({
      ...current,
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...values },
    }));
    setStatus("Filter preset applied");
  };

  const setCropPreset = (ratio: CropRatio) => {
    if (!imageElement) return;
    if (ratio === "free" || ratio === "original") {
      commitEdit((current) => ({
        ...current,
        crop: FULL_CROP,
        cropRatio: ratio,
      }));
      return;
    }
    const size = getRotatedSize(imageElement, edit.rotation);
    const imageRatio = size.width / size.height;
    const ratioValue = ratio === "1:1" ? 1 : ratio === "4:5" ? 4 / 5 : ratio === "16:9" ? 16 / 9 : 9 / 16;
    let width = 1;
    let height = 1;
    if (ratioValue > imageRatio) {
      height = imageRatio / ratioValue;
    } else {
      width = ratioValue / imageRatio;
    }
    commitEdit((current) => ({
      ...current,
      crop: {
        x: (1 - width) / 2,
        y: (1 - height) / 2,
        width,
        height,
      },
      cropRatio: ratio,
    }));
    setStatus(`Crop ratio set to ${ratio}`);
  };

  const updateCrop = (key: keyof CropRect, value: number) => {
    updateEdit((current) => {
      const next = { ...current.crop, [key]: value };
      next.width = clamp(next.width, 0.2, 1);
      next.height = clamp(next.height, 0.2, 1);
      next.x = clamp(next.x, 0, 1 - next.width);
      next.y = clamp(next.y, 0, 1 - next.height);
      return { ...current, crop: next, cropRatio: "free" };
    });
  };

  const rotateImage = (degrees: number) => {
    commitEdit((current) => ({
      ...current,
      rotation: current.rotation + degrees,
      crop: FULL_CROP,
      cropRatio: "original",
    }));
  };

  const resetImage = () => {
    commitEdit(() => DEFAULT_EDIT);
    setStatus("Image edits reset");
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) {
      setStatus("Import an image before exporting.");
      return;
    }
    const mimeType = exportFormat;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) {
      setStatus("Could not create an export canvas.");
      return;
    }
    if (mimeType === "image/jpeg") {
      exportContext.fillStyle = "#ffffff";
      exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }
    exportContext.drawImage(canvas, 0, 0);
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Could not export this image.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${imageName.replace(/\.[^.]+$/, "")}-edited.${mimeType === "image/png" ? "png" : "jpg"}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${mimeType === "image/png" ? "PNG" : "JPEG"} export created`);
    }, mimeType, mimeType === "image/jpeg" ? jpegQuality / 100 : undefined);
  };

  const loadVideo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("Please choose a supported video file.");
      return;
    }
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setSpeed(1);
    setVolume(1);
    setIsPlaying(false);
    setStatus("Video loaded");
  };

  const onVideoMetadata = () => {
    const duration = videoRef.current?.duration ?? 0;
    setVideoDuration(duration);
    setTrimStart(0);
    setTrimEnd(duration);
    setPlayhead(0);
  };

  const seekVideo = (time: number) => {
    const safeTime = clamp(time, trimStart, Math.max(trimStart, trimEnd));
    setPlayhead(safeTime);
    if (videoRef.current) videoRef.current.currentTime = safeTime;
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.playbackRate = speed;
      video.volume = volume;
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setStatus("Playback could not start in this browser.");
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const exportVideo = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      setStatus("Import a video before exporting.");
      return;
    }
    const mediaVideo = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const capture = mediaVideo.captureStream ?? mediaVideo.mozCaptureStream;
    if (!capture || typeof MediaRecorder === "undefined") {
      setStatus("This browser does not support media-element recording. Try a browser that supports captureStream and MediaRecorder.");
      return;
    }
    if (trimEnd <= trimStart) {
      setStatus("Set an end point after the start point.");
      return;
    }

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let finished = false;
    try {
      stream = capture.call(video);
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setStatus("The browser recorder encountered an export error.");
        stream?.getTracks().forEach((track) => track.stop());
        setIsPlaying(false);
      };
      recorder.onstop = () => {
        const type = recorder?.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size > 0) {
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = downloadUrl;
          const extension = type.includes("mp4") ? "mp4" : "webm";
          anchor.download = `${videoName.replace(/\.[^.]+$/, "")}-edited.${extension}`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
          setStatus(`${extension.toUpperCase()} export created. Review playback before publishing.`);
        } else {
          setStatus("The browser returned an empty export.");
        }
        stream?.getTracks().forEach((track) => track.stop());
        setIsPlaying(false);
      };

      video.pause();
      video.playbackRate = speed;
      video.volume = volume;
      video.currentTime = trimStart;
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2 && Math.abs(video.currentTime - trimStart) < 0.05) {
          resolve();
          return;
        }
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Unable to seek source media"));
        };
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
      });

      const finish = () => {
        if (finished) return;
        finished = true;
        video.pause();
        if (recorder?.state === "recording") recorder.stop();
        video.removeEventListener("timeupdate", checkEnd);
        video.removeEventListener("ended", finish);
        setIsPlaying(false);
      };
      const checkEnd = () => {
        if (video.currentTime >= trimEnd - 0.02) finish();
      };

      recorder.start(250);
      video.addEventListener("timeupdate", checkEnd);
      video.addEventListener("ended", finish);
      await video.play();
      setIsPlaying(true);
      setStatus("Recording selected trim range…");
    } catch {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      setIsPlaying(false);
      setStatus("Video export failed. The file or browser may not support this recording path.");
    }
  };

  const canExportImage = Boolean(imageElement);
  const canExportVideo = Boolean(videoUrl && videoDuration > 0);
  const originalSize = imageElement ? getRotatedSize(imageElement, edit.rotation) : { width: 0, height: 0 };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (mode === "image") loadImage(file);
    else loadVideo(file);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Frameforge home">
          <span className="brand-mark"><Aperture size={19} /></span>
          <span className="brand-copy"><strong>FRAMEFORGE</strong><small>IMAGE & VIDEO STUDIO</small></span>
        </a>

        <div className="mode-switch" role="tablist" aria-label="Editor mode">
          <button className={mode === "image" ? "mode active" : "mode"} onClick={() => setMode("image")} role="tab" aria-selected={mode === "image"}>
            <ImageIcon size={15} /> Image
          </button>
          <button className={mode === "video" ? "mode active" : "mode"} onClick={() => setMode("video")} role="tab" aria-selected={mode === "video"}>
            <Video size={15} /> Video
          </button>
        </div>

        <div className="top-actions">
          <span className="local-state"><i /> Local workspace</span>
          {mode === "image" && (
            <>
              <button className="quiet-button" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={15} /></button>
              <button className="quiet-button" onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={15} /></button>
            </>
          )}
          <button className="quiet-button" onClick={() => setShowHelp(true)}><CircleHelp size={16} /> Help</button>
          <button className="export-button" onClick={mode === "image" ? exportImage : exportVideo} disabled={mode === "image" ? !canExportImage : !canExportVideo}>
            <ArrowDownToLine size={16} /> Export
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-rail" aria-label="Editor tools">
          <button className="rail-item active" onClick={() => (mode === "image" ? imageInputRef.current?.click() : videoInputRef.current?.click())}>
            <Upload size={18} /><span>Import</span>
          </button>
          <button className={mode === "image" && imagePanel === "crop" ? "rail-item active" : "rail-item"} onClick={() => mode === "image" ? setImagePanel("crop") : setStatus("Aspect-ratio presets are part of the next video timeline increment.")}>
            <Crop size={18} /><span>Crop</span>
          </button>
          <button className="rail-item" onClick={() => mode === "image" ? setTextModalOpen(true) : setStatus("Timed title overlays are planned for the video timeline.")}>
            <Type size={18} /><span>Text</span>
          </button>
          <button className="rail-item" onClick={() => setStatus("Multiple image layers and blend modes are planned for the layer-system increment.")}>
            <Layers3 size={18} /><span>Layers</span>
          </button>
          <div className="rail-spacer" />
          <button className="rail-item" onClick={() => setShowHelp(true)}>
            <SlidersHorizontal size={18} /><span>Guide</span>
          </button>
        </aside>

        <section className="editor-column">
          <div className="document-bar">
            <div className="document-title">
              <span className="file-glyph">{mode === "image" ? <ImageIcon size={15} /> : <Film size={15} />}</span>
              <span>{mode === "image" ? imageName : videoName}</span><ChevronDown size={13} />
            </div>
            <div className="document-tools">
              {mode === "image" ? (
                <>
                  <button className="tool-button" title="Rotate left" onClick={() => rotateImage(-90)} disabled={!imageElement}><RotateCcw size={15} /></button>
                  <button className="tool-button" title="Flip horizontally" onClick={() => commitEdit((current) => ({ ...current, flipX: !current.flipX }))} disabled={!imageElement}><FlipHorizontal size={15} /></button>
                  <button className="tool-button" title="Flip vertically" onClick={() => commitEdit((current) => ({ ...current, flipY: !current.flipY }))} disabled={!imageElement}><FlipVertical size={15} /></button>
                  <button className="tool-button" title="View original" onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)} disabled={!imageElement}><Eye size={15} /></button>
                </>
              ) : (
                <button className="tool-button" title="Set trim start to playhead" onClick={() => setTrimStart(clamp(playhead, 0, Math.max(0, trimEnd - 0.1)))} disabled={!videoUrl}><Scissors size={15} /></button>
              )}
              <span className="tool-divider" />
              <button className="tool-button" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}><ZoomOut size={15} /></button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button className="tool-button" title="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}><ZoomIn size={15} /></button>
              <button className="tool-button" title="Reset zoom" onClick={() => setZoom(1)}><Maximize2 size={15} /></button>
            </div>
          </div>

          <div
            className={dragging ? "canvas-area drag-active" : "canvas-area"}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {mode === "image" ? (
              imageElement ? (
                <div className="image-preview" style={{ transform: `scale(${zoom})` }}>
                  <canvas ref={canvasRef} aria-label="Edited image preview" />
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-art"><div className="art-halo" /><ImageIcon size={40} /><span>✦</span></div>
                  <h1>Make something worth looking at.</h1>
                  <p>Drop a photo here or open a file to start editing.</p>
                  <button className="primary-button" onClick={() => imageInputRef.current?.click()}><FolderOpen size={16} /> Open an image</button>
                  <small>PNG · JPG · WEBP · GIF first frame</small>
                </div>
              )
            ) : (
              <div className="video-stage">
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={onVideoMetadata}
                    onTimeUpdate={() => {
                      const current = videoRef.current?.currentTime ?? 0;
                      setPlayhead(current);
                      if (current >= trimEnd && videoRef.current && !videoRef.current.paused) {
                        videoRef.current.pause();
                        setIsPlaying(false);
                      }
                    }}
                    onEnded={() => setIsPlaying(false)}
                  />
                ) : (
                  <div className="video-empty">
                    <div className="video-icon"><Film size={38} /></div>
                    <h1>Build your next short video.</h1>
                    <p>Import a clip to preview, trim and export it.</p>
                    <button className="primary-button" onClick={() => videoInputRef.current?.click()}><Upload size={16} /> Import video</button>
                  </div>
                )}
                {videoUrl && (
                  <div className="video-controls">
                    <button className="play-button" onClick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
                      {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                    </button>
                    <span>{formatTime(playhead)} / {formatTime(videoDuration)}</span>
                    <input aria-label="Video position" type="range" min={trimStart} max={Math.max(trimStart + 0.1, trimEnd)} step="0.01" value={Math.min(playhead, Math.max(trimStart, trimEnd))} onChange={(event) => seekVideo(Number(event.target.value))} />
                  </div>
                )}
              </div>
            )}
            <div className="canvas-footer">
              <span>{status}</span>
              <span>{mode === "image" && canvasSize.width ? `${canvasRef.current?.width ?? canvasSize.width} × ${canvasRef.current?.height ?? canvasSize.height} px` : mode === "video" && videoDuration ? `${videoDuration.toFixed(1)} sec` : "Workspace"}</span>
            </div>
          </div>

          <section className="timeline-panel">
            <div className="timeline-heading">
              <div><strong>{mode === "image" ? "LOOK PRESETS" : "CLIP TIMELINE"}</strong><small>{mode === "image" ? "Choose a starting point for your look" : "Single-source trim preview"}</small></div>
              <button className="small-add" onClick={() => (mode === "image" ? imageInputRef.current?.click() : videoInputRef.current?.click())} aria-label="Add media">+</button>
            </div>
            {mode === "image" ? (
              <div className="preset-strip">
                {PRESETS.map((preset) => (
                  <button className="preset-card" key={preset.name} onClick={() => applyPreset(preset.values)} disabled={!imageElement}>
                    <span className={`preset-swatch ${preset.className}`}>{imageUrl && <img src={imageUrl} alt="" />}</span>
                    <small>{preset.name}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="video-timeline">
                <div className="time-ruler"><span>{formatTime(0)}</span><span>{formatTime(videoDuration * 0.25)}</span><span>{formatTime(videoDuration * 0.5)}</span><span>{formatTime(videoDuration * 0.75)}</span><span>{formatTime(videoDuration)}</span></div>
                <div className="timeline-track">
                  <span className="track-label"><Video size={13} /> VIDEO</span>
                  <div className="track-bar">
                    {videoUrl ? <div className="video-clip" style={{ left: `${videoDuration ? (trimStart / videoDuration) * 100 : 0}%`, width: `${videoDuration ? ((trimEnd - trimStart) / videoDuration) * 100 : 100}%` }}><Film size={13} /><span>{videoName}</span></div> : <span className="empty-track-label">Import a video clip to begin</span>}
                  </div>
                </div>
                <div className="timeline-track audio-track">
                  <span className="track-label"><AudioLines size={13} /> AUDIO</span>
                  <div className="track-bar"><span className="empty-track-label">Separate music and sound-effect tracks are planned</span></div>
                </div>
              </div>
            )}
          </section>
        </section>

        <aside className="properties-panel">
          {mode === "image" ? (
            <>
              <div className="panel-tabs">
                <button className={imagePanel === "adjust" ? "panel-tab active" : "panel-tab"} onClick={() => setImagePanel("adjust")}><SlidersHorizontal size={14} /> Adjust</button>
                <button className={imagePanel === "crop" ? "panel-tab active" : "panel-tab"} onClick={() => setImagePanel("crop")}><Crop size={14} /> Crop</button>
              </div>
              {imagePanel === "adjust" ? (
                <>
                  <div className="panel-title"><div><SlidersHorizontal size={16} /><strong>Adjustments</strong></div><button onClick={resetImage} disabled={!imageElement}>Reset</button></div>
                  <p className="panel-hint">Fine-tune the image appearance</p>
                  <div className="control-list">
                    {([
                      ["Brightness", "brightness", 0, 200, "%"],
                      ["Contrast", "contrast", 0, 200, "%"],
                      ["Saturation", "saturation", 0, 200, "%"],
                      ["Blur", "blur", 0, 20, "px"],
                      ["Grayscale", "grayscale", 0, 100, "%"],
                      ["Sepia", "sepia", 0, 100, "%"],
                      ["Hue", "hue", -180, 180, "°"],
                      ["Invert", "invert", 0, 100, "%"],
                    ] as const).map(([label, key, min, max, unit]) => (
                      <label className="range-control" key={key}>
                        <span><b>{label}</b><output>{edit.adjustments[key]}{unit}</output></span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={edit.adjustments[key]}
                          onPointerDown={beginEditGesture}
                          onPointerUp={endEditGesture}
                          onPointerCancel={endEditGesture}
                          onKeyDown={beginEditGesture}
                          onKeyUp={endEditGesture}
                          onBlur={endEditGesture}
                          onChange={(event) => changeAdjustment(key, Number(event.target.value))}
                          disabled={!imageElement}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="panel-divider" />
                  <div className="panel-title"><div><WandSparkles size={16} /><strong>Quick tools</strong></div></div>
                  <button className="quick-tool" onClick={() => applyPreset({ brightness: 106, contrast: 112, saturation: 110 })} disabled={!imageElement}>
                    <Sparkles size={16} /><span><b>Auto enhance</b><small>Apply a balanced adjustment preset</small></span>
                  </button>
                  <button className="quick-tool" onClick={() => setTextModalOpen(true)} disabled={!imageElement}>
                    <Type size={16} /><span><b>Text overlay</b><small>Style a headline on the image</small></span>
                  </button>
                  <div className="panel-divider" />
                  <div className="panel-title"><div><Layers3 size={16} /><strong>Current elements</strong></div></div>
                  <div className="layer-row"><ImageIcon size={15} /><span>{imageName}</span><i>●</i></div>
                  {edit.textEnabled && edit.text.trim() && <div className="layer-row"><Type size={15} /><span>Text overlay</span><i>●</i></div>}
                  <p className="panel-note">Multiple selectable layers, masks and blend modes are planned. This version exports a flattened image.</p>
                </>
              ) : (
                <>
                  <div className="panel-title"><div><Crop size={16} /><strong>Crop image</strong></div><button onClick={() => setCropPreset("original")} disabled={!imageElement}>Reset</button></div>
                  <p className="panel-hint">Choose a ratio, then refine the crop frame</p>
                  <div className="crop-ratios">
                    {CROP_RATIOS.map((ratio) => <button key={ratio} className={edit.cropRatio === ratio ? "ratio-button active" : "ratio-button"} onClick={() => setCropPreset(ratio)} disabled={!imageElement}>{ratio === "original" ? "Original" : ratio === "free" ? "Free" : ratio}</button>)}
                  </div>
                  <div className="panel-divider" />
                  {([
                    ["Width", "width"],
                    ["Height", "height"],
                    ["Horizontal position", "x"],
                    ["Vertical position", "y"],
                  ] as const).map(([label, key]) => (
                    <label className="range-control crop-slider" key={key}>
                      <span><b>{label}</b><output>{Math.round(edit.crop[key] * 100)}%</output></span>
                      <input
                        type="range"
                        min={key === "width" || key === "height" ? 20 : 0}
                        max={key === "width" || key === "height" ? 100 : 80}
                        value={Math.round(edit.crop[key] * 100)}
                        onPointerDown={beginEditGesture}
                        onPointerUp={endEditGesture}
                        onPointerCancel={endEditGesture}
                        onKeyDown={beginEditGesture}
                        onKeyUp={endEditGesture}
                        onBlur={endEditGesture}
                        onChange={(event) => {
                          const value = Number(event.target.value) / 100;
                          updateCrop(key, value);
                        }}
                        disabled={!imageElement}
                      />
                    </label>
                  ))}
                  <p className="panel-note">Crop is non-destructive while you edit. The exported file uses the visible crop area at the source image's pixel resolution.</p>
                </>
              )}
              <div className="panel-divider" />
              <div className="panel-title"><div><ArrowDownToLine size={16} /><strong>Image export</strong></div></div>
              <label className="export-setting"><span>Format</span><select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "image/png" | "image/jpeg")}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>
              {exportFormat === "image/jpeg" && <label className="range-control export-quality"><span><b>JPEG quality</b><output>{jpegQuality}%</output></span><input type="range" min="50" max="100" value={jpegQuality} onChange={(event) => setJpegQuality(Number(event.target.value))} /></label>}
            </>
          ) : (
            <>
              <div className="panel-title"><div><SlidersHorizontal size={16} /><strong>Clip settings</strong></div><button onClick={() => { setSpeed(1); setVolume(1); if (videoRef.current) { videoRef.current.playbackRate = 1; videoRef.current.volume = 1; } }}>Reset</button></div>
              <p className="panel-hint">Adjust playback and clip in/out points</p>
              <div className="control-list">
                <label className="range-control"><span><b>Playback speed</b><output>{speed.toFixed(2)}×</output></span><input type="range" min="0.25" max="2" step="0.05" value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (videoRef.current) videoRef.current.playbackRate = value; }} disabled={!videoUrl} /></label>
                <label className="range-control"><span><b>Volume</b><output>{Math.round(volume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (videoRef.current) videoRef.current.volume = value; }} disabled={!videoUrl} /></label>
              </div>
              <div className="panel-divider" />
              <div className="panel-title"><div><Scissors size={16} /><strong>Trim clip</strong></div></div>
              <div className="trim-control">
                <label><span>Start</span><output>{formatTime(trimStart)}</output></label>
                <input type="range" min="0" max={Math.max(videoDuration, 0.1)} step="0.05" value={Math.min(trimStart, videoDuration)} onChange={(event) => { const value = Math.min(Number(event.target.value), trimEnd - 0.1); setTrimStart(Math.max(0, value)); if (playhead < value) { setPlayhead(value); if (videoRef.current) videoRef.current.currentTime = value; } }} disabled={!videoUrl} />
                <label><span>End</span><output>{formatTime(trimEnd)}</output></label>
                <input type="range" min="0" max={Math.max(videoDuration, 0.1)} step="0.05" value={Math.min(trimEnd, videoDuration)} onChange={(event) => { const value = Math.max(trimStart + 0.1, Number(event.target.value)); setTrimEnd(value); if (playhead > value) { setPlayhead(value); if (videoRef.current) videoRef.current.currentTime = value; } }} disabled={!videoUrl} />
                <small>Export records only the selected range.</small>
              </div>
              <div className="panel-divider" />
              <div className="panel-title"><div><Music2 size={16} /><strong>Audio</strong></div></div>
              <div className="audio-note"><AudioLines size={20} /><span>Original clip audio is retained when the browser exposes it in the media capture stream.</span></div>
              <div className="panel-divider" />
              <div className="panel-title"><div><ArrowDownToLine size={16} /><strong>Export format</strong></div></div>
              <div className="format-note"><b>WEBM or MP4 · browser-dependent</b><small>The recorder selects a supported MIME type. Multi-track editing, effects rendering and professional export need the planned timeline and encoding pipeline.</small></div>
            </>
          )}
        </aside>
      </main>

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => loadImage(event.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={(event) => loadVideo(event.target.files?.[0])} />

      {textModalOpen && (
        <div className="modal-backdrop" onClick={() => setTextModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><strong>Text overlay</strong><button onClick={() => setTextModalOpen(false)}>×</button></div>
            <label className="modal-field">Text<input value={edit.text} onChange={(event) => updateEdit((current) => ({ ...current, text: event.target.value }))} placeholder="Write a short headline" autoFocus /></label>
            <label className="modal-field">Text colour<input type="color" value={edit.textColor} onChange={(event) => updateEdit((current) => ({ ...current, textColor: event.target.value }))} /></label>
            <label className="range-control modal-range"><span><b>Text size</b><output>{edit.textSize}% of image width</output></span><input type="range" min="2" max="10" value={edit.textSize} onChange={(event) => updateEdit((current) => ({ ...current, textSize: Number(event.target.value) }))} /></label>
            <label className="range-control modal-range"><span><b>Vertical position</b><output>{edit.textY}%</output></span><input type="range" min="5" max="95" value={edit.textY} onChange={(event) => updateEdit((current) => ({ ...current, textY: Number(event.target.value) }))} /></label>
            <div className="modal-actions">
              <button className="quiet-button" onClick={() => commitEdit((current) => ({ ...current, textEnabled: false }))}>Remove text</button>
              <button className="primary-button" onClick={() => { commitEdit((current) => ({ ...current, textEnabled: Boolean(current.text.trim()) })); setTextModalOpen(false); setStatus("Text overlay applied"); }}><Check size={15} /> Apply text</button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal-card help-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><strong>Editor guide</strong><button onClick={() => setShowHelp(false)}>×</button></div>
            <p><b>Image Studio:</b> import or drop a photo, apply a preset, adjust colour and effects, crop to a ratio, rotate or flip, add styled text, compare with the original, then export PNG or JPEG.</p>
            <p><b>Video Studio:</b> import one video, preview and seek, choose trim in/out points, adjust speed and volume, then export a browser-recorded WebM or MP4 where supported.</p>
            <p><b>Current limits:</b> the video editor is a single-clip trimming foundation. Multi-track timelines, transitions, keyframes, captions, chroma key, motion tracking, stabilisation and AI tools are not implemented yet. Image layers and masks are also roadmap items.</p>
            <button className="primary-button" onClick={() => setShowHelp(false)}><Check size={15} /> Close guide</button>
          </div>
        </div>
      )}
    </div>
  );
}
