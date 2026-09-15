/*
 * Media Optimizer Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Builds the normalized file, media, stream, chapter, metadata, and original-language inventory used by the media optimizer workflow.
 */

const { analyzeAttachmentStreams } = require('../domains/attachments/analyze');
const { analyzeVideoStreams } = require('../domains/video/analyze');
const { analyzeAudioStreams } = require('../domains/audio/analyze');
const { analyzeChapters } = require('../domains/chapters/analyze');
const { analyzeFileInfo } = require('../domains/file/analyze');
const { analyzeMediaIdentity } = require('../domains/media/analyze');
const { analyzeMetadata } = require('../domains/metadata/analyze');
const { analyzeSubtitles } = require('../domains/subtitles/analyze');

function analyzeFile(context) {
  const streams = context.file?.ffProbeData?.streams || [];
  const mediaInfoTracks = context.file?.mediaInfo?.track || [];
  const ffProbeChapters = context.file?.ffProbeData?.chapters || [];
  const fileInfo = analyzeFileInfo(context.file);
  const subtitleInfo = analyzeSubtitles(streams, mediaInfoTracks, fileInfo);
  const streamInfo = {
    all: streams,
    video: analyzeVideoStreams(
      streams.filter((stream) => stream.codec_type === 'video'),
      mediaInfoTracks,
      context.file,
      fileInfo.durationSeconds,
    ),
    audio: analyzeAudioStreams(
      streams.filter((stream) => stream.codec_type === 'audio'),
      mediaInfoTracks,
    ),
    subtitle: subtitleInfo.embedded,
    attachment: analyzeAttachmentStreams(
      streams.filter((stream) => stream.codec_type === 'attachment'),
    ),
  };
  const chapterInfo = analyzeChapters(mediaInfoTracks, ffProbeChapters, context.file);
  const mediaIdentity = analyzeMediaIdentity(fileInfo.nameNoExtension);
  const metadataInfo = analyzeMetadata(streams, context.file?.ffProbeData?.format?.tags || {});
  const summary = createAnalysisSummary(fileInfo, streamInfo, chapterInfo, metadataInfo, subtitleInfo.external);

  const analysis = {
    file: fileInfo,
    media: mediaIdentity,
    streams: streamInfo,
    summary,
    chapters: chapterInfo,
    externalSubtitles: subtitleInfo.external,
    metadata: metadataInfo,
    originalLanguage: null,
  };

  return analysis;
}

function createAnalysisSummary(fileInfo, streamInfo, chapterInfo, metadataInfo, externalSubtitles) {
  const summary = {
    isVideoFile: fileInfo.medium === 'video',
    isNotVideoFile: fileInfo.medium !== 'video',
    hasInvalidStreamDurations: fileInfo.hasInvalidStreamDurations,
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

module.exports = {
  analyzeFile,
};
