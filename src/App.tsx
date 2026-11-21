import { useCallback, useEffect, useRef, useState } from "react";
import {
  Aperture, ArrowDownToLine, AudioLines, Check, ChevronDown, CircleHelp,
  Crop, Film, FlipHorizontal, FlipVertical, FolderOpen, Image as ImageIcon,
  Layers3, Maximize2, Music2, Pause, Play, RotateCcw, Scissors,
  SlidersHorizontal, Sparkles, Type, Upload, Video, WandSparkles, ZoomIn,
  ZoomOut,
} from "lucide-react";

type Mode = "image" | "video";
type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
};

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
};

const PRESETS: { name: string; values: Partial<Adjustments>; className: string }[] = [
  { name: "Original", values: {}, className: "preset-original" },
  { name: "Mono", values: { grayscale: 100, saturation: 0 }, className: "preset-mono" },
  { name: "Warm", values: { sepia: 35, saturation: 112, contrast: 106 }, className: "preset-warm" },
  { name: "Cool", values: { saturation: 88, contrast: 108, brightness: 104 }, className: "preset-cool" },
  { name: "Fade", values: { contrast: 82, brightness: 108, saturation: 78 }, className: "preset-fade" },
  { name: "Punch", values: { contrast: 132, saturation: 132 }, className: "preset-punch" },
];

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
  ].join(" ");
}

export default function App() {
  const [mode, setMode] = useState<Mode>("image");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("Untitled image");
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [overlayText, setOverlayText] = useState("");
  const [showTextOverlay, setShowTextOverlay] = useState(false);

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

  const imageFilter = getFilterCss(adjustments);

  const loadImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose a supported image file.");
      return;
    }
    setImageUrl(URL.createObjectURL(file));
    setImageName(file.name);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setZoom(1);
    setOverlayText("");
    setShowTextOverlay(false);
    setStatus("Image loaded");
  };

  useEffect(() => {
    if (!imageUrl) {
      setImageElement(null);
      setCanvasSize({ width: 0, height: 0 });
      return;
    }
    const image = new window.Image();
    image.onload = () => {
      setImageElement(image);
      setCanvasSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setStatus("The selected image could not be opened.");
    image.src = imageUrl;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const sourceWidth = imageElement.naturalWidth;
    const sourceHeight = imageElement.naturalHeight;
    const quarterTurn = Math.abs(rotation % 180) === 90;
    const outputWidth = quarterTurn ? sourceHeight : sourceWidth;
    const outputHeight = quarterTurn ? sourceWidth : sourceHeight;

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, outputWidth, outputHeight);
    context.save();
    context.translate(outputWidth / 2, outputHeight / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.filter = imageFilter;
    context.drawImage(imageElement, -sourceWidth / 2, -sourceHeight / 2);
    context.restore();

    if (showTextOverlay && overlayText.trim()) {
      context.save();
      const fontSize = Math.max(22, Math.round(outputWidth * 0.045));
      context.font = `700 ${fontSize}px Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(0,0,0,.65)";
      context.lineWidth = Math.max(2, fontSize * 0.12);
      context.fillStyle = "#ffffff";
      context.strokeText(overlayText, outputWidth / 2, outputHeight * 0.84, outputWidth * 0.88);
      context.fillText(overlayText, outputWidth / 2, outputHeight * 0.84, outputWidth * 0.88);
      context.restore();
    }
  }, [imageElement, rotation, flipX, flipY, imageFilter, showTextOverlay, overlayText]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  useEffect(() => {
    if (!videoUrl) {
      setVideoDuration(0);
      setPlayhead(0);
      setTrimStart(0);
      setTrimEnd(0);
      return;
    }
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const updateAdjustment = (key: keyof Adjustments, value: number) => {
    setAdjustments((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (values: Partial<Adjustments>) => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS, ...values });
    setStatus("Filter preset applied");
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) {
      setStatus("Import an image before exporting.");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Could not export this image.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${imageName.replace(/\.[^.]+$/, "")}-edited.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("PNG export created");
    }, "image/png");
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
    const safeTime = Math.min(Math.max(time, trimStart), Math.max(trimStart, trimEnd));
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
    const mediaVideo = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    if (!mediaVideo.captureStream || typeof MediaRecorder === "undefined") {
      setStatus("This browser cannot record a video export. Try a current desktop Chrome or Edge browser.");
      return;
    }
    if (trimEnd <= trimStart) {
      setStatus("Set an end point after the start point.");
      return;
    }

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    try {
      stream = mediaVideo.captureStream();
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder?.mimeType || "video/webm" });
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `${videoName.replace(/\.[^.]+$/, "")}-edited.webm`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        stream?.getTracks().forEach((track) => track.stop());
        setStatus("WebM recording exported. Review the file before sharing.");
      };
      video.pause();
      video.playbackRate = speed;
      video.volume = volume;
      video.currentTime = trimStart;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      recorder.start(250);
      await video.play();
      const finish = () => {
        video.pause();
        if (recorder?.state === "recording") recorder.stop();
        video.removeEventListener("timeupdate", checkEnd);
        setIsPlaying(false);
      };
      const checkEnd = () => {
        if (video.currentTime >= trimEnd) finish();
      };
      video.addEventListener("timeupdate", checkEnd);
      video.addEventListener("ended", finish, { once: true });
      setIsPlaying(true);
      setStatus("Recording video export…");
    } catch {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      setIsPlaying(false);
      setStatus("Video export failed in this browser.");
    }
  };

  const resetImage = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setStatus("Image adjustments reset");
  };

  const canExportImage = Boolean(imageElement);
  const canExportVideo = Boolean(videoUrl && videoDuration > 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Frameforge home">
          <span className="brand-mark"><Aperture size={19} /></span>
          <span className="brand-copy"><strong>FRAMEFORGE</strong><small>CREATIVE STUDIO</small></span>
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
          <button className="rail-item" onClick={() => setStatus("Crop and aspect-ratio tools are planned for the next editing increment.")}>
            <Crop size={18} /><span>Crop</span>
          </button>
          <button className="rail-item" onClick={() => mode === "image" ? setShowTextOverlay(true) : setStatus("Video title overlays are planned for the timeline renderer.")}>
            <Type size={18} /><span>Text</span>
          </button>
          <button className="rail-item" onClick={() => setStatus("Layer stack and compositing controls are in the roadmap.")}>
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
                  <button className="tool-button" title="Rotate left" onClick={() => setRotation((value) => value - 90)} disabled={!imageElement}><RotateCcw size={15} /></button>
                  <button className="tool-button" title="Flip horizontally" onClick={() => setFlipX((value) => !value)} disabled={!imageElement}><FlipHorizontal size={15} /></button>
                  <button className="tool-button" title="Flip vertically" onClick={() => setFlipY((value) => !value)} disabled={!imageElement}><FlipVertical size={15} /></button>
                </>
              ) : (
                <button className="tool-button" title="Set trim start to playhead" onClick={() => setTrimStart(Math.min(playhead, trimEnd - 0.1))} disabled={!videoUrl}><Scissors size={15} /></button>
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
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (mode === "image") loadImage(file);
              else loadVideo(file);
            }}
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
                  <small>PNG · JPG · WEBP · GIF (first frame)</small>
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
              <span>{mode === "image" && canvasSize.width ? `${canvasSize.width} × ${canvasSize.height} px` : mode === "video" && videoDuration ? `${videoDuration.toFixed(1)} sec` : "Workspace"}</span>
            </div>
          </div>

          <section className="timeline-panel">
            <div className="timeline-heading">
              <div><strong>{mode === "image" ? "LOOK PRESETS" : "CLIP TIMELINE"}</strong><small>{mode === "image" ? "Choose a starting point for your look" : "Trim the selected source clip"}</small></div>
              <button className="small-add" onClick={() => (mode === "image" ? imageInputRef.current?.click() : videoInputRef.current?.click())} aria-label="Add media">+</button>
            </div>
            {mode === "image" ? (
              <div className="preset-strip">
                {PRESETS.map((preset) => (
                  <button className="preset-card" key={preset.name} onClick={() => applyPreset(preset.values)}>
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
                  <div className="track-bar"><span className="empty-track-label">Separate music tracks are planned next</span></div>
                </div>
              </div>
            )}
          </section>
        </section>

        <aside className="properties-panel">
          {mode === "image" ? (
            <>
              <div className="panel-title"><div><SlidersHorizontal size={16} /><strong>Adjustments</strong></div><button onClick={resetImage}>Reset</button></div>
              <p className="panel-hint">Fine-tune the image appearance</p>
              <div className="control-list">
                {([
                  ["Brightness", "brightness", 0, 200],
                  ["Contrast", "contrast", 0, 200],
                  ["Saturation", "saturation", 0, 200],
                  ["Blur", "blur", 0, 20],
                  ["Grayscale", "grayscale", 0, 100],
                  ["Sepia", "sepia", 0, 100],
                ] as const).map(([label, key, min, max]) => (
                  <label className="range-control" key={key}>
                    <span><b>{label}</b><output>{key === "blur" ? `${adjustments[key]}px` : `${adjustments[key]}%`}</output></span>
                    <input type="range" min={min} max={max} value={adjustments[key]} onChange={(event) => updateAdjustment(key, Number(event.target.value))} disabled={!imageElement} />
                  </label>
                ))}
              </div>
              <div className="panel-divider" />
              <div className="panel-title"><div><WandSparkles size={16} /><strong>Quick tools</strong></div></div>
              <button className="quick-tool" onClick={() => { setAdjustments({ brightness: 106, contrast: 112, saturation: 110, blur: 0, grayscale: 0, sepia: 0 }); setStatus("Basic enhancement applied"); }} disabled={!imageElement}>
                <Sparkles size={16} /><span><b>Auto enhance</b><small>Apply a balanced adjustment preset</small></span>
              </button>
              <button className="quick-tool" onClick={() => setShowTextOverlay(true)} disabled={!imageElement}>
                <Type size={16} /><span><b>Text overlay</b><small>Add a headline to the image</small></span>
              </button>
              <div className="panel-divider" />
              <div className="panel-title"><div><Layers3 size={16} /><strong>Layers</strong></div></div>
              <div className="layer-row"><ImageIcon size={15} /><span>{imageName}</span><i>●</i></div>
              {showTextOverlay && overlayText.trim() && <div className="layer-row"><Type size={15} /><span>Text overlay</span><i>●</i></div>}
              <p className="panel-note">Layer stacking and draggable text positioning are planned for the next increment.</p>
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
                <input type="range" min="0" max={Math.max(videoDuration, 0.1)} step="0.05" value={Math.min(trimStart, videoDuration)} onChange={(event) => { const value = Math.min(Number(event.target.value), trimEnd - 0.1); setTrimStart(Math.max(0, value)); }} disabled={!videoUrl} />
                <label><span>End</span><output>{formatTime(trimEnd)}</output></label>
                <input type="range" min="0" max={Math.max(videoDuration, 0.1)} step="0.05" value={Math.min(trimEnd, videoDuration)} onChange={(event) => setTrimEnd(Math.max(trimStart + 0.1, Number(event.target.value)))} disabled={!videoUrl} />
                <small>Export records only the selected range.</small>
              </div>
              <div className="panel-divider" />
              <div className="panel-title"><div><Music2 size={16} /><strong>Audio</strong></div></div>
              <div className="audio-note"><AudioLines size={20} /><span>Original clip audio is retained in the recording when the browser exposes an audio track.</span></div>
              <div className="panel-divider" />
              <div className="panel-title"><div><ArrowDownToLine size={16} /><strong>Export format</strong></div></div>
              <div className="format-note"><b>WEBM · browser recording</b><small>MP4 export and multi-track rendering need a dedicated encoding and muxing pipeline.</small></div>
            </>
          )}
        </aside>
      </main>

      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => loadImage(event.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={(event) => loadVideo(event.target.files?.[0])} />

      {showTextOverlay && (
        <div className="modal-backdrop" onClick={() => setShowTextOverlay(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><strong>Image text overlay</strong><button onClick={() => setShowTextOverlay(false)}>×</button></div>
            <label className="modal-field">Text<input value={overlayText} onChange={(event) => setOverlayText(event.target.value)} placeholder="Write a short headline" autoFocus /></label>
            <p>The text is placed near the bottom centre of the exported image.</p>
            <button className="primary-button" onClick={() => { setShowTextOverlay(false); setStatus("Text overlay applied"); }}><Check size={15} /> Apply text</button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal-card help-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><strong>Editor guide</strong><button onClick={() => setShowHelp(false)}>×</button></div>
            <p><b>Image Studio:</b> import a photo, apply a preset, tune adjustments, rotate or flip, add a basic text overlay, then export a PNG.</p>
            <p><b>Video Studio:</b> import one video, preview it, choose trim in/out points, adjust speed and volume, then export a browser-recorded WebM.</p>
            <p><b>Current limits:</b> this first increment does not yet include crop handles, multiple video tracks, transitions, keyframes, captions, chroma key, AI tools or MP4 export.</p>
            <button className="primary-button" onClick={() => setShowHelp(false)}><Check size={15} /> Close guide</button>
          </div>
        </div>
      )}
    </div>
  );
}