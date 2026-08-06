/*
 * Media Parts Extractor Config Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Loads Tdarr inputs and creates runtime context for donor audio/subtitle sidecar extraction.
 */

const path = require('path');
const { createLog } = require('../../media_optimizer/media_optimizer/logging');

function loadTdarrMethodsLib() {
  const candidatePaths = [
    '../methods/lib',
    '../../methods/lib',
    '../../../methods/lib',
  ];

  const errors = [];

  for (const candidatePath of candidatePaths) {
    try {
      const resolvedPath = require.resolve(candidatePath);
      return require(resolvedPath)();
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') {
        errors.push(`${candidatePath}: ${error.message}`);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to load Tdarr methods/lib from Media Parts Extractor package. Tried: ${errors.join(' | ')}`);
}

function loadInputs(inputs, details) {
  const lib = loadTdarrMethodsLib();
  return lib.loadDefaultValues(Object.assign({}, inputs || {}), details);
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 'Extract';
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function prepareConfig(inputs) {
  const outputMode = inputs.outputMode || 'Next To Source';
  const outputDirectory = String(inputs.outputDirectory || '').trim();
  const validationErrors = [];

  if (outputMode === 'Configured Directory' && !outputDirectory) {
    validationErrors.push('outputDirectory is required when outputMode is Configured Directory.');
  }

  return {
    isInvalid: validationErrors.length > 0,
    messages: { validationErrors },
    settings: {
      dryRun: !parseBoolean(inputs.runMode),
      ffmpegPath: String(inputs.ffmpegPath || 'ffmpeg').trim() || 'ffmpeg',
      logLevel: inputs.logLevel || 'normal',
      overwriteExisting: inputs.overwriteExisting === true || inputs.overwriteExisting === 'true',
      output: {
        mode: outputMode,
        directory: outputDirectory,
      },
      languageOrder: {
        audio: parseList(inputs.audioLanguages),
        subtitle: parseList(inputs.subtitleLanguages),
      },
      audio: {
        mode: inputs.audioMode || 'All',
      },
      subtitle: {
        mode: inputs.subtitleMode || 'All',
      },
    },
  };
}

function createContext(file, librarySettings, config, otherArguments) {
  const settings = Object.assign({}, config.settings, {
    output: Object.assign({}, config.settings.output, {
      container: file?.container || '',
    }),
  });

  return {
    file,
    librarySettings,
    otherArguments,
    settings,
    messages: config.messages,
    isInvalid: config.isInvalid,
    response: {
      processFile: false,
      preset: '',
      container: path.extname(file?.meta?.FileName || '') || '.mkv',
      handBrakeMode: false,
      FFmpegMode: false,
      reQueueAfter: false,
    },
    log: createLog(config.settings.logLevel),
    analysis: null,
    plan: null,
  };
}

module.exports = {
  loadInputs,
  prepareConfig,
  createContext,
};
