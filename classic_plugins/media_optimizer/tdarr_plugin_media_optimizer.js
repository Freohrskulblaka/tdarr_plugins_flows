/*
 * Media Optimizer Classic Plugin
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Tdarr classic plugin entrypoint that orchestrates media optimizer configuration, analysis, planning, and response logging.
 * Changelog: ../../docs/media_optimizer_changelog.md
 */

const MEDIA_OPTIMIZER_RUNTIME_MARKER = 'media-optimizer-arr-profile-2026-08-05-38';

function clearMediaOptimizerModuleCache() {
  const path = require('path');
  const mediaOptimizerSegment = `${path.sep}media_optimizer${path.sep}`;

  Object.keys(require.cache).forEach((cachedPath) => {
    if (cachedPath.includes(mediaOptimizerSegment)) {
      delete require.cache[cachedPath];
    }
  });
}

function requireFresh(modulePath) {
  const resolvedPath = require.resolve(modulePath);

  delete require.cache[resolvedPath];

  return require(modulePath);
}

function loadOptimizerModules() {
  clearMediaOptimizerModuleCache();

  return {
    config: requireFresh('./media_optimizer/config'),
    analysis: requireFresh('./media_optimizer/analysis'),
    metadataLookup: requireFresh('./media_optimizer/metadata_lookup'),
    planning: requireFresh('./media_optimizer/planning'),
    formatting: requireFresh('./media_optimizer/formatting'),
    ffmpegCommand: requireFresh('./media_optimizer/ffmpeg_command'),
    inPlaceActions: requireFresh('./media_optimizer/actions/in_place'),
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
    Description: 'Unified media optimizer for clean, repeatable MKV outputs. Plans video copy or HEVC conversion, audio language/order cleanup, missing compatibility tracks, commentary removal, subtitle retention and external SRT import, font attachment preservation, chapter handling, and metadata cleanup. Original language can be resolved from filename/streams or Sonarr/Radarr through the Arr connection profile input. Already-compliant files return no-process with a compact summary instead of reprocessing.',
    Version: '0.1.0',
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
            'H.265 / HEVC - CPU (Disabled)',
            'H.265 / HEVC - Intel GPU (Disabled)',
            'H.265 / HEVC - AMD GPU (Disabled)',
            'H.264 - NVIDIA GPU (Disabled)',
            'H.264 - CPU (Disabled)',
            'H.264 - Intel GPU (Disabled)',
            'H.264 - AMD GPU (Disabled)',
            'Copy Video',
          ],
        },
        tooltip: `
          Select the target video codec and encoder family.\\n
          H.265 / HEVC - NVIDIA GPU: supported production path. Transcodes video to HEVC using NVENC when the video plan says conversion is needed.\\n
          H.265 / HEVC - CPU (Disabled): future CPU x265 path. Currently blocks processing with a clear disabled-profile warning.\\n
          H.265 / HEVC - Intel GPU (Disabled): future Intel QSV path. Currently disabled.\\n
          H.265 / HEVC - AMD GPU (Disabled): future AMD AMF path. Currently disabled.\\n
          H.264 options (Disabled): scaffolded future H.264 output paths. Currently disabled.\\n
          Copy Video: never transcodes video. Use this when testing audio, subtitle, chapter, or metadata behavior without changing video.\\n
          Example: use H.265 / HEVC - NVIDIA GPU for normal library rollout; use Copy Video for remux-only validation.
        `,
      },
      {
        name: 'videoQualityProfile',
        type: 'string',
        defaultValue: 'Balanced 1080p',
        inputUI: {
          type: 'dropdown',
          options: [
            'Balanced 1080p',
            'Archive Quality',
            'Smaller Files',
            'Compress 4K Preserve HDR Signaling',
            'Compress 4K to SDR Experimental (Disabled)',
            'Skip HDR Transcode (Disabled)',
            'Copy When Compatible',
          ],
        },
        tooltip: `
          Select the video quality and resolution policy.\\n
          Balanced 1080p: default library profile. Uses HEVC main10, 10-bit, slow preset, and a balanced target size for 1080p output.\\n
          Archive Quality: keeps a higher target bitrate for files where quality matters more than size.\\n
          Smaller Files: lowers the target bitrate for more aggressive space savings.\\n
          Compress 4K Preserve HDR Signaling: keeps 4K resolution and writes basic HDR signaling flags when transcoding.\\n
          Compress 4K to SDR Experimental (Disabled): reserved for future HDR-to-SDR work. Currently disabled.\\n
          Skip HDR Transcode (Disabled): reserved for future HDR skip logic. Currently disabled.\\n
          Copy When Compatible: keeps compatible video when the selected codec/profile already matches.\\n
          Example: Balanced 1080p is the normal choice for mixed libraries; Archive Quality is better for high-value movies.
        `,
      },
      {
        name: 'audioProfile',
        type: 'string',
        defaultValue: 'Keep 5.1 and Stereo',
        inputUI: {
          type: 'dropdown',
          options: ['Keep 5.1 and Stereo', 'Keep 7.1, 5.1, and Stereo', 'Stereo Only', 'Preserve Audio'],
        },
        tooltip: `
          Select the audio channel policy.\\n
          Keep 5.1 and Stereo: normal movie/TV profile. Keeps or creates one 5.1 track and one stereo track for each target language when a usable source exists.\\n
          Keep 7.1, 5.1, and Stereo: keeps 7.1 sources and still creates lower-channel compatibility tracks when needed.\\n
          Stereo Only: keeps or creates stereo output where possible. Useful for small devices or simple playback stacks.\\n
          Preserve Audio: avoids conversion/downmixing. Still allows language tagging, ordering, default cleanup, and commentary removal planning.\\n
          Commentary tracks are removed when the audio profile enables commentary cleanup.\\n
          Example: Keep 5.1 and Stereo can create AAC stereo from a 5.1/7.1 source; it does not create 5.1 from stereo-only audio.
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
          Matching external SRT sidecars are imported when available. On a later no-process pass, matched sidecars are deleted after an embedded SRT match is confirmed.\\n
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
          Preserve: keeps the available source metadata, tags, titles, attachments, and chapter layout when possible.\\n
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
          Example: eng,spa keeps English and Spanish subtitle tracks and imports matching English/Spanish SRT sidecars.\\n
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
          Sonarr/Radarr Arr Profile: uses the arrConnectionProfile JSON input to ask Sonarr/Radarr for original language metadata.\\n
          Radarr is used for movie-style matches; Sonarr is used for TV-style matches.\\n
          Tdarr may log plugin input values; keep Arr instances local or rotate keys after rollout.\\n
          Example: use Sonarr/Radarr Arr Profile for normal production, Filename and Streams Only for offline testing.
        `,
      },
      {
        name: 'arrConnectionProfile',
        type: 'string',
        defaultValue: '',
        inputUI: { type: 'text' },
        tooltip: `
          Optional JSON object for Sonarr/Radarr original-language lookup.\\n
          Include only the services you use.\\n
          Hosts can include or omit http://.\\n
          Do not deploy local .env harness files; this input is the Tdarr-side connection profile.\\n
          The expected keys are sonarr.host, sonarr.apiKey, radarr.host, and radarr.apiKey.\\n
          Example with both services:\\n
          {"sonarr":{"host":"10.0.0.10:8989","apiKey":"key"},"radarr":{"host":"10.0.0.10:7878","apiKey":"key"}}\\n
          Example with Radarr only:\\n
          {"radarr":{"host":"10.0.0.10:7878","apiKey":"key"}}
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
          normal: standard rollout logging. Shows useful plan details without the full debug analysis on no-op runs.\\n
          debug: full analysis, planning reasons, final track table, and command preview. Best for diagnosing why a file would or would not process.\\n
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
    config: { loadInputs, prepareConfig, createContext },
    analysis: { analyzeFile, summarizeAnalysis },
    metadataLookup: { resolveOriginalLanguage },
    planning: { buildProcessingPlan },
    formatting: { renderFinalTrackTable, renderPlanSummary },
    ffmpegCommand: { buildFfmpegCommand, renderFfmpegCommandPreview },
    inPlaceActions: { runInPlaceActions },
  } = loadOptimizerModules();
  const rawInputs = loadInputs(inputs, details);
  const config = prepareConfig(rawInputs);
  const context = createContext(file, librarySettings, config, otherArguments);
  const runMode = context.settings.dryRun ? 'Dry Run' : 'Process';

  context.log.section(`Media Optimizer ${runMode}`);
  context.log.info('Runtime marker', MEDIA_OPTIMIZER_RUNTIME_MARKER);
  context.log.info('Resolved settings', context.settings);
  if (config.isInvalid) {
    context.log.error('Configuration is invalid', config.messages.validationErrors);
    return createResponse(context);
  }

  if (config.messages.disabledReasons.length > 0) {
    context.log.warn('Selected profile is scaffolded but disabled', {
      disabledReasons: config.messages.disabledReasons,
    });
    return createResponse(context);
  }

  context.analysis = analyzeFile(context);
  context.analysis.originalLanguage = await resolveOriginalLanguage(context);
  context.plan = buildProcessingPlan(context);

  if (!context.plan.isValid) {
    context.log.info('Analysis summary', summarizeAnalysis(context.analysis));
    context.log.error('Processing plan is invalid', context.plan.validation.reasons);
    return createResponse(context);
  }

  context.plan.command = buildFfmpegCommand(context);
  context.plan.ffmpegArgs = context.plan.command.args;
  runInPlaceActions(context);

  if (context.settings.logLevel === 'summary') {
    context.log.section('Compliance summary');
    context.log.summary(renderPlanSummary(context.plan, context.analysis));
  } else if (context.plan.shouldProcess || context.settings.dryRun) {
    context.log.info('Analysis summary', summarizeAnalysis(context.analysis));
    context.log.section('Planned final track table');
    context.log.info(renderFinalTrackTable(context.plan));
    context.log.section('Planned FFmpeg command');
    context.log.info(renderFfmpegCommandPreview(context.plan.command));
  } else {
    const isDebugNoOp = context.settings.logLevel === 'debug';

    if (isDebugNoOp) {
      context.log.info('Analysis summary', summarizeAnalysis(context.analysis));
    }
    context.log.section('Compliance summary');
    context.log.info(renderPlanSummary(context.plan, context.analysis, { includeReasons: isDebugNoOp }));
  }

  return createResponse(context);
}

function createResponse(context) {
  const command = context.plan?.command || null;
  const canExecute = Boolean(context.plan?.isValid && context.plan?.shouldProcess && command?.isExecutable && !context.settings.dryRun);
  const response = Object.assign({}, context.response, {
    processFile: canExecute,
    preset: canExecute ? command.preset : '',
    FFmpegMode: canExecute,
    ffmpegMode: canExecute,
    cliToUse: canExecute ? 'ffmpeg' : '',
    infoLog: context.log.toString(),
  });

  return response;
}

// #endregion

// #region Exports
module.exports.details = details;
module.exports.plugin = plugin;
// #endregion
