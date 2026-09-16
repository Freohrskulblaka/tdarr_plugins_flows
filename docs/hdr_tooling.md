# Dynamic HDR Tooling

Media Optimizer 0.1.8 adds the experimental `Compress And Restore Dynamic HDR` option. `Auto Preserve HDR` remains the default; it and `Copy HDR Video` retain their existing behavior and do not require these extra tools.

## Supported Scope

- Native-resolution 4K, 10-bit HEVC, HDR10-compatible MKV input.
- Dolby Vision Profile 7 **MEL**, verified across the full file, converted to Profile 8.1.
- HDR10+ with metadata covering every frame in presentation order.
- One dynamic format per file. Combined Dolby Vision + HDR10+, resizing, cropping, FEL, Profile 5, and other Dolby Vision profiles are not supported by this initial restoration path.

Out-of-scope planning configurations copy the video while retaining other domain changes. A full-file metadata check may reveal an unsupported input that cannot be identified from the initial scan; that job fails before encoding. Select an existing copy mode for those files. Never silently accept an HDR-less replacement.

## Worker Prerequisites

Install on **every Tdarr worker that may execute this option**, not just the server:

| Tool | Requirement |
| --- | --- |
| Python | 3.10 or newer, standard library only |
| FFmpeg / FFprobe | Tested with 7.1.1; encoder must support native 10-bit HEVC |
| MKVToolNix | Tested with 85.0: `mkvmerge`, `mkvextract`, `mkvpropedit` |
| `dovi_tool` | Pinned 2.3.4, required for Dolby Vision jobs |
| `hdr10plus_tool` | Pinned 1.7.2, required for HDR10+ jobs |

Official releases: [dovi_tool 2.3.4](https://github.com/quietvoid/dovi_tool/releases/tag/2.3.4), [hdr10plus_tool 1.7.2](https://github.com/quietvoid/hdr10plus_tool/releases/tag/1.7.2), [MKVToolNix](https://mkvtoolnix.download/downloads.html), [Python](https://www.python.org/downloads/).

Verify versions from the worker/container itself. Visibility on a network share does not prove that a tool can execute. Persist container installations and aliases in the worker image or its startup configuration.

## Runner Setup

Tdarr must launch an external Python interpreter, not its own bundled executable. The interpreter alias must include `ffmpeg` in its filename so Tdarr recognizes forwarded FFmpeg progress output.

Linux, after installing Python:

```sh
ln -s "$(command -v python3)" /usr/local/bin/media_optimizer_hdr_ffmpeg
/usr/local/bin/media_optimizer_hdr_ffmpeg --version
```

Windows, create the alias beside Python so its DLLs and standard library remain discoverable:

```powershell
$python = (Get-Command python.exe).Source
$alias = Join-Path (Split-Path $python) 'media_optimizer_hdr_ffmpeg.exe'
New-Item -ItemType HardLink -Path $alias -Target $python
& $alias --version
```

Set `MEDIA_OPTIMIZER_HDR_RUNNER_PATH` on the worker to that absolute alias path and restart the worker. Do not point it at FFmpeg itself.

## Tool Paths

These optional worker environment variables override tool locations:

| Variable | Tool |
| --- | --- |
| `MEDIA_OPTIMIZER_HDR_FFMPEG_PATH` | FFmpeg (otherwise Tdarr's provided path or worker PATH) |
| `MEDIA_OPTIMIZER_HDR_FFPROBE_PATH` | FFprobe |
| `MEDIA_OPTIMIZER_HDR_MKVMERGE_PATH` | mkvmerge |
| `MEDIA_OPTIMIZER_HDR_MKVEXTRACT_PATH` | mkvextract |
| `MEDIA_OPTIMIZER_HDR_MKVPROPEDIT_PATH` | mkvpropedit (otherwise Tdarr's provided path or worker PATH) |
| `MEDIA_OPTIMIZER_HDR_DOVI_PATH` | dovi_tool 2.3.4 |
| `MEDIA_OPTIMIZER_HDR_HDR10PLUS_PATH` | hdr10plus_tool 1.7.2 |

Absent overrides, tools use worker PATH; mkvmerge/mkvextract also resolve beside an absolute mkvpropedit path. Linux binaries need executable permission. No Arr connection details are written to the HDR job descriptor.

## Processing And Space

1. Check tools, free space, native geometry, source metadata, and full-file frame correspondence.
2. Encode video once with the existing complete Media Optimizer command. Audio, subtitles, fonts, chapters, and metadata use their existing planners/renderers.
3. Stream-copy the smaller encoded video to HEVC, inject verified metadata, then remux it with the encoded non-video tracks.
4. Restore the video UID/tags and static HDR color/mastering headers. Verify dynamic metadata exactly, track order/headers/tags, chapters, attachment records, packet timelines, and audio/subtitle payload hashes.
5. Fully decode the restored video before publishing Tdarr's cache output. Tdarr remains responsible for final source replacement.

This involves **four compressed-video-sized writes**, plus encoded audio and small metadata/timestamp files. It does not dump the original remux video or encode video four times. The space check is conservative when stream sizes are missing. Extraction and final decoding add read/processing time; do not treat a quiet verification phase as a stalled encode.

Normal failure or cancellation cleans staging. Linux children are tied to the runner's lifetime. A force-kill/power loss may leave a `.media-optimizer-hdr-*` cache directory; clean it only after verifying no job owns it. Windows hard-kill cleanup and worker progress/stall handling still require live Tdarr validation.

## Validation Boundary

Use a separate testing library, untouched sources, and `dryRun=true` first. Confirm supported native-4K planning and verify worker-side execution before live processing.

Local short-clip tests do not certify full-movie synchronization, HDR playback, hardware-specific behavior, or Tdarr custom-CLI replacement/cancellation. Keep existing modes as the rollback path until those checks pass.
