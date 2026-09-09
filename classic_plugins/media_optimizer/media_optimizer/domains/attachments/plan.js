/*
 * Media Optimizer Attachment Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-13
 * Description: Builds attachment copy/removal decisions from normalized attachment analysis facts.
 * Updates:
 * - 2026-07-13 - Freohrskulblaka: Extracted attachment planning from the planning coordinator.
 * - 2026-07-15 - Freohrskulblaka: Planned attachments from normalized attachment facts and added attachment counts.
 */

function planAttachments(context) {
  const attachmentItems = context.analysis.streams.attachment.items;
  const tracks = attachmentItems.map((attachment) => ({
    sourceIndex: attachment.sourceIndex,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    codecName: attachment.codecName,
    extension: attachment.extension,
    attachmentType: attachment.attachmentType,
    isFont: attachment.isFont,
    isImage: attachment.isImage,
    action: attachment.isFont ? 'copy' : 'remove',
  }));
  const removedTracks = tracks.filter((track) => track.action === 'remove');
  const copiedTracks = tracks.filter((track) => track.action === 'copy');
  const reasons = removedTracks.length > 0
    ? ['Non-font attachments will be removed; subtitle font attachments will be preserved.']
    : [];

  return {
    tracks,
    removedTracks,
    copiedTracks,
    keptCount: copiedTracks.length,
    removedCount: removedTracks.length,
    fontCount: tracks.filter((track) => track.isFont).length,
    nonFontCount: tracks.filter((track) => !track.isFont).length,
    shouldProcess: removedTracks.length > 0,
    reasons,
  };
}

module.exports = {
  planAttachments,
};
