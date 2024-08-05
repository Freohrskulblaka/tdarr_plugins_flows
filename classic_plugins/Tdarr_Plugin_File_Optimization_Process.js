// Version: 1.0
// This will have the details of the plugin.
function details() {
    let plugin_details = {
        id: "Tdarr_Plugin_File_Optimization_Process",
        Name: "File Optimization Process",
        Stage: "Pre-processing",
        Type: "Video, Audio, Subtitle",
        Operation: "Transcode",
        Description: "This plugin will handle the file optimization process.",
        Version: "1.0",
        Tags: "pre-processing, ffmpeg, configurable",
        Inputs: []
    };

    // Add the Target File Container input to the plugin details.
    let TargetFileContainer = {
        label: 'Target File Container',
        name: 'targetFileContainer',        
        type: 'string',
        defaultValue: 'mkv',
        inputUI: { type: 'dropdown', options: ['mkv', 'mp4'] },
        tooltip: "Select the file container. If the file is not in the selected container, it will be converted to the selected container, with compatible settings."
    };

    // Basic file cleanup.
    let BasicFileCleanup = {
        label: 'Basic File Cleanup',
        name: 'basicFileCleanup',
        type: 'boolean',
        defaultValue: true,
        inputUI: { type: 'dropdown', options: ['false', 'true'] },
        tooltip: `Here are the basic file cleanup that is carried out. \\n
        - Removes Image Streams from the file. \\n
        - Removes Attachments except for fonts. \\n
        - Removes file Title, Video Title.`
    };

    // Lets perform advanced file cleanup. This includes removing unwanted language streams and subtitles.
    // it also includes removing unwanted audio channels, and subtitle types.
    let AdvancedFileCleanup = {
        label: 'Advanced File Cleanup',
        name: 'advancedFileCleanup',
        type: 'boolean',
        defaultValue: true,
        inputUI: { type: 'dropdown', options: ['false', 'true'] },
        tooltip: `Here are the advanced file cleanup that is carried out. \\n
        - Removes unwanted audio streams from the file. \\n
        - Removes unwanted subtitle streams from the file.\\n
        - Removes unwanted audio channels from the file. \\n
        - Removes commentaries from the file. \\n
        - Tag Audio and Subtitle streams that are missing language tags with the first value in the language list.`
    };

    // Add the Audio Language List input to the plugin details.
    let AudioLanguageList = {
        label: 'Audio Language List',
        name: 'audioLangList',
        type: 'string',
        defaultValue: 'eng, spa, jpn',
        inputUI: { type: 'text' },
        tooltip: `List of languagues that will be kept. The first value will be used to tag audio tracks that are missing language tags.\\n
        Example (keep this list):\\n
        eng, jpn`
    };

    // Add the Subtitle Language List input to the plugin details.
    let SubtitleLanguageList = {
        label: 'Subtitle Language List',
        name: 'subtitleLangList',
        type: 'string',
        defaultValue: 'eng, spa',
        inputUI: { type: 'text' },
        tooltip: `List of languagues that will be kept. The first value will be used to tag subtitle tracks that are missing language tags.\\n
        Example (keep this list):\\n
        eng, spa`
    };

    // Add the AudioChannelList input to the plugin details.
    let AudioChannelList = {
        label: 'Audio Channel List',
        name: 'audioChannelList',
        type: 'string',
        defaultValue: '7.1, 5.1, 2.0',
        // The options will let you keep all channels including 7.1 and bellow. It can also do 5.1 and bellow, or just 7.1, 5.1, or 2.0.
        inputUI: { type: 'dropdown', options: ['7.1, 5.1, 2.0', '5.1, 2.0', '7.1', '5.1', '2.0'] },
        tooltip: `List of audio channels that will be kept. \\n
        - It can keep all channels including 7.1 and bellow. 
        - It can also do 5.1 and bellow, or just 7.1, 5.1, or 2.0.`
    };

    // Add the AddChapters input to the plugin details.
    let AddChapters = {
        label: 'Add Chapter Markers',
        name: 'addChapterMarkers',
        type: 'boolean',
        defaultValue: true,
        inputUI: { type: 'dropdown', options: ['false', 'true'] },
        tooltip: `Add chapter markers to the file if it does not have any.`
    };

    plugin_details.Inputs.push(TargetFileContainer);
    plugin_details.Inputs.push(BasicFileCleanup);
    plugin_details.Inputs.push(AdvancedFileCleanup);
    plugin_details.Inputs.push(AudioLanguageList);
    plugin_details.Inputs.push(SubtitleLanguageList);
    plugin_details.Inputs.push(AudioChannelList);
    plugin_details.Inputs.push(AddChapters);

    return plugin_details;
};

// Sample object of what a file looks like after the ffmpeg probe has run.
let file = {
    "_id": "/mnt/media/staging/Tdarr/The Bible (2013) - [imdbid-tt2245988] - [tvdbid-265720]/Season 01/The Bible (2013) - S01E05 - Passion - ([Bluray-1080p][DTS 5.1][x264][8 bits][EN+ES+FR]).mkv",
    "file": "/mnt/media/staging/Tdarr/The Bible (2013) - [imdbid-tt2245988] - [tvdbid-265720]/Season 01/The Bible (2013) - S01E05 - Passion - ([Bluray-1080p][DTS 5.1][x264][8 bits][EN+ES+FR]).mkv",
    "DB": "gkqLK44Lq",
    "footprintId": "DUz71cjJx",
    "hasClosedCaptions": false,
    "container": "mkv",
    "scannerReads": {
      "ffProbeRead": "success",
      "exiftoolRead": "success",
      "mediaInfoRead": "success",
      "closedCaptionRead": "success"
    },
    "ffProbeData": {
      "streams": [
        {
          "index": 0,
          "codec_name": "h264",
          "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
          "profile": "High",
          "codec_type": "video",
          "codec_tag_string": "[0][0][0][0]",
          "codec_tag": "0x0000",
          "width": 1920,
          "height": 1080,
          "coded_width": 1920,
          "coded_height": 1080,
          "closed_captions": 0,
          "film_grain": 0,
          "has_b_frames": 2,
          "sample_aspect_ratio": "1:1",
          "display_aspect_ratio": "16:9",
          "pix_fmt": "yuv420p",
          "level": 41,
          "chroma_location": "left",
          "field_order": "progressive",
          "refs": 1,
          "is_avc": "true",
          "nal_length_size": "4",
          "r_frame_rate": "24000/1001",
          "avg_frame_rate": "24000/1001",
          "time_base": "1/1000",
          "start_pts": 0,
          "start_time": "0.000000",
          "bits_per_raw_sample": "8",
          "extradata_size": 43,
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0,
            "captions": 0,
            "descriptions": 0,
            "metadata": 0,
            "dependent": 0,
            "still_image": 0
          },
          "tags": {
            "language": "eng",
            "title": "The.Bible.2013.S01.E10.Courage.1080p.BluRay.x264-HDMaNiAcS"
          }
        },
        {
          "index": 1,
          "codec_name": "dts",
          "codec_long_name": "DCA (DTS Coherent Acoustics)",
          "profile": "DTS",
          "codec_type": "audio",
          "codec_tag_string": "[0][0][0][0]",
          "codec_tag": "0x0000",
          "sample_fmt": "fltp",
          "sample_rate": "48000",
          "channels": 6,
          "channel_layout": "5.1(side)",
          "bits_per_sample": 0,
          "initial_padding": 0,
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/1000",
          "start_pts": 0,
          "start_time": "0.000000",
          "bit_rate": "1536000",
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0,
            "captions": 0,
            "descriptions": 0,
            "metadata": 0,
            "dependent": 0,
            "still_image": 0
          },
          "tags": {
            "language": "eng"
          }
        },
        {
          "index": 2,
          "codec_name": "hdmv_pgs_subtitle",
          "codec_long_name": "HDMV Presentation Graphic Stream subtitles",
          "codec_type": "subtitle",
          "codec_tag_string": "[0][0][0][0]",
          "codec_tag": "0x0000",
          "width": 1920,
          "height": 1080,
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/1000",
          "start_pts": 2712,
          "start_time": "2.712000",
          "disposition": {
            "default": 1,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0,
            "captions": 0,
            "descriptions": 0,
            "metadata": 0,
            "dependent": 0,
            "still_image": 0
          },
          "tags": {
            "language": "eng"
          }
        },
        {
          "index": 3,
          "codec_name": "hdmv_pgs_subtitle",
          "codec_long_name": "HDMV Presentation Graphic Stream subtitles",
          "codec_type": "subtitle",
          "codec_tag_string": "[0][0][0][0]",
          "codec_tag": "0x0000",
          "width": 1920,
          "height": 1080,
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/1000",
          "start_pts": 2378,
          "start_time": "2.378000",
          "disposition": {
            "default": 0,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0,
            "captions": 0,
            "descriptions": 0,
            "metadata": 0,
            "dependent": 0,
            "still_image": 0
          },
          "tags": {
            "language": "spa"
          }
        },
        {
          "index": 4,
          "codec_name": "hdmv_pgs_subtitle",
          "codec_long_name": "HDMV Presentation Graphic Stream subtitles",
          "codec_type": "subtitle",
          "codec_tag_string": "[0][0][0][0]",
          "codec_tag": "0x0000",
          "width": 1920,
          "height": 1080,
          "r_frame_rate": "0/0",
          "avg_frame_rate": "0/0",
          "time_base": "1/1000",
          "start_pts": 2420,
          "start_time": "2.420000",
          "disposition": {
            "default": 0,
            "dub": 0,
            "original": 0,
            "comment": 0,
            "lyrics": 0,
            "karaoke": 0,
            "forced": 0,
            "hearing_impaired": 0,
            "visual_impaired": 0,
            "clean_effects": 0,
            "attached_pic": 0,
            "timed_thumbnails": 0,
            "captions": 0,
            "descriptions": 0,
            "metadata": 0,
            "dependent": 0,
            "still_image": 0
          },
          "tags": {
            "language": "fre"
          }
        }
      ],
      "format": {
        "filename": "/mnt/media/staging/Tdarr/The Bible (2013) - [imdbid-tt2245988] - [tvdbid-265720]/Season 01/The Bible (2013) - S01E05 - Passion - ([Bluray-1080p][DTS 5.1][x264][8 bits][EN+ES+FR]).mkv",
        "nb_streams": 5,
        "nb_programs": 0,
        "format_name": "matroska,webm",
        "format_long_name": "Matroska / WebM",
        "start_time": "0.000000",
        "duration": "3113.152000",
        "size": "8199511017",
        "bit_rate": "21070634",
        "probe_score": 100,
        "tags": {
          "encoder": "libebml v1.3.0 + libmatroska v1.4.0",
          "creation_time": "1970-01-01T00:00:01.366952Z"
        }
      }
    },
    "file_size": 7819.663064002991,
    "video_resolution": "1080p",
    "fileMedium": "video",
    "video_codec_name": "h264",
    "audio_codec_name": "",
    "lastPluginDetails": "none",
    "createdAt": 1716863809105,
    "bit_rate": 21070634,
    "duration": 3113,
    "statSync": {
      "dev": 46,
      "mode": 33270,
      "nlink": 1,
      "uid": 1000,
      "gid": 100,
      "rdev": 0,
      "blksize": 4096,
      "ino": 649644259199983200,
      "size": 8199511017,
      "blocks": 16014672,
      "atimeMs": 1716603935584.5847,
      "mtimeMs": 1655566919000,
      "ctimeMs": 1716784222997.0667,
      "birthtimeMs": 0,
      "atime": "2024-05-25T02:25:35.585Z",
      "mtime": "2022-06-18T15:41:59.000Z",
      "ctime": "2024-05-27T04:30:22.997Z",
      "birthtime": "1970-01-01T00:00:00.000Z"
    },
    "HealthCheck": "",
    "TranscodeDecisionMaker": "",
    "lastHealthCheckDate": 0,
    "holdUntil": 0,
    "lastTranscodeDate": 0,
    "bumped": false,
    "history": "",
    "oldSize": 0,
    "newSize": 0,
    "newVsOldRatio": 0,
    "videoStreamIndex": 0,
    "meta": {
      "SourceFile": "/mnt/media/staging/Tdarr/The Bible (2013) - [imdbid-tt2245988] - [tvdbid-265720]/Season 01/The Bible (2013) - S01E05 - Passion - ([Bluray-1080p][DTS 5.1][x264][8 bits][EN+ES+FR]).mkv",
      "errors": [],
      "tz": "UTC",
      "tzSource": "defaultVideosToUTC",
      "Duration": 3113.152,
      "DefaultDuration": 0.010666666,
      "ExifToolVersion": 12.6,
      "FileName": "The Bible (2013) - S01E05 - Passion - ([Bluray-1080p][DTS 5.1][x264][8 bits][EN+ES+FR]).mkv",
      "Directory": "/mnt/media/staging/Tdarr/The Bible (2013) - [imdbid-tt2245988] - [tvdbid-265720]/Season 01",
      "FileSize": "8.2 GB",
      "FileModifyDate": {
        "_ctor": "ExifDateTime",
        "year": 2022,
        "month": 6,
        "day": 18,
        "hour": 15,
        "minute": 41,
        "second": 59,
        "tzoffsetMinutes": 0,
        "rawValue": "2022:06:18 15:41:59+00:00",
        "zoneName": "UTC"
      },
      "FileAccessDate": {
        "_ctor": "ExifDateTime",
        "year": 2024,
        "month": 5,
        "day": 25,
        "hour": 2,
        "minute": 25,
        "second": 35,
        "tzoffsetMinutes": 0,
        "rawValue": "2024:05:25 02:25:35+00:00",
        "zoneName": "UTC"
      },
      "FileInodeChangeDate": {
        "_ctor": "ExifDateTime",
        "year": 2024,
        "month": 5,
        "day": 27,
        "hour": 4,
        "minute": 30,
        "second": 22,
        "tzoffsetMinutes": 0,
        "rawValue": "2024:05:27 04:30:22+00:00",
        "zoneName": "UTC"
      },
      "FilePermissions": "-rwxrw-rw-",
      "FileType": "MKV",
      "FileTypeExtension": "mkv",
      "MIMEType": "video/x-matroska",
      "EBMLVersion": 1,
      "EBMLReadVersion": 1,
      "DocType": "matroska",
      "DocTypeVersion": 4,
      "DocTypeReadVersion": 2,
      "TimecodeScale": "1 ms",
      "MuxingApp": "libebml v1.3.0 + libmatroska v1.4.0",
      "WritingApp": "mkvmerge v5.9.0 ('On The Loose') built on Dec  9 2012 15:37:01",
      "DateTimeOriginal": "1970:01:01 00:00:01-0.633048057556152Z",
      "VideoCodecID": "V_MPEG4/ISO/AVC",
      "VideoFrameRate": 23.976,
      "TrackName": "The.Bible.2013.S01.E10.Courage.1080p.BluRay.x264-HDMaNiAcS",
      "ImageWidth": 1920,
      "ImageHeight": 1080,
      "DisplayWidth": 1920,
      "DisplayHeight": 1080,
      "AudioCodecID": "A_DTS",
      "AudioSampleRate": 48000,
      "AudioChannels": 6,
      "TrackNumber": 5,
      "TrackUID": "64b7ebeaca51368d",
      "TrackType": "Subtitle",
      "TrackDefault": "No",
      "CodecID": "S_HDMV/PGS",
      "TrackLanguage": "fre",
      "ChapterTimeStart": "0:46:46",
      "ChapterString": "00:46:46.053",
      "ChapterLanguage": "eng",
      "ImageSize": "1920x1080",
      "Megapixels": 2.1
    },
    "mediaInfo": {
      "@ref": "",
      "track": [
        {
          "@type": "General",
          "UniqueID": "247083421367856277110931650927740864325",
          "VideoCount": "1",
          "AudioCount": "1",
          "TextCount": "3",
          "MenuCount": "1",
          "Format": "Matroska",
          "Format_Version": "4",
          "FileSize": "8199511017",
          "Duration": "3113.152",
          "OverallBitRate": "21070635",
          "FrameRate": "23.976",
          "FrameCount": "74641",
          "StreamSize": "163163352",
          "IsStreamable": "Yes",
          "Encoded_Date": "2010-02-22 21:41:31 UTC",
          "Encoded_Application": "mkvmerge v5.9.0 ('On The Loose') built on Dec  9 2012 15:37:01",
          "Encoded_Library": "libebml v1.3.0 + libmatroska v1.4.0"
        },
        {
          "@type": "Video",
          "StreamOrder": "0",
          "ID": "1",
          "UniqueID": "1",
          "Format": "AVC",
          "Format_Profile": "High",
          "Format_Level": "4.1",
          "Format_Settings_CABAC": "Yes",
          "Format_Settings_RefFrames": "4",
          "CodecID": "V_MPEG4/ISO/AVC",
          "Duration": "3113.155",
          "BitRate": "19500000",
          "Width": "1920",
          "Height": "1080",
          "Stored_Height": "1088",
          "Sampled_Width": "1920",
          "Sampled_Height": "1080",
          "PixelAspectRatio": "1.000",
          "DisplayAspectRatio": "1.778",
          "FrameRate_Mode": "CFR",
          "FrameRate": "23.976",
          "FrameRate_Num": "24000",
          "FrameRate_Den": "1001",
          "FrameCount": "74641",
          "ColorSpace": "YUV",
          "ChromaSubsampling": "4:2:0",
          "BitDepth": "8",
          "ScanType": "Progressive",
          "Delay": "0.000",
          "Delay_Source": "Container",
          "StreamSize": "7449129369",
          "Title": "The.Bible.2013.S01.E10.Courage.1080p.BluRay.x264-HDMaNiAcS",
          "Encoded_Library": "x264 - core 130 r2273 b3065e6",
          "Encoded_Library_Name": "x264",
          "Encoded_Library_Version": "core 130 r2273 b3065e6",
          "Encoded_Library_Settings": "cabac=1 / ref=4 / deblock=1:-3:-3 / analyse=0x3:0x113 / me=tesa / subme=11 / psy=1 / psy_rd=1.07:0.00 / mixed_ref=1 / me_range=24 / chroma_me=1 / trellis=2 / 8x8dct=1 / cqm=0 / deadzone=21,11 / fast_pskip=1 / chroma_qp_offset=-2 / threads=12 / lookahead_threads=2 / sliced_threads=0 / nr=0 / decimate=1 / interlaced=0 / bluray_compat=0 / constrained_intra=0 / bframes=8 / b_pyramid=2 / b_adapt=2 / b_bias=0 / direct=3 / weightb=1 / open_gop=0 / weightp=2 / keyint=240 / keyint_min=23 / scenecut=40 / intra_refresh=0 / rc_lookahead=40 / rc=2pass / mbtree=0 / bitrate=19500 / ratetol=1.0 / qcomp=0.60 / qpmin=10 / qpmax=69 / qpstep=4 / cplxblur=20.0 / qblur=0.5 / vbv_maxrate=62500 / vbv_bufsize=78125 / nal_hrd=none / ip_ratio=1.40 / pb_ratio=1.30 / aq=2:0.55",
          "Language": "en",
          "Default": "Yes",
          "Forced": "No"
        },
        {
          "@type": "Audio",
          "StreamOrder": "1",
          "ID": "2",
          "UniqueID": "4285862044164960401",
          "Format": "DTS",
          "Format_Settings_Mode": "16",
          "Format_Settings_Endianness": "Big",
          "CodecID": "A_DTS",
          "Duration": "3113.152",
          "BitRate_Mode": "CBR",
          "BitRate": "1509000",
          "Channels": "6",
          "ChannelPositions": "Front: L C R, Side: L R, LFE",
          "ChannelLayout": "C L R Ls Rs LFE",
          "SamplesPerFrame": "512",
          "SamplingRate": "48000",
          "SamplingCount": "149431296",
          "FrameRate": "93.750",
          "BitDepth": "24",
          "Compression_Mode": "Lossy",
          "Delay": "0.000",
          "Delay_Source": "Container",
          "Video_Delay": "0.000",
          "StreamSize": "587218296",
          "Language": "en",
          "Default": "Yes",
          "Forced": "No"
        },
        {
          "@type": "Text",
          "@typeorder": "1",
          "StreamOrder": "2",
          "ID": "3",
          "UniqueID": "1195472634198459579",
          "Format": "PGS",
          "CodecID": "S_HDMV/PGS",
          "Language": "en",
          "Default": "Yes",
          "Forced": "No"
        },
        {
          "@type": "Text",
          "@typeorder": "2",
          "StreamOrder": "3",
          "ID": "4",
          "UniqueID": "10157986539331015852",
          "Format": "PGS",
          "CodecID": "S_HDMV/PGS",
          "Language": "es",
          "Default": "No",
          "Forced": "No"
        },
        {
          "@type": "Text",
          "@typeorder": "3",
          "StreamOrder": "4",
          "ID": "5",
          "UniqueID": "7257528718180038285",
          "Format": "PGS",
          "CodecID": "S_HDMV/PGS",
          "Language": "fr",
          "Default": "No",
          "Forced": "No"
        },
        {
          "@type": "Menu",
          "extra": {
            "_00_00_00_000": "en:00:00:00.000",
            "_00_02_31_568": "en:00:02:31.568",
            "_00_06_59_127": "en:00:06:59.127",
            "_00_12_38_591": "en:00:12:38.591",
            "_00_17_33_844": "en:00:17:33.844",
            "_00_24_25_798": "en:00:24:25.798",
            "_00_26_14_615": "en:00:26:14.615",
            "_00_31_21_797": "en:00:31:21.797",
            "_00_35_08_356": "en:00:35:08.356",
            "_00_38_36_814": "en:00:38:36.814",
            "_00_43_08_002": "en:00:43:08.002",
            "_00_46_46_053": "en:00:46:46.053"
          }
        }
      ]
    }
  };


// This will be the main plugin function.
function plugin (file, librarySettings, Inputs, otherArguments) {
    // Load the lib object
    const lib = require('../methods/lib')();

    // Load the default values from the inputs in details
    let inputs = lib.loadDefaultValues(Inputs, details);

    // Lets create the default reponse object.
    let response = {
        processFile: false,
        preset: '',
        container: '.mkv',
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: true,
        infoLog: ''
    };

    // Check if the file is a video file and exit if it is not.
    response.infoLog += "-> Checking if the file is a valid video file.\n";
    if (file.fileMedium !== 'video') {
        throw new Error('This plugin only works with video files');
    }
    response.infoLog += "-> The file is a valid video file.\n";

    // The next part of the code only runs if the file is a video file.
    // Lets grab the file streams from the file object.
    let fileStreams = file.ffProbeData.streams;

    // Lets create a file that contains all the details about the file. This will be used to create the FFmpeg command.
    let fileDetails = {
        inputFile: file._id,
        fileContainer: file.container,
        wantedAudioLangs: inputs.audioLangList,
        wantedSubtitleLangs: inputs.subtitleLangList,
        wantedAudioChannels: inputs.audioChannelList,
        targetFileContainer: inputs.targetFileContainer,
        userInputs: {
            basicFileCleanup: inputs.basicFileCleanup,
            advancedFileCleanup: inputs.advancedFileCleanup,
            addChapterMarkers: inputs.addChapterMarkers
        },
        fileStreams: fileStreams.map(stream => ({
            ...stream,
            remove: false,
            mapArgs: [`-map`, `0:${stream.index}`], //This will be used to map the stream to the output file, we will copy the stream by default.
            index: stream.index, //This will be used to store the stream index.
            inputArgs:[], //This will be used to store the input args for the stream.
            outputArgs: [] //This will be used to store the output args for the stream.
        })),
        mediaInfo: file.mediaInfo,
        shouldProcess: false,
        message: '',
        videoTrackCount: fileStreams.filter(stream => stream.codec_type === 'video').length,
        audioTrackCount: fileStreams.filter(stream => stream.codec_type === 'audio').length,
        subtitleTrackCount: fileStreams.filter(stream => stream.codec_type === 'subtitle').length,
        fileInputArgs: [],
        fileOutputArgs: []
    };

    // Lets check if the file is in the target container. If it is not, we will convert it to the target container.
    checkTargetContainer(fileDetails);

    // Lets check if the basic file cleanup is enabled. If it is, we will remove the unwanted streams from the file.
    basicFileCleanup(fileDetails);

    return response;
}

// This funtion takes in the fileDetails objects and removes the uncompatible streams from the file based on the Target File Container.
function checkTargetContainer(fileDetails) {
    const UNCOMPATIBLE_MKV_CODECS = ['mov_text', 'eia_608', 'eia_708', 'timed_id3'];
    const UNCOMPATIBLE_MP4_CODECS = ['hdmv_pgs_subtitle', 'eia_608', 'eia_708', 'timed_id3', 'subrip'];

    // Check if the file is in the target container
    if (fileDetails.fileContainer === fileDetails.targetFileContainer) {
        return;
    }

    fileDetails.shouldProcess = true;
    fileDetails.message += `-> The file is currently in the ${fileDetails.fileContainer} container.\\n
    It will be converted to the ${fileDetails.targetFileContainer} container.\\n`;

    fileDetails.fileStreams.forEach((stream) => {
        const codecType = stream?.codec_type?.toLowerCase();
        const codecName = stream?.codec_name?.toLowerCase();

        // Skip the stream if the codecType or codecName is not available.
        if (!codecType || !codecName) {
            return; 
        }

        // Remove data streams for mkv target container
        if (fileDetails.targetFileContainer === 'mkv' && codecType === 'data') {
            stream.remove = true;
            fileDetails.message += `-> Removing the data stream from the file.\n`;
        }

        // Remove incompatible streams based on the target container
        const isIncompatibleForMKV = fileDetails.targetFileContainer === 'mkv' && UNCOMPATIBLE_MKV_CODECS.includes(codecName);
        const isIncompatibleForMP4 = fileDetails.targetFileContainer === 'mp4' && UNCOMPATIBLE_MP4_CODECS.includes(codecName);
        
        if (isIncompatibleForMKV || isIncompatibleForMP4) {
            stream.remove = true;
            fileDetails.message += `-> Removing the ${codecName} stream from the file.\n`;
        }
    });
}

// This function carries out the basic file cleanup process.
function basicFileCleanup(fileDetails) {
    // Check if the basic file cleanup is enabled. If it is not, we will skip the process.
    if (!fileDetails.userInputs.basicFileCleanup) {
        return;
    }

    fileDetails.message += `-> Starting the basic file cleanup process.\n`;
    const NON_VIDEO_CODECS = ['mjpeg', 'png', 'gif', 'image/jpeg'];
    const UNWANTED_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif'];
    const FONT_MIMETYPES = ['application/x-truetype-font', 'application/vnd.ms-opentype', 'application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-otf', 'application/x-font-opentype'];

    // Loop through the file and carry out the basic cleanup process.
    fileDetails.fileStreams.forEach((stream) => {
        const codecType = stream?.codec_type?.toLowerCase();
        const codecName = stream?.codec_name?.toLowerCase();
        const mimeType = stream?.tags?.MIMETYPE?.toLowerCase();

        // Skip the stream if the codecType or codecName is not available.
        if (!codecType || !codecName) {
            return; 
        }

        // Remove Image Streams from the file. This should only run if we have more than 1 video stream.
        if (fileDetails.videoTrackCount > 1 && codecType === 'video' && (NON_VIDEO_CODECS.includes(codecName) || UNWANTED_MIMETYPES.includes(mimeType))) {
            stream.remove = true;
            fileDetails.shouldProcess = true;
            fileDetails.message += `-> Removing image track ${stream.index} from the file.\n`;
        }

        // Remove the attachment streams from the file except for fonts.
        if (codecType === 'attachment' && !FONT_MIMETYPES.includes(mimeType)) {
            stream.remove = true;
            fileDetails.shouldProcess = true;
            fileDetails.message += `-> Removing attachment track ${stream.index} from the file.\n`;
        }

        // Remove video stream titles.
        if (codecType === 'video' && !stream.remove && stream.tags?.title?.trim().length > 0) {
            stream.outputArgs.push(`-metadata:s:v:${stream.index} title=`);
            fileDetails.shouldProcess = true;
            fileDetails.message += `-> Removing the title from the video stream ${stream.index}.\n`;
        }
    });

    // Remove file level metadata for title.
    if (fileDetails.mediaInfo) {
        const fileInfo = fileDetails.mediaInfo?.find(info => info['@type'] === 'General');
        const fileTitle = fileDetails.mediaInfo?.Title || fileInfo?.Title;

        if (fileTitle) {
            fileDetails.fileOutputArgs.push(`-metadata title=`);
            fileDetails.shouldProcess = true;
            fileDetails.message += `-> Removing the title from the file.\n`;
        }
    }
}



// Export the plugin details and the plugin function.
module.exports.details = details;
module.exports.plugin = plugin;