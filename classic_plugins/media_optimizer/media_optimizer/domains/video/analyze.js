/*
 * Media Optimizer Video Analysis Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-01
 * Description: Builds normalized video stream facts for image classification, bitrate, frame rate, resolution, and HDR.
 */

const { getUniqueValues } = require('../../utils/analysis');

const IMAGE_VIDEO_CODECS = ['mjpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/bmp', 'image/webp', 'image/tiff', 'image/x-ms-bmp'];

function analyzeVideoStreams(videoStreams, mediaInfoTracks, file, durationSeconds) {
  const mediaInfoVideoTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Video');
  const enrichedVideoStreams = videoStreams.map((stream, streamIndex) => {
    const mediaInfoVideoTrack = mediaInfoVideoTracks.find((track) => String(track.StreamOrder) === String(stream.index))
      || mediaInfoVideoTracks[streamIndex]
      || null;
    return enrichVideoStream(stream, mediaInfoVideoTrack, file, durationSeconds);
  });
  const videoInfo = {
    items: enrichedVideoStreams,
    count: enrichedVideoStreams.length,
    hasStreams: enrichedVideoStreams.length > 0,
    hasPlayableStreams: enrichedVideoStreams.some((stream) => !stream.analysis.isImageStream),
    hasMultipleStreams: enrichedVideoStreams.length > 1,
    codecs: getUniqueValues(enrichedVideoStreams, (stream) => stream?.codec_name || 'unknown'),
  };

  return videoInfo;
}

function enrichVideoStream(stream, mediaInfoVideoTrack, file, durationSeconds) {
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
  const bitRate = getVideoBitRate(stream, mediaInfoVideoTrack, durationSeconds);
  const frameRate = getVideoFrameRate(stream, mediaInfoVideoTrack, file);
  const enrichedStream = Object.assign({}, stream, {
    analysis: {
      isImageStream: resolveIsImageStream(),
      width,
      height,
      bitRate,
      frameRate,
      resolution: analyzeVideoResolution(width, height, file),
      hdr: analyzeVideoHdr(stream, mediaInfoVideoTrack),
    },
  });

  return enrichedStream;
}

function getVideoBitRate(stream, mediaInfoVideoTrack, fileDurationSeconds) {
  const mediaInfoBitRate = Number(mediaInfoVideoTrack?.BitRate || 0);
  const mediaInfoNominalBitRate = Number(mediaInfoVideoTrack?.BitRate_Nominal || 0);
  const streamBitRate = Number(stream.bit_rate || 0);
  const streamSize = Number(mediaInfoVideoTrack?.StreamSize
    || Object.entries(stream.tags || {}).find(([key]) => key.toUpperCase().startsWith('NUMBER_OF_BYTES'))?.[1]
    || 0);
  const durationSeconds = Number(mediaInfoVideoTrack?.Duration || stream.duration || fileDurationSeconds || 0);

  if (mediaInfoBitRate > 0) {
    return { value: mediaInfoBitRate, source: 'mediaInfoVideo' };
  }

  if (streamBitRate > 0) {
    return { value: streamBitRate, source: 'ffprobeStream' };
  }

  if (mediaInfoNominalBitRate > 0) {
    return { value: mediaInfoNominalBitRate, source: 'mediaInfoNominal' };
  }

  if (streamSize > 0 && durationSeconds > 0) {
    return { value: (streamSize * 8) / durationSeconds, source: 'videoStreamSize' };
  }

  return { value: 0, source: 'missing' };
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
  const isUnknown = width <= 0 || height <= 0;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const is4k = !isUnknown && (longEdge >= 3456 || shortEdge >= 1944);
  const is1080p = !is4k && !isUnknown && (longEdge >= 1728 || shortEdge >= 972);
  const is720p = !is1080p && !isUnknown && (longEdge >= 1152 || shortEdge >= 648);
  const is480p = !is720p && !isUnknown && (longEdge >= 640 || shortEdge >= 432);
  const isLowRes = !isUnknown && !is1080p && !is4k;
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

function analyzeVideoHdr(stream, mediaInfoVideoTrack) {
  const parseNumericMetadata = (value) => Number.parseFloat(String(value || '').replace(/[^\d.].*$/, '')) || 0;
  const colorPrimaries = String(stream.color_primaries || mediaInfoVideoTrack?.colour_primaries || mediaInfoVideoTrack?.ColorPrimaries || '').toLowerCase();
  const colorTransfer = String(stream.color_transfer || stream.color_trc || mediaInfoVideoTrack?.transfer_characteristics || mediaInfoVideoTrack?.TransferCharacteristics || '').toLowerCase();
  const colorSpace = String(stream.color_space || stream.colorspace || mediaInfoVideoTrack?.matrix_coefficients || mediaInfoVideoTrack?.Matrix_Coefficients || '').toLowerCase();
  const hdrDescription = [
    mediaInfoVideoTrack?.HDR_Format,
    mediaInfoVideoTrack?.HDR_Format_Profile,
    mediaInfoVideoTrack?.HDR_Format_Compatibility,
    mediaInfoVideoTrack?.HDR_Format_String,
    ...(stream.side_data_list || []).map((item) => item.side_data_type),
  ].filter(Boolean).join(' ').toLowerCase();
  const doviSideData = (stream.side_data_list || []).find((item) => /dovi|dolby vision/i.test(item.side_data_type || '')) || {};
  const dolbyVisionProfileMatch = hdrDescription.match(/(?:dvhe|dvh1)[._-]?0?(\d+)/i);
  const dolbyVisionProfile = Number(doviSideData.dv_profile || dolbyVisionProfileMatch?.[1] || 0);
  const hasDolbyVision = /dolby vision|\bdovi\b|\bdvhe\b|\bdvh1\b/.test(hdrDescription) || dolbyVisionProfile > 0;
  const hasHdr10Plus = /hdr10\+|smpte\s*st\s*2094(?:-|\s*)40|smpte\s*st\s*2094\s*app\s*4/.test(hdrDescription);
  const format = /smpte\s*2084|smpte2084|\bpq\b/.test(colorTransfer)
    ? 'pq'
    : /arib(?:-std)?-?b67|\bhlg\b/.test(colorTransfer) ? 'hlg' : '';
  const type = hasDolbyVision ? 'dolbyVision' : hasHdr10Plus ? 'hdr10plus' : format === 'pq' ? 'hdr10' : format === 'hlg' ? 'hlg' : 'sdr';
  const hdr = {
    isHdr: type !== 'sdr',
    format,
    type,
    hasDynamicMetadata: hasDolbyVision || hasHdr10Plus,
    hasDolbyVision,
    hasHdr10Plus,
    dolbyVisionProfile,
    colorPrimaries,
    colorTransfer,
    colorSpace,
    masteringDisplay: mediaInfoVideoTrack?.MasteringDisplay_ColorPrimaries || '',
    masteringDisplayLuminance: mediaInfoVideoTrack?.MasteringDisplay_Luminance || '',
    maxContentLightLevel: parseNumericMetadata(mediaInfoVideoTrack?.MaxCLL || mediaInfoVideoTrack?.MaximumContentLightLevel),
    maxFrameAverageLightLevel: parseNumericMetadata(mediaInfoVideoTrack?.MaxFALL || mediaInfoVideoTrack?.MaximumFrameAverageLightLevel),
  };

  return hdr;
}

module.exports = {
  analyzeVideoStreams,
};
