/*
 * Media Parts Extractor Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Selects donor audio and subtitle streams for sidecar extraction.
 */

const { buildAudioOutputPath, buildSubtitleOutputPath } = require('./naming');

function buildExtractionPlan(context) {
  const validation = validateSource(context);
  const audio = planAudio(context);
  const subtitles = planSubtitles(context);
  const shouldProcess = audio.items.length > 0 || subtitles.items.length > 0;

  return {
    isValid: validation.isValid,
    shouldProcess,
    validation,
    reasons: [...validation.reasons, ...audio.reasons, ...subtitles.reasons],
    audio,
    subtitles,
    command: null,
  };
}

function validateSource(context) {
  const reasons = [];
  const isVideoFile = context.analysis.file.medium === 'video';

  if (!isVideoFile) {
    reasons.push('Media Parts Extractor requires a video media file.');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

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

function planSubtitles(context) {
  const mode = context.settings.subtitle.mode;
  const languages = context.settings.languageOrder.subtitle;
  const items = context.analysis.streams.subtitle.items
    .filter((stream) => shouldExtractSubtitle(stream, mode, languages))
    .map((stream) => ({
      sourceIndex: stream.index,
      language: stream.analysis.subtitle.language,
      languageVariant: stream.analysis.subtitle.languageVariant,
      codec: stream.analysis.subtitle.codec,
      subtitleType: stream.analysis.subtitle.subtitleType,
      currentForced: stream.analysis.subtitle.currentForced,
      accessibility: stream.analysis.subtitle.accessibility,
      title: stream.analysis.subtitle.title,
      outputPath: buildSubtitleOutputPath(context, stream),
    }));
  const reasons = [];

  if (mode === 'None') {
    reasons.push('Subtitle extraction disabled by input.');
  } else if (items.length === 0) {
    reasons.push('No subtitle streams matched the extraction inputs.');
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

function shouldExtractSubtitle(stream, mode, languages) {
  const subtitle = stream.analysis.subtitle;

  if (mode === 'None') {
    return false;
  }

  if (mode === 'Text Only') {
    return subtitle.subtitleType === 'text';
  }

  if (mode === 'Picture Only') {
    return subtitle.subtitleType === 'picture';
  }

  if (mode === 'Preferred Languages') {
    return languages.includes(subtitle.language);
  }

  return true;
}

module.exports = {
  buildExtractionPlan,
};
