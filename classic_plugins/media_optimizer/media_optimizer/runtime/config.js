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
const { parseArrConnectionProfile } = require('../integrations/arr_connection_profile');

function loadInputs(inputs, details) {
  const lib = loadTdarrMethodsLib();
  const userInputs = lib.loadDefaultValues(Object.assign({}, inputs || {}), details);
  return userInputs;
}

function prepareConfig(inputs) {
  const parseList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
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
      audio: {
        ...profileConfig.settings.audio,
        keepCommentary: inputs.keepAudioCommentary === true || inputs.keepAudioCommentary === 'true',
        keepDescriptive: inputs.keepDescriptiveAudio === true || inputs.keepDescriptiveAudio === 'true',
      },
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
