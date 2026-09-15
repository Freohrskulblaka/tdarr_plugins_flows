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
9. Confirm the Tdarr log shows `media-optimizer-release-package-2026-09-15-41` and the expected planned track table before allowing live processing.

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

Do not commit real hosts, API keys, runtime exports, logs, or media samples.
