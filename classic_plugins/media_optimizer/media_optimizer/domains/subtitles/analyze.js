/*
 * Media Optimizer Subtitle Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Builds normalized subtitle stream facts for language, type, defaults, forced flags, and commentary detection.
 * Updates:
 * - 2026-07-10 - Freohrskulblaka: Extracted subtitle source classification from the subtitle planner.
 * - 2026-07-13 - Freohrskulblaka:
 *   - Added subtitle richness facts and external SRT source inventory.
 *   - Limited external SRT discovery to sidecars matching the current media filename.
 *   - Reused shared analysis utility helpers.
 * - 2026-07-15 - Freohrskulblaka: Counted external SRT cue rows for duplicate-import checks.
 * - 2026-08-05 - Freohrskulblaka: Detect forced subtitle intent from title and sidecar filename text.
 */

const fs = require('fs');
const path = require('path');
const { getUniqueValues } = require('../../utils/analysis');
const { createLanguageLabel, detectLanguageVariant, normalizeLanguageForVariant } = require('../../utils/language');
const { analyzeCommentaryTrack } = require('../../utils/track_intent');

const PICTURE_SUBTITLE_CODECS = ['hdmv_pgs_subtitle', 'dvd_subtitle'];
const TEXT_SUBTITLE_CODECS = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text'];
const SUBTITLE_FORMAT_LABELS = {ass: 'ASS', dvd_subtitle: 'DVD', hdmv_pgs_subtitle: 'PGS', pgs: 'PGS', srt: 'SRT', ssa: 'SSA', subrip: 'SRT', 'utf-8': 'SRT', webvtt: 'WEBVTT'};
const SUBTITLE_LANGUAGE_FILE_TOKENS = {en: 'eng', eng: 'eng', es: 'spa', spa: 'spa', fr: 'fre', fre: 'fre', fra: 'fre', pt: 'por', por: 'por'};
const SUBTITLE_FORMAT_KEY_ALIASES = {hdmv_pgs_subtitle: 'pgs', pgs: 'pgs', srt: 'srt', subrip: 'srt'};
const NON_LANGUAGE_SUBTITLE_TOKENS = new Set(['ass', 'dub', 'pgs', 'sdh', 'srt', 'ssa', 'sub', 'sup', 'vtt']);
const DIALOGUE_CUE_PATTERN = /^\s*Dialogue:/gm;
const TIMESTAMP_CUE_PATTERN = /(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}/g;
const EXTERNAL_SUBTITLE_FORMATS = {
  '.ass': {codec: 'ass', formatKey: 'ass', formatLabel: 'ASS', subtitleType: 'text', inputFormat: 'ass', textEncoding: true, cuePattern: DIALOGUE_CUE_PATTERN},
  '.pgs': {codec: 'hdmv_pgs_subtitle', formatKey: 'pgs', formatLabel: 'PGS', subtitleType: 'picture', inputFormat: 'sup', textEncoding: false},
  '.srt': {codec: 'srt', formatKey: 'srt', formatLabel: 'SRT', subtitleType: 'text', inputFormat: 'srt', textEncoding: true, cuePattern: TIMESTAMP_CUE_PATTERN},
  '.ssa': {codec: 'ssa', formatKey: 'ssa', formatLabel: 'SSA', subtitleType: 'text', inputFormat: 'ass', textEncoding: true, cuePattern: DIALOGUE_CUE_PATTERN},
  '.sup': {codec: 'hdmv_pgs_subtitle', formatKey: 'pgs', formatLabel: 'PGS', subtitleType: 'picture', inputFormat: 'sup', textEncoding: false},
  '.vtt': {codec: 'webvtt', formatKey: 'webvtt', formatLabel: 'WEBVTT', subtitleType: 'text', inputFormat: 'webvtt', textEncoding: true, cuePattern: TIMESTAMP_CUE_PATTERN},
};

function analyzeSubtitles(streams, mediaInfoTracks, fileInfo) {
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
  const embedded = analyzeEmbeddedSubtitleStreams(subtitleStreams, mediaInfoTracks);
  const external = analyzeExternalSubtitleFiles(fileInfo);

  return {embedded, external};
}

function analyzeEmbeddedSubtitleStreams(subtitleStreams, mediaInfoTracks) {
  const readMetric = (value) => {
    const numberValue = value === undefined || value === null || value === '' ? NaN : Number(value);
    const finalNumberValue = Number.isFinite(numberValue) ? numberValue : null;
    return finalNumberValue;
  };

  const mediaInfoSubtitleTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Text');
  const embeddedSubtitles = subtitleStreams.map((stream, sourceOrder) => {
    const mediaInfoSubtitleTrack = mediaInfoSubtitleTracks.find((track) => String(track.StreamOrder) === String(stream.index)) || null;
    const title = stream.tags?.title || mediaInfoSubtitleTrack?.Title || '';
    const language = normalizeLanguageForVariant(stream.tags?.language || mediaInfoSubtitleTrack?.Language || 'und');
    const languageFields = [stream.tags?.language, stream.tags?.LANGUAGE, mediaInfoSubtitleTrack?.Language];
    const titleFields = [stream.tags?.title, stream.tags?.TITLE, mediaInfoSubtitleTrack?.Title];
    const languageVariant = detectLanguageVariant(language, languageFields, titleFields);
    const codec = String(stream.codec_name || 'unknown').trim().toLowerCase();
    const subtitleType = PICTURE_SUBTITLE_CODECS.includes(codec) ? 'picture' : TEXT_SUBTITLE_CODECS.includes(codec) ? 'text' : 'other';
    const mediaInfoFormat = String(mediaInfoSubtitleTrack?.Format || '').trim().toLowerCase();
    const formatLabel = SUBTITLE_FORMAT_LABELS[codec] || SUBTITLE_FORMAT_LABELS[mediaInfoFormat] || String(mediaInfoSubtitleTrack?.Format || codec || 'unknown').trim().toUpperCase();
    const formatKey = SUBTITLE_FORMAT_KEY_ALIASES[codec] || SUBTITLE_FORMAT_KEY_ALIASES[mediaInfoFormat] || codec || mediaInfoFormat || 'unknown';
    const frameCount = readMetric(mediaInfoSubtitleTrack?.FrameCount || stream.nb_frames);
    const elementCount = readMetric(mediaInfoSubtitleTrack?.ElementCount);
    const streamSize = readMetric(mediaInfoSubtitleTrack?.StreamSize);
    const bitRate = readMetric(mediaInfoSubtitleTrack?.BitRate || stream.bit_rate);
    const isEmpty = frameCount === 0 || elementCount === 0 || streamSize === 0;
    const contentCount = Math.max(frameCount || 0, elementCount || 0);
    const contentScope = isEmpty ? 'empty' : contentCount === 0 ? 'unknown' : contentCount <= 250 ? 'sparse' : 'full';
    const textIntent = detectSubtitleTextIntent({stream, title});
    const currentDefault = Boolean(stream.disposition?.default) || mediaInfoSubtitleTrack?.Default === 'Yes';
    const currentForced = Boolean(stream.disposition?.forced) || mediaInfoSubtitleTrack?.Forced === 'Yes';
    const commentary = analyzeCommentaryTrack({disposition: stream.disposition || {}, title});
    const subtitleAnalysis = {
      sourceKind: 'embedded', sourceIndex: stream.index, sourcePath: '', sourceOrder, title, language, languageVariant, codec,
      formatLabel, formatKey, subtitleType, frameCount, elementCount, streamSize, bitRate, isEmpty, contentScope,
      accessibility: textIntent.accessibility, currentDefault, currentForced, titleIndicatesForced: textIntent.forced,
      isCommentary: commentary.isCommentary, commentaryReasons: commentary.reasons, languageLabel: createLanguageLabel(language, languageVariant),
    };

    return subtitleAnalysis;
  });

  return createSubtitleInfo(embeddedSubtitles);
}

function analyzeExternalSubtitleFiles(fileInfo) {
  const directory = fileInfo.directory;

  if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return createSubtitleInfo([]);
  }

  const normalizeExternalSubtitleName = (value) => {
    const normalizedValue = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');

    return normalizedValue;
  };

  const mediaName = normalizeExternalSubtitleName(fileInfo.nameNoExtension);
  const fileNames = fs.readdirSync(directory);
  const externalSubtitles = [];

  fileNames.forEach((fileName) => {
    const extension = path.extname(fileName).toLowerCase();
    const format = EXTERNAL_SUBTITLE_FORMATS[extension];

    if (!format) {
      return;
    }

    const baseName = path.basename(fileName, extension);
    const normalizedBaseName = normalizeExternalSubtitleName(baseName);
    const isForCurrentMedia = normalizedBaseName === mediaName || normalizedBaseName.startsWith(`${mediaName}.`);

    if (!isForCurrentMedia) {
      return;
    }

    try {
      const sourcePath = path.join(directory, fileName);
      const suffix = normalizedBaseName === mediaName ? '' : normalizedBaseName.slice(mediaName.length + 1);
      const suffixParts = suffix.split(/[^a-z0-9]+/);
      const mappedLanguageToken = suffixParts.find((token) => SUBTITLE_LANGUAGE_FILE_TOKENS[token]);
      const genericLanguageToken = suffixParts.find((token) => /^[a-z]{3}$/.test(token) && !NON_LANGUAGE_SUBTITLE_TOKENS.has(token));
      const language = normalizeLanguageForVariant(SUBTITLE_LANGUAGE_FILE_TOKENS[mappedLanguageToken] || genericLanguageToken || 'und');
      const languageVariant = detectLanguageVariant(language, [language], [baseName]);
      const streamSize = fs.statSync(sourcePath).size;
      let cueCount = null;

      if (format.cuePattern) {
        const subtitleText = fs.readFileSync(sourcePath, 'utf8');
        cueCount = (subtitleText.match(format.cuePattern) || []).length;
      }

      const isEmpty = streamSize === 0 || cueCount === 0;
      const contentScope = isEmpty ? 'empty' : cueCount === null ? 'unknown' : cueCount <= 250 ? 'sparse' : 'full';
      const textIntent = detectSubtitleTextIntent({title: baseName});
      const commentary = analyzeCommentaryTrack({title: baseName});
      const externalSubtitle = {
        sourceKind: 'external', sourceIndex: null, sourcePath, sourceOrder: externalSubtitles.length, fileName,
        title: '', suffix, codec: format.codec, formatLabel: format.formatLabel, formatKey: format.formatKey, subtitleType: format.subtitleType,
        inputFormat: format.inputFormat, textEncoding: format.textEncoding, language, languageVariant, frameCount: cueCount,
        elementCount: cueCount, streamSize, bitRate: null, isEmpty, contentScope,
        accessibility: textIntent.accessibility, currentDefault: false, currentForced: false, titleIndicatesForced: textIntent.forced,
        isCommentary: commentary.isCommentary, commentaryReasons: commentary.reasons, languageLabel: createLanguageLabel(language, languageVariant),
      };

      externalSubtitles.push(externalSubtitle);
    } catch (error) {
      return;
    }
  });

  return createSubtitleInfo(externalSubtitles);
}

function createSubtitleInfo(subtitles) {
  const languages = getUniqueValues(subtitles, (subtitle) => subtitle.language);
  const codecs = getUniqueValues(subtitles, (subtitle) => subtitle.codec);
  const subtitleTypes = getUniqueValues(subtitles, (subtitle) => subtitle.subtitleType);

  return {
    items: subtitles,
    count: subtitles.length,
    hasStreams: subtitles.length > 0,
    hasMultipleStreams: subtitles.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasPictureSubtitles: subtitleTypes.includes('picture'),
    languages,
    codecs,
    subtitleTypes,
  };
}

function detectSubtitleTextIntent({stream, title}) {
  const disposition = stream?.disposition || {};
  const normalizedTitle = String(title || '').toLowerCase();
  const hasSdhTitle = /\bsdh\b|hearing impaired|hearing-impaired|deaf|hard of hearing/.test(normalizedTitle);
  const hasClosedCaptionTitle = /\bcc\b|closed captions?|\[cc\]/.test(normalizedTitle);
  const hasForcedTitle = /\bforced\b|\bforeign[ -]?only\b|\bsigns?[ &-]?songs?\b/.test(normalizedTitle);
  const hasAccessibility = disposition.hearing_impaired || disposition.captions;
  const accessibility = hasAccessibility ? 'CC' : hasSdhTitle ? 'SDH' : hasClosedCaptionTitle ? 'CC' : 'regular';

  return {accessibility, forced: hasForcedTitle};
}

module.exports = {
  analyzeSubtitles,
};
