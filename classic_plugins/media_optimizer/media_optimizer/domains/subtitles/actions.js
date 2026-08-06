/*
 * Media Optimizer Subtitle Actions
 * Created by: Freohrskulblaka
 * Created on: 2026-08-04
 * Description: Runs safe subtitle maintenance actions for files that do not need an FFmpeg processing pass.
 * Updates:
 * - 2026-08-05 - Freohrskulblaka: Repair forced subtitle flags to the planned state during no-op passes.
 */

function runSubtitleActions(context) {
  cleanupMatchedExternalSubtitleSidecars(context);
  repairSubtitleDispositions(context);
}

function cleanupMatchedExternalSubtitleSidecars(context) {
  const matchedSidecars = context.plan?.subtitles?.matchedExternalSubtitles || [];
  const shouldClean = context.plan?.isValid
    && !context.plan?.shouldProcess
    && !context.settings.dryRun
    && matchedSidecars.length > 0;

  if (!shouldClean) {
    return;
  }

  const fs = require('fs');
  const removedSidecars = [];
  const failedSidecars = [];

  matchedSidecars.forEach((sidecar) => {
    const sourcePath = sidecar.sourcePath;

    try {
      if (sourcePath && fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
        removedSidecars.push({
          fileName: sidecar.fileName,
          matchedSourceIndex: sidecar.matchedSourceIndex,
        });
      }
    } catch (error) {
      failedSidecars.push({
        fileName: sidecar.fileName,
        error: error.message,
      });
    }
  });

  if (removedSidecars.length > 0) {
    context.log.info('Removed external subtitle sidecars already embedded in the MKV', removedSidecars);
  }

  if (failedSidecars.length > 0) {
    context.log.warn('Unable to remove external subtitle sidecars already embedded in the MKV', failedSidecars);
  }
}

function repairSubtitleDispositions(context) {
  const subtitleTracks = context.plan?.subtitles?.tracks || [];
  const dispositionUpdates = subtitleTracks
    .filter((track) => track.sourceKind === 'embedded')
    .filter((track) => track.default !== track.currentDefault || track.forced !== track.currentForced);
  const shouldRepair = context.plan?.isValid
    && !context.plan?.shouldProcess
    && !context.settings.dryRun
    && context.plan?.container?.targetContainer === 'mkv'
    && context.analysis?.file?.container === 'mkv'
    && dispositionUpdates.length > 0;

  if (!shouldRepair) {
    return;
  }

  const filePath = context.file?._id || context.file?.file;

  if (!filePath) {
    context.log.warn('Unable to repair subtitle default flags because the file path is missing.');
    return;
  }

  const args = [filePath];
  dispositionUpdates.forEach((track) => {
    args.push(
      '--edit',
      `track:s${track.sourceOrder + 1}`,
      '--set',
      `flag-default=${track.default ? '1' : '0'}`,
      '--set',
      `flag-forced=${track.forced ? '1' : '0'}`,
    );
  });

  const proc = require('child_process');

  try {
    const runner = context.otherArguments?.mediaOptimizerCommandRunner;

    if (typeof runner === 'function') {
      runner('mkvpropedit', args);
    } else {
      proc.execFileSync('mkvpropedit', args, { stdio: 'pipe' });
    }

    context.log.info('Repaired subtitle default flags in place with mkvpropedit', dispositionUpdates.map((track) => ({
      subtitleIndex: track.sourceOrder,
      default: track.default,
      forced: track.forced,
    })));
  } catch (error) {
    context.log.warn('Unable to repair subtitle default flags in place with mkvpropedit', {
      error: error.message,
    });
  }
}

module.exports = {
  cleanupMatchedExternalSubtitleSidecars,
  repairSubtitleDispositions,
  runSubtitleActions,
};
