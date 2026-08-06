# Media Optimizer Classic Plugin

Deployable Tdarr classic plugin package for Media Optimizer.

## Contents

- `tdarr_plugin_media_optimizer.js`: classic plugin entrypoint loaded by Tdarr.
- `media_optimizer/`: support modules grouped by runtime concerns, pipeline orchestration, media domains, integrations, and shared helpers.

Keep these two items together. The plugin uses relative `require(...)` calls into the sibling `media_optimizer/` folder.

## Deploy To Tdarr

1. Stop the Tdarr node or pause the library that uses this plugin.
2. Open the local classic plugin directory configured for the Tdarr node that will run the plugin.
3. Create or replace a `media_optimizer/` folder in that local classic plugin directory.
4. Copy this package into that folder so the deployed layout is:

```text
media_optimizer/
  tdarr_plugin_media_optimizer.js
  media_optimizer/
    domains/
      attachments/
      audio/
      chapters/
      file/
      media_info/
      metadata/
      subtitles/
      video/
    integrations/
    pipeline/
    runtime/
    shared/
    analysis.js
    config.js
    ffmpeg_command.js
    formatting.js
    logging.js
    metadata_lookup.js
    planning.js
    response.js
```

5. Restart the Tdarr node or refresh local plugins.
6. Add `Media Optimizer` to the target library flow in Tdarr.
7. Start with `dryRun=true` and `logLevel=debug` for the first validation pass.
8. Confirm the Tdarr log shows the expected runtime marker and planned track table before allowing live processing.

Do not commit real hosts, API keys, runtime exports, logs, or media samples.
