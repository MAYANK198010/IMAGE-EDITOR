# IMAGE-EDITOR

A browser-based workspace for image editing and short-form video editing.

> Status: initial scaffold. This repository was empty before initialization.

## Product direction

### Image Studio
- Import local images (PNG, JPG, WEBP, GIF)
- Crop, rotate and flip
- Brightness, contrast, saturation, blur, grayscale and sepia adjustments
- Filter presets
- Text and shape overlays
- Layer ordering, undo/redo and PNG/JPEG export

### Video Studio
- Import local video and audio
- Preview, seek, trim and split clips
- Multiple video/audio tracks
- Playback speed, volume, titles, transitions and aspect-ratio presets
- Caption/subtitle support
- Export to browser-supported formats with a robust muxing pipeline

## Research and architecture notes

- **Image editing:** Konva/react-konva provides a practical foundation for a layered canvas, transforms, filters and raster export. Preserve original file assets and keep edits as serializable project state wherever possible.
- **Video editing:** use an explicit timeline/project model with source media, clip in/out points, track placement, speed, effects and keyframes. A HTML video preview alone is not a full video editing engine.
- **Browser APIs:** WebCodecs provides low-level frame/audio decode and encode interfaces. It does not itself demux input media containers or mux encoded output, so a container/muxing library is also needed.
- **Export fallback:** FFmpeg.wasm can process selected media formats in Web Workers, but should be treated as an optional path because CPU and memory usage can be substantial.
- **Scope:** AI background removal, generative fill, professional color grading, motion tracking and cloud rendering require dedicated models/services or a more substantial backend. They should not be advertised as working features until implemented.

## Planned stack

- React + TypeScript + Vite
- Tailwind CSS
- Konva / react-konva for image composition
- Browser media APIs for video preview
- WebCodecs plus an MP4/WebM muxer for future optimized export
- FFmpeg.wasm as an optional processing fallback

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Reference documentation

- Konva: https://konvajs.org/docs/
- Photopea layers: https://www.photopea.com/learn/layers
- Photopea adjustments and filters: https://www.photopea.com/learn/adjustments-filters
- WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- FFmpeg.wasm overview: https://ffmpegwasm.netlify.app/docs/overview/
- Remotion client-side rendering: https://www.remotion.dev/docs/client-side-rendering

This is an initial foundation, not a feature-complete replacement for commercial desktop editors.