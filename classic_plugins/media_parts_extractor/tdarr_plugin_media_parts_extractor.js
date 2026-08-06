/*
 * Media Parts Extractor Classic Plugin
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Tdarr classic plugin entrypoint for extracting donor audio and subtitle streams into sidecar files.
 */

const { analyzeFile, summarizeAnalysis } = require('../media_optimizer/media_optimizer/pipeline/analyze');
const { loadInputs, prepareConfig, createContext } = require('./media_parts_extractor/config');
const { buildExtractionPlan } = require('./media_parts_extractor/planning');
const { buildExtractionCommands, executeExtractionCommands } = require('./media_parts_extractor/command');
const {
  renderCommandPreview,
  renderExecutionResults,
  renderExtractionPlan,
} = require('./media_parts_extractor/formatting');

function details() {
  return {
    id: 'Tdarr_Plugin_Media_Parts_Extractor',
    Name: 'Media Parts Extractor',
    Stage: 'Pre-processing',
    Type: 'Audio, Subtitle',
    Operation: 'Transcode',
    Description: 'Extracts donor audio and subtitle streams into sidecar files for staging-library workflows. The source media file is not rewritten.',
    Version: '0.1.0',
    Tags: 'pre-processing, ffmpeg, audio, subtitles, extractor, sidecars',
    Inputs: [
      {
        name: 'runMode',
        type: 'string',
        defaultValue: 'Dry Run',
        inputUI: { type: 'dropdown', options: ['Dry Run', 'Extract'] },
        tooltip: 'Dry Run logs the planned sidecar extraction. Extract runs FFmpeg directly and leaves the source file unchanged.',
      },
      {
        name: 'audioMode',
        type: 'string',
        defaultValue: 'All',
        inputUI: { type: 'dropdown', options: ['All', 'Preferred Languages', 'None'] },
        tooltip: 'Select which audio streams should be extracted.',
      },
      {
        name: 'audioLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: 'Comma-separated preferred audio languages used when audioMode is Preferred Languages. Example: eng,spa',
      },
      {
        name: 'subtitleMode',
        type: 'string',
        defaultValue: 'All',
        inputUI: { type: 'dropdown', options: ['All', 'Text Only', 'Picture Only', 'Preferred Languages', 'None'] },
        tooltip: 'Select which subtitle streams should be extracted.',
      },
      {
        name: 'subtitleLanguages',
        type: 'string',
        defaultValue: 'eng,spa',
        inputUI: { type: 'text' },
        tooltip: 'Comma-separated preferred subtitle languages used when subtitleMode is Preferred Languages. Example: eng,spa',
      },
      {
        name: 'outputMode',
        type: 'string',
        defaultValue: 'Next To Source',
        inputUI: { type: 'dropdown', options: ['Next To Source', 'Configured Directory'] },
        tooltip: 'Choose whether extracted sidecars are written next to the donor file or into outputDirectory.',
      },
      {
        name: 'outputDirectory',
        type: 'string',
        defaultValue: '',
        inputUI: { type: 'text' },
        tooltip: 'Directory for extracted sidecars when outputMode is Configured Directory.',
      },
      {
        name: 'overwriteExisting',
        type: 'boolean',
        defaultValue: false,
        inputUI: { type: 'dropdown', options: ['false', 'true'] },
        tooltip: 'When false, existing sidecar files are skipped.',
      },
      {
        name: 'ffmpegPath',
        type: 'string',
        defaultValue: 'ffmpeg',
        inputUI: { type: 'text' },
        tooltip: 'FFmpeg executable path available to the Tdarr node.',
      },
      {
        name: 'logLevel',
        type: 'string',
        defaultValue: 'normal',
        inputUI: { type: 'dropdown', options: ['summary', 'normal', 'debug'] },
        tooltip: 'Controls log verbosity.',
      },
    ],
  };
}

async function plugin(file, librarySettings, inputs, otherArguments) {
  const rawInputs = loadInputs(inputs, details);
  const config = prepareConfig(rawInputs);
  const context = createContext(file, librarySettings, config, otherArguments);
  const runMode = context.settings.dryRun ? 'Dry Run' : 'Extract';

  context.log.section(`Media Parts Extractor ${runMode}`);
  context.log.info('Resolved settings', context.settings);

  if (context.isInvalid) {
    context.log.error('Configuration is invalid', context.messages.validationErrors);
    return createResponse(context);
  }

  context.analysis = analyzeFile(context);
  context.plan = buildExtractionPlan(context);

  context.log.info('Analysis summary', summarizeAnalysis(context.analysis));
  context.log.section('Extraction plan');
  context.log.info(renderExtractionPlan(context.plan));

  if (!context.plan.isValid) {
    context.log.error('Extraction plan is invalid', context.plan.validation.reasons);
    return createResponse(context);
  }

  context.plan.command = buildExtractionCommands(context);
  context.log.section('FFmpeg extraction commands');
  context.log.info(renderCommandPreview(context.plan.command));

  if (!context.settings.dryRun && context.plan.shouldProcess) {
    try {
      const results = executeExtractionCommands(context);
      context.log.section('Extraction results');
      context.log.info(renderExecutionResults(results));
    } catch (error) {
      context.log.error('Extraction command failed', error.message);
    }
  }

  return createResponse(context);
}

function createResponse(context) {
  return Object.assign({}, context.response, {
    processFile: false,
    preset: '',
    infoLog: context.log.toString(),
  });
}

module.exports.details = details;
module.exports.plugin = plugin;
