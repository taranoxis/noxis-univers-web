'use strict';

const byId = (id) => document.getElementById(id);
const video = byId('video');
const cover = byId('cover');
const music = byId('music');
const visualFile = byId('visual-file');
const musicFile = byId('music-file');
const play = byId('play');
const seek = byId('seek');
const clear = byId('clear');
const record = byId('record');
const cancel = byId('cancel');
const download = byId('download');
const status = byId('status');

const sources = new Map();
const AudioEngine = window.AudioContext || window.webkitAudioContext;
const canRecord = Boolean(window.MediaRecorder && AudioEngine && HTMLCanvasElement.prototype.captureStream);
let exportJob;
let downloadURL;

function ready(media) {
  return Boolean(sources.has(media) && !media.error && Number.isFinite(media.duration) && media.duration > 0);
}

function coverReady() {
  return Boolean(sources.has(cover) && cover.complete && cover.naturalWidth);
}

function canExport() {
  return ready(music) && (ready(video) || coverReady());
}

function primary() {
  return ready(video) ? video : ready(music) ? music : null;
}

function timeLabel(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function render() {
  const leader = primary();
  const current = leader?.currentTime || 0;
  const duration = leader?.duration || 0;
  video.hidden = !ready(video);
  cover.hidden = !coverReady();
  byId('empty').hidden = !video.hidden || !cover.hidden;
  byId('empty').textContent = ready(music) ? 'Song ready to play.' : 'Choose a video, cover image or song to begin.';
  byId('time').textContent = timeLabel(current) + ' / ' + timeLabel(duration);
  play.textContent = leader && !leader.paused ? 'Pause' : 'Play';
  seek.max = duration;
  seek.value = current;
  seek.disabled = play.disabled = !leader || Boolean(exportJob);
  clear.disabled = !sources.size || Boolean(exportJob);
  visualFile.disabled = musicFile.disabled = Boolean(exportJob);
  record.disabled = !canRecord || !canExport() || Boolean(exportJob);
  cancel.hidden = !exportJob;
}

function stopPlayback() {
  video.pause();
  music.pause();
}

function removeDownload() {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = null;
  download.removeAttribute('href');
  download.hidden = true;
}

function replaceFile(media, file) {
  const prior = sources.get(media);
  media.removeAttribute('src');
  if (prior) URL.revokeObjectURL(prior);
  sources.delete(media);
  if (file) {
    const url = URL.createObjectURL(file);
    sources.set(media, url);
    media.src = url;
  }
  if (media !== cover) media.load();
}

function handleSelection(picker, update) {
  picker.addEventListener('change', () => {
    stopPlayback();
    removeDownload();
    const file = picker.files[0];
    status.textContent = file ? 'Opening the file on this device…' : 'Choose a video, cover image or song.';
    update(file);
    render();
  });
}

function watchMedia(media, label) {
  media.addEventListener(media === cover ? 'load' : 'loadedmetadata', () => {
    status.textContent = 'Ready to play.';
    render();
  });
  media.addEventListener('error', () => {
    if (!sources.has(media)) return;
    status.textContent = 'This browser could not open the ' + label + '. Try a different file.';
    render();
  });
  for (const event of ['timeupdate', 'pause', 'play', 'durationchange']) {
    media.addEventListener(event, render);
  }
}

function syncSong() {
  if (primary() !== video || !ready(music)) return;
  const target = Math.min(video.currentTime, music.duration);
  if (Math.abs(music.currentTime - target) > 0.25) music.currentTime = target;
}

watchMedia(video, 'video');
watchMedia(cover, 'cover image');
watchMedia(music, 'song');
handleSelection(visualFile, (file) => {
  const isImage = file && (file.type.startsWith('image/') || (!file.type && /\.(png|jpe?g|webp|gif|avif|bmp|svg|heic|heif)$/i.test(file.name)));
  replaceFile(video, isImage ? null : file);
  replaceFile(cover, isImage ? file : null);
});
handleSelection(musicFile, (file) => replaceFile(music, file));
for (const event of ['seeking', 'waiting', 'pause', 'ended']) {
  video.addEventListener(event, () => {
    if (primary() === video) music.pause();
  });
}
for (const event of ['playing', 'seeked']) {
  video.addEventListener(event, () => {
    syncSong();
    if (ready(music) && !video.paused && !video.ended && video.currentTime < music.duration && music.paused) {
      music.play().catch(() => {});
    }
  });
}
video.addEventListener('timeupdate', syncSong);
seek.addEventListener('input', () => {
  const leader = primary();
  if (!leader) return;
  leader.currentTime = Number(seek.value);
  syncSong();
});
play.addEventListener('click', async () => {
  const leader = primary();
  if (!leader) return;
  if (!leader.paused) {
    stopPlayback();
    return;
  }

  if (leader.ended) leader.currentTime = 0;
  const paired = leader === video && ready(music);
  video.muted = paired;
  syncSong();
  try {
    const start = [leader.play()];
    if (paired && video.currentTime < music.duration) start.push(music.play());
    await Promise.all(start);
  } catch {
    stopPlayback();
    status.textContent = 'Playback could not start. Try pressing Play again.';
  }
});
clear.addEventListener('click', () => {
  stopPlayback();
  removeDownload();
  replaceFile(video, null);
  replaceFile(cover, null);
  replaceFile(music, null);
  visualFile.value = musicFile.value = '';
  status.textContent = 'Files cleared.';
  render();
});

function exportFormat() {
  return [
    'video/mp4;codecs=avc1.420034,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

async function makeDownload() {
  if (exportJob || !canExport()) return;
  const format = exportFormat();
  if (!format) {
    status.textContent = 'This browser can play your files but cannot export them.';
    return;
  }
  stopPlayback();
  removeDownload();

  const controller = new AbortController();
  const { signal } = controller;
  exportJob = controller;
  render();
  status.textContent = 'Preparing export…';

  const clip = ready(video) ? document.createElement('video') : null;
  const song = document.createElement('audio');
  const clock = clip || song;
  if (clip) {
    clip.muted = true;
    clip.playsInline = true;
    clip.preload = 'auto';
  }
  song.preload = 'auto';
  const mediaInputs = [[song, music]];
  if (clip) mediaInputs.unshift([clip, video]);
  let context;
  let stream;
  let recorder;
  let frame;
  try {
    context = new AudioEngine();
    await context.resume();
    signal.throwIfAborted();
    const loaded = mediaInputs.map(([media, source]) => new Promise((resolve, reject) => {
      media.addEventListener('loadeddata', resolve, { once: true, signal });
      media.addEventListener('error', reject, { once: true, signal });
      signal.addEventListener('abort', reject, { once: true });
      media.src = sources.get(source);
      media.load();
    }));
    await Promise.all(loaded);
    signal.throwIfAborted();

    const canvas = document.createElement('canvas');
    const visual = clip || cover;
    const width = clip ? clip.videoWidth : cover.naturalWidth;
    const height = clip ? clip.videoHeight : cover.naturalHeight;
    const scale = Math.min(1, 1920 / width, 1920 / height);
    canvas.width = Math.max(2, Math.floor(width * scale / 2) * 2);
    canvas.height = Math.max(2, Math.floor(height * scale / 2) * 2);
    const drawing = canvas.getContext('2d');
    const draw = () => {
      drawing.drawImage(visual, 0, 0, canvas.width, canvas.height);
      status.textContent = 'Making your video… ' + timeLabel(clock.currentTime) + ' / ' + timeLabel(clock.duration) + '. Keep this tab visible.';
      frame = requestAnimationFrame(draw);
    };
    const audioOutput = context.createMediaStreamDestination();
    context.createMediaElementSource(song).connect(audioOutput);
    stream = canvas.captureStream(30);
    for (const track of audioOutput.stream.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: format });
    const parts = [];
    await new Promise((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) parts.push(event.data);
      });
      recorder.addEventListener('stop', resolve, { once: true });
      recorder.addEventListener('error', reject, { once: true });
      signal.addEventListener('abort', reject, { once: true });
      for (const [media] of mediaInputs) media.addEventListener('error', reject, { once: true, signal });
      clock.addEventListener('ended', () => recorder.stop(), { once: true, signal });
      draw();
      recorder.start(1000);
      Promise.all(mediaInputs.map(([media]) => media.play())).catch(reject);
    });
    signal.throwIfAborted();
    if (!parts.length) throw new Error('Empty recording');

    const type = recorder.mimeType || format;
    downloadURL = URL.createObjectURL(new Blob(parts, { type }));
    download.href = downloadURL;
    download.download = type.includes('mp4') ? 'NOXIS-TV.mp4' : 'NOXIS-TV.webm';
    download.hidden = false;
    status.textContent = 'Ready. Use Download video to save it on this device.';
  } catch {
    status.textContent = signal.aborted ? 'Export cancelled.' : 'The export did not finish. Your original files are still available.';
  } finally {
    controller.abort();
    cancelAnimationFrame(frame);
    clip?.pause();
    song.pause();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed') context.close().catch(() => {});
    exportJob = null;
    render();
  }
}

record.addEventListener('click', makeDownload);
cancel.addEventListener('click', () => exportJob?.abort());
if (!canRecord) status.textContent = 'This browser can play your files. Video export is unavailable here.';
render();
