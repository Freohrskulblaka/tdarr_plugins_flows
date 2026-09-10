/*
 * Media Optimizer Chapter Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds chapter keep/add decisions from normalized chapter and file facts.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka:
 *   - Extracted chapter planning from the planning coordinator and modeled generated chapter markers.
 *   - Added media-type-aware generated chapter count bounds.
 * - 2026-07-15 - Freohrskulblaka: Skipped generated chapter planning when duration is unavailable.
 * - 2026-09-09 - Freohrskulblaka: Generated complete interval markers without a redundant end-of-file marker.
 * - 2026-08-04 - Freohrskulblaka: Prevent repeated generated-chapter remuxing on Tdarr cache outputs.
 */

const DEFAULT_CHAPTER_INTERVAL_SECONDS = 300;
const MAX_GENERATED_CHAPTER_COUNTS = {'TV Show': 12, Movie: 30};

function planChapters(context) {
  const chapterAnalysis = context.analysis.chapters;
  const existingChapters = chapterAnalysis.items;
  const durationSeconds = context.analysis.file.durationSeconds;
  const mediaType = context.analysis.media?.type || 'Unknown';
  const basePlan = {
    action: 'skip',
    count: 0,
    existingCount: existingChapters.length,
    generatedCount: 0,
    durationSeconds,
    intervalSeconds: null,
    mediaType,
    markers: [],
    source: chapterAnalysis.source,
    evidenceOnly: chapterAnalysis.evidenceOnly,
    shouldProcess: false,
    reasons: [],
  };

  if (chapterAnalysis.hasChapters) {
    return {
      ...basePlan,
      action: 'keep',
      count: chapterAnalysis.count,
    };
  }

  if (!context.settings.metadata.generateMissingChapters) {
    return {
      ...basePlan,
      reasons: ['No chapters were detected; the selected metadata profile does not generate chapter markers.'],
    };
  }

  if (context.analysis.file.isTdarrCacheOutput) {
    return {
      ...basePlan,
      reasons: ['No chapters were detected on a Tdarr cache output; generated chapter markers will not be re-applied.'],
    };
  }

  if (durationSeconds <= 0) {
    return {
      ...basePlan,
      reasons: ['No chapters were detected, but duration is unavailable; generated chapter markers will be skipped.'],
    };
  }

  const intervalCount = Math.ceil(durationSeconds / DEFAULT_CHAPTER_INTERVAL_SECONDS);
  const maximumCount = MAX_GENERATED_CHAPTER_COUNTS[mediaType] || intervalCount;
  const generatedCount = Math.min(maximumCount, intervalCount);
  const markers = Array.from({length: generatedCount}, (_, index) => {
    return generatedCount < intervalCount
      ? Math.floor((durationSeconds * index) / generatedCount)
      : index * DEFAULT_CHAPTER_INTERVAL_SECONDS;
  });

  return {
    ...basePlan,
    action: 'add',
    count: generatedCount,
    generatedCount,
    intervalSeconds: markers.length > 1 ? markers[1] - markers[0] : null,
    markers,
    shouldProcess: true,
    reasons: ['No chapters were detected; generated chapter markers will be added.'],
  };
}

module.exports = {
  planChapters,
};
