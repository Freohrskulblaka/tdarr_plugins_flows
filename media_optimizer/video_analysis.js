/*
 * Media Optimizer Video Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-01
 * Description: Builds normalized video stream facts for image classification, bitrate, frame rate, resolution, and HDR.
 * Updates:
 * - 2026-07-01 - Freohrskulblaka: Extracted video analysis from the main analysis orchestrator.
 */

const IMAGE_VIDEO_CODECS = ['mjpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/bmp', 'image/webp', 'image/tiff', 'image/x-ms-bmp'];

function analyzeVideoStreams(videoStreams, mediaInfoTracks, file) {
  const getUniqueValues = (items, getValue) => {
    const values = items.map(getValue);
    const uniqueValues = [...new Set(values)];

    return uniqueValues;
  };
  const mediaInfoVideoTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Video');
  const enrichedVideoStreams = videoStreams.map((stream, streamIndex) => {
    const mediaInfoVideoTrack = mediaInfoVideoTracks[streamIndex] || {};
    return enrichVideoStream(stream, streamIndex, mediaInfoVideoTrack, file);
  });
  const videoInfo = {
    items: enrichedVideoStreams,
    count: enrichedVideoStreams.length,
    playableCount: enrichedVideoStreams.filter((stream) => !stream.analysis.isImageStream).length,
    imageCount: enrichedVideoStreams.filter((stream) => stream.analysis.isImageStream).length,
    hasStreams: enrichedVideoStreams.length > 0,
    hasPlayableStreams: enrichedVideoStreams.some((stream) => !stream.analysis.isImageStream),
    hasImageStreams: enrichedVideoStreams.some((stream) => stream.analysis.isImageStream),
    hasMultipleStreams: enrichedVideoStreams.length > 1,
    hasTitles: enrichedVideoStreams.some((stream) => Boolean(stream?.tags?.title)),
    indices: enrichedVideoStreams.map((stream) => stream.index ?? -1),
    codecs: getUniqueValues(enrichedVideoStreams, (stream) => stream?.codec_name || 'unknown'),
  };

  return videoInfo;
}

function enrichVideoStream(stream, streamIndex, mediaInfoVideoTrack, file) {
  const resolveIsImageStream = () => {
    const codecName = String(stream.codec_name || '').toLowerCase();
    const codecLongName = String(stream.codec_long_name || '').toLowerCase();
    const mimeType = String(stream.tags?.MIMETYPE || stream.tags?.mimetype || '').toLowerCase();
    const attachedPicture = Number(stream.disposition?.attached_pic || 0) === 1;
    const stillImage = Number(stream.disposition?.still_image || 0) === 1;
    const codecIsImage = IMAGE_VIDEO_CODECS.includes(codecName) || IMAGE_VIDEO_CODECS.includes(mimeType);
    const longNameIsImage = /image|jpeg|png|gif|cover|thumbnail/.test(codecLongName);
    const streamIsImage = attachedPicture || stillImage || codecIsImage || longNameIsImage;

    return streamIsImage;
  };
  const width = Number(stream.width || mediaInfoVideoTrack?.Width || 0);
  const height = Number(stream.height || mediaInfoVideoTrack?.Height || 0);
  const bitRate = getVideoBitRate(stream, mediaInfoVideoTrack, file);
  const frameRate = getVideoFrameRate(stream, mediaInfoVideoTrack, file);
  const enrichedStream = Object.assign({}, stream, {
    analysis: {
      mediaInfo: mediaInfoVideoTrack,
      streamOrder: streamIndex,
      isImageStream: resolveIsImageStream(),
      width,
      height,
      bitRate,
      frameRate,
      resolution: analyzeVideoResolution(width, height, file),
      hdr: analyzeVideoHdr(stream),
    },
  });

  return enrichedStream;
}

function getVideoBitRate(stream, mediaInfoVideoTrack, file) {
  const estimateFileBitRate = () => {
    const durationSeconds = Number(mediaInfoVideoTrack?.Duration || file?.meta?.Duration || file?.duration || 0);
    const fileSizeBytes = Number(file?.file_size || file?.fileSize || 0);
    const hasEstimateInputs = durationSeconds > 0 && fileSizeBytes > 0;

    if (!hasEstimateInputs) {
      return 0;
    }

    const durationMinutes = durationSeconds * 0.0166667;
    const fileBitRateKbps = fileSizeBytes / (durationMinutes * 0.0075);

    return fileBitRateKbps;
  };
  const mediaInfoBitRate = Number(mediaInfoVideoTrack?.BitRate || 0);
  const mediaInfoNominalBitRate = Number(mediaInfoVideoTrack?.BitRate_Nominal || 0);
  const streamBitRate = Number(stream.bit_rate || 0);
  const fileEstimateBitRate = estimateFileBitRate();

  if (mediaInfoBitRate > 0) {
    return { value: mediaInfoBitRate, source: 'mediaInfoVideo', isEstimated: false };
  }

  if (mediaInfoNominalBitRate > 0) {
    return { value: mediaInfoNominalBitRate, source: 'mediaInfoNominal', isEstimated: false };
  }

  if (streamBitRate > 0) {
    return { value: streamBitRate, source: 'ffprobeStream', isEstimated: false };
  }

  return { value: fileEstimateBitRate, source: 'fileEstimate', isEstimated: true };
}

function getVideoFrameRate(stream, mediaInfoVideoTrack, file) {
  const parseStreamFrameRate = (value) => {
    const frameRateText = String(value || '');

    if (!frameRateText) {
      return 0;
    }

    if (frameRateText.includes('/')) {
      const parts = frameRateText.split('/');
      const numerator = Number(parts[0] || 0);
      const denominator = Number(parts[1] || 0);

      if (numerator > 0 && denominator > 0) {
        return numerator / denominator;
      }

      return 0;
    }

    return Number(frameRateText || 0);
  };
  const mediaInfoFrameRate = Number(mediaInfoVideoTrack?.FrameRate || 0);
  const streamFrameRate = parseStreamFrameRate(stream.avg_frame_rate || stream.r_frame_rate);
  const fileFrameRate = Number(file?.meta?.FrameRate || file?.video_frame_rate || 0);

  if (mediaInfoFrameRate > 0) {
    return { value: mediaInfoFrameRate, source: 'mediaInfoVideo' };
  }

  if (streamFrameRate > 0) {
    return { value: streamFrameRate, source: 'ffprobeStream' };
  }

  if (fileFrameRate > 0) {
    return { value: fileFrameRate, source: 'fileMetadata' };
  }

  return { value: 0, source: 'missing' };
}

function analyzeVideoResolution(width, height, file) {
  const is1080p = height >= 972 && height <= 1080 && width >= 1728 && width <= 1920;
  const is4k = height >= 2160 || file?.video_resolution === '4KUHD';
  const is720p = height >= 700 && height <= 720;
  const is480p = height > 0 && height <= 480;
  const isUnknown = width <= 0 || height <= 0;
  const isLowRes = (height < 972 || width < 1728) && !is1080p;
  const resolutionOptions = [
    { matches: is4k, label: '4KUHD' },
    { matches: is1080p, label: '1080p' },
    { matches: is720p, label: '720p' },
    { matches: is480p, label: '480p' },
    { matches: isUnknown, label: file?.video_resolution || 'unknown' },
    { matches: true, label: `${width}x${height}` },
  ];
  const selectedResolution = resolutionOptions.find((option) => option.matches);
  const resolution = {
    is1080p,
    is4k,
    is720p,
    is480p,
    isUnknown,
    isLowRes,
    label: selectedResolution.label,
  };

  return resolution;
}

function analyzeVideoHdr(stream) {
  const colorPrimaries = stream.color_primaries || '';
  const colorTransfer = stream.color_transfer || stream.color_trc || '';
  const colorSpace = stream.color_space || stream.colorspace || '';
  const isBt2020 = colorPrimaries === 'bt2020';
  const isPqHdr = colorTransfer === 'smpte2084';
  const isHdr = isBt2020 || (isBt2020 && isPqHdr && colorSpace === 'bt2020nc');
  const hdr = {
    isHdr,
    colorPrimaries,
    colorTransfer,
    colorSpace,
  };

  return hdr;
}

module.exports = {
  analyzeVideoStreams,
};
