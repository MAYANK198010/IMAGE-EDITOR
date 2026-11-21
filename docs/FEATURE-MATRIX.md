# Feature research and implementation roadmap

Research snapshot: **21 November 2026**. This is a practical benchmark of publicly documented capabilities in browser and creator-focused editors, not a guarantee that every feature is available on every platform, region, account tier, or app version.

## 1. Benchmark of current editors

| Product | Image capabilities documented | Video / short-form capabilities documented | Useful product lesson |
|---|---|---|---|
| **Photopea** | Layer-based raster/vector editing; PSD support; layers, masks, layer styles, smart objects, adjustment layers, channels, paths; brightness, saturation, levels, curves, blur, liquify and puppet warp. | Includes a video-editing learning section, but it is best used here as the image-editing depth benchmark. | A serious image editor needs editable layers and non-destructive adjustments, not only one flattened canvas. |
| **Adobe Express** | Preset filters; brightness, contrast, saturation, warmth, sharpening and blur; background removal; crop/shape, rotate, scale, nudge, flip, resize presets, text, frames and templates. | Quick social content workflows and media assets are integrated with its design tools. | Make common social and product-photo tasks fast with presets, good defaults and simple resize/crop. |
| **CapCut** | Photo effects and overlays are part of its creator workflow; transform, masks, blend modes and color adjustments are also used across visual layers. | Trim, split, merge, speed changes and speed curves; multi-track timeline; transitions; filters and video/body effects; keyframes; masks; transform; blend modes; HSL/curves; chroma key; stabilization; optical-flow slow motion; auto captions; text-to-speech; background removal; motion tracking; voice effects; export controls for resolution, frame rate, codec and bitrate. | Short-form video editors compete on motion, captions, effects, speed curves, audio tools and fast export—not only cutting clips. |
| **Canva Video** | Design-first image/text/graphic composition and reusable templates. | Media-first multi-track timeline; video, audio and graphics on separate tracks; multiple audio tracks; clip and element timing; drag-to-trim and animation timing. | A creator editor must allow text/graphics/audio to be timed independently of the base video. |
| **Microsoft Clipchamp** | Image/video assets and templates can be combined in projects. | Trimming; AI silence removal and transcript-based editing; transitions, special effects, frames, animated overlays, color correction, filters, templates, stock assets and AI auto-compose. | Include efficient tools that remove editing friction, not just visual effects. |

### Source links

- [Photopea: product overview and supported editing capabilities](https://www.photopea.com/)
- [Photopea: layers](https://www.photopea.com/learn/layers)
- [Photopea: adjustments and filters](https://www.photopea.com/learn/adjustments-filters)
- [Photopea: smart objects](https://www.photopea.com/learn/smart-objects)
- [Adobe Express: online photo editor](https://www.adobe.com/express/feature/image/editor)
- [CapCut: advanced editing features](https://www.capcut.com/resource/how-to-use-capcut)
- [CapCut: video editing tools](https://www.capcut.com/tools/video)
- [CapCut: export and overlays](https://www.capcut.com/resource/how-to-add-capcut-overlays)
- [Canva: create and edit videos](https://www.canva.com/en_in/help/creating-and-editing-videos/)
- [Clipchamp: video editor features](https://clipchamp.com/en/video-editor/)

## 2. Full feature inventory for this product

These are feature categories to consider when planning a modern editor. They are not all implemented in the current application.

### Image editor

| Category | Features |
|---|---|
| Import and assets | Drag/drop, file picker, clipboard paste, image formats, image metadata, asset bin, recent files |
| Framing and geometry | Crop, free crop, aspect-ratio crop, resize, canvas resize, rotate, flip, straighten, perspective, guides and snapping |
| Light and tone | Exposure, brightness, contrast, highlights, shadows, whites, blacks, gamma, auto levels |
| Color | Temperature, tint, saturation, vibrance, hue, HSL, color balance, curves, levels, selective color, LUTs |
| Effects | Preset filters, blur, lens blur, sharpen, denoise, grain, vignette, glow, shadow, distortion, glitch, duotone, halftone |
| Layers and composition | Image layers, text, shapes, stickers, frames, groups, opacity, blend modes, clipping, masks, ordering, duplication and locking |
| Selection and retouch | Object/subject selection, background removal, edge refinement, brush/eraser, clone, heal, blemish removal, content-aware object removal, liquify and warp |
| Typography | Font selection, size, weight, color, alignment, spacing, outline, shadow, curved text, text presets |
| AI-assisted tools | Background removal, generative fill, object replacement/removal, upscaling, denoise, auto enhancement and subject-aware edits |
| Export | PNG/JPEG/WebP, transparency, quality/compression, dimensions, metadata, project file, batch export |

### Short-form video editor

| Category | Features |
|---|---|
| Media and timeline | Video, image and audio import; asset bin; multiple video, overlay, text and audio tracks; timeline zoom; thumbnails; snapping |
| Core editing | Trim, split, merge, reorder, duplicate, ripple delete, freeze frame, reverse, markers, clip grouping |
| Timing and motion | Playback speed, speed curves, slow motion, keyframes for position/scale/rotation/opacity/volume/effects |
| Framing | Crop, rotate, scale, position, aspect ratios (9:16, 1:1, 4:5, 16:9), safe zones and auto-reframe |
| Transitions | Dissolve, fade, wipe, slide, zoom, blur, mask and motion transitions |
| Visual effects | Filters, brightness, contrast, saturation, hue, HSL, curves, exposure, blur, sharpen, grain, glow, vignette, distortion and overlays |
| Compositing | Alpha/opacity, blend modes, masks, chroma key/green screen, picture-in-picture |
| Motion analysis | Motion tracking, stabilization, optical-flow interpolation and subject tracking |
| Text and captions | Titles, lower thirds, animated text, subtitles, auto captions, caption styling, text templates and text-to-speech |
| Audio | Music tracks, sound effects, voiceover, volume, fades, mute, ducking, noise reduction, equalizer, waveform and beat alignment |
| AI-assisted tools | Silence removal, transcript-based editing, background removal, scene detection, highlight extraction and smart reframing |
| Export | MP4/WebM, resolution, frame rate, bitrate, codec selection, aspect ratio, quality presets and progress/cancel controls |

### Cross-cutting product capabilities

- Non-destructive project state; the original imported media should remain unchanged.
- Undo/redo history and keyboard shortcuts.
- Autosave and crash-safe recovery.
- Project reopening and asset relinking.
- Local-first processing, with clear disclosure before any server-side AI upload.
- Responsive workspace, accessible controls and touch/stylus support.
- Large-file safeguards, progress reporting and cancellation.
- Export presets for Reels/Shorts, square posts, landscape video and still images.

## 3. What is implemented in main today

| Capability | Current state |
|---|---|
| React/TypeScript application shell | Implemented |
| Image import (PNG/JPEG/WebP/GIF first frame) | Implemented |
| Image preview canvas | Implemented |
| Brightness, contrast, saturation, blur, grayscale, sepia | Implemented |
| Basic filter presets | Implemented |
| Rotate and flip | Implemented |
| One basic bottom-centred text overlay | Implemented |
| PNG image export | Implemented |
| One local video clip import and preview | Implemented |
| Video seek and playback | Implemented |
| Start/end trim range | Implemented |
| Playback speed and volume | Implemented |
| Browser MediaRecorder WebM export of selected range | Implemented, browser-dependent |
| Crop handles, image resize UI, layer stack, draggable/multiple text objects | Not implemented |
| Multi-clip/multi-track timeline, transitions, keyframes, speed curves | Not implemented |
| Captions, chroma key, stabilization, tracking, audio mixing | Not implemented |
| MP4 export and full codec controls | Not implemented |
| AI background removal/generative fill/object removal | Not implemented |

## 4. Recommended technical architecture

### Image path

Use an explicit document model rather than treating the canvas as the document:

- **Document**: dimensions, background, color space and export settings.
- **Asset**: original file reference, metadata and generated previews.
- **Layer**: stable ID, type, transform, visibility, opacity, blend mode and z-order.
- **Effect**: typed, parameterized adjustment/filter entries attached to a layer or adjustment layer.
- **History**: commands or immutable document snapshots for undo/redo.

Render a preview at the working resolution, but export at the document's true dimensions. Apply effects from serializable parameters so users can reopen and revise them.

### Video path

Use a timeline data model independent of the preview:

- **Project** → **Track[]** → **Clip[]**.
- A clip stores its source asset, timeline start, source in/out points, playback rate, transform, volume, effects and keyframes.
- Transitions are first-class objects between clips.
- Text, graphics, subtitles and audio are separate track items.
- The preview renderer reads the timeline state; the export renderer uses the same state so preview and output do not drift apart.

### Media pipeline recommendation

- The browser's WebCodecs API exposes low-level video/audio decode and encode primitives, but does **not** demux input containers or mux a finished MP4/WebM file by itself. A demuxer/muxer is also required.
- **Mediabunny is the preferred first library to evaluate** for this project's browser-first export pipeline: it documents reading, writing and converting MP4/WebM and other containers, multiple tracks, and WebCodecs-based encoding/decoding.
- Keep **FFmpeg.wasm as an optional fallback**, not the default path. It runs inside workers, but its own published benchmark shows browser WASM transcoding can be much slower than native FFmpeg and it has meaningful CPU/memory cost.
- Feature-detect codec support and offer compatible export presets rather than assuming all browsers can encode the same formats.
- Move expensive rendering/encoding off the UI thread and report progress/cancellation.

Technical sources:

- [MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [Mediabunny: introduction and feature set](https://mediabunny.dev/guide/introduction)
- [Mediabunny: supported formats and codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)
- [FFmpeg.wasm: overview](https://ffmpegwasm.netlify.app/docs/overview/)
- [FFmpeg.wasm: performance](https://ffmpegwasm.netlify.app/docs/performance/)

Mediabunny is published under MPL-2.0. Review the license obligations of the selected media libraries and any codec/build configurations before distributing a commercial product.

## 5. Delivery order

| Priority | Milestone | Why |
|---|---|---|
| P0 | Fix image lifecycle/history, crop and resize, export PNG/JPEG/WebP, save/reopen projects | Makes the basic image editor dependable |
| P0 | Proper clip data model, multi-clip timeline, split/trim/ripple delete, multiple audio/video tracks | Turns the video screen into a real editor rather than a single-file trimmer |
| P1 | Selectable/draggable layers, text styles, shapes, masks, opacity and blend modes | Core compositing workflow |
| P1 | Mediabunny-based MP4/WebM export, codec checks, resolution/FPS/bitrate presets and export progress | Reliable short-video output |
| P1 | Transitions, keyframes, speed curves, clip filters, audio fades and caption tracks | The main creator-editing feature set |
| P2 | HSL/curves/LUT color controls, chroma key, stabilization, motion tracking and advanced retouch tools | More advanced editing workflows |
| P2 | AI background removal, object removal, generative fill, transcript editing and smart reframing | Requires model/API selection, cost controls, privacy design and fallbacks |

**Recommendation:** finish the reliable image foundation and a real multi-track short-video timeline before adding AI features. A broad tool menu with non-working controls is less valuable than a smaller, tested editor with trustworthy exports.
