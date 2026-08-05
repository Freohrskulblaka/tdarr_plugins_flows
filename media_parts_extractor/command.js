/*
 * Media Parts Extractor Command Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-22
 * Description: Renders and optionally executes FFmpeg stream-copy extraction commands for audio and subtitle sidecars.
 */

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

function buildExtractionCommands(context) {
  const sourcePath = getSourcePath(context.file);
  const commands = [];

  context.plan.audio.items.forEach((item) => {
    commands.push(createStreamCopyCommand(context, sourcePath, item, 'audio'));
  });

  context.plan.subtitles.items.forEach((item) => {
    commands.push(createStreamCopyCommand(context, sourcePath, item, 'subtitle'));
  });

  return {
    sourcePath,
    commands,
    isExecutable: Boolean(sourcePath) && commands.every((command) => command.isExecutable),
  };
}

function executeExtractionCommands(context) {
  const commandPlan = context.plan.command;
  const results = [];

  commandPlan.commands.forEach((command) => {
    if (!command.isExecutable) {
      results.push({
        status: 'skipped',
        outputPath: command.outputPath,
        reason: command.reason,
      });
      return;
    }

    if (fs.existsSync(command.outputPath) && !context.settings.overwriteExisting) {
      results.push({
        status: 'skipped',
        outputPath: command.outputPath,
        reason: 'Output already exists and overwriteExisting is false.',
      });
      return;
    }

    fs.mkdirSync(path.dirname(command.outputPath), { recursive: true });
    childProcess.execFileSync(context.settings.ffmpegPath, command.args, { stdio: 'pipe' });
    results.push({
      status: 'extracted',
      outputPath: command.outputPath,
    });
  });

  return results;
}

function createStreamCopyCommand(context, sourcePath, item, kind) {
  if (!sourcePath) {
    return {
      kind,
      sourceIndex: item.sourceIndex,
      outputPath: item.outputPath,
      args: [],
      preview: '',
      isExecutable: false,
      reason: 'Source path could not be resolved from Tdarr file details.',
    };
  }

  const args = [
    context.settings.overwriteExisting ? '-y' : '-n',
    '-i',
    sourcePath,
    '-map',
    `0:${item.sourceIndex}`,
    '-c',
    'copy',
    item.outputPath,
  ];

  return {
    kind,
    sourceIndex: item.sourceIndex,
    outputPath: item.outputPath,
    args,
    preview: renderCommand(context.settings.ffmpegPath, args),
    isExecutable: true,
  };
}

function renderCommand(executable, args) {
  return [executable, ...args].map(quoteArg).join(' ');
}

function quoteArg(value) {
  const text = String(value);

  if (!/[\s"]/g.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function getSourcePath(file) {
  if (file?.file) {
    return file.file;
  }

  if (file?._id && /[\\/]/.test(file._id)) {
    return file._id;
  }

  if (file?.meta?.SourceFile) {
    return file.meta.SourceFile;
  }

  if (file?.meta?.Directory && file?.meta?.FileName) {
    return path.join(file.meta.Directory, file.meta.FileName);
  }

  return '';
}

module.exports = {
  buildExtractionCommands,
  executeExtractionCommands,
  getSourcePath,
  renderCommand,
};
