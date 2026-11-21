import { useCallback, useState } from "react";
import {
  Aperture, CircleHelp, Film, Image as ImageIcon, PanelRight,
  ArrowDownToLine, Clapperboard, Sparkles,
} from "lucide-react";
import ImageStudio from "./editor/ImageStudio";
import VideoStudio from "./editor/VideoStudio";

type WorkspaceMode = "image" | "video";

export default function App() {
  const [mode, setMode] = useState<WorkspaceMode>("image");
  const [status, setStatus] = useState("Ready");
  const [helpOpen, setHelpOpen] = useState(false);

  const reportStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);

  return (
    <div className="app-shell frameforge-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="FrameForge home">
          <span className="brand-mark"><Aperture size={19} /></span>
          <span className="brand-copy">
            <strong>FRAMEFORGE</strong>
            <small>CREATIVE STUDIO</small>
          </span>
        </a>

        <div className="mode-switch" role="tablist" aria-label="Choose editor">
          <button
            className={mode === "image" ? "mode active" : "mode"}
            role="tab"
            aria-selected={mode === "image"}
            onClick={() => setMode("image")}
          >
            <ImageIcon size={15} /> Image Studio
          </button>
          <button
            className={mode === "video" ? "mode active" : "mode"}
            role="tab"
            aria-selected={mode === "video"}
            onClick={() => setMode("video")}
          >
            <Film size={15} /> Video Studio
          </button>
        </div>

        <div className="top-actions">
          <span className="local-state"><i /> Files stay on this device</span>
          <button className="quiet-button" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={16} /> Guide
          </button>
          <span className="studio-edition"><Sparkles size={13}/> Editing workspace</span>
        </div>
      </header>

      <main className="workspace frameforge-workspace">
        {mode === "image" ? (
          <ImageStudio onStatus={reportStatus} />
        ) : (
          <VideoStudio onStatus={reportStatus} />
        )}
      </main>

      <footer className="app-statusbar">
        <span className="status-live" />
        <span>{status}</span>
        <span className="statusbar-right">
          {mode === "image" ? <ImageIcon size={13}/> : <Clapperboard size={13}/>}
          {mode === "image" ? "Image project" : "Video project"}
        </span>
      </footer>

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section className="modal-card help-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <strong>FrameForge editing guide</strong>
              <button onClick={() => setHelpOpen(false)}>×</button>
            </div>
            <h3><ImageIcon size={15}/> Image Studio</h3>
            <p>Import a base image, add independent layers, select and drag them on the canvas, resize them with the corner handle, reorder and hide layers, then adjust text, shape, frame, opacity and blend settings. Effects, crop controls and 4K still-image export are available in the right panel.</p>
            <h3><Film size={15}/> Video Studio</h3>
            <p>Import more than one video clip. Select clips to trim, split, duplicate, reorder, change speed, volume and clip effects. Add music and timed titles. Export MP4 or WebM at supported resolutions and frame rates. Export capability depends on browser codec support.</p>
            <h3><ArrowDownToLine size={15}/> Export note</h3>
            <p>4K output can require substantial device memory and processing time. Use direct-to-disk saving where the browser offers it. Unsupported codecs and resolutions are reported instead of silently producing an empty file.</p>
            <button className="primary-button" onClick={() => setHelpOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </div>
  );
}
