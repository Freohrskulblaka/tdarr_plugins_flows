# Media Parts Extractor Classic Plugin

Deployable Tdarr classic plugin package for staging-library donor extraction.

## Contents

- `Local/Tdarr_Plugin_Media_Parts_Extractor.js`: Tdarr classic plugin entrypoint.
- `media_parts_extractor/runtime/`: inputs, context, logging, Tdarr methods, and response.
- `media_parts_extractor/pipeline/`: analysis adapter, planning orchestration, FFmpeg commands and execution, and log formatting.
- `media_parts_extractor/domains/`: video, audio, and subtitle selection and sidecar naming.
- `media_parts_extractor/utils/`: shared output-directory and filename rules.

The `Local/` and `media_parts_extractor/` folders mirror their installed locations under Tdarr's `Plugins/` directory, following Media Optimizer's package structure.

Media Parts Extractor reuses Media Optimizer's normalized analysis. Its complete `media_optimizer/` support folder must be installed as a sibling. Extraction settings, selection, naming, commands, logging, and responses belong to this package.

## Deploy To Tdarr

1. Stop the Tdarr node or pause the staging library that uses this plugin.
2. Locate Tdarr's `Plugins/` directory, which must contain Tdarr's own `methods/` folder.
3. Back up the existing extractor entrypoint and support folder outside `Plugins/`. Remove the retired flat extractor package when migrating from the earlier layout.
4. Copy this package's `Local/` and `media_parts_extractor/` folders into `Plugins/`. Merge `Local/` without replacing other plugin entrypoints.
5. Confirm Media Optimizer's support folder is installed as a sibling:

```text
Plugins/
  Local/
    Tdarr_Plugin_Media_Parts_Extractor.js
    Tdarr_Plugin_Media_Optimizer.js
  media_parts_extractor/
    domains/
      audio/
        naming.js
        plan.js
      subtitles/
        analyze.js
        naming.js
        plan.js
      video/
        naming.js
        plan.js
    pipeline/
      analyze.js
      command.js
      format.js
      plan.js
    runtime/
      config.js
      logging.js
      response.js
      tdarr_methods.js
    utils/
      naming.js
  media_optimizer/
    domains/
    pipeline/
    utils/
  methods/
```

Do not replace or copy `methods/`; Tdarr supplies it. Install the complete Media Optimizer support folder rather than only the folders illustrated above.

6. Restart the Tdarr node or refresh local plugins.
7. Add `Media Parts Extractor` to a staging or donor library classic plugin stack, or use Tdarr's Run Classic Plugin flow component.
8. Start with `runMode=Dry Run`, `videoMode=Primary Video`, and a configured output directory before using `runMode=Extract`.

Extraction uses stream copy and leaves the source file unchanged. Selected playable video tracks become `.mkv` sidecars; cover art and other image-like video streams are skipped.

Do not commit real hosts, API keys, runtime exports, logs, media samples, or extracted sidecars.
