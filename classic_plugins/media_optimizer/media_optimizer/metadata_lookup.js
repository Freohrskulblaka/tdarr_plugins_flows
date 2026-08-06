/*
 * Media Optimizer Metadata Lookup Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Resolves external media metadata and original language details from Tdarr variables, Sonarr, Radarr, and local analysis fallbacks.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Split original-language and Sonarr/Radarr lookup helpers out of the analysis inventory library.
 * - 2026-08-04 - Freohrskulblaka: Read Tdarr flow-style args.userVariables in addition to classic-plugin otherArguments.userVariables.
 * - 2026-08-04 - Freohrskulblaka: Prefer a single classic Arr connection profile input before Tdarr variable fallback.
 * - 2026-08-04 - Freohrskulblaka: Added a Radarr title/year fallback for movie-like filenames without embedded IDs.
 * - 2026-08-04 - Freohrskulblaka: Added an Arr profile lookup mode while preserving legacy variable mode aliases.
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
  const possibleRoots = [
    otherArguments,
    otherArguments?.args,
    otherArguments?.args?.args,
  ];

  for (const root of possibleRoots) {
    const value = root?.userVariables?.[normalizedScope]?.[name];

    if (value) {
      return value;
    }
  }

  return '';
}

function resolveLookupConfig(settings, otherArguments) {
  const lookupMode = settings.originalLanguageLookup || 'Filename and Streams Only';
  const lookupUsesArrProfile = lookupMode === 'Sonarr/Radarr Arr Profile';
  const lookupUsesLegacyVariables = lookupMode === 'Sonarr/Radarr Global Variables'
    || lookupMode === 'Sonarr/Radarr Library Variables';
  const lookupUsesApi = lookupUsesArrProfile || lookupUsesLegacyVariables;
  const lookupConfig = {
    lookupMode,
    lookupUsesVariables: lookupUsesApi,
    lookupScope: null,
    sonarrHost: '',
    sonarrApiKey: '',
    radarrHost: '',
    radarrApiKey: '',
  };

  if (!lookupUsesApi) {
    return lookupConfig;
  }

  let lookupScope = 'arrConnectionProfile';

  if (lookupMode === 'Sonarr/Radarr Library Variables') {
    lookupScope = 'library';
  } else if (lookupMode === 'Sonarr/Radarr Global Variables') {
    lookupScope = 'global';
  }

  const arrConnectionProfile = settings?.lookup?.arrConnectionProfile || null;

  lookupConfig.lookupScope = lookupScope;
  lookupConfig.sonarrHost = arrConnectionProfile?.sonarr?.host || '';
  lookupConfig.sonarrApiKey = arrConnectionProfile?.sonarr?.apiKey || '';
  lookupConfig.radarrHost = arrConnectionProfile?.radarr?.host || '';
  lookupConfig.radarrApiKey = arrConnectionProfile?.radarr?.apiKey || '';

  if (lookupUsesLegacyVariables) {
    lookupConfig.sonarrHost = lookupConfig.sonarrHost
      || getTdarrVariable('MediaOptimizerSonarrHost', lookupScope, otherArguments);
    lookupConfig.sonarrApiKey = lookupConfig.sonarrApiKey
      || getTdarrVariable('MediaOptimizerSonarrAPIKey', lookupScope, otherArguments);
    lookupConfig.radarrHost = lookupConfig.radarrHost
      || getTdarrVariable('MediaOptimizerRadarrHost', lookupScope, otherArguments);
    lookupConfig.radarrApiKey = lookupConfig.radarrApiKey
      || getTdarrVariable('MediaOptimizerRadarrAPIKey', lookupScope, otherArguments);
  }

  return lookupConfig;
}

async function resolveOriginalLanguage(context) {
  const lookupConfig = resolveLookupConfig(
    Object.assign({}, context.settings, { lookup: context.lookup }),
    context.otherArguments,
  );
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

  await resolveUnknownMediaOriginalLanguage(context, lookupConfig, originalLanguage);
}

async function resolveMovieOriginalLanguage(context, lookupConfig, originalLanguage) {
  if (!lookupConfig.radarrHost || !lookupConfig.radarrApiKey) {
    originalLanguage.errors.push('Radarr host or API key is missing; movie lookup skipped.');
    return;
  }

  if (!context.analysis.media.imdbId) {
    await resolveMovieOriginalLanguageByTerm(context, lookupConfig, originalLanguage);
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

async function resolveUnknownMediaOriginalLanguage(context, lookupConfig, originalLanguage) {
  if (!lookupConfig.radarrHost || !lookupConfig.radarrApiKey) {
    originalLanguage.errors.push('Media type is unknown and Radarr host or API key is missing; lookup skipped.');
    return;
  }

  await resolveMovieOriginalLanguageByTerm(context, lookupConfig, originalLanguage);

  if (!originalLanguage.apiLookupAttempted) {
    originalLanguage.errors.push('Media type is unknown; Sonarr/Radarr lookup skipped.');
  }
}

async function resolveMovieOriginalLanguageByTerm(context, lookupConfig, originalLanguage) {
  const term = createMovieLookupTerm(context);

  if (!term) {
    originalLanguage.errors.push('Movie lookup term could not be derived from the filename; Radarr lookup skipped.');
    return;
  }

  originalLanguage.apiLookupAttempted = true;

  try {
    const url = buildApiUrl(
      lookupConfig.radarrHost,
      '/api/v3/movie/lookup',
      {
        term,
        apikey: lookupConfig.radarrApiKey,
      },
    );
    const movieData = await fetchJson(url);
    const movie = Array.isArray(movieData) ? movieData[0] : movieData;

    applyOriginalLanguageResult(originalLanguage, movie, 'radarr');
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

function createMovieLookupTerm(context) {
  const nameNoExtension = context.analysis?.file?.nameNoExtension || '';
  const normalizedName = String(nameNoExtension)
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const yearMatch = normalizedName.match(/^(.*?)(?:\s*[\[(]?((?:19|20)\d{2})[\])]?)(?:\s|$)/);

  if (!yearMatch) {
    return normalizedName;
  }

  const title = yearMatch[1]
    .replace(/[-[\](){}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const year = yearMatch[2];

  if (!title || !year) {
    return normalizedName;
  }

  return `${title} ${year}`;
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
