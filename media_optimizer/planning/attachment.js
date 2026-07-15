/*
 * Media Optimizer Attachment Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds attachment copy/removal decisions from normalized attachment analysis facts.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted attachment planning from the planning coordinator.
 */

function planAttachments(context) {
  const attachmentStreams = context.analysis.streams.attachment.items;
  const tracks = attachmentStreams.map((stream) => {
    const fileName = stream.tags?.filename || '';
    const mimeType = stream.tags?.mimetype || stream.codec_name || '';
    const isFont = isFontAttachment(fileName, mimeType);
    const shouldKeep = context.settings.metadata.keepFontAttachments && isFont;
    const action = shouldKeep || !context.settings.metadata.removeNonFontAttachments ? 'copy' : 'remove';
    const reasons = [];

    if (action === 'remove') {
      reasons.push('Attachment is not a font attachment and remove-non-font-attachments is enabled.');
    }

    return {
      sourceIndex: stream.index,
      fileName,
      mimeType,
      isFont,
      action,
      reasons,
    };
  });
  
  const removedTracks = tracks.filter((track) => track.action === 'remove');
  const reasons = [];

  tracks.forEach((track) => {
    reasons.push(...track.reasons);
  });

  return {
    tracks,
    removedTracks,
    shouldProcess: removedTracks.length > 0,
    reasons,
  };
}

function isFontAttachment(fileName, mimeType) {
  const value = `${fileName} ${mimeType}`.toLowerCase();
  const isFont = /font|\.ttf|\.otf|\.woff|\.woff2/.test(value);

  return isFont;
}

module.exports = {
  planAttachments,
};
