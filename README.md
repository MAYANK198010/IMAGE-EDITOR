# IMAGE-EDITOR — FrameForge

FrameForge is a local-first browser editor for still images and short-form video sequences. Imported files are processed in the browser; this version does not upload user media to an application server.

## Image Studio — available tools

- Import a base image and add additional image overlays.
- Real editable layers for text, shapes, frames and image overlays.
- Select layers from the layer panel or by clicking the canvas; drag to position and resize using the lower-right handle.
- Show/hide, lock/unlock, duplicate, delete, reorder and select layers.
- Change layer opacity, rotation and blend mode (Normal, Multiply, Screen, Overlay, Lighten, Darken).
- Text controls: content, colour, font family, size, weight, alignment, italic, shadow and outline.
- Shape tools: rectangle, ellipse, line and star, with fill and stroke settings.
- Frame styles: classic, double, polaroid, film strip and neon.
- Adjustments: brightness, contrast, saturation, blur, grayscale, sepia, hue, invert, vignette and grain.
- Nine presets: Original, Mono, Warm, Cool, Fade, Punch, Vintage, Dream and Negative.
- Crop presets: Original, Free, 1:1, 4:5, 16:9 and 9:16; refine crop dimensions and position with sliders.
- Rotate, flip, undo/redo and hold-to-compare with the original.
- Export flattened PNG, JPEG or WebP at original size, 1920px, 2560px or 3840px long edge. JPEG/WebP quality is adjustable.

The crop UI currently uses presets and numeric sliders; it does not yet have a draggable crop marquee. Layer masks, smart selections, brush retouching, healing, liquify and AI object removal are not implemented.

## Video Studio — available tools

- Import multiple local clips into a sequential timeline.
- Save, rename, autosave and reopen video projects locally using IndexedDB; imported media is stored with the project and can be restored in the same browser profile.
- Store edit data in a versioned project document with independent video, text and audio track records, source-time ranges, effects, and keyframe-ready timeline items.
- Preview, seek, trim in/out, split at the playhead, reorder, duplicate and delete clips.
- Change clip playback speed, volume and mute state.
- Apply per-clip brightness, contrast, saturation, blur, sepia, grayscale and hue effects.
- Choose Cut or Fade-in-from-black transitions.
- Add one timed title overlay and select its text, colour, size, vertical position and duration.
- Import one music/voice audio file, preview it in sync with the timeline and adjust its volume. Export mixes the original clip sound with the imported audio.
- Apply Classic, Film or Neon output-frame treatment.
- Export MP4 or WebM using Mediabunny and browser WebCodecs, with codec capability checks, 720p/1080p/4K target resolutions, 16:9/9:16/1:1/4:5/source framing, and 24/25/30/60 FPS options.
- Show export progress and save directly to disk where the browser supports the File System Access API.

The video timeline is currently a sequential clip editor, not a professional overlapping multi-track compositor. Multiple overlay/video tracks, multiple audio tracks, audio waveforms, keyframe animation, speed curves, cross-clip transitions, captions/subtitles, chroma key, stabilization, motion tracking and AI editing are not implemented. Export depends on the browser's available decoders, encoders and memory; a 4K preset is not a guarantee that every device can encode every source file.

## Technology

- React 19, TypeScript 7 and Vite 8
- Canvas 2D for image composition and export
- HTML video/audio elements for the interactive editor preview
- Mediabunny 1.66 for media demuxing, encoding, container writing and streaming export
- WebCodecs where supported by the browser
- Lucide React icons

## Run locally

Requires Node.js compatible with the engine version in `package.json`. The committed `package-lock.json` pins the dependency tree.

```bash
npm ci
npm run dev
npm run typecheck
npm run build
```

## Build and deployment

GitHub Actions runs TypeScript checks and a production Vite build on pushes to `main`. The Pages workflow builds `dist/` and deploys that Vite output (not a Jekyll source directory).

- [Open FrameForge](https://mayank198010.github.io/IMAGE-EDITOR/)
- [Feature matrix and competitor research](docs/FEATURE-MATRIX.md)
- [GitHub Actions](https://github.com/MAYANK198010/IMAGE-EDITOR/actions)

## Technical references

- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [Mediabunny: writing media files](https://mediabunny.dev/guide/writing-media-files)
- [Mediabunny: media sources and backpressure](https://mediabunny.dev/guide/media-sources)
- [Photopea layers](https://www.photopea.com/learn/layers)
- [Photopea adjustments and filters](https://www.photopea.com/learn/adjustments-filters)
