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
  const globalTagKeys = getActionableGlobalTagKeys(context, metadata.globalTagKeys || []);
  const shouldStripGlobalTags = Boolean(settings.stripGlobalTags && globalTagKeys.length > 0);
  const shouldRemoveFileTitle = Boolean(settings.removeFileTitle && metadata.hasFileTitle);
  const videoTitleTracks = (metadata.videoTitleStreams || []).map((stream) => planVideoTitleTrack(stream, settings));
  const extraTagTracks = (metadata.extraTagStreams || []).map((stream) => planExtraTagTrack(stream, settings));
  const removedVideoTitleTracks = videoTitleTracks.filter((track) => track.action === 'removeTitle');
  const removedExtraTagTracks = extraTagTracks.filter((track) => track.action === 'remove');
  const reasons = collectMetadataReasons({
    shouldStripGlobalTags,
    shouldRemoveFileTitle,
    removedVideoTitleTracks,
    removedExtraTagTracks,
    settings,
  });

  return {
    stripGlobalTags: Boolean(settings.stripGlobalTags),
    removeFileTitle: Boolean(settings.removeFileTitle),
    removeVideoTitles: Boolean(settings.removeVideoTitles),
    removeExtraTagStreams: Boolean(settings.removeExtraTagStreams),
    writeCustomGlobalMetadata: Boolean(settings.writeCustomGlobalMetadata),
    globalTagKeys,
    fileTitle: metadata.fileTitle || '',
    videoTitleTracks,
    extraTagTracks,
    shouldProcess: shouldStripGlobalTags || shouldRemoveFileTitle || removedVideoTitleTracks.length > 0 || removedExtraTagTracks.length > 0,
    reasons,
  };
}

function getActionableGlobalTagKeys(context, globalTagKeys) {
  const filteredKeys = globalTagKeys.filter((key) => String(key || '').toLowerCase() !== 'encoder');

  return filteredKeys;
}

function planVideoTitleTrack(stream, settings) {
  const action = settings.removeVideoTitles ? 'removeTitle' : 'keep';
  const reasons = action === 'removeTitle'
    ? ['Video title metadata is removed by the selected metadata profile.']
    : ['Video title metadata is preserved by the selected metadata profile.'];

  return {
    sourceIndex: stream.sourceIndex,
    codecName: stream.codecName,
    title: stream.title,
    action,
    reasons,
  };
}

function planExtraTagTrack(stream, settings) {
  const action = settings.removeExtraTagStreams ? 'remove' : 'copy';
  const reasons = action === 'remove'
    ? ['Extra tag/data stream is removed by the selected metadata profile.']
    : ['Extra tag/data stream is preserved by the selected metadata profile.'];

  return {
    sourceIndex: stream.sourceIndex,
    codecType: stream.codecType,
    codecName: stream.codecName,
    title: stream.title,
    tagKeys: stream.tagKeys,
    action,
    reasons,
  };
}

function collectMetadataReasons({ shouldStripGlobalTags, shouldRemoveFileTitle, removedVideoTitleTracks, removedExtraTagTracks, settings }) {
  const reasons = [];

  if (shouldStripGlobalTags) {
    reasons.push('Global tags will be stripped by the selected metadata profile.');
  }

  if (shouldRemoveFileTitle) {
    reasons.push('File title metadata will be removed by the selected metadata profile.');
  }

  if (removedVideoTitleTracks.length > 0) {
    reasons.push('Video stream title metadata will be removed by the selected metadata profile.');
  }

  if (removedExtraTagTracks.length > 0) {
    reasons.push('Extra tag/data streams will be removed by the selected metadata profile.');
  }

  return reasons;
}

module.exports = {
  planMetadata,
};
