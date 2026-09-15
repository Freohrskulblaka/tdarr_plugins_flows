/*
 * Media Optimizer Response Library
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Builds Tdarr classic plugin responses from Media Optimizer runtime context.
 */

function createResponse(context) {
  const command = context.plan?.command || null;
  const canExecute = Boolean(context.plan?.isValid && context.plan?.shouldProcess && command?.isExecutable && !context.settings.dryRun);

  return {
    processFile: canExecute,
    preset: canExecute ? command.preset : '',
    container: '.mkv',
    handBrakeMode: false,
    FFmpegMode: canExecute,
    ffmpegMode: canExecute,
    cliToUse: canExecute ? 'ffmpeg' : '',
    reQueueAfter: false,
    infoLog: context.log.toString(),
  };
}

module.exports = {
  createResponse,
};
