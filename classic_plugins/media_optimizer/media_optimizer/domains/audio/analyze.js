/*
 * Media Optimizer Audio Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Builds normalized audio stream facts for language, variants, channels, codecs, defaults, bitrate, and commentary detection.
 * Updates:
 * - 2026-07-10 - Freohrskulblaka:
 *   - Extracted audio stream classification from the audio planner.
 *   - Reused shared commentary and generalized language variant detection.
 * - 2026-07-13 - Freohrskulblaka: Reused shared analysis utility helpers.
 */

const { getUniqueValues } = require('../../utils/analysis');
const {
  createLanguageLabel: createAudioLanguageLabel,
  detectLanguageVariant,
  normalizeLanguageForVariant: normalizeAudioLanguage,
} = require('../../utils/language');
const { analyzeCommentaryTrack } = require('../../utils/track_intent');

function analyzeAudioStreams(audioStreams, mediaInfoTracks) {
  const mediaInfoAudioTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Audio');
  const enrichedAudioStreams = audioStreams.map((stream, streamIndex) => {
    const mediaInfoAudioTrack = findAudioMediaInfoTrack(mediaInfoAudioTracks, streamIndex);
    return enrichAudioStream(stream, mediaInfoAudioTrack);
  });
  const languages = getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.language);
  const audioInfo = {
    items: enrichedAudioStreams,
    count: enrichedAudioStreams.length,
    hasStreams: enrichedAudioStreams.length > 0,
    hasMultipleStreams: enrichedAudioStreams.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasUntaggedStreams: languages.includes('und'),
    languages,
    channels: getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.channels || 'unknown'),
    channelFamilies: getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.channelFamily),
    codecs: getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.codec),
  };

  return audioInfo;
}

function enrichAudioStream(stream, mediaInfoAudioTrack) {
  const title = stream.tags?.title || '';
  const language = normalizeAudioLanguage(stream.tags?.language || 'und');
  const languageVariant = detectAudioLanguageVariant(stream, mediaInfoAudioTrack, language);
  const channels = Number(stream.channels || 0);
  const channelFamily = getAudioChannelFamily(channels);
  const codec = normalizeAudioCodec(stream.codec_name || 'unknown');
  const profile = stream.profile || '';
  const currentDefault = Boolean(stream.disposition?.default);
  const bitrate = parseAudioBitrate(stream.bit_rate || stream.tags?.BPS || mediaInfoAudioTrack?.BitRate);
  const commentary = analyzeAudioCommentary(stream);
  const audioAnalysis = {
    title,
    language,
    languageVariant,
    languageLabel: createAudioLanguageLabel(language, languageVariant),
    channels,
    channelFamily,
    codec,
    profile,
    currentDefault,
    bitrate,
    isCommentary: commentary.isCommentary,
    commentaryReasons: commentary.reasons,
  };
  const enrichedStream = Object.assign({}, stream, {
    analysis: Object.assign({}, stream.analysis || {}, {
      audio: audioAnalysis,
    }),
  });

  return enrichedStream;
}

function findAudioMediaInfoTrack(mediaInfoAudioTracks, streamIndex) {
  const streamOrder = String(streamIndex + 1);
  const mediaInfoTrack = mediaInfoAudioTracks.find((track) => String(track.StreamOrder) === streamOrder)
    || mediaInfoAudioTracks[streamIndex]
    || null;

  return mediaInfoTrack;
}

function getAudioChannelFamily(channels) {
  if (channels >= 8) {
    return '7.1';
  }

  if (channels >= 6) {
    return '5.1';
  }

  if (channels <= 2) {
    return 'stereo';
  }

  return 'other';
}

function analyzeAudioCommentary(stream) {
  const title = stream.tags?.title || stream.tags?.TITLE || '';
  const commentary = analyzeCommentaryTrack({
    disposition: stream.disposition || {},
    title,
  });

  return commentary;
}

function detectAudioLanguageVariant(stream, mediaInfoTrack, language) {
  const languageFields = [
    stream.tags?.language,
    stream.tags?.LANGUAGE,
    mediaInfoTrack?.Language,
  ];
  const titleFields = [
    stream.tags?.title,
    stream.tags?.TITLE,
    mediaInfoTrack?.Title,
  ];
  const languageVariant = detectLanguageVariant(language, languageFields, titleFields);

  return languageVariant;
}

function normalizeAudioCodec(codec) {
  return String(codec || 'unknown').trim().toLowerCase();
}

function parseAudioBitrate(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

module.exports = {
  analyzeAudioStreams,
};
