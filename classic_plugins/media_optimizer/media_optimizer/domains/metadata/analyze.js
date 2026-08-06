/*
 * Media Optimizer Metadata Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-15
 * Description: Builds normalized metadata facts for global tags, titles, and extra tag/data streams.
 * Updates:
 * - 2026-07-15 - Freohrskulblaka: Added focused metadata source facts for metadata planning.
 */

function analyzeMetadata(streams, formatTags) {
  const normalizedGlobalTags = normalizeTags(formatTags);
  const fileTitle = getTagValue(normalizedGlobalTags, ['title']);
  const videoTitleStreams = streams
    .filter((stream) => stream.codec_type === 'video')
    .map(normalizeVideoTitleStream)
    .filter((stream) => stream.title);
  const extraTagStreams = streams
    .filter(isExtraTagStream)
    .map(normalizeExtraTagStream);

  return {
    globalTags: normalizedGlobalTags,
    globalTagKeys: Object.keys(normalizedGlobalTags),
    fileTitle,
    hasFileTitle: Boolean(fileTitle),
    videoTitleStreams,
    videoTitleCount: videoTitleStreams.length,
    extraTagStreams,
    extraTagStreamCount: extraTagStreams.length,
    hasExtraTagStreams: extraTagStreams.length > 0,
  };
}

function normalizeVideoTitleStream(stream) {
  const tags = normalizeTags(stream?.tags || {});

  return {
    sourceIndex: stream?.index,
    codecType: stream?.codec_type || '',
    codecName: stream?.codec_name || '',
    title: getTagValue(tags, ['title']),
  };
}

function normalizeExtraTagStream(stream) {
  const tags = normalizeTags(stream?.tags || {});

  return {
    sourceIndex: stream?.index,
    codecType: stream?.codec_type || '',
    codecName: stream?.codec_name || '',
    title: getTagValue(tags, ['title', 'handler_name']),
    tagKeys: Object.keys(tags),
  };
}

function isExtraTagStream(stream) {
  const codecType = String(stream?.codec_type || '').toLowerCase();
  const codecName = String(stream?.codec_name || '').toLowerCase();
  const title = String(stream?.tags?.title || stream?.tags?.TITLE || stream?.tags?.handler_name || '').toLowerCase();

  if (codecType === 'data') {
    return true;
  }

  if (codecType === 'unknown' && /tag|metadata/.test(codecName)) {
    return true;
  }

  return codecType === 'unknown' && /tag|metadata/.test(title);
}

function normalizeTags(tags) {
  const normalizedTags = {};

  Object.keys(tags || {}).forEach((key) => {
    const normalizedKey = String(key || '').trim().toLowerCase();

    if (!normalizedKey) {
      return;
    }

    normalizedTags[normalizedKey] = tags[key];
  });

  return normalizedTags;
}

function getTagValue(tags, tagNames) {
  for (const tagName of tagNames) {
    const value = tags?.[tagName];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

module.exports = {
  analyzeMetadata,
};
