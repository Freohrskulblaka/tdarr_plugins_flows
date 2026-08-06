/*
 * Media Optimizer Chapter Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized chapter facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted chapter source facts from the analysis coordinator.
 * - 2026-08-04 - Freohrskulblaka: Count FFprobe chapters when MediaInfo menu tracks are unavailable on Tdarr cache outputs.
 * - 2026-08-04 - Freohrskulblaka: Count individual MediaInfo Menu timestamp entries as chapters.
 * - 2026-08-04 - Freohrskulblaka: Read Tdarr's nested MediaInfo Menu extra timestamp map.
 * - 2026-08-04 - Freohrskulblaka: Treat a MediaInfo Menu track as chapter evidence even when timestamps are not expanded.
 * - 2026-08-04 - Freohrskulblaka: Count Tdarr/ExifTool chapter metadata from the provided file object.
 * - 2026-08-04 - Freohrskulblaka: Count Tdarr MediaInfo MenuCount metadata as chapter evidence.
 * - 2026-08-04 - Freohrskulblaka: Recognize Tdarr MediaInfo underscore-formatted Menu timestamps.
 * - 2026-08-04 - Freohrskulblaka: Tolerate alternate MediaInfo Menu extra containers from Tdarr scans.
 */

function analyzeChapters(mediaInfoTracks, ffProbeChapters, file) {
  const mediaInfoChapters = normalizeMediaInfoMenuChapters(mediaInfoTracks);
  const normalizedFfProbeChapters = Array.isArray(ffProbeChapters)
    ? ffProbeChapters.map((chapter, index) => Object.assign({source: 'ffprobe', index}, chapter))
    : [];
  const metadataChapters = normalizeMetadataChapters(file?.meta || {});
  const scannedChapters = mediaInfoChapters.length > 0
    ? mediaInfoChapters
    : normalizedFfProbeChapters.length > 0
      ? normalizedFfProbeChapters
      : metadataChapters;

  const chapterInfo = {
    chapters: scannedChapters,
    count: scannedChapters.length,
    hasChapters: scannedChapters.length > 0,
  };

  return chapterInfo;
}

function normalizeMediaInfoMenuChapters(mediaInfoTracks) {
  return mediaInfoTracks
    .filter((track) => track?.['@type'] === 'Menu')
    .flatMap((track, trackIndex) => {
      const chapters = normalizeMenuTrackChapters(track, trackIndex);

      if (chapters.length > 0) {
        return chapters;
      }

      return [{
        source: 'mediainfo',
        trackIndex,
        index: 0,
        start: '',
        title: '',
        rawValue: track,
      }];
    });
}

function normalizeMenuTrackChapters(track, trackIndex) {
  const arrayChapters = normalizeArrayChapters(track.Chapters || track.chapters || track.Menu || track.menu, trackIndex);

  if (arrayChapters.length > 0) {
    return arrayChapters;
  }

  const menuEntries = getMenuEntries(track);

  return menuEntries
    .filter(([key, value]) => isChapterTimestamp(key) || isChapterTimestamp(value))
    .map(([key, value], index) => createMediaInfoChapter({
      trackIndex,
      index,
      start: isChapterTimestamp(key) ? key : value,
      title: isChapterTimestamp(value) ? '' : value,
      rawKey: key,
      rawValue: value,
    }));
}

function getMenuEntries(track) {
  const entries = Object.entries(track || {});
  const extraEntries = [
    ...objectEntries(track?.extra),
    ...objectEntries(track?.Extra),
    ...objectEntries(track?.extra?.extra),
    ...objectEntries(track?.Extra?.extra),
  ];

  return [...entries, ...extraEntries];
}

function objectEntries(value) {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    try {
      return Object.entries(JSON.parse(value));
    } catch (error) {
      return [];
    }
  }

  if (typeof value !== 'object') {
    return [];
  }

  return Object.entries(value);
}

function normalizeArrayChapters(chapters, trackIndex) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  return chapters
    .map((chapter, index) => {
      if (typeof chapter === 'string') {
        return createMediaInfoChapter({
          trackIndex,
          index,
          start: chapter,
          title: '',
          rawValue: chapter,
        });
      }

      if (!chapter || typeof chapter !== 'object') {
        return null;
      }

      return createMediaInfoChapter({
        trackIndex,
        index,
        start: chapter.start || chapter.Start || chapter.startTime || chapter.StartTime || chapter.time || chapter.Time,
        title: chapter.title || chapter.Title || '',
        rawValue: chapter,
      });
    })
    .filter((chapter) => chapter && chapter.start);
}

function createMediaInfoChapter({ trackIndex, index, start, title, rawKey, rawValue }) {
  return {
    source: 'mediainfo',
    trackIndex,
    index,
    start: String(start || ''),
    title: String(title || ''),
    rawKey,
    rawValue,
  };
}

function isChapterTimestamp(value) {
  const normalizedValue = String(value || '').trim();

  return /^_?\d{1,2}[_:]\d{2}[_:]\d{2}(?:[_.:]\d+)?$/.test(normalizedValue);
}

function normalizeMetadataChapters(meta) {
  const chapterStrings = valuesToArray(meta.ChapterString || meta.ChapterTitle || meta.ChapterName);
  const chapterStarts = valuesToArray(meta.ChapterTimeStart || meta.ChapterStartTime || meta.ChapterStart);
  const chapterEnds = valuesToArray(meta.ChapterTimeEnd || meta.ChapterEndTime || meta.ChapterEnd);
  const menuCount = Number.parseInt(String(meta.MenuCount || meta.menuCount || '0'), 10) || 0;
  const count = Math.max(chapterStrings.length, chapterStarts.length, chapterEnds.length, menuCount > 0 ? 1 : 0);

  if (count === 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => ({
    source: 'metadata',
    index,
    start: String(chapterStarts[index] || ''),
    end: String(chapterEnds[index] || ''),
    title: String(chapterStrings[index] || ''),
    rawValue: {
      title: chapterStrings[index],
      start: chapterStarts[index],
      end: chapterEnds[index],
    },
  }));
}

function valuesToArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null && String(item).trim());
  }

  if (value === undefined || value === null || !String(value).trim()) {
    return [];
  }

  return [value];
}

module.exports = {
  analyzeChapters,
};
