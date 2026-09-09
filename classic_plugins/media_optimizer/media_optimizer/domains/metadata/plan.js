/*
 * Media Optimizer Metadata Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-15
 * Description: Builds metadata cleanup decisions for global tags, file/video titles, and extra tag/data streams.
 * Updates:
 * - 2026-07-15 - Freohrskulblaka: Added focused metadata cleanup planning from normalized metadata facts.
 * - 2026-08-04 - Freohrskulblaka: Ignored unavoidable FFmpeg encoder-only tags on Tdarr cache outputs.
 * - 2026-08-04 - Freohrskulblaka: Ignored unavoidable FFmpeg encoder tags for all cleanup planning.
 */

function planMetadata(context) {
  const metadata = context.analysis.metadata || {};
  const settings = context.settings.metadata || {};
  const globalTagKeys = (metadata.globalTagKeys || []).filter((key) => String(key || '').toLowerCase() !== 'encoder');
  const stripGlobalTags = Boolean(settings.stripGlobalTags && globalTagKeys.length > 0);
  const removeFileTitle = Boolean(settings.removeFileTitle && metadata.hasFileTitle);
  const videoTitleTracks = (metadata.videoTitleStreams || []).map((stream) => ({
    ...stream,
    action: settings.removeVideoTitles ? 'removeTitle' : 'keep',
  }));
  const extraTagTracks = (metadata.extraTagStreams || []).map((stream) => ({
    ...stream,
    action: settings.removeExtraTagStreams ? 'remove' : 'copy',
  }));
  const removedVideoTitleTracks = videoTitleTracks.filter((track) => track.action === 'removeTitle');
  const removedExtraTagTracks = extraTagTracks.filter((track) => track.action === 'remove');
  const reasons = [
    stripGlobalTags ? 'Global tags will be stripped by the selected metadata profile.' : '',
    removeFileTitle ? 'File title metadata will be removed by the selected metadata profile.' : '',
    removedVideoTitleTracks.length > 0 ? 'Video stream title metadata will be removed by the selected metadata profile.' : '',
    removedExtraTagTracks.length > 0 ? 'Extra tag/data streams will be removed by the selected metadata profile.' : '',
  ].filter(Boolean);

  return {
    stripGlobalTags,
    removeFileTitle,
    removeVideoTitles: removedVideoTitleTracks.length > 0,
    removeExtraTagStreams: removedExtraTagTracks.length > 0,
    globalTagKeys,
    fileTitle: metadata.fileTitle || '',
    videoTitleTracks,
    extraTagTracks,
    shouldProcess: removedExtraTagTracks.length > 0,
    reasons,
  };
}

module.exports = {
  planMetadata,
};
