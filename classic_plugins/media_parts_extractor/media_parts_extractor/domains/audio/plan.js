/*
 * Media Parts Extractor Audio Plan Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Selects donor audio tracks by extraction mode and language.
 */

const { buildAudioOutputPath } = require('./naming');

function planAudio(context) {
  const mode = context.settings.audio.mode;
  const languages = context.settings.languageOrder.audio;
  const items = context.analysis.streams.audio.items
    .filter((stream) => shouldExtractAudio(stream, mode, languages))
    .map((stream) => ({
      sourceIndex: stream.index,
      language: stream.analysis.audio.language,
      languageVariant: stream.analysis.audio.languageVariant,
      codec: stream.analysis.audio.codec,
      channels: stream.analysis.audio.channels,
      channelFamily: stream.analysis.audio.channelFamily,
      title: stream.analysis.audio.title,
      outputPath: buildAudioOutputPath(context, stream),
    }));
  const reasons = [];

  if (mode === 'None') {
    reasons.push('Audio extraction disabled by input.');
  } else if (items.length === 0) {
    reasons.push('No audio streams matched the extraction inputs.');
  }

  return {
    mode,
    items,
    count: items.length,
    reasons,
  };
}

function shouldExtractAudio(stream, mode, languages) {
  if (mode === 'None') {
    return false;
  }

  if (mode === 'Preferred Languages') {
    return languages.includes(stream.analysis.audio.language);
  }

  return true;
}

module.exports = { planAudio };
