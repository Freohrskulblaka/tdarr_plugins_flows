/*
 * Media Optimizer Media Info Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized media identity facts from filename and MediaInfo data.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted media identity facts from the analysis coordinator.
 */

// Filename parsing follows the Radarr/Sonarr naming formats used by this workflow.
// Radarr movies include title, release year, optional edition tags, IMDb ID, quality,
// media info, audio languages, and subtitle language hints. Sonarr episodes include
// series title/year, TVDB ID, season/episode, optional anime absolute episode,
// episode title, quality/media info, audio languages, and subtitle language hints.
function analyzeMediaInfo(fileNameNoExtension, mediaInfoTracks) {
  const nameYearMatch = fileNameNoExtension.match(/(.+?) \((\d{4})\)/);
  const tvdbIdMatch = fileNameNoExtension.match(/\[tvdbid-(\d+)]/i) || fileNameNoExtension.match(/tvdbid-(\d+)/i);
  const imdbIdMatch = fileNameNoExtension.match(/\[imdb-(tt\d+)]/i) || fileNameNoExtension.match(/imdb-(tt\d+)/i);
  const seasonEpisodeMatch = fileNameNoExtension.match(/s(\d{2})e(\d{1,3})/i);
  const absoluteEpisodeMatch = fileNameNoExtension.match(/s\d{2}e\d{1,3} - (\d{3})/i);
  const resolutionMatch = fileNameNoExtension.match(/(2160p|4k|1080p|720p|480p)/i);
  const hasTvdbEpisode = Boolean(tvdbIdMatch && seasonEpisodeMatch);
  const hasImdbId = Boolean(imdbIdMatch);

  let mediaType = 'Unknown';

  if (hasTvdbEpisode) {
    mediaType = 'TV Show';
  } else if (hasImdbId) {
    mediaType = 'Movie';
  }

  const mediaInfo = {
    type: mediaType,
    name: nameYearMatch?.[1] || '',
    year: nameYearMatch?.[2] || '',
    season: seasonEpisodeMatch?.[1] || '',
    episode: seasonEpisodeMatch?.[2] || '',
    absoluteEpisode: absoluteEpisodeMatch?.[1] || '',
    resolution: resolutionMatch?.[1] || '',
    imdbId: imdbIdMatch?.[1] || null,
    tvdbId: tvdbIdMatch?.[1] || null,
    tracks: mediaInfoTracks,
  };

  return mediaInfo;
}

module.exports = {
  analyzeMediaInfo,
};
