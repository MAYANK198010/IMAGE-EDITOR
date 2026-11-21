# IMAGE-EDITOR — FrameForge

A browser-based editor for still images and short-form video clips. The project is local-first: imported media is processed in the browser and is not uploaded to a server by this initial implementation.

## Implemented now

### Image Studio
- Import local images through the browser file picker or drag-and-drop.
- Adjust brightness, contrast, saturation, blur, grayscale, sepia, hue and invert.
- Apply eight built-in filter presets.
- Crop using Original, Free, 1:1, 4:5, 16:9 and 9:16 ratios, then refine crop size and position with sliders.
- Rotate and flip the image.
- Add one styled text overlay with editable text, colour, size and vertical position.
- Compare the edit with the original using the press-and-hold preview control.
- Undo and redo image edits.
- Export flattened PNG or JPEG, with a JPEG quality setting.

### Video Studio
- Import and preview one local video clip.
- Seek through the source video and set start/end trim points.
- Adjust playback speed and original clip volume.
- Record the selected range to a supported MediaRecorder format (typically WebM; MP4 only when the browser exposes a compatible recorder MIME type).

## Current limitations

This is an early browser editor, not yet a full Photoshop, Premiere, Canva or CapCut replacement.

- Image editing currently exports a flattened canvas; multiple selectable layers, masks, blend modes, object selection, retouch brushes and draggable text are not implemented.
- Crop is controlled through ratio and numeric sliders; an interactive crop marquee/handles are not yet implemented.
- Video editing is a single-source clip trimmer. Multiple tracks, multiple clips, split/ripple editing, transitions, keyframes, speed curves, text/caption tracks, colour effects, chroma key, stabilisation, motion tracking and audio mixing are not implemented.
- Video export relies on browser media capture and recorder support. Output format and codec availability vary by browser. There is no full MP4/WebM container pipeline yet.
- AI background removal, generative fill, object removal, transcript editing and cloud rendering are not implemented.

## Technology

- React 19 + TypeScript + Vite
- Canvas 2D API for image composition, transforms, adjustments and raster export
- HTMLVideoElement for video preview and seeking
- MediaRecorder + media-element capture where supported for basic video recording
- Lucide React icons

The next architecture milestone is to formalise the image document/layer model and build a real multi-track video timeline. For robust video export, evaluate WebCodecs together with a container demuxer/muxer; WebCodecs alone does not create finished MP4/WebM files. FFmpeg.wasm should remain an optional fallback because browser-side transcoding can be CPU- and memory-intensive.

## Run locally

Requires a current Node.js release compatible with the engine declared in `package.json`.

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

## Research and roadmap

See [docs/FEATURE-MATRIX.md](docs/FEATURE-MATRIX.md) for the competitor feature benchmark, full feature inventory, implementation status, architecture direction and delivery priorities.

## Technical references

- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [HTMLMediaElement.captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/captureStream)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [Mediabunny](https://mediabunny.dev/guide/introduction)
- [FFmpeg.wasm overview](https://ffmpegwasm.netlify.app/docs/overview/)
- [Photopea layers](https://www.photopea.com/learn/layers)
- [Photopea adjustments and filters](https://www.photopea.com/learn/adjustments-filters)

