/*
 * Media Optimizer FFmpeg Command Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Assembles focused command renderers into a dry-run-safe Tdarr FFmpeg preset preview.
 */

const { addAttachmentArgs } = require('../domains/attachments/command');
const { addAudioArgs } = require('../domains/audio/command');
const { addChapterArgs, addGeneratedChapterInput } = require('../domains/chapters/command');
const { addMetadataArgs } = require('../domains/metadata/command');
const { buildSubtitleCommandArgs } = require('../domains/subtitles/command');
const { addVideoArgs } = require('../domains/video/command');

function buildFfmpegCommand(context) {
  const plan = context.plan || {};
  const inputArgs = [];
  const outputArgs = [];
  const unsupportedSteps = [];
  const warnings = [];
  const streamIndexes = {
    video: 0,
    audio: 0,
    subtitle: 0,
    attachment: 0,
  };
  const subtitleCommand = buildSubtitleCommandArgs(plan.subtitles, streamIndexes, 1);
  inputArgs.push(...subtitleCommand.inputArgs);
  const chapterInputs = addGeneratedChapterInput(context, plan.chapters, inputArgs, subtitleCommand.nextInputIndex);

  addVideoArgs(outputArgs, plan.video, streamIndexes);
  addAudioArgs(outputArgs, plan.audio, streamIndexes);
  outputArgs.push(...subtitleCommand.outputArgs);
  addAttachmentArgs(outputArgs, plan.attachments, streamIndexes);
  addChapterArgs(outputArgs, plan.chapters, chapterInputs.chapterInput, unsupportedSteps);
  addMetadataArgs(outputArgs, plan, streamIndexes, warnings, unsupportedSteps);

  outputArgs.push('-max_muxing_queue_size', '9999');

  const args = [...inputArgs, ...outputArgs];
  const preset = args.length > 0 ? `, ${args.join(' ')}` : '';

  return {
    preset,
    args,
    unsupportedSteps,
    warnings,
    isExecutable: unsupportedSteps.length === 0,
  };
}

function renderFfmpegCommandPreview(command) {
  const lines = [];

  lines.push(`Executable in current slice: ${command.isExecutable ? 'yes' : 'no'}`);
  lines.push(`Preset: ${command.preset || '(empty)'}`);

  if (command.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    command.warnings.forEach((warning) => {
      lines.push(`  - ${warning}`);
    });
  }

  if (command.unsupportedSteps.length > 0) {
    lines.push('');
    lines.push('Deferred command steps:');
    command.unsupportedSteps.forEach((step) => {
      lines.push(`  - ${step}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  buildFfmpegCommand,
  renderFfmpegCommandPreview,
};
