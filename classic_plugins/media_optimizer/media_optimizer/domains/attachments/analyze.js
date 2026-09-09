/*
 * Media Optimizer Attachment Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds normalized attachment stream facts for the media optimizer workflow.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka:
 *   - Extracted attachment source facts from the analysis coordinator.
 *   - Reused shared analysis utility helpers.
 * - 2026-07-15 - Freohrskulblaka: Normalized attachment filenames, MIME types, extensions, and type classification.
 */

const { getUniqueValues } = require('../../utils/analysis');

const FONT_EXTENSIONS = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

const FONT_MIME_TYPES = [
  'font/ttf',
  'font/otf',
  'font/collection',
  'font/woff',
  'font/woff2',
  'application/x-truetype-font',
  'application/vnd.ms-opentype',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/x-font-opentype',
];

function analyzeAttachmentStreams(attachmentStreams) {
  const items = attachmentStreams.map(normalizeAttachmentStream);

  const attachmentInfo = {
    items,
    count: items.length,
    hasAttachments: items.length > 0,
    fontCount: items.filter((item) => item.isFont).length,
    nonFontCount: items.filter((item) => !item.isFont).length,
    imageCount: items.filter((item) => item.isImage).length,
    mimeTypes: getUniqueValues(items, (item) => item.mimeType || item.codecName || 'unknown'),
  };

  return attachmentInfo;
}

function normalizeAttachmentStream(stream) {
  const fileName = getTagValue(stream, ['filename', 'FILENAME']) || '';
  const mimeType = normalizeValue(getTagValue(stream, ['mimetype', 'MIMETYPE', 'mime_type', 'MIME_TYPE']));
  const codecName = normalizeValue(stream?.codec_name);
  const extension = getFileExtension(fileName);
  const isFont = isFontAttachment(extension, mimeType);
  const isImage = isImageAttachment(extension, mimeType, codecName);
  const attachmentType = getAttachmentType({ isFont, isImage });

  return {
    sourceIndex: stream?.index,
    fileName,
    mimeType,
    codecName,
    extension,
    attachmentType,
    isFont,
    isImage,
  };
}

function getTagValue(stream, tagNames) {
  const tags = stream?.tags || {};

  for (const tagName of tagNames) {
    if (tags[tagName] !== undefined && tags[tagName] !== null) {
      return tags[tagName];
    }
  }

  return '';
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getFileExtension(fileName) {
  const match = String(fileName || '').trim().toLowerCase().match(/(\.[^.\\/\s]+)$/);

  return match ? match[1] : '';
}

function isFontAttachment(extension, mimeType) {
  if (FONT_EXTENSIONS.includes(extension)) {
    return true;
  }

  if (FONT_MIME_TYPES.includes(mimeType)) {
    return true;
  }

  return mimeType.startsWith('font/');
}

function isImageAttachment(extension, mimeType, codecName) {
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return true;
  }

  if (mimeType.startsWith('image/')) {
    return true;
  }

  return ['mjpeg', 'png', 'gif', 'webp', 'bmp'].includes(codecName);
}

function getAttachmentType({ isFont, isImage }) {
  if (isFont) {
    return 'font';
  }

  if (isImage) {
    return 'image';
  }

  return 'other';
}

module.exports = {
  analyzeAttachmentStreams,
};
