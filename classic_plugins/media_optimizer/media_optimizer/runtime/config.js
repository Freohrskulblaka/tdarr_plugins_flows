/*
 * Media Optimizer Config Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Loads Tdarr inputs, resolves profile settings, validates disabled or invalid selections, and creates runtime context.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created configuration and context helpers for the media optimizer workflow.
 * - 2026-08-04 - Freohrskulblaka: Added parsing for a single Sonarr/Radarr connection profile input without logging secrets.
 * - 2026-08-04 - Freohrskulblaka: Defaulted classic responses to non-FFmpeg until execution is selected.
 */

const { createLog } = require('./logging');
const { createProfileConfig } = require('./profiles');
const { loadTdarrMethodsLib } = require('./tdarr_methods');

function loadInputs(inputs, details) {
  const lib = loadTdarrMethodsLib();
  const userInputs = lib.loadDefaultValues(Object.assign({}, inputs || {}), details);
  return userInputs;
}

function parseList(value) {
  const rawValue = String(value || '');
  const rawItems = rawValue.split(',');
  const normalizedItems = rawItems.map((item) => item.trim().toLowerCase());
  const parsedItems = normalizedItems.filter(Boolean);

  return parsedItems;
}

function normalizeConnectionEntry(entry) {
  const normalizedEntry = {
    host: '',
    apiKey: '',
  };

  if (!entry || typeof entry !== 'object') {
    return normalizedEntry;
  }

  normalizedEntry.host = String(entry.host || entry.url || '').trim();
  normalizedEntry.apiKey = String(entry.apiKey || entry.api_key || entry.key || '').trim();

  return normalizedEntry;
}

function parseArrConnectionProfile(value) {
  const rawValue = String(value || '').trim();
  const connectionProfile = {
    isConfigured: false,
    isInvalid: false,
    validationError: '',
    sonarr: normalizeConnectionEntry(null),
    radarr: normalizeConnectionEntry(null),
  };

  if (!rawValue) {
    return connectionProfile;
  }

  try {
    const parsedProfile = JSON.parse(rawValue);

    connectionProfile.sonarr = normalizeConnectionEntry(parsedProfile.sonarr);
    connectionProfile.radarr = normalizeConnectionEntry(parsedProfile.radarr);
    connectionProfile.isConfigured = Boolean(
      connectionProfile.sonarr.host
        || connectionProfile.sonarr.apiKey
        || connectionProfile.radarr.host
        || connectionProfile.radarr.apiKey,
    );
  } catch (error) {
    connectionProfile.isInvalid = true;
    connectionProfile.validationError = `Invalid arrConnectionProfile JSON: ${error.message}`;
  }

  return connectionProfile;
}

function prepareConfig(inputs) {
  const profileConfig = createProfileConfig(inputs);
  const validationErrors = [...profileConfig.messages.validationErrors];
  const disabledReasons = [...profileConfig.messages.disabledReasons];
  const audioLanguageOrder = parseList(inputs.audioLanguages);
  const subtitleLanguageOrder = parseList(inputs.subtitleLanguages);
  const arrConnectionProfile = parseArrConnectionProfile(inputs.arrConnectionProfile);

  if (arrConnectionProfile.isInvalid) {
    validationErrors.push(arrConnectionProfile.validationError);
  }

  const config = {
    isInvalid: validationErrors.length > 0,
    messages: {
      validationErrors,
      disabledReasons,
    },
    settings: {
      logLevel: inputs.logLevel || 'normal',
      dryRun: inputs.dryRun === true || inputs.dryRun === 'true',
      originalLanguageLookup: inputs.originalLanguageLookup,
      output: {
        container: 'mkv',
      },
      languageOrder: {
        audio: audioLanguageOrder,
        subtitle: subtitleLanguageOrder,
        video: audioLanguageOrder[0] || 'und',
      },
      video: profileConfig.settings.video,
      audio: profileConfig.settings.audio,
      subtitle: profileConfig.settings.subtitle,
      metadata: profileConfig.settings.metadata,
    },
    lookup: {
      arrConnectionProfile,
    },
  };

  return config;
}

function createContext(file, librarySettings, config, otherArguments) {
  const context = {
    file,
    librarySettings,
    otherArguments,
    settings: config.settings,
    lookup: config.lookup,
    messages: config.messages,
    isInvalid: config.isInvalid,
    response: {
      processFile: false,
      preset: '',
      container: '.mkv',
      handBrakeMode: false,
      FFmpegMode: false,
      ffmpegMode: false,
      cliToUse: '',
      reQueueAfter: false,
    },
    log: createLog(config.settings.logLevel),
    analysis: null,
    plan: null,
  };

  return context;
}

module.exports = {
  loadInputs,
  prepareConfig,
  createContext,
};
