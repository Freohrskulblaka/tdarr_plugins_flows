# Dynamic HDR Tooling

Media Optimizer 0.1.8 adds the experimental `Compress And Restore Dynamic HDR` option; 0.1.9 adds automatic tool discovery. `Auto Preserve HDR` remains the default; it and `Copy HDR Video` retain their existing behavior and do not require these extra tools. Python and HDR binaries are installed separately, not bundled in the plugin release.

## Supported Scope

- 10-bit HEVC, HDR10-compatible MKV input: native 4K restoration, plus the Dolby Vision geometry cases below.
- Dolby Vision Profile 7 **MEL**, verified across the full file, converted to Profile 8.1; existing HDR10-compatible Profile 8.1 is also accepted.
- With `0.1.12`, Dolby Vision square-pixel 3840x2160 input can downscale to 1920x1080 using `Normalize to 1080p` or `Downscale 4K to 1080p`. Level 5 active-area offsets are halved and frame ranges preserved; letterbox bars are not cropped. Odd offsets fail before encoding rather than being rounded. Native 1920x1080 Dolby Vision is also supported for bitrate compression; compliant files are copied without another encode.
- Native-resolution 4K HDR10+ with metadata covering every frame in presentation order.
- One dynamic format per file. Combined Dolby Vision + HDR10+, resized HDR10+, other resize geometries, cropping, FEL, Profile 5, and other Dolby Vision compatibility profiles are not supported. Profile 8 requires compatibility ID 1 in the scan and authoritative runtime probe.

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

Linux with the standard persistent server mount, after installing Python and placing the HDR binaries in `/app/server/tools/hdr/`:

```sh
chmod 755 /app/server/tools/hdr/dovi_tool /app/server/tools/hdr/hdr10plus_tool
test -e /app/server/tools/hdr/media_optimizer_hdr_ffmpeg ||
  ln -s "$(command -v python3)" /app/server/tools/hdr/media_optimizer_hdr_ffmpeg
/app/server/tools/hdr/media_optimizer_hdr_ffmpeg --version
```

Windows, create the alias beside Python so its DLLs and standard library remain discoverable:

```powershell
$python = (Get-Command python.exe).Source
$alias = Join-Path (Split-Path $python) 'media_optimizer_hdr_ffmpeg.exe'
New-Item -ItemType HardLink -Path $alias -Target $python
& $alias --version
```

The alias is discovered in the server `tools/hdr/` directory or worker PATH. For a custom location outside both, set `MEDIA_OPTIMIZER_HDR_RUNNER_PATH` to its absolute path and restart the worker. Do not point it at FFmpeg itself. Keep the alias on a persistent mount; Python itself must also remain available after container recreation.

## Tool Paths

These optional worker environment variables override tool locations:

| Variable | Tool |
| --- | --- |
| `MEDIA_OPTIMIZER_HDR_RUNNER_PATH` | Python interpreter alias |
| `MEDIA_OPTIMIZER_HDR_FFMPEG_PATH` | FFmpeg |
| `MEDIA_OPTIMIZER_HDR_FFPROBE_PATH` | FFprobe |
| `MEDIA_OPTIMIZER_HDR_MKVMERGE_PATH` | mkvmerge |
| `MEDIA_OPTIMIZER_HDR_MKVEXTRACT_PATH` | mkvextract |
| `MEDIA_OPTIMIZER_HDR_MKVPROPEDIT_PATH` | mkvpropedit |
| `MEDIA_OPTIMIZER_HDR_DOVI_PATH` | dovi_tool 2.3.4 |
| `MEDIA_OPTIMIZER_HDR_HDR10PLUS_PATH` | hdr10plus_tool 1.7.2 |

No path variables are required for the standard container layout. Discovery uses Tdarr's supplied tool paths first, then its bundled FFmpeg/FFprobe locations and worker PATH. FFprobe also resolves beside FFmpeg; mkvmerge/mkvextract resolve beside mkvpropedit. HDR tools and the Python alias resolve from the server `tools/hdr/` directory, the standard `/app/server/tools/hdr/` mount, or worker PATH. An explicit override is authoritative: invalid overrides fail rather than silently selecting another tool. Linux binaries need executable permission. No Arr connection details are written to the HDR job descriptor.

## Processing And Space

1. Check tools, free space, declared source/output geometry, source metadata, and full-file frame correspondence. For supported Dolby Vision downscaling, edit Level 5 active-area presets before encoding and verify adjusted frame counts/ranges.
2. Encode video once with the existing complete Media Optimizer command. Keep frame passthrough and the input demuxer time base, preserving sub-frame timestamp precision instead of rounding to the encoder's default frame-rate clock. Audio, subtitles, fonts, chapters, and metadata use their existing planners/renderers.
3. Stream-copy the smaller encoded video to HEVC, inject verified metadata, then remux it with the encoded non-video tracks.
4. Restore the video UID/tags and static HDR color/mastering headers. Verify dynamic metadata exactly, track order/headers/tags, chapters, attachment records, packet timelines, and audio/subtitle payload hashes.
5. Fully decode the restored video before publishing Tdarr's cache output. Tdarr remains responsible for final source replacement.

This involves **four compressed-video-sized writes**, plus encoded audio and small metadata/timestamp files. It does not dump the original remux video or encode video four times. The space check is conservative when stream sizes are missing. Extraction and final decoding add read/processing time; do not treat a quiet verification phase as a stalled encode.

Normal failure or cancellation cleans staging. Linux children are tied to the runner's lifetime. A force-kill/power loss may leave a `.media-optimizer-hdr-*` cache directory; clean it only after verifying no job owns it. Windows hard-kill cleanup and worker progress/stall handling still require live Tdarr validation.

## Validation Boundary

Use a separate testing library, untouched sources, and `dryRun=true` first. Confirm supported profile/geometry planning and verify worker-side execution before live processing. Resized Dolby Vision needs representative TV/Plex playback and HDR10-only fallback validation; structural metadata checks do not establish professional regrading or universal device compatibility.

Local short-clip tests do not certify full-movie synchronization, HDR playback, hardware-specific behavior, or Tdarr custom-CLI replacement/cancellation. Keep existing modes as the rollback path until those checks pass.
