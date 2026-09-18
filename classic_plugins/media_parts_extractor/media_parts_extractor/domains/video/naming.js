/*
 * Media Parts Extractor Video Naming Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Builds standalone MKV donor video filenames.
 */

const path = require('path');
const { getOutputDirectory, formatNameParts } = require('../../utils/naming');

function buildVideoOutputPath(context, stream) {
  const video = stream.analysis || {};
  const parts = [
    context.analysis.file.nameNoExtension,
    'video',
    String(stream.index),
    video.resolution?.label || '',
    video.hdr?.type && video.hdr.type !== 'sdr' ? video.hdr.type : '',
    stream.codec_name || 'unknown',
  ];

  return path.join(getOutputDirectory(context), `${formatNameParts(parts)}.mkv`);
}

module.exports = { buildVideoOutputPath };
