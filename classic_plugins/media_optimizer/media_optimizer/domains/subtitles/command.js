/*
 * Media Optimizer FFmpeg Subtitle Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders embedded subtitle copies and external subtitle imports into FFmpeg arguments.
 * Updates:
 * - 2026-08-04 - Freohrskulblaka: Leave kept embedded subtitles as stream copies; only annotate newly imported external subtitles.
 * - 2026-08-04 - Freohrskulblaka: Apply planned subtitle dispositions during active remuxes while preserving embedded subtitle metadata.
 * - 2026-08-05 - Freohrskulblaka: Render planned forced subtitle dispositions instead of clearing all forced flags.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('../../shared/command_args');

function addExternalSubtitleInputs(subtitlePlan, inputArgs, startingInputIndex) {
  const externalSubtitleInputs = new Map();
  let nextInputIndex = startingInputIndex;

  (subtitlePlan?.tracks || []).forEach((track) => {
    if (track.sourceKind !== 'external' || externalSubtitleInputs.has(track.sourcePath)) {
      return;
    }

    if (track.textEncoding) {
      inputArgs.push('-sub_charenc', quoteArg('UTF-8'));
    }

    if (track.inputFormat) {
      inputArgs.push('-f', track.inputFormat);
    }

    inputArgs.push('-i', quoteArg(track.sourcePath));
    externalSubtitleInputs.set(track.sourcePath, nextInputIndex);
    nextInputIndex += 1;
  });

  return {
    inputs: externalSubtitleInputs,
    nextInputIndex,
  };
}

function addSubtitleArgs(args, subtitlePlan, streamIndexes, externalSubtitleInputs) {
  const shouldApplyDispositions = subtitlePlan?.shouldProcess === true;

  (subtitlePlan?.tracks || []).forEach((track) => {
    const outputIndex = streamIndexes.subtitle;

    if (track.sourceKind === 'external') {
      const inputIndex = externalSubtitleInputs.get(track.sourcePath);
      args.push('-map', `${inputIndex}:0`);
      args.push(`-c:s:${outputIndex}`, 'copy');
      addStreamMetadata(args, 's', outputIndex, {
        language: track.language,
        title: track.title,
      });
    } else {
      args.push('-map', `0:${track.sourceIndex}`);
      args.push(`-c:s:${outputIndex}`, 'copy');
    }

    if (shouldApplyDispositions) {
      addDisposition(args, 's', outputIndex, {
        default: track.default,
        forced: track.forced,
      });
    }

    streamIndexes.subtitle += 1;
  });
}

module.exports = {
  addExternalSubtitleInputs,
  addSubtitleArgs,
};
