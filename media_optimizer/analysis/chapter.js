/*
 * Media Optimizer Chapter Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized chapter facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted chapter source facts from the analysis coordinator.
 */

function analyzeChapters(mediaInfoTracks) {
  const chapters = mediaInfoTracks.filter((track) => track['@type'] === 'Menu');

  const chapterInfo = {
    chapters,
    count: chapters.length,
    hasChapters: chapters.length > 0,
  };

  return chapterInfo;
}

module.exports = {
  analyzeChapters,
};
