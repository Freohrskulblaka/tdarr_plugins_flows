/*
 * Media Optimizer Chapter Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds chapter keep/add decisions from normalized chapter and file facts.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted chapter planning from the planning coordinator and modeled generated chapter markers.
 * - 2026-07-13 - Freohrskulblaka: Added media-type-aware generated chapter count bounds.
 */

const DEFAULT_CHAPTER_INTERVAL_SECONDS = 300;
const MIN_GENERATED_CHAPTER_COUNT = 2;
const MAX_EPISODE_CHAPTER_COUNT = 12;
const MAX_MOVIE_CHAPTER_COUNT = 30;

function planChapters(context) {
  const existingChapters = context.analysis.chapters || [];
  const hasChapters = existingChapters.length > 0;

  if (hasChapters) {
    return {
      action: 'keep',
      count: existingChapters.length,
      existingCount: existingChapters.length,
      generatedCount: 0,
      intervalSeconds: null,
      shouldProcess: false,
      reasons: [],
    };
  }

  const durationSeconds = getDurationSeconds(context);
  const mediaType = context.analysis.media?.type || 'Unknown';
  const generatedCount = estimateGeneratedChapterCount(durationSeconds, DEFAULT_CHAPTER_INTERVAL_SECONDS, mediaType);
  const reasons = ['No chapters were detected; generated chapter markers will be added.'];

  return {
    action: 'add',
    count: generatedCount,
    existingCount: 0,
    generatedCount,
    intervalSeconds: DEFAULT_CHAPTER_INTERVAL_SECONDS,
    mediaType,
    shouldProcess: true,
    reasons,
  };
}

function getDurationSeconds(context) {
  const file = context.file || {};
  const duration = file.mediaInfo?.format?.duration
    || file.mediaInfo?.format?.Duration
    || file.meta?.Duration
    || file.duration
    || 0;
  const durationSeconds = Number(duration);

  return Number.isFinite(durationSeconds) ? durationSeconds : 0;
}

function estimateGeneratedChapterCount(durationSeconds, intervalSeconds, mediaType) {
  if (durationSeconds <= 0 || intervalSeconds <= 0) {
    return 0;
  }

  const intervalCount = Math.ceil(durationSeconds / intervalSeconds);
  const boundedMinimumCount = Math.max(MIN_GENERATED_CHAPTER_COUNT, intervalCount);
  const maximumCount = getMaximumGeneratedChapterCount(mediaType);

  return maximumCount ? Math.min(maximumCount, boundedMinimumCount) : boundedMinimumCount;
}

function getMaximumGeneratedChapterCount(mediaType) {
  if (mediaType === 'TV Show') {
    return MAX_EPISODE_CHAPTER_COUNT;
  }

  if (mediaType === 'Movie') {
    return MAX_MOVIE_CHAPTER_COUNT;
  }

  return null;
}

module.exports = {
  planChapters,
};
