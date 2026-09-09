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
const { createLanguageLabel, detectLanguageVariant, normalizeLanguageForVariant } = require('../../utils/language');
const { analyzeTrackIntent } = require('../../utils/track_intent');

const AUDIO_CODEC_ALIASES = { 'ac-3': 'ac3', 'e-ac-3': 'eac3', 'mlp fba': 'truehd' };

function analyzeAudioStreams(audioStreams, mediaInfoTracks) {
  const mediaInfoAudioTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Audio');
  const enrichedAudioStreams = audioStreams.map((stream, streamIndex) => {
    const mediaInfoAudioTrack = mediaInfoAudioTracks.find((track) => String(track.StreamOrder) === String(stream.index))
      || mediaInfoAudioTracks[streamIndex]
      || null;
    return enrichAudioStream(stream, mediaInfoAudioTrack);
  });
  const languages = getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.language);

  return {
    items: enrichedAudioStreams,
    count: enrichedAudioStreams.length,
    hasStreams: enrichedAudioStreams.length > 0,
    hasMultipleStreams: enrichedAudioStreams.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasUntaggedStreams: languages.includes('und'),
    languages,
    channels: getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.channels || 'unknown'),
    codecs: getUniqueValues(enrichedAudioStreams, (stream) => stream.analysis.audio.codec),
  };
}

function enrichAudioStream(stream, mediaInfoAudioTrack) {
  const title = stream.tags?.title || stream.tags?.TITLE || mediaInfoAudioTrack?.Title || '';
  const language = normalizeLanguageForVariant(stream.tags?.language || stream.tags?.LANGUAGE || mediaInfoAudioTrack?.Language || 'und');
  const languageVariant = detectLanguageVariant(
    language,
    [stream.tags?.language, stream.tags?.LANGUAGE, mediaInfoAudioTrack?.Language],
    [stream.tags?.title, stream.tags?.TITLE, mediaInfoAudioTrack?.Title],
  );
  const parsedChannels = Number.parseFloat(stream.channels || mediaInfoAudioTrack?.Channels || 0);
  const channels = Number.isFinite(parsedChannels) ? parsedChannels : 0;
  const channelFamily = getAudioChannelFamily(channels);
  const rawCodec = String(stream.codec_name || mediaInfoAudioTrack?.Format || 'unknown').trim().toLowerCase();
  const codec = AUDIO_CODEC_ALIASES[rawCodec] || rawCodec.replace(/[^a-z0-9]+/g, '');
  const profile = stream.profile || mediaInfoAudioTrack?.Format_Profile || mediaInfoAudioTrack?.Format_Commercial_IfAny || '';
  const formatText = [profile, stream.codec_long_name, title, mediaInfoAudioTrack?.Format_Commercial_IfAny, mediaInfoAudioTrack?.Format_AdditionalFeatures]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  let formatKey = codec;

  if (formatText.includes('atmos')) {
    formatKey = 'atmos';
  } else if (codec === 'dts' && ['dts-hd ma', 'master audio', 'ma / core', 'xll'].some((label) => formatText.includes(label))) {
    formatKey = 'dts-hd ma';
  }
  const currentDefault = Boolean(stream.disposition?.default) || String(mediaInfoAudioTrack?.Default || '').toLowerCase() === 'yes';
  const parsedBitrate = Number(stream.bit_rate || stream.tags?.BPS || stream.tags?.bps || mediaInfoAudioTrack?.BitRate);
  const bitrate = Number.isFinite(parsedBitrate) ? parsedBitrate : 0;
  const trackIntent = analyzeTrackIntent({
    disposition: stream.disposition || {},
    title,
  });
  const audioAnalysis = {
    title,
    language,
    languageVariant,
    languageLabel: createLanguageLabel(language, languageVariant),
    channels,
    channelFamily,
    codec,
    formatKey,
    profile,
    currentDefault,
    bitrate,
    isCommentary: trackIntent.isCommentary,
    isDescriptive: trackIntent.isDescriptive,
    commentaryReasons: trackIntent.commentaryReasons,
    descriptiveReasons: trackIntent.descriptiveReasons,
  };
  const enrichedStream = Object.assign({}, stream, {
    analysis: Object.assign({}, stream.analysis || {}, {
      audio: audioAnalysis,
    }),
  });

  return enrichedStream;
}

function getAudioChannelFamily(channels) {
  if (channels >= 8) {
    return '7.1';
  }

  if (channels >= 6) {
    return '5.1';
  }

  if (channels > 0 && channels <= 2) {
    return 'stereo';
  }

  return 'other';
}

module.exports = {
  analyzeAudioStreams,
};
