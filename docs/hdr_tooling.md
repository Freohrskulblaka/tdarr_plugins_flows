# Dynamic HDR Tooling

Pinned dynamic-HDR tools are installed for a separate future processing plugin. They are not runtime dependencies of Media Optimizer.

## Media Optimizer Boundary

Media Optimizer currently:

- Detects HDR10, HLG, HDR10+, and Dolby Vision video.
- Can transcode static HDR10 and HLG while carrying source color signaling into the output command.
- Copies HDR10+ and Dolby Vision video so their dynamic metadata is not silently discarded.
- Does not extract metadata, write sidecar manifests, inject metadata, or call the tools documented below.

A future regular Tdarr plugin may use these tools to preserve dynamic metadata around a single video encode.

## Pinned Tools

| Tool | Version | Windows SHA-256 | Linux musl SHA-256 |
| --- | --- | --- | --- |
| `dovi_tool` | 2.3.4 | `0d9733d311dfe49f9dca0c350f7e6d978182673d333c6f07f7365daf9e6c81eb` | `1844258e13c26607b32224bf1fa82b595d3b35949f5467405fda560daad32b3f` |
| `hdr10plus_tool` | 1.7.2 | `82b2d560073941b14c6511a431f429e33e134e5caefb60d7e8f6f6e6da8e16ba` | `06385f37a639d61ba21d4be3150c863846933bc3b58110e094d8fc8f1c2249f2` |

Official releases:

- `dovi_tool`: <https://github.com/quietvoid/dovi_tool/releases/tag/2.3.4>
- `hdr10plus_tool`: <https://github.com/quietvoid/hdr10plus_tool/releases/tag/1.7.2>

## Installed Paths

Windows workstation:

```text
D:\Tdarr\tools\hdr\dovi_tool.exe
D:\Tdarr\tools\hdr\hdr10plus_tool.exe
D:\Tdarr\mkvtoolnix\mkvmerge.exe
```

KRATOS Tdarr server share:

```text
\\KRATOS\appdata\MediaAutomation\tdarr\server\tools\hdr\dovi_tool
\\KRATOS\appdata\MediaAutomation\tdarr\server\tools\hdr\hdr10plus_tool
```

Expected paths inside the Tdarr server container:

```text
/app/server/tools/hdr/dovi_tool
/app/server/tools/hdr/hdr10plus_tool
```

The Linux binaries need executable permission inside the environment that runs them.

## Verification

Windows:

```powershell
& 'D:\Tdarr\tools\hdr\dovi_tool.exe' --version
& 'D:\Tdarr\tools\hdr\hdr10plus_tool.exe' --version
& 'D:\Tdarr\mkvtoolnix\mkvmerge.exe' --version
```

Tdarr server container:

```bash
/app/server/tools/hdr/dovi_tool --version
/app/server/tools/hdr/hdr10plus_tool --version
```

The workstation and KRATOS share installations have been checked. Direct execution from the Tdarr container remains to be validated before a future plugin depends on them.

## Future Plugin Requirements

A dynamic-HDR plugin should:

- Extract and validate metadata before any video encode.
- Perform no more than one lossy video encode.
- Restore metadata only after the encoded video is complete.
- Keep unsupported Dolby Vision profiles in copy mode until their conversion path is proven.
- Verify streams, duration, synchronization, and restored dynamic metadata before replacing the source file.
