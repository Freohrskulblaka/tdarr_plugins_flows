# Media Optimizer Classic Plugin

Deployable Tdarr classic plugin package for Media Optimizer.

## Contents

- `Local/Tdarr_Plugin_Media_Optimizer.js`: classic plugin entrypoint loaded by Tdarr.
- `media_optimizer/`: support modules grouped by runtime concerns, pipeline orchestration, media domains, integrations, and utilities.
- `build_release.ps1`: creates a ready-to-extract release archive.

The `Local/` and `media_optimizer/` folders mirror their final locations under Tdarr's `Plugins/` directory.

## Deploy To Tdarr

1. Stop the Tdarr node or pause every library that uses this plugin.
2. Locate the Tdarr `Plugins/` directory. It must already contain Tdarr's own `methods/` folder.
3. Back up any existing `Local/Tdarr_Plugin_Media_Optimizer.js` and `media_optimizer/` folder outside `Plugins/`.
4. Remove the old `media_optimizer/` support folder so retired modules are not left behind.
5. Copy this package's `Local/` and `media_optimizer/` folders into Tdarr's `Plugins/` directory.

The installed layout must be:

```text
Plugins/
  Local/
    Tdarr_Plugin_Media_Optimizer.js
  media_optimizer/
    domains/
      attachments/
      audio/
      chapters/
      file/
      media/
      metadata/
      subtitles/
      video/
    integrations/
    pipeline/
    runtime/
    utils/
  methods/
```

Do not replace or copy the `methods/` folder. Tdarr supplies it.

6. Restart the Tdarr node or refresh local plugins.
7. Add `Media Optimizer` to the target classic plugin stack, or select it through Tdarr's Run Classic Plugin flow component.
8. Start with `dryRun=true` and `logLevel=debug` for the first validation pass.
9. Confirm the Tdarr log shows `media-optimizer-main-audio-source-2026-09-16-48` and the expected planned track table before allowing live processing.

Resizing uses one `scale` filter, which preserves display aspect ratio by adjusting sample aspect ratio as needed. Outputs are not forced to square pixels. Tdarr classic presets use a comma as the input/output delimiter; additional commas inside arguments can truncate the executed command even when quoted. Media Optimizer blocks such commands rather than risking lost tracks. This safeguard also applies to explicitly rendered metadata values and external input paths containing commas.

Resize bitrate targets use the expected even-pixel dimensions fitted within 1920x1080, not the entire boundary. Widescreen output therefore uses the same pixel-based bitrate calculation before encoding and during the follow-up check, avoiding a second encode caused by a smaller post-resize target.

## Main Audio And Compatibility Tracks

Compatibility profiles use the best eligible main soundtrack within each language variant. Lower-quality AC3/AAC streams are not assumed to contain the same soundtrack merely because their language and codec match. When needed, AC3 5.1 and AAC stereo are generated from that main source; stereo-only sources are never upmixed to 5.1.

The `MEDIA_OPTIMIZER_AUDIO_SOURCE` stream tag links compatibility tracks to their parent. It carries the parent's channel count, quality rank, and a hashed identity, not its filename or connection credentials. Matching generated tracks are reused on later runs even when the original 7.1 track was removed. Do not strip this tag if you want to preserve that association. Files produced before this release may need a one-time audio regeneration because their existing compatibility tracks cannot be verified.

Commentary and descriptive tracks identified through titles or dispositions remain separate and are never compatibility sources. Untagged descriptive soundtracks cannot be reliably recognized from codec information alone; selecting the best main source reduces this risk but is not content-based audio detection.

## Configure Sonarr And Radarr

Select `Sonarr/Radarr Arr Profile`. Media Optimizer first checks Tdarr variables and worker environment variables so credentials do not need to be stored in plugin inputs.

When the classic plugin receives Tdarr variables, each complete library pair overrides the global pair:

| Tdarr variable | Purpose |
| --- | --- |
| `MediaOptimizerSonarrHost` | Sonarr URL, with an optional reverse-proxy base path |
| `MediaOptimizerSonarrAPIKey` | Sonarr API key |
| `MediaOptimizerRadarrHost` | Radarr URL, with an optional reverse-proxy base path |
| `MediaOptimizerRadarrAPIKey` | Radarr API key |

The current Tdarr Run Classic Plugin flow component does not forward `userVariables` to the classic plugin. For that execution path, define these environment variables on every Tdarr Node that may run Media Optimizer:

| Worker environment variable | Purpose |
| --- | --- |
| `MEDIA_OPTIMIZER_SONARR_HOST` | Sonarr URL |
| `MEDIA_OPTIMIZER_SONARR_API_KEY` | Sonarr API key |
| `MEDIA_OPTIMIZER_RADARR_HOST` | Radarr URL |
| `MEDIA_OPTIMIZER_RADARR_API_KEY` | Radarr API key |

Restart the affected Tdarr Nodes after changing their environment. The source order for each service is library variables, global variables, worker environment variables, then the `arrConnectionProfile` plugin input.

The existing `arrConnectionProfile` JSON input remains available as a fallback for installations where neither Tdarr variables nor worker environment variables reach the classic plugin. Tdarr may include plugin input values in job logs, so the fallback should be used only when necessary. API keys are sent only through the `X-Api-Key` request header. Debug logging reports whether each service is configured and which source was selected, but never its host, API key, or fallback profile.

## Build A Release Archive

From PowerShell, run:

```powershell
.\build_release.ps1
```

The script creates `dist/Tdarr_Media_Optimizer_<version>.zip`. Extract that archive directly into Tdarr's `Plugins/` directory after completing the backup and cleanup steps above.

Linux and Docker users can extract the same ZIP with `unzip` and must preserve the displayed directory structure and file-name capitalization.

## Upgrade And Roll Back

Upgrades replace both the entrypoint and the complete support folder. Do not mix support modules from different releases.

To roll back, stop or pause Tdarr again, remove the failed entrypoint and support folder, restore both items from the same backup, and restart or refresh Tdarr.

Media Optimizer safely copies HDR10+ and Dolby Vision video because restoring their dynamic metadata requires a separate process. See [`../../docs/hdr_tooling.md`](../../docs/hdr_tooling.md) for the installed tool versions and the boundary for that future workflow.

Prefer variables over the plugin-input fallback. Do not commit real hosts, API keys, runtime exports, logs, or media samples.
