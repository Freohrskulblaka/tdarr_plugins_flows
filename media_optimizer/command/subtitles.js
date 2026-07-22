/*
 * Media Optimizer FFmpeg Subtitle Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders embedded subtitle copies and external SRT imports into FFmpeg arguments.
 */

const { addDisposition, addStreamMetadata, quoteArg } = require('./args');

function addExternalSubtitleInputs(subtitlePlan, inputArgs, startingInputIndex) {
  const externalSubtitleInputs = new Map();
  let nextInputIndex = startingInputIndex;

  (subtitlePlan?.tracks || []).forEach((track) => {
    if (track.sourceKind !== 'external' || externalSubtitleInputs.has(track.sourcePath)) {
      return;
    }

    externalSubtitleInputs.set(track.sourcePath, nextInputIndex);
    inputArgs.push('-sub_charenc', quoteArg('UTF-8'));
    inputArgs.push('-f', 'srt');
    inputArgs.push('-i', quoteArg(track.sourcePath));
    nextInputIndex += 1;
  });

  return {
    inputs: externalSubtitleInputs,
    nextInputIndex,
  };
}

function addSubtitleArgs(args, subtitlePlan, streamIndexes, externalSubtitleInputs) {
  (subtitlePlan?.tracks || []).forEach((track) => {
    if (track.sourceKind === 'external') {
      const inputIndex = externalSubtitleInputs.get(track.sourcePath);
      args.push('-map', `${inputIndex}:0`);
      args.push(`-c:s:${streamIndexes.subtitle}`, 'copy');
    } else {
      args.push('-map', `0:${track.sourceIndex}`);
      args.push(`-c:s:${streamIndexes.subtitle}`, 'copy');
    }

    addStreamMetadata(args, 's', streamIndexes.subtitle, {
      language: track.language,
      title: track.title,
    });
    addDisposition(args, 's', streamIndexes.subtitle, {
      default: track.default,
      forced: false,
    });
    streamIndexes.subtitle += 1;
  });
}

module.exports = {
  addExternalSubtitleInputs,
  addSubtitleArgs,
};
