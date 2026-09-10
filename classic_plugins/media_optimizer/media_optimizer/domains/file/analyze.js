/*
 * Media Optimizer File Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized file/container facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted file source facts from the analysis coordinator.
 */

function analyzeFileInfo(file, settings) {
  const fileName = file?.meta?.FileName || '';
  const nameNoExtension = file?.fileNameWithoutExtension || fileName.replace(/\.[^/.]+$/, '');
  const container = file?.container || '';
  const targetContainer = settings.output.container;
  const fileExtension = file?.meta?.FileTypeExtension || container;
  const durationSeconds = [
    file?.mediaInfo?.format?.duration,
    file?.mediaInfo?.format?.Duration,
    file?.meta?.Duration,
    file?.duration,
  ]
    .map(Number)
    .find((duration) => Number.isFinite(duration) && duration > 0) || 0;
  const isTdarrCacheOutput = [file?._id, file?.file]
    .some((value) => String(value || '').includes('TdarrCacheFile'));

  const fileInfo = {
    id: file?._id || '',
    directory: file?.meta?.Directory || '',
    container,
    medium: file?.fileMedium || '',
    nameNoExtension,
    extension: fileExtension ? `.${fileExtension}` : '',
    type: file?.meta?.FileType || '',
    targetContainer,
    durationSeconds,
    isTdarrCacheOutput,
    needsRemux: Boolean(container && container !== targetContainer),
    useGenpts: hasInvalidStreamDuration(file?.ffProbeData?.streams || []),
  };

  return fileInfo;
}

function hasInvalidStreamDuration(streams) {
  const hasInvalidDuration = streams.some((stream) => {
    const duration = stream?.duration;
    const durationIsMissing = !duration;
    const durationIsNotAvailable = duration === 'N/A';

    return durationIsMissing || durationIsNotAvailable;
  });

  return hasInvalidDuration;
}

module.exports = {
  analyzeFileInfo,
};
