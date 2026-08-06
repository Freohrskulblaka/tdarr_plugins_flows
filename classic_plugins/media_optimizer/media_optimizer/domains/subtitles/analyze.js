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
const { getUniqueValues } = require('../../shared/analysis_utils');
const {
  analyzeCommentaryTrack,
  createLanguageLabel: createSubtitleLanguageLabel,
  detectLanguageVariant,
  normalizeLanguageForVariant: normalizeSubtitleLanguage,
} = require('../../shared/media_text');

const PICTURE_SUBTITLE_CODECS = ['hdmv_pgs_subtitle', 'dvd_subtitle'];
const TEXT_SUBTITLE_CODECS = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text'];
const SUBTITLE_LANGUAGE_FILE_TOKENS = {en: 'eng', eng: 'eng', es: 'spa', spa: 'spa', fr: 'fre', fre: 'fre', fra: 'fre', pt: 'por', por: 'por'};

function analyzeSubtitleStreams(subtitleStreams, mediaInfoTracks) {
  const mediaInfoSubtitleTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Text');
  const enrichedSubtitleStreams = subtitleStreams.map((stream, sourceOrder) => {
    const mediaInfoSubtitleTrack = findSubtitleMediaInfoTrack(mediaInfoSubtitleTracks, stream, sourceOrder);
    return enrichSubtitleStream(stream, mediaInfoSubtitleTrack);
  });
  const languages = getUniqueValues(enrichedSubtitleStreams, (stream) => stream.analysis.subtitle.language);
  const codecs = getUniqueValues(enrichedSubtitleStreams, (stream) => stream.analysis.subtitle.codec);
  const subtitleTypes = getUniqueValues(enrichedSubtitleStreams, (stream) => stream.analysis.subtitle.subtitleType);

  const subtitleInfo = {
    items: enrichedSubtitleStreams,
    count: enrichedSubtitleStreams.length,
    hasStreams: enrichedSubtitleStreams.length > 0,
    hasMultipleStreams: enrichedSubtitleStreams.length > 1,
    hasMultipleLanguages: languages.length > 1,
    hasPictureSubtitles: subtitleTypes.includes('picture'),
    languages,
    codecs,
    subtitleTypes,
  };

  return subtitleInfo;
}

function analyzeExternalSubtitleFiles(fileInfo) {
  const directory = fileInfo.directory;

  if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return [];
  }

  const fileNames = fs.readdirSync(directory);
  const externalSubtitles = fileNames
    .filter((fileName) => path.extname(fileName).toLowerCase() === '.srt')
    .filter((fileName) => isExternalSubtitleSidecarForMedia(fileName, fileInfo.nameNoExtension))
    .map((fileName, sourceOrder) => createExternalSubtitleFile(path.join(directory, fileName), fileInfo.nameNoExtension, sourceOrder));

  return externalSubtitles;
}

function enrichSubtitleStream(stream, mediaInfoSubtitleTrack) {
  const title = stream.tags?.title || mediaInfoSubtitleTrack?.Title || '';
  const language = normalizeSubtitleLanguage(stream.tags?.language || mediaInfoSubtitleTrack?.Language || 'und');
  const languageVariant = detectSubtitleLanguageVariant(stream, mediaInfoSubtitleTrack, language);
  const codec = normalizeSubtitleCodec(stream.codec_name || 'unknown');
  const subtitleType = getSubtitleType(codec);
  const formatLabel = createSubtitleFormatLabel(codec, mediaInfoSubtitleTrack?.Format);
  const frameCount = parseSubtitleMetric(mediaInfoSubtitleTrack?.FrameCount || stream.nb_frames);
  const elementCount = parseSubtitleMetric(mediaInfoSubtitleTrack?.ElementCount);
  const streamSize = parseSubtitleMetric(mediaInfoSubtitleTrack?.StreamSize);
  const bitRate = parseSubtitleMetric(mediaInfoSubtitleTrack?.BitRate || stream.bit_rate);
  const isEmpty = isEmptySubtitle({frameCount, elementCount, streamSize});
  const contentScope = createSubtitleContentScope({isEmpty, frameCount, elementCount});
  const accessibility = detectSubtitleAccessibility(stream, title);
  const currentDefault = Boolean(stream.disposition?.default) || mediaInfoSubtitleTrack?.Default === 'Yes';
  const currentForced = Boolean(stream.disposition?.forced) || mediaInfoSubtitleTrack?.Forced === 'Yes';
  const titleIndicatesForced = detectTitleForced(title);
  const commentary = analyzeSubtitleCommentary(stream, title);
  const subtitleAnalysis = {
    title,
    language,
    languageVariant,
    languageLabel: createSubtitleLanguageLabel(language, languageVariant),
    codec,
    formatLabel,
    subtitleType,
    frameCount,
    elementCount,
    streamSize,
    bitRate,
    isEmpty,
    contentScope,
    accessibility,
    currentDefault,
    currentForced,
    titleIndicatesForced,
    isCommentary: commentary.isCommentary,
    commentaryReasons: commentary.reasons,
  };
  const enrichedStream = Object.assign({}, stream, {
    analysis: Object.assign({}, stream.analysis || {}, {
      subtitle: subtitleAnalysis,
    }),
  });

  return enrichedStream;
}

function createExternalSubtitleFile(filePath, mediaNameNoExtension, sourceOrder) {
  const fileName = path.basename(filePath);
  const title = path.basename(fileName, path.extname(fileName));
  const language = detectExternalSubtitleLanguage(fileName, mediaNameNoExtension);
  const languageVariant = detectLanguageVariant(language, [language], [title]);
  const streamSize = getExternalFileSize(filePath);
  const cueCount = countExternalSrtCues(filePath);
  const isEmpty = streamSize === 0;
  const externalSubtitle = {
    sourceKind: 'external',
    sourcePath: filePath,
    sourceOrder,
    fileName,
    title,
    codec: 'srt',
    formatLabel: 'SRT',
    subtitleType: 'text',
    language,
    languageVariant,
    languageLabel: createSubtitleLanguageLabel(language, languageVariant),
    frameCount: cueCount,
    elementCount: cueCount,
    streamSize,
    bitRate: null,
    isEmpty,
    contentScope: isEmpty ? 'empty' : 'unknown',
    accessibility: detectTitleAccessibility(title),
    titleIndicatesForced: detectTitleForced(title),
    isCommentary: false,
    commentaryReasons: [],
  };

  return externalSubtitle;
}

function findSubtitleMediaInfoTrack(mediaInfoSubtitleTracks, stream, sourceOrder) {
  const sourceIndex = String(stream.index);
  const sourceOrderIndex = String(sourceOrder + 1);
  const mediaInfoTrack = mediaInfoSubtitleTracks.find((track) => String(track.StreamOrder) === sourceIndex)
    || mediaInfoSubtitleTracks.find((track) => String(track.StreamOrder) === sourceOrderIndex)
    || mediaInfoSubtitleTracks[sourceOrder]
    || null;

  return mediaInfoTrack;
}

function detectSubtitleLanguageVariant(stream, mediaInfoTrack, language) {
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

function analyzeSubtitleCommentary(stream, title) {
  const commentary = analyzeCommentaryTrack({
    disposition: stream.disposition || {},
    title,
  });

  return commentary;
}

function createSubtitleFormatLabel(codec, mediaInfoFormat) {
  const normalizedCodec = normalizeSubtitleCodec(codec);
  const normalizedFormat = String(mediaInfoFormat || '').trim().toLowerCase();

  if (normalizedCodec === 'hdmv_pgs_subtitle' || normalizedFormat === 'pgs') {
    return 'PGS';
  }

  if (normalizedCodec === 'dvd_subtitle') {
    return 'DVD';
  }

  if (normalizedCodec === 'subrip' || normalizedCodec === 'srt' || normalizedFormat === 'utf-8') {
    return 'SRT';
  }

  if (normalizedCodec === 'ass' || normalizedFormat === 'ass') {
    return 'ASS';
  }

  if (normalizedCodec === 'ssa' || normalizedFormat === 'ssa') {
    return 'SSA';
  }

  if (normalizedCodec === 'webvtt') {
    return 'WEBVTT';
  }

  return String(mediaInfoFormat || codec || 'unknown').trim().toUpperCase();
}

function detectSubtitleAccessibility(stream, title) {
  const disposition = stream.disposition || {};

  if (disposition.hearing_impaired || disposition.captions) {
    return 'CC';
  }

  return detectTitleAccessibility(title);
}

function detectTitleAccessibility(title) {
  const normalizedTitle = String(title || '').toLowerCase();

  if (/\bsdh\b|hearing impaired|hearing-impaired|deaf|hard of hearing/.test(normalizedTitle)) {
    return 'SDH';
  }

  if (/\bcc\b|closed captions?|\[cc\]/.test(normalizedTitle)) {
    return 'CC';
  }

  return 'regular';
}

function detectTitleForced(title) {
  const normalizedTitle = String(title || '').toLowerCase();

  return /\bforced\b|\bforeign[ -]?only\b|\bsigns?[ &-]?songs?\b/.test(normalizedTitle);
}

function isEmptySubtitle({frameCount, elementCount, streamSize}) {
  const hasEmptyFrameCount = frameCount === 0;
  const hasEmptyElementCount = elementCount === 0;
  const hasEmptyStreamSize = streamSize === 0;
  const isEmpty = hasEmptyFrameCount || hasEmptyElementCount || hasEmptyStreamSize;

  return isEmpty;
}

function createSubtitleContentScope({isEmpty, frameCount, elementCount}) {
  const count = Math.max(frameCount || 0, elementCount || 0);

  if (isEmpty) {
    return 'empty';
  }

  if (count === 0) {
    return 'unknown';
  }

  if (count <= 250) {
    return 'sparse';
  }

  return 'full';
}

function detectExternalSubtitleLanguage(fileName, mediaNameNoExtension) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const normalizedBaseName = normalizeExternalSubtitleName(baseName);
  const normalizedMediaName = normalizeExternalSubtitleName(mediaNameNoExtension);
  const subtitleSuffix = getExternalSubtitleSuffix(normalizedBaseName, normalizedMediaName);
  const language = Object.keys(SUBTITLE_LANGUAGE_FILE_TOKENS).find((token) => {
    const canonicalLanguage = SUBTITLE_LANGUAGE_FILE_TOKENS[token];
    const hasLanguageToken = subtitleSuffix.split(/[^a-z0-9]+/).some((part) => {
      return part === token || part === canonicalLanguage;
    });

    return hasLanguageToken;
  });

  return language ? SUBTITLE_LANGUAGE_FILE_TOKENS[language] : 'und';
}

function isExternalSubtitleSidecarForMedia(fileName, mediaNameNoExtension) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const normalizedBaseName = normalizeExternalSubtitleName(baseName);
  const normalizedMediaName = normalizeExternalSubtitleName(mediaNameNoExtension);

  return normalizedBaseName === normalizedMediaName
    || normalizedBaseName.startsWith(`${normalizedMediaName}.`)
    || normalizedBaseName.startsWith(`${normalizedMediaName}-`)
    || normalizedBaseName.startsWith(`${normalizedMediaName}_`);
}

function getExternalSubtitleSuffix(normalizedBaseName, normalizedMediaName) {
  if (normalizedBaseName === normalizedMediaName) {
    return '';
  }

  if (
    normalizedBaseName.startsWith(`${normalizedMediaName}.`)
    || normalizedBaseName.startsWith(`${normalizedMediaName}-`)
    || normalizedBaseName.startsWith(`${normalizedMediaName}_`)
  ) {
    return normalizedBaseName.slice(normalizedMediaName.length + 1);
  }

  return normalizedBaseName;
}

function getSubtitleType(codec) {
  if (PICTURE_SUBTITLE_CODECS.includes(codec)) {
    return 'picture';
  }

  if (TEXT_SUBTITLE_CODECS.includes(codec)) {
    return 'text';
  }

  return 'other';
}

function normalizeSubtitleCodec(codec) {
  return String(codec || 'unknown').trim().toLowerCase();
}

function normalizeExternalSubtitleName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseSubtitleMetric(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getExternalFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (error) {
    return null;
  }
}

function countExternalSrtCues(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cueMatches = content.match(/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/g);

    return cueMatches ? cueMatches.length : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  analyzeExternalSubtitleFiles,
  analyzeSubtitleStreams,
};
