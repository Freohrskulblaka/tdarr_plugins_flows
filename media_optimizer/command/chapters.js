/*
 * Media Optimizer FFmpeg Chapter Command Renderer
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Renders kept chapters and generated chapter metadata inputs into FFmpeg arguments.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { quoteArg } = require('./args');

function addGeneratedChapterInput(context, chapterPlan, inputArgs, inputIndex) {
  if (chapterPlan?.action !== 'add') {
    return {
      chapterInput: null,
      nextInputIndex: inputIndex,
    };
  }

  const chapterFile = createChapterMetadataFile(context, chapterPlan);

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

function createChapterMetadataFile(context, chapterPlan) {
  const cacheDir = context.librarySettings?.cache;

  if (!cacheDir) {
    return {
      error: 'Generated chapter marker file requires librarySettings.cache.',
    };
  }

  const durationSeconds = Math.floor(Number(chapterPlan.durationSeconds || 0));
  const generatedCount = Math.floor(Number(chapterPlan.generatedCount || 0));
  const intervalSeconds = Math.floor(Number(chapterPlan.intervalSeconds || 300));

  if (durationSeconds <= 1 || generatedCount <= 0) {
    return {
      error: 'Generated chapter marker file requires a positive duration and chapter count.',
    };
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const fileIdentity = context.file?._id || context.file?.file || context.file?.meta?.SourceFile || 'media_optimizer_file';
  const fileHash = crypto.createHash('md5').update(String(fileIdentity)).digest('hex');
  const chapterPath = path.join(cacheDir, `${fileHash}.ffmetadata`);
  const markers = buildChapterMarkers(durationSeconds, generatedCount, intervalSeconds);
  const metadata = renderChapterMetadata(markers, durationSeconds);

  fs.writeFileSync(chapterPath, metadata);

  return {
    path: chapterPath,
    count: markers.length,
  };
}

function buildChapterMarkers(durationSeconds, generatedCount, intervalSeconds) {
  const markers = [];
  const intervalMarkerCount = Math.ceil(durationSeconds / intervalSeconds) + 1;

  if (generatedCount >= intervalMarkerCount) {
    for (let second = 0; second < durationSeconds; second += intervalSeconds) {
      markers.push(second);
    }
  } else if (generatedCount === 1) {
    markers.push(0);
  } else {
    for (let index = 0; index < generatedCount - 1; index += 1) {
      markers.push(Math.floor(((durationSeconds - 1) * index) / (generatedCount - 1)));
    }
  }

  const finalMarker = Math.max(0, durationSeconds - 1);

  if (markers[markers.length - 1] !== finalMarker) {
    markers.push(finalMarker);
  }

  return markers.slice(0, generatedCount);
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
    lines.push(`title=CHAPTER ${chapterNum}`);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  addChapterArgs,
  addGeneratedChapterInput,
};
