/*
 * Media Optimizer FFmpeg Command Argument Helpers
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Shared helpers for rendering FFmpeg command arguments.
 */

function addStreamMetadata(args, streamType, outputIndex, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return;
    }

    args.push(`-metadata:s:${streamType}:${outputIndex}`, quoteArg(`${key}=${value}`));
  });
}

function addDisposition(args, streamType, outputIndex, dispositions) {
  const dispositionValue = Object.entries(dispositions)
    .map(([key, value]) => `${value ? '+' : '-'}${key}`)
    .join('');

  if (dispositionValue) {
    args.push(`-disposition:${streamType}:${outputIndex}`, dispositionValue);
  }
}

function quoteArg(value) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '\\"');

  return `"${escaped}"`;
}

module.exports = {
  addDisposition,
  addStreamMetadata,
  quoteArg,
};
