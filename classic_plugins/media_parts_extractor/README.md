# Media Parts Extractor Classic Plugin

Deployable Tdarr classic plugin package for Media Parts Extractor.

## Contents

- `tdarr_plugin_media_parts_extractor.js`: classic plugin entrypoint loaded by Tdarr.
- `media_parts_extractor/`: support modules for configuration, stream selection, sidecar naming, FFmpeg command rendering/execution, and Tdarr log formatting.

Keep these two items together. The plugin uses relative `require(...)` calls into the sibling `media_parts_extractor/` folder.

Media Parts Extractor also reuses Media Optimizer's normalized analysis and logging helpers. Deploy the Media Optimizer package as a sibling when using this plugin.

## Deploy To Tdarr

1. Stop the Tdarr node or pause the staging library that uses this plugin.
2. Open the local classic plugin directory configured for the Tdarr node that will run the plugin.
3. Create or replace a `media_parts_extractor/` folder in that local classic plugin directory.
4. Copy this package into that folder so the deployed layout is:

```text
media_parts_extractor/
  tdarr_plugin_media_parts_extractor.js
  media_parts_extractor/
    command.js
    config.js
    formatting.js
    naming.js
    planning.js
```

5. Confirm the Media Optimizer package is deployed as a sibling:

```text
media_optimizer/
  tdarr_plugin_media_optimizer.js
  media_optimizer/
    analysis/
    logging.js
    analysis.js
```

6. Restart the Tdarr node or refresh local plugins.
7. Add `Media Parts Extractor` to a staging or donor library flow.
8. Start with `runMode=Dry Run` and a configured output directory before using `runMode=Extract`.

Do not commit real hosts, API keys, runtime exports, logs, media samples, or extracted sidecars.
