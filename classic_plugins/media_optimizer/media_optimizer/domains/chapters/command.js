/*
 * Media Optimizer FFmpeg Chapter Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders kept chapters and generated chapter metadata inputs into FFmpeg arguments.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { quoteArg } = require('../../utils/command_args');

function addGeneratedChapterInput(context, chapterPlan, inputArgs, inputIndex, materialize) {
  if (chapterPlan?.action !== 'add') {
    return {
      chapterInput: null,
      nextInputIndex: inputIndex,
    };
  }

  const chapterFile = prepareChapterMetadataFile(context, chapterPlan, materialize);

  if (!chapterFile.path) {
    return {
      chapterInput: chapterFile,
      nextInputIndex: inputIndex,
    };
  }

  inputArgs.push('-f', 'ffmetadata');
  inputArgs.push('-i', quoteArg(chapterFile.path));

  return {
    chapterInput: {
      inputIndex,
      path: chapterFile.path,
      count: chapterFile.count,
    },
    nextInputIndex: inputIndex + 1,
  };
}

function addChapterArgs(args, chapterPlan, chapterInput, unsupportedSteps) {
  if (!chapterPlan) {
    return;
  }

  if (chapterPlan.action === 'keep') {
    args.push('-map_chapters', '0');
    return;
  }

  if (chapterPlan.action === 'add') {
    if (!chapterInput?.path) {
      args.push('-map_chapters', '-1');
      unsupportedSteps.push(chapterInput?.error || 'Generated chapter marker file could not be rendered.');
      return;
    }

    args.push('-map_chapters', String(chapterInput.inputIndex));
    return;
  }

  args.push('-map_chapters', '-1');
}

function prepareChapterMetadataFile(context, chapterPlan, materialize) {
  const cacheDir = resolveChapterMetadataDirectory(context);

  if (!cacheDir) {
    return {
      error: 'Generated chapter marker file requires a writable Tdarr cache or work directory.',
    };
  }

  const durationSeconds = Math.floor(Number(chapterPlan.durationSeconds || 0));
  const markers = Array.isArray(chapterPlan.markers)
    ? chapterPlan.markers
      .map(Number)
      .filter((marker) => Number.isFinite(marker) && marker >= 0 && marker < durationSeconds)
    : [];

  if (durationSeconds <= 0 || markers.length === 0) {
    return {
      error: 'Generated chapter marker file requires a positive duration and planned chapter markers.',
    };
  }

  const fileIdentity = context.file?._id || context.file?.file || context.file?.meta?.SourceFile || 'media_optimizer_file';
  const fileHash = crypto.createHash('md5').update(String(fileIdentity)).digest('hex');
  const chapterPath = path.join(cacheDir, `${fileHash}.ffmetadata`);

  if (materialize) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(chapterPath, renderChapterMetadata(markers, durationSeconds));
    } catch (error) {
      return {
        error: `Generated chapter marker file could not be written: ${error.message}`,
      };
    }
  }

  return {
    path: chapterPath,
    count: markers.length,
  };
}

function resolveChapterMetadataDirectory(context) {
  const sourceDirectory = context.file?.meta?.Directory || path.dirname(context.file?._id || context.file?.file || '');

  if (isTdarrWorkDirectory(sourceDirectory)) {
    return sourceDirectory;
  }

  const processDirectory = process.cwd();

  if (isTdarrWorkDirectory(processDirectory)) {
    return processDirectory;
  }

  const cacheRoot = context.librarySettings?.cache;

  if (!cacheRoot) {
    return '';
  }

  return cacheRoot;
}

function isTdarrWorkDirectory(directoryPath) {
  return /(?:^|[\\/])tdarr-workDir/i.test(String(directoryPath || ''));
}

function renderChapterMetadata(markers, durationSeconds) {
  const lines = [';FFMETADATA1', ''];

  markers.forEach((startSecond, index) => {
    const nextStartSecond = markers[index + 1];
    const endSecond = nextStartSecond !== undefined ? nextStartSecond : durationSeconds;
    const chapterNum = String(index + 1).padStart(2, '0');

    lines.push('[CHAPTER]');
    lines.push('TIMEBASE=1/1000');
    lines.push(`START=${Math.max(0, startSecond * 1000)}`);
    lines.push(`END=${Math.max(startSecond + 1, endSecond) * 1000}`);
    lines.push(`title=Chapter ${chapterNum}`);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  addChapterArgs,
  addGeneratedChapterInput,
};
