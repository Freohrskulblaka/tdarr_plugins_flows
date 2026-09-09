/*
 * Media Optimizer Subtitle Actions
 * Created by: Freohrskulblaka
 * Created on: 2026-08-04
 * Description: Runs safe subtitle maintenance actions for files that do not need an FFmpeg processing pass.
 * Updates:
 * - 2026-08-05 - Freohrskulblaka: Repair forced subtitle flags to the planned state during no-op passes.
 */

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

function addSubtitleMkvpropeditActions(context, args) {
  const subtitleTracks = context.plan?.subtitles?.tracks || [];
  const subtitleUpdates = subtitleTracks.filter((track) => {
    const dispositionChanged = track.default !== track.currentDefault || track.forced !== track.currentForced;
    return track.sourceKind === 'embedded' && (track.titleNeedsUpdate || dispositionChanged);
  });

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

  return subtitleUpdates.map((track) => ({
    subtitleIndex: track.sourceOrder,
    title: track.title,
    default: track.default,
    forced: track.forced,
  }));
}

module.exports = {
  addSubtitleMkvpropeditActions,
  cleanupMatchedExternalSubtitleSidecars,
};
