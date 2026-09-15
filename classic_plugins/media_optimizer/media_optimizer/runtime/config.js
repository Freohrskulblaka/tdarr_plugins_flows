/*
 * Media Optimizer Config Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Loads Tdarr inputs, resolves and validates settings, and creates runtime context.
 */

const { createLog } = require('./logging');
const { createProfileConfig } = require('./profiles');
const { loadTdarrMethodsLib } = require('./tdarr_methods');
const { parseArrConnectionProfile } = require('../integrations/arr_connection_profile');
const { normalizeLanguageForVariant } = require('../utils/language');

const BOOLEAN_INPUTS = ['dryRun', 'keepAudioCommentary', 'keepDescriptiveAudio'];
const LOG_LEVELS = ['summary', 'normal', 'debug'];
const ORIGINAL_LANGUAGE_LOOKUP_MODES = ['Disabled', 'Filename and Streams Only', 'Sonarr/Radarr Arr Profile'];

function loadInputs(inputs, details) {
  const lib = loadTdarrMethodsLib();
  const normalizedInputs = {...inputs};
  const invalidBooleanInputs = {};

  BOOLEAN_INPUTS.forEach((inputName) => {
    const value = normalizedInputs[inputName];
    const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : value;
    const hasValue = normalizedValue !== undefined && normalizedValue !== '';
    const isValid = typeof normalizedValue === 'boolean' || normalizedValue === 'true' || normalizedValue === 'false';

    if (hasValue && !isValid) {
      invalidBooleanInputs[inputName] = value;
    } else if (typeof normalizedValue === 'string') {
      normalizedInputs[inputName] = normalizedValue;
    }
  });

  return {
    ...lib.loadDefaultValues(normalizedInputs, details),
    ...invalidBooleanInputs,
  };
}

function prepareConfig(inputs) {
  const profileConfig = createProfileConfig(inputs);
  const validationErrors = [...profileConfig.messages.validationErrors];
  const parseChoice = (value, allowedValues, inputName, fallback) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    const selectedValue = allowedValues.find((allowedValue) => allowedValue.toLowerCase() === normalizedValue);

    if (!selectedValue) {
      validationErrors.push(`Invalid ${inputName}: ${value || '(empty)'}`);
    }

    return selectedValue || fallback;
  };
  const parseBoolean = (value, inputName, fallback) => {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalizedValue = String(value || '').trim().toLowerCase();

    if (normalizedValue === 'true' || normalizedValue === 'false') {
      return normalizedValue === 'true';
    }

    validationErrors.push(`Invalid ${inputName}: ${value || '(empty)'}`);
    return fallback;
  };
  const parseLanguageList = (value, inputName) => {
    const languageValues = String(value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (languageValues.length === 0) {
      validationErrors.push(`${inputName} must include at least one language.`);
      return [];
    }

    const normalizedLanguages = new Set();
    const invalidLanguages = [];

    languageValues.forEach((language) => {
      const normalizedLanguage = normalizeLanguageForVariant(language);

      if (language !== 'und' && normalizedLanguage === 'und') {
        invalidLanguages.push(language);
      } else {
        normalizedLanguages.add(normalizedLanguage);
      }
    });

    if (invalidLanguages.length > 0) {
      validationErrors.push(`Invalid ${inputName}: ${invalidLanguages.join(', ')}`);
    }

    return Array.from(normalizedLanguages);
  };
  const logLevel = parseChoice(inputs.logLevel, LOG_LEVELS, 'logLevel', 'normal');
  const originalLanguageLookup = parseChoice(
    inputs.originalLanguageLookup,
    ORIGINAL_LANGUAGE_LOOKUP_MODES,
    'originalLanguageLookup',
    'Disabled',
  );
  const dryRun = parseBoolean(inputs.dryRun, 'dryRun', true);
  const keepCommentary = parseBoolean(inputs.keepAudioCommentary, 'keepAudioCommentary', false);
  const keepDescriptive = parseBoolean(inputs.keepDescriptiveAudio, 'keepDescriptiveAudio', true);
  const audioLanguageOrder = parseLanguageList(inputs.audioLanguages, 'audioLanguages');
  const subtitleLanguageOrder = parseLanguageList(inputs.subtitleLanguages, 'subtitleLanguages');
  const arrConnectionProfile = parseArrConnectionProfile(inputs.arrConnectionProfile);

  if (originalLanguageLookup === 'Sonarr/Radarr Arr Profile' && arrConnectionProfile.isInvalid) {
    validationErrors.push(arrConnectionProfile.validationError);
  }

  const config = {
    isInvalid: validationErrors.length > 0,
    messages: {
      validationErrors,
    },
    settings: {
      logLevel,
      dryRun,
      originalLanguageLookup,
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
        keepCommentary,
        keepDescriptive,
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
