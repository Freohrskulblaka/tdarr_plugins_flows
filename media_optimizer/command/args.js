/*
 * Media Optimizer FFmpeg Command Argument Helpers
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Shared helpers for rendering FFmpeg command arguments.
 * Updates:
 * - 2026-08-04 - Freohrskulblaka: Combine disposition flag changes into one FFmpeg operation per stream.
 */

function addStreamMetadata(args, streamType, outputIndex, values) {
  Object.keys(values).forEach((key) => {
    const value = values[key];

    if (value === undefined || value === null || String(value).trim() === '') {
      return;
    }

    args.push(`-metadata:s:${streamType}:${outputIndex}`, quoteArg(`${key}=${value}`));
  });
}

function addDisposition(args, streamType, outputIndex, dispositions) {
  const dispositionValue = Object.keys(dispositions)
    .map((key) => {
      const value = dispositions[key];
      return `${value ? '+' : '-'}${key}`;
    })
    .join('');

  if (dispositionValue) {
    args.push(`-disposition:${streamType}:${outputIndex}`, dispositionValue);
  }
}

function findOutputIndex(tracks, sourceIndex) {
  const outputTracks = (tracks || []).filter((track) => track.action !== 'remove');
  const track = outputTracks.find((candidate) => candidate.sourceIndex === sourceIndex);

  return track ? track.outputIndex : null;
}

function quoteArg(value) {
  const text = String(value || '');
  const escaped = text.replace(/"/g, '\\"');

  return `"${escaped}"`;
}

module.exports = {
  addDisposition,
  addStreamMetadata,
  findOutputIndex,
  quoteArg,
};
