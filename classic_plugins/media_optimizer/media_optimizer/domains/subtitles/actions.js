/*
 * Media Optimizer Subtitle Actions
 * Created by: Freohrskulblaka
 * Created on: 2026-08-04
 * Description: Runs safe subtitle maintenance actions for files that do not need an FFmpeg processing pass.
 * Updates:
 * - 2026-08-05 - Freohrskulblaka: Repair forced subtitle flags to the planned state during no-op passes.
 */

function runSubtitleActions(context) {
  const shouldRunActions = context.plan?.isValid
    && !context.plan?.shouldProcess
    && !context.settings.dryRun;

  if (!shouldRunActions) {
    return;
  }

  cleanupMatchedExternalSubtitleSidecars(context);
  repairSubtitleMetadata(context);
}

function cleanupMatchedExternalSubtitleSidecars(context) {
  const matchedSidecars = context.plan?.subtitles?.matchedExternalSubtitles || [];

  if (matchedSidecars.length === 0) {
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

function repairSubtitleMetadata(context) {
  const subtitleTracks = context.plan?.subtitles?.tracks || [];
  const subtitleUpdates = subtitleTracks.filter((track) => {
    const dispositionChanged = track.default !== track.currentDefault || track.forced !== track.currentForced;
    return track.sourceKind === 'embedded' && (track.titleNeedsUpdate || dispositionChanged);
  });
  const shouldRepair = context.plan?.container?.targetContainer === 'mkv'
    && context.analysis?.file?.container === 'mkv'
    && subtitleUpdates.length > 0;

  if (!shouldRepair) {
    return;
  }

  const filePath = context.file?._id || context.file?.file;

  if (!filePath) {
    context.log.warn('Unable to repair subtitle metadata because the file path is missing.');
    return;
  }

  const args = [filePath];
  subtitleUpdates.forEach((track) => {
    const changes = [
      track.titleNeedsUpdate && `name=${track.title}`,
      track.default !== track.currentDefault && `flag-default=${track.default ? '1' : '0'}`,
      track.forced !== track.currentForced && `flag-forced=${track.forced ? '1' : '0'}`,
    ].filter(Boolean).flatMap((change) => ['--set', change]);

    args.push(
      '--edit',
      `track:s${track.sourceOrder + 1}`,
      ...changes,
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

    context.log.info('Repaired subtitle metadata in place with mkvpropedit', subtitleUpdates.map((track) => ({
      subtitleIndex: track.sourceOrder,
      title: track.title,
      default: track.default,
      forced: track.forced,
    })));
  } catch (error) {
    context.log.warn('Unable to repair subtitle metadata in place with mkvpropedit', {
      error: error.message,
    });
  }
}

module.exports = {
  runSubtitleActions,
};
