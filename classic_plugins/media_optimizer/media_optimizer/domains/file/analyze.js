/*
 * Media Optimizer File Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized file/container facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted file source facts from the analysis coordinator.
 */

function analyzeFileInfo(file) {
  const filePath = file?.file || file?._id || file?.meta?.SourceFile || '';
  const pathSeparatorIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const pathFileName = pathSeparatorIndex >= 0 ? filePath.slice(pathSeparatorIndex + 1) : filePath;
  const fileName = file?.meta?.FileName || pathFileName;
  const nameNoExtension = file?.fileNameWithoutExtension || fileName.replace(/\.[^/.]+$/, '');
  const container = String(file?.container || file?.meta?.FileTypeExtension || fileName.match(/\.([^./\\]+)$/)?.[1] || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const durationSeconds = [
    file?.mediaInfo?.format?.duration,
    file?.mediaInfo?.format?.Duration,
    file?.ffProbeData?.format?.duration,
    file?.meta?.Duration,
    file?.duration,
  ]
    .map(Number)
    .find((duration) => Number.isFinite(duration) && duration > 0) || 0;
  const isTdarrCacheOutput = [file?._id, file?.file, file?.meta?.SourceFile, fileName]
    .some((value) => /TdarrCacheFile/i.test(String(value || '')));
  const hasInvalidStreamDurations = (file?.ffProbeData?.streams || []).some((stream) => {
    const streamDuration = Number(stream?.duration);

    return !Number.isFinite(streamDuration) || streamDuration <= 0;
  });

  const fileInfo = {
    id: file?._id || filePath,
    directory: file?.meta?.Directory || (pathSeparatorIndex >= 0 ? filePath.slice(0, pathSeparatorIndex) : ''),
    container,
    medium: String(file?.fileMedium || '').toLowerCase(),
    nameNoExtension,
    extension: container ? `.${container}` : '',
    type: file?.meta?.FileType || '',
    durationSeconds,
    isTdarrCacheOutput,
    hasInvalidStreamDurations,
  };

  return fileInfo;
}

module.exports = {
  analyzeFileInfo,
};
