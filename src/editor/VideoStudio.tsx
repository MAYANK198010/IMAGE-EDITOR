import { useEffect, useMemo, useRef, useState } from "react";
import type { StreamTargetChunk } from "mediabunny";
import {
  AudioLines, ArrowDownToLine, ArrowLeft, ArrowRight, Clapperboard,
  Copy, Film, Music2, Pause, Play, Plus, Scissors, Trash2, Type, Upload,
  Volume2, Video, X,
} from "lucide-react";

type Props = { onStatus: (message: string) => void };
type VideoAdjustment = { brightness: number; contrast: number; saturation: number; blur: number; sepia: number; grayscale: number; hue: number };
type Transition = "cut" | "fade";
type VideoClip = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  muted: boolean;
  transition: Transition;
  adjustments: VideoAdjustment;
};
type AudioAsset = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  volume: number;
};
type OutputFormat = "mp4" | "webm";
type OutputResolution = "720" | "1080" | "4k";
type AspectRatio = "source" | "16:9" | "9:16" | "1:1" | "4:5";

const DEFAULT_VIDEO_ADJUSTMENT: VideoAdjustment = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  hue: 0,
};

const EMPTY_TITLE = { text: "", start: 0, end: 8, color: "#ffffff", size: 5, position: "bottom" as "top" | "center" | "bottom" };

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(value: number) {
  const safe = Math.max(0, Number.isFinite(value) ? value : 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function getClipLength(clip: VideoClip) {
  return Math.max(0, clip.trimEnd - clip.trimStart) / clip.speed;
}

function getClipStarts(clips: VideoClip[]) {
  let cursor = 0;
  return clips.map((clip) => {
    const start = cursor;
    cursor += getClipLength(clip);
    return start;
  });
}

function videoFilter(adjustment: VideoAdjustment) {
  return [
    `brightness(${adjustment.brightness}%)`,
    `contrast(${adjustment.contrast}%)`,
    `saturate(${adjustment.saturation}%)`,
    `blur(${adjustment.blur}px)`,
    `sepia(${adjustment.sepia}%)`,
    `grayscale(${adjustment.grayscale}%)`,
    `hue-rotate(${adjustment.hue}deg)`,
  ].join(" ");
}

function mimeFor(format: OutputFormat) {
  return format === "mp4" ? "video/mp4" : "video/webm";
}

function downloadBuffer(buffer: ArrayBuffer | Uint8Array, mime: string, filename: string) {
  const blob = new Blob([buffer as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function silenceBuffer(duration: number, sampleRate = 48000, channels = 2) {
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  return new AudioBuffer({ numberOfChannels: channels, length, sampleRate });
}

function processAudioBuffer(
  source: AudioBuffer,
  offsetSeconds: number,
  durationSeconds: number,
  speed: number,
  volume: number,
) {
  const sampleRate = source.sampleRate;
  const startFrame = clamp(Math.floor(offsetSeconds * sampleRate), 0, source.length);
  const availableFrames = Math.max(0, Math.min(source.length - startFrame, Math.ceil(durationSeconds * sampleRate)));
  const outputFrames = Math.max(1, Math.floor(availableFrames / Math.max(0.25, speed)));
  const output = new AudioBuffer({
    numberOfChannels: source.numberOfChannels,
    length: outputFrames,
    sampleRate,
  });
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let index = 0; index < outputFrames; index += 1) {
      const sourcePosition = startFrame + index * speed;
      const left = Math.min(source.length - 1, Math.floor(sourcePosition));
      const right = Math.min(source.length - 1, left + 1);
      const ratio = sourcePosition - left;
      target[index] = (input[left] * (1 - ratio) + input[right] * ratio) * volume;
    }
  }
  return output;
}

function fitDimensions(width: number, height: number, resolution: OutputResolution, aspect: AspectRatio) {
  const edge = resolution === "4k" ? 3840 : resolution === "1080" ? 1920 : 1280;
  let ratio = width / Math.max(1, height);
  if (aspect !== "source") {
    ratio = aspect === "16:9" ? 16 / 9 : aspect === "9:16" ? 9 / 16 : aspect === "1:1" ? 1 : 4 / 5;
  }
  let w = edge;
  let h = Math.round(edge / ratio);
  if (h > edge) {
    h = edge;
    w = Math.round(edge * ratio);
  }
  return {
    width: Math.max(2, Math.round(w / 2) * 2),
    height: Math.max(2, Math.round(h / 2) * 2),
  };
}

export default function VideoStudio({ onStatus }: Props) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioAsset, setAudioAsset] = useState<AudioAsset | null>(null);
  const [title, setTitle] = useState(EMPTY_TITLE);
  const [exportFormat, setExportFormat] = useState<OutputFormat>("mp4");
  const [resolution, setResolution] = useState<OutputResolution>("1080");
  const [aspect, setAspect] = useState<AspectRatio>("source");
  const [fps, setFps] = useState(30);
  const [frameStyle, setFrameStyle] = useState<"none" | "classic" | "film" | "neon">("none");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoTab, setVideoTab] = useState<"clips" | "audio" | "titles" | "export">("clips");
  const [dragging, setDragging] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const outputInFlight = useRef(false);
  const pendingSeekRef = useRef<{ clipId: string; time: number } | null>(null);
  const allocatedUrlsRef = useRef(new Set<string>());

  const activeIndex = clips.findIndex((clip) => clip.id === activeClipId);
  const activeClip = activeIndex >= 0 ? clips[activeIndex] : clips[0];
  const clipStarts = useMemo(() => getClipStarts(clips), [clips]);
  const totalDuration = useMemo(() => clips.reduce((sum, clip) => sum + getClipLength(clip), 0), [clips]);
  const activeTimelineStart = activeIndex >= 0 ? clipStarts[activeIndex] : 0;
  const globalPlayhead = activeClip
    ? activeTimelineStart + Math.max(0, localTime - activeClip.trimStart) / activeClip.speed
    : 0;

  useEffect(() => {
    if (!activeClip) {
      setIsPlaying(false);
      setLocalTime(0);
      return;
    }
    const element = videoRef.current;
    if (!element) return;
    const seekTo = () => {
      const pending = pendingSeekRef.current?.clipId === activeClip.id ? pendingSeekRef.current.time : activeClip.trimStart;
      const target = clamp(pending, 0, Math.max(0, element.duration || activeClip.duration));
      if (Math.abs(element.currentTime - target) > 0.04) element.currentTime = target;
      setLocalTime(target);
      pendingSeekRef.current = null;
      if (isPlaying) void element.play().catch(() => {
        setIsPlaying(false);
        onStatus("Playback was blocked. Press Play again.");
      });
    };
    if (element.readyState >= 1) seekTo();
  }, [activeClipId, activeClip?.trimStart, isPlaying, onStatus]);

  useEffect(() => {
    if (!audioAsset || !audioRef.current) return;
    audioRef.current.volume = audioAsset.volume;
  }, [audioAsset?.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && audioAsset) {
      const safeTime = clamp(globalPlayhead, 0, Math.max(0, audioAsset.duration - 0.05));
      if (Math.abs(audio.currentTime - safeTime) > 0.7) audio.currentTime = safeTime;
      void audio.play().catch(() => onStatus("Music preview could not start in this browser."));
    } else {
      audio.pause();
    }
  }, [isPlaying, activeClipId, audioAsset?.id, audioAsset?.duration, globalPlayhead, onStatus]);

  useEffect(() => () => {
    allocatedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    allocatedUrlsRef.current.clear();
  }, []);

  const appendVideoFiles = async (files: FileList | File[]) => {
    const chosen = Array.from(files).filter((file) => file.type.startsWith("video/"));
    if (!chosen.length) {
      onStatus("Choose one or more video files.");
      return;
    }
    const prepared = await Promise.all(chosen.map(async (file): Promise<VideoClip | null> => {
      const url = URL.createObjectURL(file);
      allocatedUrlsRef.current.add(url);
      try {
        const metadata = await new Promise<number>((resolve, reject) => {
          const probe = document.createElement("video");
          probe.preload = "metadata";
          probe.muted = true;
          probe.onloadedmetadata = () => {
            const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
            probe.removeAttribute("src");
            probe.load();
            resolve(duration);
          };
          probe.onerror = () => reject(new Error(`Unable to read ${file.name}`));
          probe.src = url;
        });
        if (metadata <= 0) throw new Error("Video duration is invalid");
        return {
          id: makeId(),
          file,
          url,
          name: file.name,
          duration: metadata,
          trimStart: 0,
          trimEnd: metadata,
          speed: 1,
          volume: 1,
          muted: false,
          transition: "cut",
          adjustments: DEFAULT_VIDEO_ADJUSTMENT,
        };
      } catch {
        URL.revokeObjectURL(url);
        allocatedUrlsRef.current.delete(url);
        onStatus(`Could not read video: ${file.name}`);
        return null;
      }
    }));
    const valid = prepared.filter((clip): clip is VideoClip => clip !== null);
    if (!valid.length) return;
    if (!activeClipId && clips.length === 0) setActiveClipId(valid[0].id);
    setClips((current) => [...current, ...valid]);
    setVideoTab("clips");
    onStatus(`${valid.length} video clip${valid.length === 1 ? "" : "s"} added to the timeline`);
  };

  const addAudioFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      onStatus("Choose an audio file such as MP3, WAV, M4A or OGG.");
      return;
    }
    const url = URL.createObjectURL(file);
    allocatedUrlsRef.current.add(url);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const probe = document.createElement("audio");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
        probe.onerror = () => reject(new Error("Audio metadata unavailable"));
        probe.src = url;
      });
      if (audioAsset) {
        URL.revokeObjectURL(audioAsset.url);
        allocatedUrlsRef.current.delete(audioAsset.url);
      }
      setAudioAsset({ id: makeId(), file, url, name: file.name, duration, volume: 0.8 });
      setVideoTab("audio");
      onStatus("Music track added");
    } catch {
      URL.revokeObjectURL(url);
      allocatedUrlsRef.current.delete(url);
      onStatus("Could not read that audio file.");
    }
  };

  const updateClip = (id: string, updater: (clip: VideoClip) => VideoClip) => {
    setClips((current) => current.map((clip) => clip.id === id ? updater(clip) : clip));
  };

  const selectClip = (clip: VideoClip) => {
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    pendingSeekRef.current = { clipId: clip.id, time: clip.trimStart };
    setActiveClipId(clip.id);
    setLocalTime(clip.trimStart);
  };

  const togglePlayback = async () => {
    if (!activeClip) {
      onStatus("Import a video clip before playback.");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    if (video.currentTime < activeClip.trimStart || video.currentTime >= activeClip.trimEnd - 0.02) {
      video.currentTime = activeClip.trimStart;
      setLocalTime(activeClip.trimStart);
    }
    video.playbackRate = activeClip.speed;
    video.volume = activeClip.muted ? 0 : activeClip.volume;
    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      onStatus("Playback could not start. Check that the file is supported by this browser.");
    }
  };

  const advanceToNextClip = () => {
    if (activeIndex >= 0 && activeIndex < clips.length - 1) {
      const next = clips[activeIndex + 1];
      pendingSeekRef.current = { clipId: next.id, time: next.trimStart };
      setActiveClipId(next.id);
      setLocalTime(next.trimStart);
    } else {
      setIsPlaying(false);
      if (activeClip) {
        setLocalTime(activeClip.trimEnd);
      }
    }
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    setLocalTime(video.currentTime);
    if (video.currentTime >= activeClip.trimEnd - 0.025) {
      video.pause();
      advanceToNextClip();
    }
  };

  const seekGlobal = (time: number) => {
    if (!clips.length) return;
    const safe = clamp(time, 0, totalDuration);
    let cursor = 0;
    const targetIndex = clips.findIndex((clip) => {
      const end = cursor + getClipLength(clip);
      const matches = safe <= end;
      if (!matches) cursor = end;
      return matches;
    });
    const index = targetIndex < 0 ? clips.length - 1 : targetIndex;
    const clip = clips[index];
    const local = clamp(
      clip.trimStart + Math.min(getClipLength(clip), Math.max(0, safe - clipStarts[index])) * clip.speed,
      clip.trimStart,
      clip.trimEnd,
    );
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    if (activeClip?.id === clip.id && videoRef.current) {
      videoRef.current.currentTime = local;
    } else {
      pendingSeekRef.current = { clipId: clip.id, time: local };
    }
    setActiveClipId(clip.id);
    setLocalTime(local);
  };

  const splitClip = () => {
    if (!activeClip || activeIndex < 0 || localTime <= activeClip.trimStart + 0.12 || localTime >= activeClip.trimEnd - 0.12) {
      onStatus("Move the playhead inside the selected clip before splitting.");
      return;
    }
    const first: VideoClip = { ...activeClip, id: makeId(), trimEnd: localTime };
    const second: VideoClip = { ...activeClip, id: makeId(), trimStart: localTime, transition: "fade" };
    setClips((current) => [...current.slice(0, activeIndex), first, second, ...current.slice(activeIndex + 1)]);
    pendingSeekRef.current = { clipId: second.id, time: localTime };
    setActiveClipId(second.id);
    setIsPlaying(false);
    setLocalTime(localTime);
    onStatus("Clip split into two editable segments");
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= clips.length) return;
    setClips((current) => {
      const result = [...current];
      [result[index], result[next]] = [result[next], result[index]];
      return result;
    });
  };

  const deleteClip = (id: string) => {
    const index = clips.findIndex((clip) => clip.id === id);
    if (index < 0) return;
    const removedClip = clips[index];
    const nextClips = clips.filter((clip) => clip.id !== id);
    setClips(nextClips);
    if (!nextClips.some((clip) => clip.url === removedClip.url)) {
      URL.revokeObjectURL(removedClip.url);
      allocatedUrlsRef.current.delete(removedClip.url);
    }
    const newActive = nextClips[Math.min(index, nextClips.length - 1)];
    setActiveClipId(newActive?.id ?? null);
    setIsPlaying(false);
    onStatus("Clip removed from timeline");
  };

  const removeAudioTrack = () => {
    if (!audioAsset) return;
    URL.revokeObjectURL(audioAsset.url);
    allocatedUrlsRef.current.delete(audioAsset.url);
    setAudioAsset(null);
  };

  const duplicateClip = (clip: VideoClip) => {
    const duplicate: VideoClip = { ...clip, id: makeId(), name: `${clip.name} copy`, transition: "fade" };
    setClips((current) => {
      const index = current.findIndex((item) => item.id === clip.id);
      const result = [...current];
      result.splice(index + 1, 0, duplicate);
      return result;
    });
    setActiveClipId(duplicate.id);
    setIsPlaying(false);
    onStatus("Clip duplicated");
  };

  const updateActiveAdjustment = (key: keyof VideoAdjustment, value: number) => {
    if (!activeClip) return;
    updateClip(activeClip.id, (clip) => ({
      ...clip,
      adjustments: { ...clip.adjustments, [key]: value },
    }));
  };

  const drawVideoTitle = (context: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    if (!title.text.trim() || time < title.start || time > title.end) return;
    const fontSize = Math.max(24, Math.round(width * title.size / 100));
    context.save();
    context.font = `800 ${fontSize}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0,0,0,.76)";
    context.lineWidth = Math.max(2, fontSize * 0.12);
    context.fillStyle = title.color;
    const y = title.position === "top" ? height * 0.14 : title.position === "center" ? height / 2 : height * 0.86;
    context.strokeText(title.text, width / 2, y, width * 0.88);
    context.fillText(title.text, width / 2, y, width * 0.88);
    context.restore();
  };

  const drawVideoFrame = (context: CanvasRenderingContext2D, width: number, height: number) => {
    if (frameStyle === "none") return;
    context.save();
    const thickness = Math.max(8, width * 0.012);
    if (frameStyle === "classic") {
      context.strokeStyle = "#f3f0e8";
      context.lineWidth = thickness;
      context.strokeRect(thickness / 2, thickness / 2, width - thickness, height - thickness);
    } else if (frameStyle === "neon") {
      context.shadowColor = "#af9aff";
      context.shadowBlur = thickness * 2;
      context.strokeStyle = "#b6a5ff";
      context.lineWidth = thickness * 0.4;
      context.strokeRect(thickness, thickness, width - thickness * 2, height - thickness * 2);
    } else {
      context.fillStyle = "#111018";
      context.fillRect(0, 0, width, thickness * 1.8);
      context.fillRect(0, height - thickness * 1.8, width, thickness * 1.8);
      context.fillStyle = "#e9dfc4";
      for (let x = thickness * 0.45; x < width; x += thickness * 1.8) {
        context.fillRect(x, thickness * 0.45, thickness * 0.8, thickness * 0.65);
        context.fillRect(x, height - thickness * 1.1, thickness * 0.8, thickness * 0.65);
      }
    }
    context.restore();
  };

  const renderExport = async () => {
    if (!clips.length || exporting || outputInFlight.current) return;
    outputInFlight.current = true;
    setExporting(true);
    setProgress(0);
    onStatus("Preparing video timeline export…");
    let output: import("mediabunny").Output | null = null;
    const inputs: Array<import("mediabunny").Input> = [];
    try {
      // Request the destination before any awaited dynamic imports so the
      // browser's transient user activation from the Export click is preserved.
      const fileWindow = window as Window & {
        showSaveFilePicker?: (options?: unknown) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;
      };
      const filename = \`frameforge-\${Date.now()}.\${exportFormat}\`;
      let writableFile: WritableStream<Uint8Array> | null = null;

      if (fileWindow.showSaveFilePicker) {
        try {
          const handle = await fileWindow.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: exportFormat.toUpperCase(), accept: { [mimeFor(exportFormat)]: [\`.\${exportFormat}\`] } }],
          });
          writableFile = await handle.createWritable();
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            onStatus("Export cancelled");
            return;
          }
          throw error;
        }
      }

      const media = await import("mediabunny");
      const outputFormat = exportFormat === "mp4"
        ? new media.Mp4OutputFormat()
        : new media.WebMOutputFormat();
      let target: import("mediabunny").BufferTarget | import("mediabunny").StreamTarget;
      if (writableFile) {
        // StreamTarget writes { type: "write", data, position } chunks. This
        // is also the command shape understood by FileSystemWritableFileStream.
        target = new media.StreamTarget(
          writableFile as unknown as WritableStream<StreamTargetChunk>,
          { chunked: true },
        );
      } else {
        target = new media.BufferTarget();
        if (totalDuration > 45 || resolution === "4k") {
          onStatus("This browser has no direct-to-disk export. Large/4K output may exceed available memory.");
        }
      }

      const firstClip = clips[0];
      const metadataProbe = document.createElement("video");
      metadataProbe.preload = "metadata";
      metadataProbe.src = firstClip.url;
      await new Promise<void>((resolve, reject) => {
        metadataProbe.onloadedmetadata = () => resolve();
        metadataProbe.onerror = () => reject(new Error("Could not read source video dimensions"));
      });
      const dimensions = fitDimensions(metadataProbe.videoWidth || 1920, metadataProbe.videoHeight || 1080, resolution, aspect);
      metadataProbe.removeAttribute("src");
      metadataProbe.load();

      const media = await import("mediabunny");
      const videoCodec = await media.getFirstEncodableVideoCodec(outputFormat.getSupportedVideoCodecs(), {
        width: dimensions.width,
        height: dimensions.height,
      });
      if (!videoCodec) throw new Error(`This browser cannot encode ${dimensions.width}×${dimensions.height} video with the selected format. Try WebM or a lower resolution.`);
      const audioCodec = await media.getFirstEncodableAudioCodec(outputFormat.getSupportedAudioCodecs());
      output = new media.Output({ format: outputFormat, target });
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas rendering is unavailable.");
      const videoSource = new media.CanvasSource(canvas, {
        codec: videoCodec,
        quality: new media.Quality("high"),
        hardwareAcceleration: "prefer-hardware",
      });
      output.addVideoTrack(videoSource, { frameRate: fps });

      let audioSource: import("mediabunny").AudioBufferSource | null = null;
      if (audioCodec) {
        audioSource = new media.AudioBufferSource({ codec: audioCodec, quality: new media.Quality("high") });
        output.addAudioTrack(audioSource, { name: "Original clip audio" });
      }
      let musicSource: import("mediabunny").AudioBufferSource | null = null;
      if (audioAsset && audioCodec) {
        musicSource = new media.AudioBufferSource({ codec: audioCodec, quality: new media.Quality("high") });
        output.addAudioTrack(musicSource, { name: "Music" });
      }

      output.setMetadataTags({ title: "FrameForge Edit", date: new Date() });
      await output.start();

      const timelineTotal = Math.max(0.1, totalDuration);
      let timelineCursor = 0;
      const previousFrame = document.createElement("canvas");
      previousFrame.width = dimensions.width;
      previousFrame.height = dimensions.height;
      const previousContext = previousFrame.getContext("2d");
      for (let clipIndex = 0; clipIndex < clips.length; clipIndex += 1) {
        const clip = clips[clipIndex];
        const input = new media.Input({ source: new media.BlobSource(clip.file), formats: media.ALL_FORMATS });
        inputs.push(input);
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error(`No video track found in ${clip.name}`);
        if (!(await videoTrack.canDecode())) throw new Error(`This browser cannot decode ${clip.name}`);
        const videoSink = new media.VideoSampleSink(videoTrack);
        const clipDuration = getClipLength(clip);
        const fadeDuration = clip.transition === "fade" ? Math.min(0.55, clipDuration * 0.25) : 0;
        let lastFrameAvailable = false;

        for await (const sample of videoSink.samples(clip.trimStart, clip.trimEnd)) {
          const sourceStart = Math.max(clip.trimStart, sample.timestamp);
          const localTime = Math.max(0, sourceStart - clip.trimStart) / clip.speed;
          if (localTime >= clipDuration) {
            sample.close();
            continue;
          }
          context.save();
          context.fillStyle = "#08090d";
          context.fillRect(0, 0, dimensions.width, dimensions.height);
          context.filter = videoFilter(clip.adjustments);
          if (fadeDuration > 0 && localTime < fadeDuration && lastFrameAvailable) {
            context.drawImage(previousFrame, 0, 0);
            context.globalAlpha = clamp(localTime / fadeDuration, 0, 1);
          }
          sample.drawWithFit(context, { fit: "contain" });
          context.restore();
          const globalTime = timelineCursor + localTime;
          drawVideoTitle(context, dimensions.width, dimensions.height, globalTime);
          drawVideoFrame(context, dimensions.width, dimensions.height);
          const duration = Math.min(Math.max(1 / fps, sample.duration / clip.speed), clipDuration - localTime);
          await videoSource.add(globalTime, duration);
          if (previousContext) {
            previousContext.clearRect(0, 0, dimensions.width, dimensions.height);
            previousContext.drawImage(canvas, 0, 0);
            lastFrameAvailable = true;
          }
          sample.close();
          setProgress(clamp((globalTime / timelineTotal) * 82, 0, 82));
        }
        timelineCursor += clipDuration;

        if (audioSource) {
          const audioTrack = await input.getPrimaryAudioTrack();
          let audioCursor = 0;
          if (audioTrack && await audioTrack.canDecode()) {
            const audioSink = new media.AudioBufferSink(audioTrack);
            for await (const wrapped of audioSink.buffers(clip.trimStart, clip.trimEnd)) {
              const partStart = Math.max(clip.trimStart, wrapped.timestamp);
              const partEnd = Math.min(clip.trimEnd, wrapped.timestamp + wrapped.duration);
              if (partEnd <= partStart) continue;
              const localStart = (partStart - clip.trimStart) / clip.speed;
              if (localStart > audioCursor + 0.01) {
                await audioSource.add(silenceBuffer(localStart - audioCursor));
              }
              const processed = processAudioBuffer(
                wrapped.buffer,
                partStart - wrapped.timestamp,
                partEnd - partStart,
                clip.speed,
                clip.muted ? 0 : clip.volume,
              );
              await audioSource.add(processed);
              audioCursor = Math.max(audioCursor, localStart + processed.duration);
            }
          }
          if (audioCursor < clipDuration) {
            await audioSource.add(silenceBuffer(clipDuration - audioCursor));
          }
        }
        setProgress(clamp((timelineCursor / timelineTotal) * 82, 0, 82));
      }
      videoSource.close();
      audioSource?.close();

      if (audioAsset && musicSource) {
        const audioInput = new media.Input({ source: new media.BlobSource(audioAsset.file), formats: media.ALL_FORMATS });
        inputs.push(audioInput);
        const audioTrack = await audioInput.getPrimaryAudioTrack();
        if (audioTrack && await audioTrack.canDecode()) {
          const sink = new media.AudioBufferSink(audioTrack);
          let cursor = 0;
          for await (const wrapped of sink.buffers(0, Math.min(totalDuration, audioAsset.duration))) {
            if (wrapped.timestamp > cursor + 0.01) {
              await musicSource.add(silenceBuffer(wrapped.timestamp - cursor));
            }
            const buffer = processAudioBuffer(wrapped.buffer, 0, wrapped.duration, 1, audioAsset.volume);
            await musicSource.add(buffer);
            cursor = wrapped.timestamp + wrapped.duration;
          }
          if (cursor < totalDuration) await musicSource.add(silenceBuffer(totalDuration - cursor));
        } else {
          await musicSource.add(silenceBuffer(totalDuration));
        }
        musicSource.close();
      }

      setProgress(90);
      await output.finalize();
      setProgress(100);
      const mime = await output.getMimeType();
      if (target instanceof media.BufferTarget) {
        const buffer = target.buffer;
        if (!buffer) throw new Error("The renderer did not produce a final file.");
        downloadBuffer(buffer, mime, filename);
      }
      onStatus(`Export complete · ${dimensions.width}×${dimensions.height} · ${exportFormat.toUpperCase()}`);
    } catch (error) {
      if (output && output.state !== "finalized" && output.state !== "canceled") {
        try { await output.cancel(); } catch { /* Output was already closed */ }
      }
      const message = error instanceof Error ? error.message : "Unexpected video export error.";
      onStatus(`Export failed: ${message}`);
    } finally {
      inputs.forEach((input) => {
        try { input.dispose(); } catch { /* Ignore already disposed media inputs */ }
      });
      outputInFlight.current = false;
      setExporting(false);
      setProgress(0);
    }
  };

  const activePreviewStyle = activeClip
    ? { filter: videoFilter(activeClip.adjustments), opacity: activeClip.transition === "fade" && localTime - activeClip.trimStart < 0.45 ? clamp((localTime - activeClip.trimStart) / 0.45, 0.05, 1) : 1 }
    : undefined;

  return (
    <div className="studio-grid video-studio">
      <aside className="studio-toolbar">
        <button onClick={() => videoInputRef.current?.click()}><Upload/><span>Import</span></button>
        <button onClick={splitClip} disabled={!activeClip}><Scissors/><span>Split</span></button>
        <button onClick={() => { setVideoTab("titles"); setTitle((current) => ({ ...current, text: current.text || "Your title" })); }} disabled={!clips.length}><Type/><span>Text</span></button>
        <button onClick={() => audioInputRef.current?.click()}><Music2/><span>Audio</span></button>
      </aside>

      <section className="studio-main">
        <div className="studio-toolbar-row">
          <div className="doc-label"><Video size={15}/><span>{activeClip?.name ?? "Video timeline"}</span></div>
          <div className="studio-actions">
            <button className="mini-tool" onClick={splitClip} disabled={!activeClip} title="Split at playhead"><Scissors size={15}/></button>
            <button className="mini-tool" onClick={() => setVideoTab("export")} disabled={!clips.length} title="Export settings"><ArrowDownToLine size={15}/></button>
            <span className="zoom-readout">{formatTime(globalPlayhead)} / {formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className={dragging ? "studio-canvas-area is-dragging" : "studio-canvas-area"}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void appendVideoFiles(event.dataTransfer.files); }}>
          <div className="video-preview-stage">
            {activeClip ? (
              <>
                <video
                  key={activeClip.id}
                  ref={videoRef}
                  src={activeClip.url}
                  playsInline
                  preload="auto"
                  style={activePreviewStyle}
                  onLoadedMetadata={() => {
                    const video = videoRef.current;
                    if (!video || !activeClip) return;
                    const requestedTime = pendingSeekRef.current?.clipId === activeClip.id
                      ? pendingSeekRef.current.time
                      : activeClip.trimStart;
                    const targetTime = clamp(requestedTime, 0, activeClip.duration);
                    video.currentTime = targetTime;
                    setLocalTime(targetTime);
                    pendingSeekRef.current = null;
                    video.playbackRate = activeClip.speed;
                    video.volume = activeClip.muted ? 0 : activeClip.volume;
                    if (isPlaying) void video.play().catch(() => setIsPlaying(false));
                  }}
                  onTimeUpdate={onVideoTimeUpdate}
                  onEnded={advanceToNextClip}
                />
                {title.text && globalPlayhead >= title.start && globalPlayhead <= title.end && (
                  <div className={`video-title-overlay title-${title.position}`} style={{ color: title.color, fontSize: `clamp(18px, ${title.size}vw, 58px)` }}>{title.text}</div>
                )}
                {frameStyle !== "none" && <div className={`video-frame-overlay frame-${frameStyle}`}/>}
                <div className="video-preview-controls">
                  <button className="play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <Pause size={17}/> : <Play size={17}/>}
                  </button>
                  <span>{formatTime(globalPlayhead)} / {formatTime(totalDuration)}</span>
                  <input aria-label="Timeline playhead" type="range" min="0" max={Math.max(totalDuration, 0.1)} step="0.01" value={globalPlayhead} onChange={(event) => seekGlobal(Number(event.target.value))}/>
                  <button className="mini-tool" onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }} title="Mute preview"><Volume2 size={15}/></button>
                </div>
              </>
            ) : (
              <div className="studio-empty">
                <div className="empty-art"><Clapperboard size={38}/></div>
                <h2>Build your video timeline</h2>
                <p>Import multiple clips, reorder them, trim, split, add music and titles, then export MP4 or WebM.</p>
                <button className="primary-button" onClick={() => videoInputRef.current?.click()}><Upload size={16}/> Import video clips</button>
                <small>MP4 · MOV · WebM · supported browser formats</small>
              </div>
            )}
          </div>
          <div className="studio-canvas-footer">
            <span>{clips.length} clip{clips.length === 1 ? "" : "s"} · {fps} FPS target</span>
            <span>{activeClip ? `${activeClip.speed.toFixed(2)}× speed` : "No clips"}</span>
          </div>
        </div>

        <div className="video-timeline-panel">
          <div className="video-timeline-heading">
            <div><strong>EDIT TIMELINE</strong><small>Sequence clips, overlay title and add music</small></div>
            <div className="timeline-add-actions">
              <button onClick={() => videoInputRef.current?.click()}><Plus size={14}/> Video</button>
              <button onClick={() => audioInputRef.current?.click()}><Plus size={14}/> Audio</button>
            </div>
          </div>
          <div className="video-track-row">
            <div className="video-track-label"><Video size={14}/> VIDEO</div>
            <div className="video-track-content">
              {clips.map((clip, index) => (
                <div key={clip.id} className={clip.id === activeClip?.id ? "video-timeline-clip active" : "video-timeline-clip"} style={{ flex: `${Math.max(0.35, getClipLength(clip))} 1 0` }} onClick={() => selectClip(clip)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectClip(clip); }}>
                  <div className="clip-thumb"><Film size={14}/></div>
                  <div className="clip-meta"><b>{clip.name}</b><small>{formatTime(clip.trimStart)}–{formatTime(clip.trimEnd)} · {clip.speed}×</small></div>
                  {clip.transition === "fade" && <span className="transition-tag">FADE</span>}
                  <div className="clip-actions">
                    <button onClick={(event) => { event.stopPropagation(); moveClip(index, -1); }} disabled={index === 0} title="Move left"><ArrowLeft size={12}/></button>
                    <button onClick={(event) => { event.stopPropagation(); moveClip(index, 1); }} disabled={index === clips.length - 1} title="Move right"><ArrowRight size={12}/></button>
                  </div>
                </div>
              ))}
              {!clips.length && <span className="empty-track-label">Add a video clip to begin</span>}
            </div>
          </div>
          <div className="video-track-row">
            <div className="video-track-label"><Type size={14}/> TITLE</div>
            <div className="video-track-content title-track">
              {title.text.trim() ? <button className="title-clip" onClick={() => setVideoTab("titles")}>{title.text}<small>{formatTime(title.start)}–{formatTime(title.end)}</small></button> : <span className="empty-track-label">Add a title from the Text tool</span>}
            </div>
          </div>
          <div className="video-track-row">
            <div className="video-track-label"><AudioLines size={14}/> AUDIO</div>
            <div className="video-track-content audio-track-content">
              {audioAsset ? <div className="audio-clip"><AudioLines size={13}/><span>{audioAsset.name}</span><button onClick={removeAudioTrack} title="Remove music"><X size={12}/></button></div> : <span className="empty-track-label">Add music or voice audio</span>}
            </div>
          </div>
        </div>
      </section>

      <aside className="studio-properties video-properties">
        <div className="property-tabs">
          {(["clips", "audio", "titles", "export"] as const).map((tab) => (
            <button key={tab} className={videoTab === tab ? "active" : ""} onClick={() => setVideoTab(tab)}>
              {tab === "clips" ? <Film size={14}/> : tab === "audio" ? <Music2 size={14}/> : tab === "titles" ? <Type size={14}/> : <ArrowDownToLine size={14}/>}
              {tab}
            </button>
          ))}
        </div>

        {videoTab === "clips" && (
          <div className="property-section">
            <div className="property-heading"><strong>Clip properties</strong><button onClick={splitClip} disabled={!activeClip}><Scissors size={14}/></button></div>
            {!activeClip && <p className="empty-hint">Select or import a clip to edit its trim and effects.</p>}
            {activeClip && (
              <>
                <div className="active-clip-heading"><Film size={16}/><span>{activeClip.name}</span></div>
                <label className="range-control"><span><b>Trim in</b><output>{formatTime(activeClip.trimStart)}</output></span><input type="range" min="0" max={Math.max(activeClip.duration - 0.08, 0.1)} step="0.02" value={activeClip.trimStart} onChange={(event) => { const start = Math.min(Number(event.target.value), activeClip.trimEnd - 0.08); updateClip(activeClip.id, (clip) => ({ ...clip, trimStart: Math.max(0, start) })); if (activeIndex === clips.length - 1 || activeIndex >= 0) setLocalTime(Math.max(0, start)); }}/></label>
                <label className="range-control"><span><b>Trim out</b><output>{formatTime(activeClip.trimEnd)}</output></span><input type="range" min={Math.min(activeClip.trimStart + 0.08, activeClip.duration)} max={activeClip.duration} step="0.02" value={activeClip.trimEnd} onChange={(event) => updateClip(activeClip.id, (clip) => ({ ...clip, trimEnd: Math.max(clip.trimStart + 0.08, Number(event.target.value)) }))}/></label>
                <label className="range-control"><span><b>Speed</b><output>{activeClip.speed.toFixed(2)}×</output></span><input type="range" min="0.25" max="2" step="0.05" value={activeClip.speed} onChange={(event) => updateClip(activeClip.id, (clip) => ({ ...clip, speed: Number(event.target.value) }))}/></label>
                <label className="range-control"><span><b>Volume</b><output>{activeClip.muted ? "Muted" : `${Math.round(activeClip.volume * 100)}%`}</output></span><input type="range" min="0" max="1" step="0.01" value={activeClip.volume} onChange={(event) => updateClip(activeClip.id, (clip) => ({ ...clip, volume: Number(event.target.value) }))}/></label>
                <label className="check-setting"><input type="checkbox" checked={activeClip.muted} onChange={(event) => updateClip(activeClip.id, (clip) => ({ ...clip, muted: event.target.checked }))}/> Mute source clip audio</label>
                <label className="field-control">Transition into clip<select value={activeClip.transition} onChange={(event) => updateClip(activeClip.id, (clip) => ({ ...clip, transition: event.target.value as Transition }))}><option value="cut">Cut</option><option value="fade">Fade from black</option></select></label>
                <div className="property-heading effects-heading"><strong>Clip effects</strong></div>
                {([
                  ["Brightness", "brightness", 0, 200],
                  ["Contrast", "contrast", 0, 200],
                  ["Saturation", "saturation", 0, 200],
                  ["Blur", "blur", 0, 12],
                  ["Sepia", "sepia", 0, 100],
                  ["Grayscale", "grayscale", 0, 100],
                  ["Hue", "hue", -180, 180],
                ] as const).map(([label, key, min, max]) => (
                  <label className="range-control effect-slider" key={key}><span><b>{label}</b><output>{activeClip.adjustments[key]}{key === "blur" ? "px" : key === "hue" ? "°" : "%"}</output></span><input type="range" min={min} max={max} value={activeClip.adjustments[key]} onChange={(event) => updateActiveAdjustment(key, Number(event.target.value))}/></label>
                ))}
                <div className="clip-management">
                  <button onClick={() => duplicateClip(activeClip)}><Copy size={14}/> Duplicate</button>
                  <button onClick={() => deleteClip(activeClip.id)}><Trash2 size={14}/> Delete</button>
                </div>
              </>
            )}
          </div>
        )}

        {videoTab === "audio" && (
          <div className="property-section">
            <div className="property-heading"><strong>Audio track</strong><button onClick={() => audioInputRef.current?.click()}><Plus size={15}/></button></div>
            {audioAsset ? (
              <>
                <div className="active-clip-heading"><Music2 size={16}/><span>{audioAsset.name}</span></div>
                <p className="empty-hint">This music track starts at the beginning of the edited sequence.</p>
                <audio ref={audioRef} src={audioAsset.url} controls className="audio-player"/>
                <label className="range-control"><span><b>Music volume</b><output>{Math.round(audioAsset.volume * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={audioAsset.volume} onChange={(event) => setAudioAsset((current) => current ? { ...current, volume: Number(event.target.value) } : current)}/></label>
                <button className="danger-action" onClick={removeAudioTrack}>Remove audio track</button>
              </>
            ) : (
              <>
                <p className="empty-hint">Add a music or voice audio file. It will be mixed into the exported video as a separate audio track.</p>
                <button className="primary-button export-wide" onClick={() => audioInputRef.current?.click()}><Upload size={15}/> Import audio</button>
              </>
            )}
          </div>
        )}

        {videoTab === "titles" && (
          <div className="property-section">
            <div className="property-heading"><strong>Title overlay</strong><button onClick={() => setTitle(EMPTY_TITLE)}><X size={14}/></button></div>
            <label className="field-control">Text<input value={title.text} onChange={(event) => setTitle((current) => ({ ...current, text: event.target.value }))} placeholder="Enter a title or caption"/></label>
            <div className="two-fields">
              <label className="field-control">Text colour<input type="color" value={title.color} onChange={(event) => setTitle((current) => ({ ...current, color: event.target.value }))}/></label>
              <label className="field-control">Position<select value={title.position} onChange={(event) => setTitle((current) => ({ ...current, position: event.target.value as typeof current.position }))}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
            </div>
            <label className="range-control"><span><b>Font size</b><output>{title.size}vw</output></span><input type="range" min="2" max="8" step="0.25" value={title.size} onChange={(event) => setTitle((current) => ({ ...current, size: Number(event.target.value) }))}/></label>
            <label className="range-control"><span><b>Show from</b><output>{formatTime(title.start)}</output></span><input type="range" min="0" max={Math.max(totalDuration, 0.1)} step="0.1" value={Math.min(title.start, totalDuration)} onChange={(event) => setTitle((current) => ({ ...current, start: Number(event.target.value), end: Math.max(current.end, Number(event.target.value) + 0.1) }))}/></label>
            <label className="range-control"><span><b>Show until</b><output>{formatTime(title.end)}</output></span><input type="range" min="0" max={Math.max(totalDuration, 0.1)} step="0.1" value={Math.min(title.end, totalDuration)} onChange={(event) => setTitle((current) => ({ ...current, end: Math.max(current.start + 0.1, Number(event.target.value)) }))}/></label>
            <p className="empty-hint">The same title timing and styling is used in the preview and rendered export.</p>
          </div>
        )}

        {videoTab === "export" && (
          <div className="property-section">
            <div className="property-heading"><strong>Export settings</strong></div>
            <label className="field-control">Container<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as OutputFormat)}><option value="mp4">MP4 · H.264/AAC where supported</option><option value="webm">WebM · VP9/Opus where supported</option></select></label>
            <label className="field-control">Resolution<select value={resolution} onChange={(event) => setResolution(event.target.value as OutputResolution)}><option value="720">720p HD</option><option value="1080">1080p Full HD</option><option value="4k">4K UHD · 3840px</option></select></label>
            <label className="field-control">Aspect ratio<select value={aspect} onChange={(event) => setAspect(event.target.value as AspectRatio)}><option value="source">Source clip</option><option value="16:9">16:9 Landscape</option><option value="9:16">9:16 Reel/Short</option><option value="1:1">1:1 Square</option><option value="4:5">4:5 Portrait</option></select></label>
            <label className="field-control">Frame rate<select value={fps} onChange={(event) => setFps(Number(event.target.value))}><option value={24}>24 FPS</option><option value={25}>25 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
            <label className="field-control">Frame treatment<select value={frameStyle} onChange={(event) => setFrameStyle(event.target.value as typeof frameStyle)}><option value="none">None</option><option value="classic">Classic border</option><option value="film">Film strip</option><option value="neon">Neon frame</option></select></label>
            <p className="empty-hint">The browser must support the selected codec and resolution. Large 4K projects are faster with hardware encoding and direct-to-disk saving.</p>
            {exporting && <div className="export-progress"><div><span>Rendering video…</span><b>{Math.round(progress)}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div></div>}
            <button className="primary-button export-wide" onClick={() => void renderExport()} disabled={!clips.length || exporting}>
              {exporting ? <><span className="spinner"/> Rendering…</> : <><ArrowDownToLine size={16}/> Export {exportFormat.toUpperCase()}</>}
            </button>
          </div>
        )}
      </aside>

      <input ref={videoInputRef} type="file" accept="video/*" multiple hidden onChange={(event) => { if (event.target.files) void appendVideoFiles(event.target.files); event.target.value = ""; }}/>
      <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(event) => { void addAudioFile(event.target.files?.[0]); event.target.value = ""; }}/>
    </div>
  );
}
