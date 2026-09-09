/*
 * Media Optimizer In-Place Actions
 * Created by: Freohrskulblaka
 * Created on: 2026-09-09
 * Description: Runs safe source-file maintenance when the processing plan does not require FFmpeg.
 */

const { addMetadataMkvpropeditActions } = require('../domains/metadata/actions');
const {
  addSubtitleMkvpropeditActions,
  cleanupMatchedExternalSubtitleSidecars,
} = require('../domains/subtitles/actions');

function runInPlaceActions(context) {
  const shouldRunActions = context.plan?.isValid
    && !context.plan?.shouldProcess
    && !context.settings.dryRun;

  if (!shouldRunActions) {
    return;
  }

  cleanupMatchedExternalSubtitleSidecars(context);

  const canEditMkv = context.plan?.container?.targetContainer === 'mkv'
    && context.analysis?.file?.container === 'mkv';

  if (!canEditMkv) {
    return;
  }

  const editArgs = [];
  const metadataUpdates = addMetadataMkvpropeditActions(context, editArgs);
  const subtitleUpdates = addSubtitleMkvpropeditActions(context, editArgs);

  if (editArgs.length === 0) {
    return;
  }

  const filePath = context.file?._id || context.file?.file;

  if (!filePath) {
    context.log.warn('Unable to repair MKV metadata because the file path is missing.');
    return;
  }

  const proc = require('child_process');
  const args = [filePath, ...editArgs];

  try {
    const runner = context.otherArguments?.mediaOptimizerCommandRunner;

    if (typeof runner === 'function') {
      runner('mkvpropedit', args);
    } else {
      proc.execFileSync('mkvpropedit', args, {stdio: 'pipe'});
    }

    if (metadataUpdates.length > 0) {
      context.log.info('Repaired file metadata in place with mkvpropedit', metadataUpdates);
    }

    if (subtitleUpdates.length > 0) {
      context.log.info('Repaired subtitle metadata in place with mkvpropedit', subtitleUpdates);
    }
  } catch (error) {
    context.log.warn('Unable to repair MKV metadata in place with mkvpropedit', {
      error: error.message,
    });
  }
}

module.exports = {
  runInPlaceActions,
};
