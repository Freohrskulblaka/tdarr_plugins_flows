/*
 * Media Optimizer Classic Plugin
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Tdarr classic plugin entrypoint that orchestrates media optimizer configuration, analysis, planning, and response logging.
 * Changelog: ../../../docs/media_optimizer_changelog.md
 */

const MEDIA_OPTIMIZER_RUNTIME_MARKER = 'media-optimizer-audio-untagged-reuse-2026-09-17-52';

function loadOptimizerModules() {
  const path = require('path');
  const supportRoot = path.resolve(__dirname, '..', 'media_optimizer');
  const supportPrefix = `${supportRoot}${path.sep}`;

  Object.keys(require.cache).forEach((cachedPath) => {
    if (cachedPath.startsWith(supportPrefix)) {
      delete require.cache[cachedPath];
    }
  });

  return {
    ...require(path.join(supportRoot, 'runtime/config')),
    ...require(path.join(supportRoot, 'runtime/response')),
    ...require(path.join(supportRoot, 'pipeline/actions')),
    ...require(path.join(supportRoot, 'integrations/arr_original_language')),
    ...require(path.join(supportRoot, 'pipeline/analyze')),
    ...require(path.join(supportRoot, 'pipeline/plan')),
    ...require(path.join(supportRoot, 'pipeline/command')),
    ...require(path.join(supportRoot, 'pipeline/format')),
  };
}

// #region Plugin Metadata
function details() {
  return {
    id: 'Tdarr_Plugin_Media_Optimizer',
    Name: 'Media Optimizer',
    Stage: 'Pre-processing',
    Type: 'Video, Audio, Subtitle',
    Operation: 'Transcode',
    Description: 'Unified media optimizer for clean, repeatable MKV outputs. Plans video copy or HEVC conversion, audio language/order cleanup, normalized compatibility tracks, commentary and descriptive-audio handling, subtitle retention and external subtitle import, font attachment preservation, chapter handling, and metadata cleanup. Original language can be resolved from filename/streams or Sonarr/Radarr through Tdarr variables, worker environment variables, or a fallback connection profile. Already-compliant files return no-process with a compact summary instead of reprocessing.',
    Version: '0.1.11',
    Tags: 'pre-processing, ffmpeg, media optimizer, configurable',
    Inputs: [
      {
        name: 'videoCodec',
        type: 'string',
        defaultValue: 'H.265 / HEVC - NVIDIA GPU',
        inputUI: {
          type: 'dropdown',
          options: [
            'H.265 / HEVC - NVIDIA GPU',
            'H.265 / HEVC - CPU',
            'H.265 / HEVC - Intel GPU',
            'H.265 / HEVC - AMD GPU',
            'Copy Video',
          ],
        },
        tooltip: `
          Select the target video codec and encoder family.\\n
          H.265 / HEVC - NVIDIA GPU: uses NVENC hardware encoding.\\n
          H.265 / HEVC - CPU: uses libx265 on either Intel or AMD processors.\\n
          H.265 / HEVC - Intel GPU: uses Intel Quick Sync Video.\\n
          H.265 / HEVC - AMD GPU: uses AMD AMF hardware encoding.\\n
          Copy Video: never transcodes video. Use this when testing audio, subtitle, chapter, or metadata behavior without changing video.\\n
          Example: use H.265 / HEVC - NVIDIA GPU for normal library rollout; use Copy Video for remux-only validation.
        `,
      },
      {
        name: 'videoQualityProfile',
        type: 'string',
        defaultValue: 'Balanced',
        inputUI: {
          type: 'dropdown',
          options: [
            'Balanced',
            'Archive Quality',
            'Smaller Files',
          ],
        },
        tooltip: `
          Select the HEVC quality and size target independently from output resolution.\\n
          Balanced: targets about 5 Mbps for 1080p24 and 16 Mbps for 4K24.\\n
          Archive Quality: keeps a higher target bitrate for files where quality matters more than size.\\n
          Smaller Files: lowers the target bitrate for more aggressive space savings.\\n
          Example: Balanced is the normal choice for mixed libraries; Archive Quality is better for high-value movies.
        `,
      },
      {
        name: 'videoResolution',
        type: 'string',
        defaultValue: 'Upscale Below 1080p',
        inputUI: {
          type: 'dropdown',
          options: [
            'Keep Native Resolution',
            'Upscale Below 1080p',
            'Downscale 4K to 1080p',
            'Normalize to 1080p',
          ],
        },
        tooltip: `
          Select the output resolution policy independently from video quality.\\n
          Keep Native Resolution: keeps the source dimensions.\\n
          Upscale Below 1080p: fits 720p and smaller video within 1920x1080 while preserving 4K.\\n
          Downscale 4K to 1080p: fits 4K video within 1920x1080 and leaves lower resolutions unchanged.\\n
          Normalize to 1080p: upscales lower resolutions and downscales 4K to a 1920x1080 boundary.\\n
          Resizing always preserves the source aspect ratio.
        `,
      },
      {
        name: 'hdrHandling',
        type: 'string',
        defaultValue: 'Auto Preserve HDR',
        inputUI: {
          type: 'dropdown',
          options: [
            'Auto Preserve HDR',
            'Copy HDR Video',
            'Compress And Restore Dynamic HDR',
          ],
        },
        tooltip: `
          Select how HDR video is handled when video transcoding would otherwise be needed.\\n
          Auto Preserve HDR: transcodes HDR10 and HLG with their source color signaling. HDR10+ and Dolby Vision video is copied so dynamic metadata is not silently lost.\\n
          Copy HDR Video: always copies HDR video without re-encoding it. Audio, subtitle, chapter, attachment, and metadata changes may still be applied in a lossless remux.\\n
          Compress And Restore Dynamic HDR: experimental native-4K MKV compression with verified metadata restoration. Supports HDR10+ or Dolby Vision Profile 7 MEL converted to Profile 8.1, without resizing. Unsupported profiles or combinations remain copied. Requires the external runner and HDR tools documented in hdr_tooling.md; failed verification never accepts an HDR-less output.
        `,
      },
      {
        name: 'audioProfile',
        type: 'string',
        defaultValue: 'Compatibility 5.1 + Stereo',
        inputUI: {
          type: 'dropdown',
          options: [
            'Compatibility 5.1 + Stereo',
            'Best 5.1 + Compatibility',
            'Best 7.1 + Compatibility',
            'Preserve All + Compatibility',
            'Stereo Only',
            'Preserve Original Audio',
          ],
        },
        tooltip: `
          Select the audio channel policy.\\n
          Compatibility 5.1 + Stereo: creates missing AC3 5.1 and AAC stereo from the best main soundtrack for each language variant. Existing qualifying main tracks are reused if untagged or associated with the selected source. Missing tags alone do not trigger processing.\\n
          Best 5.1 + Compatibility: also keeps the best Atmos, DTS-HD MA, or DTS 5.1 source.\\n
          Best 7.1 + Compatibility: also keeps the best Atmos, DTS-HD MA, or DTS 7.1 source.\\n
          Preserve All + Compatibility: retains every eligible original and adds missing AC3 5.1 and AAC stereo tracks.\\n
          Stereo Only: keeps or creates stereo output where possible. Useful for small devices or simple playback stacks.\\n
          Preserve Original Audio: retains eligible originals without creating compatibility tracks.\\n
          Generated compatibility tracks use single-pass loudness normalization to reduce extreme differences between quiet and loud sections.\\n
          Example: Best 5.1 + Compatibility can keep DTS-HD MA 5.1 beside AC3 5.1 and AAC stereo.
        `,
      },
      {
        name: 'keepAudioCommentary',
        type: 'boolean',
        defaultValue: false,
        inputUI: {
          type: 'dropdown',
          options: ['false', 'true'],
        },
        tooltip: `
          Keep commentary audio for configured languages.\\n
          Commentary tracks retain their source codec and channel layout, are placed after regular audio, and never produce compatibility tracks.\\n
          Disabled by default.
        `,
      },
      {
        name: 'keepDescriptiveAudio',
        type: 'boolean',
        defaultValue: true,
        inputUI: {
          type: 'dropdown',
          options: ['false', 'true'],
        },
        tooltip: `
          Preserve descriptive audio and narration tracks for configured languages.\\n
          Descriptive tracks retain their source codec and channel layout, are placed after regular audio, and never produce compatibility tracks.\\n
          Enabled by default to preserve accessibility content.
        `,
      },
      {
        name: 'subtitleProfile',
        type: 'string',
        defaultValue: 'Picture First + Text',
        inputUI: {
          type: 'dropdown',
          options: ['Picture First + Text', 'Include Original Language', 'Text First', 'Text Only'],
        },
        tooltip: `
          Select the subtitle retention and ordering policy.\\n
          Picture First + Text: keeps preferred-language image subtitles first, then text subtitles. Good for PGS-heavy movie sources.\\n
          Include Original Language: includes subtitles for the resolved original language in addition to configured subtitle languages.\\n
          Text First: prefers text subtitles before image subtitles. Good when SRT/ASS tracks are preferred by your players.\\n
          Text Only: removes image subtitles and keeps/imports text subtitles only.\\n
          Matching external subtitle sidecars are imported when available. Supported sidecars: SRT, ASS, SSA, VTT, SUP/PGS. On a later no-process pass, matched text sidecars are deleted after an embedded match is confirmed.\\n
          Forced subtitle intent can be preserved from stream flags or titles such as forced, foreign-only, or signs/songs.\\n
          Example: Picture First + Text with subtitleLanguages eng,spa keeps English/Spanish PGS first, then English/Spanish text tracks.
        `,
      },
      {
        name: 'metadataProfile',
        type: 'string',
        defaultValue: 'Clean',
        inputUI: {
          type: 'dropdown',
          options: ['Clean', 'Preserve'],
        },
        tooltip: `
          Select the metadata cleanup policy.\\n
          Clean: strips global tags, removes file/video titles, removes extra tag tracks, preserves font attachments, removes non-font attachments, and keeps or creates chapters.\\n
          Preserve: keeps the available source metadata, tags, titles, and chapter layout. Font attachments are retained for subtitles; non-font attachments are removed.\\n
          Chapter handling uses existing MediaInfo Menu/@type chapter data when present. If no chapters exist and Clean is selected, generated chapter markers can be added.\\n
          Example: Clean removes noisy release tags and non-font attachments while preserving ASS/SSA font attachments needed for styled subtitles.
        `,
      },
      {
        name: 'audioLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: `
          Comma-separated preferred audio languages.\\n
          Use ISO-639-2/B three-letter language codes.\\n
          The resolved original language is considered first when original language lookup is enabled.\\n
          Undetermined audio can be retagged to the resolved original language, or to the first configured language when no better source exists.\\n
          Example: eng,spa keeps English and Spanish audio, with original language priority added by lookup.\\n
          Example: spa,eng makes Spanish the first configured fallback for untagged stereo-only files.
        `,
      },
      {
        name: 'subtitleLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: `
          Comma-separated preferred subtitle languages.\\n
          Use ISO-639-2/B three-letter language codes.\\n
          Subtitles are retained and ordered using this list plus the selected subtitle profile.\\n
          Include Original Language adds the resolved original language to subtitle retention.\\n
          Example: eng,spa keeps English and Spanish subtitle tracks and imports matching English/Spanish subtitle sidecars such as SRT, ASS, VTT, or SUP.\\n
          Example: eng keeps only English subtitles unless Include Original Language adds another language.
        `,
      },
      {
        name: 'originalLanguageLookup',
        type: 'string',
        defaultValue: 'Filename and Streams Only',
        inputUI: {
          type: 'dropdown',
          options: ['Disabled', 'Filename and Streams Only', 'Sonarr/Radarr Arr Profile'],
        },
        tooltip: `
          Select how original language should be resolved.\\n
          Disabled: skips Sonarr/Radarr and disables original-language lookup logic. Local stream language may still be used as a fallback label.\\n
          Filename and Streams Only: avoids Sonarr/Radarr and uses filename IDs plus local stream metadata where possible.\\n
          Sonarr/Radarr Arr Profile: uses Tdarr library variables, global variables, worker environment variables, or the fallback connection profile to ask Sonarr/Radarr for original language metadata.\\n
          Radarr is used for movie-style matches; Sonarr is used for TV-style matches.\\n
          API keys are sent through the X-Api-Key request header and are never included in the request URL.\\n
          Example: use Sonarr/Radarr Arr Profile for normal production, Filename and Streams Only for offline testing.\\n
          Connection variable names and worker environment setup are documented in the package README.
        `,
      },
      {
        name: 'arrConnectionProfile',
        type: 'string',
        defaultValue: '',
        inputUI: {type: 'text'},
        tooltip: `
          Optional fallback JSON object for Sonarr/Radarr original-language lookup.\\n
          Tdarr library variables, global variables, and worker environment variables take priority over this input.\\n
          Include only the services that do not have a preferred variable source.\\n
          Hosts can include or omit http:// and may include a reverse-proxy URL base path.\\n
          API keys are sent through the X-Api-Key request header instead of the request URL.\\n
          Tdarr may include plugin input values in job logs, so use this only when the preferred variable sources are unavailable.\\n
          Example with both services:\\n
          {"sonarr":{"host":"10.0.0.10:8989","apiKey":"key"},"radarr":{"host":"10.0.0.10:7878","apiKey":"key"}}
        `,
      },
      {
        name: 'dryRun',
        type: 'boolean',
        defaultValue: true,
        inputUI: {
          type: 'dropdown',
          options: ['false', 'true'],
        },
        tooltip: `
          Controls whether Media Optimizer only plans or actually processes.\\n
          true: dry run. Logs analysis, final track plan, and FFmpeg command preview without processing the file.\\n
          false: process mode. Returns an FFmpeg preset only when the plan is valid, processing is needed, the command is executable, and dry run is false.\\n
          Use dry run first when changing profiles or rolling the plugin out to a new library.\\n
          Example: keep true for first-pass validation, then set false after the planned track table looks correct.
        `,
      },
      {
        name: 'logLevel',
        type: 'string',
        defaultValue: 'normal',
        inputUI: {
          type: 'dropdown',
          options: ['summary', 'normal', 'debug'],
        },
        tooltip: `
          Controls Media Optimizer log verbosity.\\n
          summary: compact compliance summary only. Best for stable no-process reruns.\\n
          normal: standard rollout logging. Shows compact processing counts and outcomes without listing every retained or removed track. Dry runs also include the command preview.\\n
          debug: full analysis, per-track planning reasons, final track table, and command preview. Best for diagnosing why a file would or would not process.\\n
          In dry run, normal and debug intentionally include the planned FFmpeg command preview.\\n
          Example: use summary for broad rollout monitoring and debug for a single confusing file.
        `,
      },
    ],
  };
}
// #endregion

// #region Plugin Entry Point
async function plugin(file, librarySettings, inputs, otherArguments) {
  const {
    analyzeFile,
    buildFfmpegCommand,
    buildProcessingPlan,
    createContext,
    createResponse,
    loadInputs,
    prepareConfig,
    renderFfmpegCommandPreview,
    renderFinalTrackTable,
    renderPlanSummary,
    resolveOriginalLanguage,
    runInPlaceActions,
    summarizeAnalysis,
  } = loadOptimizerModules();
  const rawInputs = loadInputs(inputs, details);
  const config = prepareConfig(rawInputs, otherArguments);
  const context = createContext(file, librarySettings, config, otherArguments);
  const runMode = context.settings.dryRun ? 'Dry Run' : 'Process';

  context.log.section(`Media Optimizer ${runMode}`);
  context.log.info('Runtime marker', MEDIA_OPTIMIZER_RUNTIME_MARKER);
  context.log.info('Resolved settings', context.settings);
  context.log.debug('Arr lookup configuration', Object.fromEntries(
    ['sonarr', 'radarr'].map((appName) => [appName, {
      configured: Boolean(context.lookup.arrConnections[appName].host && context.lookup.arrConnections[appName].apiKey),
      source: context.lookup.arrConnections[appName].source,
    }]),
  ));
  if (config.isInvalid) {
    context.log.error('Configuration is invalid', config.messages.validationErrors);
    return createResponse(context);
  }

  context.analysis = analyzeFile(context);
  context.analysis.originalLanguage = await resolveOriginalLanguage(context);
  context.plan = buildProcessingPlan(context);

  if (!context.plan.isValid) {
    context.log.info('Analysis summary', summarizeAnalysis(context.analysis, context.settings));
    context.log.error('Processing plan is invalid', context.plan.validation.reasons);
    return createResponse(context);
  }

  context.plan.command = buildFfmpegCommand(context);

  if (context.plan.shouldProcess && !context.plan.command.isExecutable) {
    context.log.error('Processing is required but the FFmpeg command cannot be executed', context.plan.command.unsupportedSteps);
  }

  runInPlaceActions(context);

  if (context.settings.logLevel === 'debug') {
    context.log.info('Analysis summary', summarizeAnalysis(context.analysis, context.settings));
    context.log.section('Planned final track table');
    context.log.info(renderFinalTrackTable(context.plan));
    context.log.section('Planned FFmpeg command');
    context.log.info(renderFfmpegCommandPreview(context.plan.command));
  } else {
    const summaryTitle = context.plan.shouldProcess ? 'Processing summary' : 'Compliance summary';
    const summary = renderPlanSummary(context.plan, context.analysis);

    context.log.section(summaryTitle);
    if (context.settings.logLevel === 'summary') {
      context.log.summary(summary);
    } else {
      context.log.info(summary);
    }

    if (context.settings.dryRun && context.settings.logLevel === 'normal') {
      context.log.section('Planned FFmpeg command');
      context.log.info(renderFfmpegCommandPreview(context.plan.command));
    }
  }

  return createResponse(context);
}

// #endregion

// #region Exports
module.exports.details = details;
module.exports.plugin = plugin;
// #endregion
