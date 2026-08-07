/*
 * Media Optimizer Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Builds the normalized file, media, stream, chapter, metadata, and original-language inventory used by the media optimizer workflow.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created analysis helpers for media optimizer classic plugin and future flow components.
 * - 2026-07-01 - Freohrskulblaka: Added normalized video stream facts for image classification, bitrate, frame rate, resolution, and HDR.
 * - 2026-07-01 - Freohrskulblaka: Moved video-specific stream enrichment into the video analysis library.
 * - 2026-07-13 - Freohrskulblaka: Extracted file, attachment, chapter, and media identity source facts into focused analysis modules.
 * - 2026-07-15 - Freohrskulblaka: Moved metadata source facts into a focused analysis module.
 * - 2026-08-04 - Freohrskulblaka: Passed FFprobe chapter data into chapter analysis for Tdarr cache-output detection.
 * - 2026-08-04 - Freohrskulblaka: Passed file context into chapter analysis for direct chapter probing.
 */

const { analyzeAttachmentStreams } = require('../domains/attachments/analyze');
const { analyzeVideoStreams } = require('../domains/video/analyze');
const { analyzeAudioStreams } = require('../domains/audio/analyze');
const { analyzeChapters } = require('../domains/chapters/analyze');
const { analyzeFileInfo } = require('../domains/file/analyze');
const { analyzeMediaInfo } = require('../domains/media_info/analyze');
const { analyzeMetadata } = require('../domains/metadata/analyze');
const { analyzeSubtitles } = require('../domains/subtitles/analyze');

function analyzeFile(context) {
  const streams = context.file?.ffProbeData?.streams || [];
  const mediaInfoTracks = context.file?.mediaInfo?.track || [];
  const ffProbeChapters = context.file?.ffProbeData?.chapters || [];
  const fileInfo = analyzeFileInfo(context.file, context.settings);
  const subtitleInfo = analyzeSubtitles(streams, mediaInfoTracks, fileInfo);
  const streamInfo = analyzeStreams(streams, mediaInfoTracks, context.file, subtitleInfo.embedded);
  const chapterInfo = analyzeChapters(mediaInfoTracks, ffProbeChapters, context.file, context);
  const mediaInfo = analyzeMediaInfo(fileInfo.nameNoExtension, mediaInfoTracks);
  const metadataInfo = analyzeMetadata(streams, context.file?.ffProbeData?.format?.tags || {});
  const summary = createAnalysisSummary(fileInfo, streamInfo, chapterInfo, metadataInfo, subtitleInfo.external);

  const analysis = {
    file: fileInfo,
    media: mediaInfo,
    streams: streamInfo,
    summary,
    chapters: chapterInfo.chapters,
    externalSubtitles: subtitleInfo.external,
    metadata: metadataInfo,
    globalTags: metadataInfo.globalTags,
    originalLanguage: null,
    videoSettings: context.settings.video,
  };

  return analysis;
}

function analyzeStreams(streams, mediaInfoTracks, file, subtitleInfo) {
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const attachmentStreams = streams.filter((stream) => stream.codec_type === 'attachment');

  const streamInfo = {
    all: streams,
    video: analyzeVideoStreams(videoStreams, mediaInfoTracks, file),
    audio: analyzeAudioStreams(audioStreams, mediaInfoTracks),
    subtitle: subtitleInfo,
    attachment: analyzeAttachmentStreams(attachmentStreams),
  };

  return streamInfo;
}

function createAnalysisSummary(fileInfo, streamInfo, chapterInfo, metadataInfo, externalSubtitles) {
  const summary = {
    isVideoFile: fileInfo.medium === 'video',
    isNotVideoFile: fileInfo.medium !== 'video',
    needsRemux: fileInfo.needsRemux,
    useGenpts: fileInfo.useGenpts,
    hasVideo: streamInfo.video.hasStreams,
    hasAudio: streamInfo.audio.hasStreams,
    hasSubtitles: streamInfo.subtitle.hasStreams,
    hasAttachments: streamInfo.attachment.hasAttachments,
    hasChapters: chapterInfo.hasChapters,
    hasMultipleVideoStreams: streamInfo.video.hasMultipleStreams,
    hasMultipleAudioStreams: streamInfo.audio.hasMultipleStreams,
    hasMultipleAudioLanguages: streamInfo.audio.hasMultipleLanguages,
    hasUntaggedAudioStreams: streamInfo.audio.hasUntaggedStreams,
    hasMultipleSubtitleStreams: streamInfo.subtitle.hasMultipleStreams,
    hasMultipleSubtitleLanguages: streamInfo.subtitle.hasMultipleLanguages,
    hasPictureSubtitles: streamInfo.subtitle.hasPictureSubtitles,
    videoStreamCount: streamInfo.video.count,
    audioStreamCount: streamInfo.audio.count,
    subtitleStreamCount: streamInfo.subtitle.count,
    externalSubtitleCount: externalSubtitles.count,
    attachmentCount: streamInfo.attachment.count,
    chapterCount: chapterInfo.count,
    extraTagStreamCount: metadataInfo.extraTagStreamCount,
    videoTitleCount: metadataInfo.videoTitleCount,
    audioLanguages: streamInfo.audio.languages,
    audioChannels: streamInfo.audio.channels,
    audioCodecs: streamInfo.audio.codecs,
    subtitleLanguages: streamInfo.subtitle.languages,
    subtitleCodecs: streamInfo.subtitle.codecs,
    globalTagKeys: metadataInfo.globalTagKeys,
    hasFileTitle: metadataInfo.hasFileTitle,
    hasExtraTagStreams: metadataInfo.hasExtraTagStreams,
  };

  return summary;
}

function summarizeAnalysis(analysis) {
  const summary = {
    file: analysis.file,
    media: {
      type: analysis.media.type,
      name: analysis.media.name,
      year: analysis.media.year,
      season: analysis.media.season,
      episode: analysis.media.episode,
      absoluteEpisode: analysis.media.absoluteEpisode,
      resolution: analysis.media.resolution,
      imdbId: analysis.media.imdbId,
      tvdbId: analysis.media.tvdbId,
    },
    container: analysis.file.container,
    fileMedium: analysis.file.medium,
    videoCodec: analysis.streams.video.codecs[0] || '',
    videoResolution: analysis.media.resolution,
    videoSettings: analysis.videoSettings,
    streamSummary: analysis.summary,
    originalLanguage: analysis.originalLanguage,
  };

  return summary;
}

module.exports = {
  analyzeFile,
  summarizeAnalysis,
};
