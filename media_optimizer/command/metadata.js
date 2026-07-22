/*
 * Media Optimizer FFmpeg Metadata Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned global and stream metadata cleanup into FFmpeg output arguments.
 */

const { findOutputIndex, quoteArg } = require('./args');

function addMetadataArgs(args, plan, streamIndexes, warnings, unsupportedSteps) {
  const metadataPlan = plan.metadata || {};

  if (metadataPlan.stripGlobalTags) {
    args.push('-map_metadata', '-1');
  }

  if (metadataPlan.removeFileTitle) {
    args.push('-metadata', quoteArg('title='));
  }

  (metadataPlan.videoTitleTracks || []).forEach((track) => {
    if (track.action === 'removeTitle') {
      const outputVideoIndex = findOutputIndex(plan.video?.tracks, track.sourceIndex);

      if (outputVideoIndex !== null) {
        args.push(`-metadata:s:v:${outputVideoIndex}`, quoteArg('title='));
      }
    }
  });

  if ((metadataPlan.extraTagTracks || []).some((track) => track.action === 'remove')) {
    unsupportedSteps.push('Extra tag/data stream cleanup is planned by omitting mapped streams; verify with output inspection before enabling processing.');
  }

  if ((plan.attachments?.removedTracks || []).length > 0) {
    warnings.push('Removed attachments are omitted from the output maps; confirm FFmpeg preserves desired font attachments and drops only planned non-font attachments.');
  }

  if (streamIndexes.video === 0 || streamIndexes.audio === 0) {
    warnings.push('Command preview has no mapped video or audio stream; plan validation should normally prevent execution.');
  }
}

module.exports = {
  addMetadataArgs,
};
