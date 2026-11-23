const MAX_BYTES = 40_000_000;
const MAX_SECONDS = 600;
const WINDOW_SECONDS = 2;

export function isSong(file) {
  return /\.(mp3|wav|m4a|flac|ogg|opus)$/i.test(file.name);
}

export async function analyzeSong(file) {
  if (file.size > MAX_BYTES) throw new Error("Choose an audio file of up to 40 MB.");
  let audio;
  try {
    const decoder = new OfflineAudioContext(1, 1, 16_000);
    audio = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("This browser could not read the audio. Try an MP3 or WAV file.");
  }
  if (!audio.length) throw new Error("This audio file is empty.");
  if (audio.duration > MAX_SECONDS) throw new Error("Choose a track of up to 10 minutes.");

  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const framesPerWindow = WINDOW_SECONDS * audio.sampleRate;
  const rmsDbfs = [];
  for (let start = 0; start < audio.length; start += framesPerWindow) {
    const end = Math.min(audio.length, start + framesPerWindow);
    let squares = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i++) squares += channel[i] * channel[i];
    }
    const meanPower = squares / ((end - start) * channels.length);
    rmsDbfs.push(Math.max(-90, Math.round(10 * Math.log10(meanPower))));
  }

  return {
    duration_seconds: Number(audio.duration.toFixed(2)),
    window_seconds: WINDOW_SECONDS,
    rms_dbfs: rmsDbfs,
  };
}
