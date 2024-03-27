const details = () => ({
    id: "Tdarr_Plugin_003_MKVTools",
    Name: "Skull's MKV Tools",
    Stage: "Pre-processing",
    Type: "Video, Audio, Subtitles",
    Operation: "Transcode",
    Description: "This process only works with MKV files. It lets you extract files from a file, or merge files into it.",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, configurable",
    Inputs:[
        {
            name: 'OperationType',
            type: 'string',
            defaultValue: 'Off',
            inputUI: { type: 'dropdown', options: ['Off', 'Extract', 'Merge'] },
            tooltip: `This will Trigger the Extract or Merge process. It can be completely turned off.`
        },
        {
            name: 'ExtractionType',
            type: 'string',
            defaultValue: 'All',
            inputUI: { type: 'dropdown', options: ['All', 'Video', 'Audio', ] },
            tooltip: `This will Trigger the Extract or Merge process. It can be completely turned off.`
        }
    ],
});

const plugin = (file, librarySettings, Inputs, otherArguments) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details
    const fs = require('fs');
    const ct = require("crypto");
    const proc = require('child_process');
    let cfile           = file._id;
    let fileName        = file.meta.FileName;
    let fileDirectory   = file.meta.Directory;


     //create the default reponse object.
     const response = {processFile: false, preset: '', container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

     //Check if file is a video. If it isn't then exit plugin.
     if (file.fileMedium !== 'video') {
         response.infoLog += '- This is not a valid video file. \n';
         return response;
     }

     //Data Arrays
    const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
	const audioStreams = fileStreams.filter(codec => codec.codec_type === 'audio'); //Filter to only the audio streams
    const subStreams = fileStreams.filter(codec => codec.codec_type === 'subtitle'); //Filter to only the subtitle streams

     

}