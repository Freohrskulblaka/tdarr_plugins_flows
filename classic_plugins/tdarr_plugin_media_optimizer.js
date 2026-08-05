/*
 * Media Optimizer Classic Plugin
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Tdarr classic plugin entrypoint that orchestrates media optimizer configuration, analysis, planning, and response logging.
 * Changelog: ../docs/media_optimizer_changelog.md
 */

const MEDIA_OPTIMIZER_RUNTIME_MARKER = 'media-optimizer-arr-profile-2026-08-05-24';

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
    config: requireFresh('../media_optimizer/config'),
    analysis: requireFresh('../media_optimizer/analysis'),
    metadataLookup: requireFresh('../media_optimizer/metadata_lookup'),
    planning: requireFresh('../media_optimizer/planning'),
    formatting: requireFresh('../media_optimizer/formatting'),
    ffmpegCommand: requireFresh('../media_optimizer/ffmpeg_command'),
    inPlaceActions: requireFresh('../media_optimizer/actions/in_place'),
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
    Description: 'Profile-driven media optimizer that plans video, audio, subtitle, attachment, chapter, and metadata cleanup in one dry-run-safe workflow. Sonarr/Radarr lookup uses the Arr connection profile input.',
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
        tooltip: 'Select the target video codec and encoder family. NVIDIA GPU is the initial supported path. CPU, Intel QSV, AMD AMF, and H.264 options are scaffolded for future support and currently marked disabled.',
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
        tooltip: 'Balanced 1080p uses NVIDIA HEVC, slow preset, main10, 10-bit, and target compression rate 0.101. Archive Quality raises the target bitrate. Smaller Files lowers it. Compress 4K Preserve HDR Signaling keeps 4K resolution and writes basic HDR signaling flags when transcoding. Full HDR10+/Dolby Vision metadata cloning is not implemented yet. HDR-to-SDR and skip-HDR modes are scaffolded for future support and currently marked disabled.',
      },
      {
        name: 'audioProfile',
        type: 'string',
        defaultValue: 'Keep 5.1 and Stereo',
        inputUI: {
          type: 'dropdown',
          options: ['Keep 5.1 and Stereo', 'Keep 7.1, 5.1, and Stereo', 'Stereo Only', 'Preserve Audio'],
        },
        tooltip: 'Select the audio channel policy. Keep 5.1 and Stereo creates missing compatibility tracks and removes 7.1 after fallbacks exist. Preserve Audio avoids conversion/downmixing but still allows cleanup planning.',
      },
      {
        name: 'subtitleProfile',
        type: 'string',
        defaultValue: 'Picture First + Text',
        inputUI: {
          type: 'dropdown',
          options: ['Picture First + Text', 'Include Original Language', 'Text First', 'Text Only'],
        },
        tooltip: 'Select the subtitle retention and ordering policy. Picture First + Text keeps preferred-language image subtitles first, then text subtitles, and imports matching external SRT files when available.',
      },
      {
        name: 'metadataProfile',
        type: 'string',
        defaultValue: 'Clean',
        inputUI: {
          type: 'dropdown',
          options: ['Clean', 'Preserve'],
        },
        tooltip: 'Clean strips global tags, extra tag tracks, removes non-font attachments, preserves font attachments, and keeps or creates chapters. Preserve keeps the available source metadata.',
      },
      {
        name: 'audioLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: 'Comma-separated preferred audio languages after the original language. Example: eng,spa',
      },
      {
        name: 'subtitleLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: 'Comma-separated subtitle language order. Example: eng,spa',
      },
      {
        name: 'originalLanguageLookup',
        type: 'string',
        defaultValue: 'Filename and Streams Only',
        inputUI: {
          type: 'dropdown',
          options: ['Disabled', 'Filename and Streams Only', 'Sonarr/Radarr Arr Profile'],
        },
        tooltip: 'Select how original language should be resolved. Sonarr/Radarr Arr Profile uses the single arrConnectionProfile JSON input. Keys are not included in Media Optimizer logs.',
      },
      {
        name: 'arrConnectionProfile',
        type: 'string',
        defaultValue: '',
        inputUI: { type: 'text' },
        tooltip: 'Optional JSON object for Sonarr/Radarr lookup. Example: {"sonarr":{"host":"10.0.0.10:8989","apiKey":"key"},"radarr":{"host":"10.0.0.10:7878","apiKey":"key"}}',
      },
      {
        name: 'dryRun',
        type: 'boolean',
        defaultValue: true,
        inputUI: {
          type: 'dropdown',
          options: ['false', 'true'],
        },
        tooltip: 'When true, log the analysis and final plan but do not process the file.',
      },
      {
        name: 'logLevel',
        type: 'string',
        defaultValue: 'normal',
        inputUI: {
          type: 'dropdown',
          options: ['summary', 'normal', 'debug'],
        },
        tooltip: 'Controls log verbosity.',
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

  if (context.plan.shouldProcess || context.settings.dryRun) {
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
