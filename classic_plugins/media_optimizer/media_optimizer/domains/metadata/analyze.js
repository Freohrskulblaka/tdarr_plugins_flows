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
  const normalizedStreams = streams.map((stream) => {
    const tags = normalizeTags(stream?.tags || {});

    return {
      sourceIndex: stream?.index,
      codecType: String(stream?.codec_type || '').toLowerCase(),
      codecName: String(stream?.codec_name || '').toLowerCase(),
      title: getTagValue(tags, ['title']),
      handlerName: getTagValue(tags, ['handler_name']),
    };
  });
  const videoTitleStreams = normalizedStreams
    .filter((stream) => stream.codecType === 'video')
    .map((stream, sourceOrder) => ({sourceIndex: stream.sourceIndex, sourceOrder, title: stream.title}))
    .filter((stream) => stream.title);
  const extraTagStreams = normalizedStreams.filter((stream) => {
    return stream.codecType === 'data'
      || stream.codecType === 'unknown' && /tag|metadata/.test(`${stream.codecName} ${stream.title} ${stream.handlerName}`.toLowerCase());
  }).map((stream) => ({
    sourceIndex: stream.sourceIndex,
    codecType: stream.codecType,
    codecName: stream.codecName,
    title: stream.title || stream.handlerName,
  }));

  return {
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
