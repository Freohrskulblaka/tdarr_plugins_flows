/*
 * Media Optimizer Metadata Lookup Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Resolves external media metadata and original language details from Tdarr variables, Sonarr, Radarr, and local analysis fallbacks.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Split original-language and Sonarr/Radarr lookup helpers out of the analysis inventory library.
 */

const LANGUAGE_NAME_TO_ISO3 = {
  english: 'eng',
  spanish: 'spa',
  japanese: 'jpn',
  french: 'fra',
  german: 'deu',
  italian: 'ita',
  portuguese: 'por',
  chinese: 'zho',
  korean: 'kor',
  hindi: 'hin',
  russian: 'rus',
  dutch: 'nld',
  swedish: 'swe',
  norwegian: 'nor',
  danish: 'dan',
  finnish: 'fin',
  polish: 'pol',
  arabic: 'ara',
  hebrew: 'heb',
  thai: 'tha',
  turkish: 'tur',
};

function getTdarrVariable(name, scope, otherArguments) {
  const normalizedScope = scope === 'library' ? 'library' : 'global';
  return (
    otherArguments?.userVariables?.[normalizedScope]?.[name]
    || ''
  );
}

function resolveLookupConfig(settings, otherArguments) {
  const lookupMode = settings.originalLanguageLookup || 'Filename and Streams Only';
  const lookupUsesVariables = lookupMode === 'Sonarr/Radarr Global Variables'
    || lookupMode === 'Sonarr/Radarr Library Variables';
  const lookupConfig = {
    lookupMode,
    lookupUsesVariables,
    lookupScope: null,
    sonarrHost: '',
    sonarrApiKey: '',
    radarrHost: '',
    radarrApiKey: '',
  };

  if (!lookupUsesVariables) {
    return lookupConfig;
  }

  const lookupScope = lookupMode === 'Sonarr/Radarr Library Variables' ? 'library' : 'global';

  lookupConfig.lookupScope = lookupScope;
  lookupConfig.sonarrHost = getTdarrVariable('MediaOptimizerSonarrHost', lookupScope, otherArguments);
  lookupConfig.sonarrApiKey = getTdarrVariable('MediaOptimizerSonarrAPIKey', lookupScope, otherArguments);
  lookupConfig.radarrHost = getTdarrVariable('MediaOptimizerRadarrHost', lookupScope, otherArguments);
  lookupConfig.radarrApiKey = getTdarrVariable('MediaOptimizerRadarrAPIKey', lookupScope, otherArguments);

  return lookupConfig;
}

async function resolveOriginalLanguage(context) {
  const lookupConfig = resolveLookupConfig(context.settings, context.otherArguments);
  const localLanguage = resolveLocalOriginalLanguage(context);
  const originalLanguage = {
    language: localLanguage.language,
    languageName: '',
    source: lookupConfig.lookupMode === 'Disabled' ? 'disabled' : localLanguage.source,
    lookupMode: lookupConfig.lookupMode,
    variableScope: lookupConfig.lookupScope,
    imdbId: context.analysis.media.imdbId,
    tvdbId: context.analysis.media.tvdbId,
    radarrConfigured: Boolean(lookupConfig.radarrHost && lookupConfig.radarrApiKey),
    sonarrConfigured: Boolean(lookupConfig.sonarrHost && lookupConfig.sonarrApiKey),
    apiLookupEnabled: lookupConfig.lookupUsesVariables && Boolean(
      (lookupConfig.radarrHost && lookupConfig.radarrApiKey)
        || (lookupConfig.sonarrHost && lookupConfig.sonarrApiKey),
    ),
    apiLookupAttempted: false,
    apiLookupSucceeded: false,
    mediaMetadata: {},
    errors: [],
    note: '',
  };

  if (!lookupConfig.lookupUsesVariables) {
    originalLanguage.note = lookupConfig.lookupMode === 'Disabled'
      ? 'Original language lookup is disabled. Local fallback is retained for planning safety.'
      : 'Using filename and stream metadata only.';
    return originalLanguage;
  }

  await resolveOriginalLanguageFromArr(context, lookupConfig, originalLanguage);

  if (!originalLanguage.apiLookupSucceeded) {
    originalLanguage.note = 'API lookup did not resolve an original language. Using local stream fallback.';
  }

  return originalLanguage;
}

function resolveLocalOriginalLanguage(context) {
  const audioLanguages = context.analysis.streams.audio.items
    .map((stream) => stream.tags?.language)
    .filter(Boolean);
  const localLanguage = {
    language: audioLanguages[0] || context.settings.languageOrder.audio[0] || 'und',
    source: audioLanguages.length > 0 ? 'audioStream' : 'languageOrderFallback',
  };

  return localLanguage;
}

async function resolveOriginalLanguageFromArr(context, lookupConfig, originalLanguage) {
  const isMovie = context.analysis.media.type === 'Movie';
  const isTvShow = context.analysis.media.type === 'TV Show';

  if (isMovie) {
    await resolveMovieOriginalLanguage(context, lookupConfig, originalLanguage);
    return;
  }

  if (isTvShow) {
    await resolveSeriesOriginalLanguage(context, lookupConfig, originalLanguage);
    return;
  }

  originalLanguage.errors.push('Media type is unknown; Sonarr/Radarr lookup skipped.');
}

async function resolveMovieOriginalLanguage(context, lookupConfig, originalLanguage) {
  if (!context.analysis.media.imdbId) {
    originalLanguage.errors.push('IMDb ID was not found in the filename; Radarr lookup skipped.');
    return;
  }

  if (!lookupConfig.radarrHost || !lookupConfig.radarrApiKey) {
    originalLanguage.errors.push('Radarr host or API key is missing; movie lookup skipped.');
    return;
  }

  originalLanguage.apiLookupAttempted = true;

  try {
    const url = buildApiUrl(
      lookupConfig.radarrHost,
      '/api/v3/movie/lookup/imdb',
      {
        imdbId: context.analysis.media.imdbId,
        apikey: lookupConfig.radarrApiKey,
      },
    );
    const movieData = await fetchJson(url);

    applyOriginalLanguageResult(originalLanguage, movieData, 'radarr');
  } catch (error) {
    originalLanguage.errors.push(`Radarr lookup failed: ${error.message}`);
  }
}

async function resolveSeriesOriginalLanguage(context, lookupConfig, originalLanguage) {
  if (!context.analysis.media.tvdbId) {
    originalLanguage.errors.push('TVDB ID was not found in the filename; Sonarr lookup skipped.');
    return;
  }

  if (!lookupConfig.sonarrHost || !lookupConfig.sonarrApiKey) {
    originalLanguage.errors.push('Sonarr host or API key is missing; series lookup skipped.');
    return;
  }

  originalLanguage.apiLookupAttempted = true;

  try {
    const url = buildApiUrl(
      lookupConfig.sonarrHost,
      '/api/v3/series',
      {
        tvdbId: context.analysis.media.tvdbId,
        includeSeasonImages: 'false',
        apikey: lookupConfig.sonarrApiKey,
      },
    );
    const seriesData = await fetchJson(url);
    const series = Array.isArray(seriesData) ? seriesData[0] : seriesData;

    applyOriginalLanguageResult(originalLanguage, series, 'sonarr');
  } catch (error) {
    originalLanguage.errors.push(`Sonarr lookup failed: ${error.message}`);
  }
}

function applyOriginalLanguageResult(originalLanguage, mediaData, source) {
  const normalizeLanguageCode = (languageName) => {
    const normalizedName = String(languageName || '').trim().toLowerCase();

    if (!normalizedName) {
      return '';
    }

    if (/^[a-z]{3}$/.test(normalizedName)) {
      return normalizedName;
    }

    return LANGUAGE_NAME_TO_ISO3[normalizedName] || 'und';
  };
  const createMetadataSummary = (data) => {
    const metadata = {
      source,
      title: data?.title || '',
      year: data?.year || null,
      imdbId: data?.imdbId || null,
      tvdbId: data?.tvdbId || null,
      tmdbId: data?.tmdbId || null,
      path: data?.path || '',
      monitored: data?.monitored ?? null,
      status: data?.status || '',
    };

    return metadata;
  };

  const originalLanguageName = mediaData?.originalLanguage?.name || '';
  const originalLanguageCode = normalizeLanguageCode(originalLanguageName);

  if (!originalLanguageCode) {
    originalLanguage.errors.push(`${source} response did not include an original language.`);
    return;
  }

  originalLanguage.language = originalLanguageCode;
  originalLanguage.languageName = originalLanguageName;
  originalLanguage.source = source;
  originalLanguage.apiLookupSucceeded = true;
  originalLanguage.mediaMetadata = createMetadataSummary(mediaData);
  originalLanguage.note = `Original language resolved from ${source}.`;
}

function buildApiUrl(host, pathname, query) {
  const normalizeHost = (value) => {
    const trimmedHost = String(value || '').trim().replace(/\/+$/, '');
    const hostHasProtocol = /^https?:\/\//i.test(trimmedHost);
    const normalizedHost = hostHasProtocol ? trimmedHost : `http://${trimmedHost}`;

    return normalizedHost;
  };

  const normalizedHost = normalizeHost(host);
  const url = new URL(pathname, normalizedHost);

  Object.keys(query).forEach((key) => {
    url.searchParams.set(key, query[key]);
  });

  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

module.exports = {
  resolveOriginalLanguage,
};
