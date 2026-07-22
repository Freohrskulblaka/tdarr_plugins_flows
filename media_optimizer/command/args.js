/*
 * Media Optimizer FFmpeg Command Argument Helpers
 * Created by: Freohrskulblaka
 * Created on: 2026-07-21
 * Description: Shared helpers for rendering FFmpeg command arguments.
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
  const dispositionValues = [];

  Object.keys(dispositions).forEach((key) => {
    const value = dispositions[key];
    dispositionValues.push(`${value ? '+' : '-'}${key}`);
  });

  if (dispositionValues.length > 0) {
    args.push(`-disposition:${streamType}:${outputIndex}`, dispositionValues.join(''));
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
