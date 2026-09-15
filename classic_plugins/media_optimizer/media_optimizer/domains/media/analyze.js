/*
 * Media Optimizer Media Identity Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized movie and episode identity facts from the filename.
 */

// Filename parsing follows the Radarr/Sonarr naming formats used by this workflow.
// Radarr movies include title, release year, optional edition tags, IMDb ID, quality,
// media info, audio languages, and subtitle language hints. Sonarr episodes include
// series title/year, TVDB ID, season/episode, optional anime absolute episode,
// episode title, quality/media info, audio languages, and subtitle language hints.
function analyzeMediaIdentity(fileNameNoExtension) {
  const fileName = String(fileNameNoExtension || '');
  const nameYearMatch = fileName.match(/(.+?) \((\d{4})\)/);
  const seasonEpisodeMatch = fileName.match(/\bs(\d{1,2})e(\d{1,3})\b/i);
  const absoluteEpisodeMatch = fileName.match(/s\d{1,2}e\d{1,3} - (\d{3})/i);
  const resolutionMatch = fileName.match(/(2160p|4k|1080p|720p|480p)/i);
  const imdbId = fileName.match(/\[?imdb-(tt\d+)\]?/i)?.[1] || null;
  const tvdbId = fileName.match(/\[?tvdbid-(\d+)\]?/i)?.[1] || null;
  const episodePrefix = seasonEpisodeMatch
    ? fileName.slice(0, seasonEpisodeMatch.index)
      .replace(/\[?tvdbid-\d+\]?/ig, ' ')
      .replace(/[._]+/g, ' ')
      .replace(/[\s-]+$/g, '')
      .trim()
    : '';
  const episodeYearMatch = episodePrefix.match(/^(.*?)[\s([]+((?:19|20)\d{2})[\s)\]]*$/);
  const episodeName = (episodeYearMatch?.[1] || episodePrefix)
    .replace(/[\s([{]+$/g, '')
    .trim();

  let mediaType = 'Unknown';

  if (tvdbId || seasonEpisodeMatch) {
    mediaType = 'TV Show';
  } else if (imdbId || nameYearMatch) {
    mediaType = 'Movie';
  }

  const mediaIdentity = {
    type: mediaType,
    name: nameYearMatch?.[1] || episodeName,
    year: nameYearMatch?.[2] || episodeYearMatch?.[2] || '',
    season: seasonEpisodeMatch?.[1] || '',
    episode: seasonEpisodeMatch?.[2] || '',
    absoluteEpisode: absoluteEpisodeMatch?.[1] || '',
    resolution: resolutionMatch?.[1].toLowerCase() || '',
    imdbId,
    tvdbId,
  };

  return mediaIdentity;
}

module.exports = {
  analyzeMediaIdentity,
};
