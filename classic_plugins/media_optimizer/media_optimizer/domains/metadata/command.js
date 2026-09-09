/*
 * Media Optimizer FFmpeg Metadata Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders planned global and stream metadata cleanup into FFmpeg output arguments.
 * Updates:
 * - 2026-08-04 - Freohrskulblaka: Strip global metadata without removing generated chapter titles.
 */

const { findOutputIndex, quoteArg } = require('../../utils/command_args');

function addMetadataArgs(args, plan, warnings, unsupportedSteps) {
  const metadataPlan = plan.metadata || {};

  if (metadataPlan.stripGlobalTags) {
    args.push('-map_metadata:g', '-1');
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

  const hasExtraTagTracks = (metadataPlan.extraTagTracks || []).length > 0;

  if (hasExtraTagTracks) {
    if (metadataPlan.removeExtraTagStreams) {
      warnings.push('Removed extra tag/data streams are omitted from the output maps.');
    } else {
      unsupportedSteps.push('Preserving extra tag/data streams is not supported because the target MKV may not accept their codecs.');
    }
  }
}

module.exports = {
  addMetadataArgs,
};
