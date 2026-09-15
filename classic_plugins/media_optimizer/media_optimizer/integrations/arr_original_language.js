/*
 * Media Optimizer Original Language Integration
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Resolves original language from normalized audio analysis or optional Sonarr/Radarr variables.
 */

const { normalizeLanguageForVariant, normalizeVariantText } = require('../utils/language');

const ARR_PROFILE_MODE = 'Sonarr/Radarr Arr Profile';
const REQUEST_TIMEOUT_MS = 10000;

async function resolveOriginalLanguage(context) {
  const lookupMode = context.settings.originalLanguageLookup || 'Filename and Streams Only';
  const arrConnections = context.lookup?.arrConnections || {};
  const analyzedAudioLanguages = context.analysis.streams.audio.items
    .map((stream) => stream.analysis?.audio?.language)
    .filter((language) => language && language !== 'und');
  const firstAudioLanguage = analyzedAudioLanguages[0] || '';
  const configuredLanguages = context.settings.languageOrder.audio.map(normalizeLanguageForVariant);
  const configuredAudioLanguage = configuredLanguages.find((language) => analyzedAudioLanguages.includes(language)) || '';
  const analyzedAudioLanguage = lookupMode === ARR_PROFILE_MODE && configuredAudioLanguage
    ? configuredAudioLanguage
    : firstAudioLanguage;
  const configuredLanguage = configuredLanguages[0] || 'und';
  const localLanguage = analyzedAudioLanguage || configuredLanguage || 'und';
  let localSource = 'languageOrderFallback';

  if (analyzedAudioLanguage) {
    localSource = configuredAudioLanguage && analyzedAudioLanguage !== firstAudioLanguage
      ? 'configuredAudioStreamFallback'
      : 'audioStream';
  }
  const radarrConfigured = Boolean(arrConnections.radarr?.host && arrConnections.radarr?.apiKey);
  const sonarrConfigured = Boolean(arrConnections.sonarr?.host && arrConnections.sonarr?.apiKey);
  const originalLanguage = {
    language: localLanguage,
    languageName: '',
    source: lookupMode === 'Disabled' ? 'disabled' : localSource,
    lookupMode,
    imdbId: context.analysis.media.imdbId,
    tvdbId: context.analysis.media.tvdbId,
    radarrConfigured,
    sonarrConfigured,
    apiLookupEnabled: lookupMode === ARR_PROFILE_MODE && (radarrConfigured || sonarrConfigured),
    apiLookupAttempted: false,
    apiLookupSucceeded: false,
    errors: [],
    note: '',
  };

  if (lookupMode !== ARR_PROFILE_MODE) {
    originalLanguage.note = lookupMode === 'Disabled'
      ? 'Original language lookup is disabled. Local fallback is retained for planning safety.'
      : 'Using filename and stream metadata only.';
    return originalLanguage;
  }

  const request = createArrLookupRequest(context, arrConnections, originalLanguage.errors);

  if (!request) {
    originalLanguage.note = 'API lookup did not resolve an original language. Using local stream fallback.';
    return originalLanguage;
  }

  originalLanguage.apiLookupAttempted = true;

  try {
    const url = buildApiUrl(request.connection.host, request.pathname, request.query);
    const responseData = await fetchJson(url, request.connection.apiKey);
    const candidates = Array.isArray(responseData) ? responseData : [responseData];
    let mediaData = candidates[0] || null;

    if (request.seriesIdentity) {
      const exactMatches = candidates.filter((candidate) => {
        const candidateTitles = [
          candidate?.title,
          candidate?.sortTitle,
          candidate?.cleanTitle,
          ...(candidate?.alternateTitles || []).map((alternateTitle) => alternateTitle?.title),
        ]
          .map((title) => normalizeVariantText(title).replace(/[^a-z0-9]+/g, ' ').trim())
          .filter(Boolean);
        const titleMatches = candidateTitles.includes(request.seriesIdentity.normalizedTitle);
        const yearMatches = !request.seriesIdentity.year
          || String(candidate?.year || '') === request.seriesIdentity.year;

        return titleMatches && yearMatches;
      });

      mediaData = exactMatches.length === 1 ? exactMatches[0] : null;
    } else if (request.movieIdentity && candidates.length > 1) {
      const exactMatch = candidates.find((candidate) => {
        const candidateTitle = normalizeVariantText(candidate?.title)
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const titleMatches = candidateTitle === request.movieIdentity.normalizedTitle;
        const yearMatches = !request.movieIdentity.year
          || String(candidate?.year || '') === request.movieIdentity.year;

        return titleMatches && yearMatches;
      });

      mediaData = exactMatch || null;
    }

    if (!mediaData) {
      originalLanguage.errors.push(`${request.source} response did not contain an unambiguous media match.`);
    } else {
      const languageName = String(mediaData.originalLanguage?.name || '').trim();
      const language = normalizeLanguageForVariant(languageName);

      if (!languageName) {
        originalLanguage.errors.push(`${request.source} response did not include an original language.`);
      } else if (language === 'und') {
        originalLanguage.errors.push(`${request.source} returned unsupported original language "${languageName}".`);
      } else {
        originalLanguage.language = language;
        originalLanguage.languageName = languageName;
        originalLanguage.source = request.source;
        originalLanguage.apiLookupSucceeded = true;
        originalLanguage.note = `Original language resolved from ${request.source}.`;
      }
    }
  } catch (error) {
    originalLanguage.errors.push(`${request.source} lookup failed: ${error.message}`);
  }

  if (!originalLanguage.apiLookupSucceeded) {
    originalLanguage.note = 'API lookup did not resolve an original language. Using local stream fallback.';
  }

  return originalLanguage;
}

function createArrLookupRequest(context, arrConnections, errors) {
  const media = context.analysis.media;

  if (media.type === 'TV Show') {
    if (!arrConnections.sonarr?.host || !arrConnections.sonarr?.apiKey) {
      errors.push('Sonarr host or API key is missing; series lookup skipped.');
      return null;
    }

    if (!media.tvdbId) {
      const normalizedTitle = normalizeVariantText(media.name).replace(/[^a-z0-9]+/g, ' ').trim();

      if (!normalizedTitle) {
        errors.push('TVDB ID and series title were not found in the filename; Sonarr lookup skipped.');
        return null;
      }

      return {
        source: 'sonarr',
        connection: arrConnections.sonarr,
        pathname: '/api/v3/series',
        query: {includeSeasonImages: 'false'},
        seriesIdentity: {
          normalizedTitle,
          year: String(media.year || ''),
        },
      };
    }

    return {
      source: 'sonarr',
      connection: arrConnections.sonarr,
      pathname: '/api/v3/series',
      query: {tvdbId: media.tvdbId, includeSeasonImages: 'false'},
      seriesIdentity: null,
      movieIdentity: null,
    };
  }

  if (!arrConnections.radarr?.host || !arrConnections.radarr?.apiKey) {
    const prefix = media.type === 'Movie' ? '' : 'Media type is unknown and ';
    errors.push(`${prefix}Radarr host or API key is missing; lookup skipped.`);
    return null;
  }

  if (media.imdbId) {
    return {
      source: 'radarr',
      connection: arrConnections.radarr,
      pathname: '/api/v3/movie/lookup/imdb',
      query: {imdbId: media.imdbId},
      movieIdentity: null,
    };
  }

  const movieIdentity = createMovieLookupIdentity(context.analysis.file.nameNoExtension);

  if (!movieIdentity.term) {
    errors.push('Movie lookup term could not be derived from the filename; Radarr lookup skipped.');
    return null;
  }

  return {
    source: 'radarr',
    connection: arrConnections.radarr,
    pathname: '/api/v3/movie/lookup',
    query: {term: movieIdentity.term},
    movieIdentity,
  };
}

function createMovieLookupIdentity(nameNoExtension) {
  const normalizedName = String(nameNoExtension || '')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const yearMatch = normalizedName.match(/^(.*?)(?:\s*[\[(]?((?:19|20)\d{2})[\])]?)(?:\s|$)/);
  const title = (yearMatch?.[1] || normalizedName)
    .replace(/[-[\](){}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const year = yearMatch?.[2] || '';

  return {
    term: title && year ? `${title} ${year}` : title,
    normalizedTitle: normalizeVariantText(title).replace(/[^a-z0-9]+/g, ' ').trim(),
    year,
  };
}

function buildApiUrl(host, pathname, query) {
  const trimmedHost = String(host || '').trim();
  const hostWithProtocol = /^https?:\/\//i.test(trimmedHost) ? trimmedHost : `http://${trimmedHost}`;
  const url = new URL(hostWithProtocol);
  const basePath = url.pathname.replace(/\/+$/, '');
  const endpointPath = String(pathname || '').replace(/^\/+/, '');

  url.pathname = `${basePath}/${endpointPath}`.replace(/\/{2,}/g, '/');
  url.search = '';
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  return url.toString();
}

async function fetchJson(url, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  resolveOriginalLanguage,
};
