/*
 * Media Optimizer FFmpeg Subtitle Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders embedded subtitle copies and external subtitle imports into FFmpeg arguments.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('../../utils/command_args');

function buildSubtitleCommandArgs(subtitlePlan, streamIndexes, startingInputIndex) {
  const inputArgs = [];
  const outputArgs = [];
  const externalSubtitleInputs = new Map();
  let nextInputIndex = startingInputIndex;

  (subtitlePlan?.tracks || []).forEach((track) => {
    const isExternal = track.sourceKind === 'external';

    if (isExternal && !externalSubtitleInputs.has(track.sourcePath)) {
      const inputOptions = [
        track.textEncoding && ['-sub_charenc', quoteArg('UTF-8')],
        track.inputFormat && ['-f', track.inputFormat],
      ].filter(Boolean).flat();

      inputArgs.push(...inputOptions, '-i', quoteArg(track.sourcePath));
      externalSubtitleInputs.set(track.sourcePath, nextInputIndex);
      nextInputIndex += 1;
    }

    const outputIndex = streamIndexes.subtitle;
    const inputSpecifier = isExternal ? `${externalSubtitleInputs.get(track.sourcePath)}:0` : `0:${track.sourceIndex}`;

    outputArgs.push('-map', inputSpecifier, `-c:s:${outputIndex}`, 'copy');

    if (isExternal || track.titleNeedsUpdate) {
      const metadata = isExternal ? {language: track.language, title: track.title} : {title: track.title};
      addStreamMetadata(outputArgs, 's', outputIndex, metadata);
    }

    addDisposition(outputArgs, 's', outputIndex, {default: track.default, forced: track.forced});

    streamIndexes.subtitle += 1;
  });

  return {inputArgs, outputArgs, nextInputIndex};
}

module.exports = {
  buildSubtitleCommandArgs,
};
