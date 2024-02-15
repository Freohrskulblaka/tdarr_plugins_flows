const details = () => ({
    id: "Tdarr_Plugin_Pre_Setup",
    Name: "Setup file to make sure everything is working as intended",
    Stage: "Pre-processing",
    Type: "Video",
    Operation: "Transcode",
    Description: "",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, configurable",
    Inputs:[],
});


const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    inputs = lib.loadDefaultValues(inputs, details); // load the default values from the inputs in details

    //create the default reponse object.
    const response = {processFile: false, preset: '', container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    //Check if file is a video. If it isn't then exit plugin.
    if (file.fileMedium !== 'video') {
        response.infoLog += '- This is not a valid video file. \n';
        response.processFile = false;
        return response;
    }

    const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array


    //Check that file has video in the first stream
    if (fileStreams[0].codec_type !== "video") {
        response.infoLog += "Video is not in the first stream";
        response.preset = ",-map 0:v? -map 0:a? -map 0:s? -map 0:d? -map 0:t? -c copy";
        response.reQueueAfter = true;
        response.processFile = true;
        return response;
    }
      
    if (fileStreams[0].codec_type === "video") {
        response.infoLog += "File has video in first stream\n";
    }
     
    //Check to make sure that stats are updated
    if (file.container === 'mkv') {
        // Check that Stats are update for the file
        const proc = require('child_process');
        let currentfilename = file._id;
        let stats_are_current = false;

        //start by defining a random date
        let datStats = Date.parse(new Date(70, 1).toISOString());
        let statsThres = Date.parse(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString());

        //Check if the file has stats at all. 
        if (typeof file.ffProbeData.streams[0].tags !== 'undefined'){
            if(typeof file.ffProbeData.streams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng'] !== 'undefined') {
                datStats = Date.parse(`${file.ffProbeData.streams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng']} GMT`);
            }
        }

        if (datStats >= statsThres) {
            stats_are_current = true;
            response.infoLog += "File Stats are okay \n";
            response.infoLog += `StatsThres: ${statsThres}, StatsDate: ${datStats}\n`;
        }

        if (!stats_are_current) {
            response.infoLog += 'Stats need to be updated! \n';
            proc.execSync(`mkvpropedit --add-track-statistics-tags "${currentfilename}"`);
            return response;
        }
    }

    return response;
}

module.exports.details = details;
module.exports.plugin = plugin;