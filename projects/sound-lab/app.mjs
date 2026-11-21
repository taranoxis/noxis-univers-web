import {DEFAULTS,PRESETS,clamp,selection,buildGraph,peaks,encodeWav} from './audio-engine.mjs';
const $=id=>document.getElementById(id);
const state={buffer:null,file:null,peaks:null,ctx:null,graph:null,mode:'original',cursor:0,playing:false,started:0,base:0,raf:0,busy:false,url:null,playRequest:0};
const fields=['transport-controls','effect-controls','trim-controls','export-controls'];
const seconds=n=>{n=Math.max(0,Number(n)||0);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0');};
const params=()=>Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Number($(k).value)]));
const range=()=>selection(Number($('start').value),Number($('end').value),state.buffer.duration);
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function controls(){for(const id of fields)$(id).disabled=!state.buffer||state.busy;$('file').disabled=state.busy;$('drop').setAttribute('aria-disabled',String(state.busy));$('pause').disabled=!state.playing||state.busy;}
function busy(value,message){state.busy=value;controls();if(message)status(message);}
async function context(){if(!state.ctx||state.ctx.state==='closed'){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('This browser does not support Web Audio. Try a current Chrome, Edge or Firefox.');state.ctx=new C();}return state.ctx;}
function position(){if(!state.playing)return state.cursor;return Math.min(range().length,state.base+state.ctx.currentTime-state.started);}
function invalidateDownload(){if(state.url)URL.revokeObjectURL(state.url);state.url=null;$('download').hidden=true;$('download').removeAttribute('href');$('export-info').textContent='Your original file stays unchanged. Effect tails end with the selected fragment.';}
function labels(){
 const p=params();$('tone-value').textContent=p.tone===100?'Open':Math.round(500*Math.pow(40,p.tone/100))+' Hz';
 $('echo-value').textContent=Math.round(p.echo*100)+'%';$('reverb-value').textContent=Math.round(p.reverb*100)+'%';$('delay-value').textContent=Math.round(p.delay*1000)+' ms';$('volume-value').textContent=Math.round(p.volume*100)+'%';
 $('original').classList.toggle('selected',state.mode==='original');$('effects').classList.toggle('selected',state.mode==='effects');$('original').setAttribute('aria-pressed',String(state.mode==='original'));$('effects').setAttribute('aria-pressed',String(state.mode==='effects'));$('export-mode').textContent=state.mode==='original'?'/ ORIGINAL':'/ EFFECTS';
 for(const b of document.querySelectorAll('[data-preset]'))b.classList.toggle('selected',state.mode==='effects'&&Object.entries(PRESETS[b.dataset.preset]).every(([k,v])=>Math.abs(p[k]-v)<0.001));
 if(state.buffer){const r=range();$('selection-meta').textContent=r.length.toFixed(2)+' SECONDS';$('seek').max=r.length;$('clock').textContent=seconds(position())+' / '+seconds(r.length);}
}
function paint(){
 const canvas=$('wave'),rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const g=canvas.getContext('2d');if(!g)return;g.clearRect(0,0,width,height);
 g.strokeStyle='#223b48';g.lineWidth=1;for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,height*i/4);g.lineTo(width,height*i/4);g.stroke();}
 if(!state.buffer){g.fillStyle='#6f8998';g.font=`${11*ratio}px Segoe UI`;g.textAlign='center';g.fillText('A waveform will appear here',width/2,height/2);return;}
 const r=range(),a=r.start/state.buffer.duration*width,b=r.end/state.buffer.duration*width;
 g.fillStyle='#edc86d0f';g.fillRect(a,0,b-a,height);
 const middle=height*.46,scale=height*.36;
 for(let i=0;i<state.peaks.length;i++){const x=i/(state.peaks.length-1)*width,p=state.peaks[i];g.strokeStyle=x>=a&&x<=b?'#e1be6d':'#526f7e';g.beginPath();g.moveTo(x,middle-Math.max(1,p*scale));g.lineTo(x,middle+Math.max(1,p*scale));g.stroke();}
 g.strokeStyle='#bda061';g.setLineDash([4*ratio,4*ratio]);for(const x of [a,b]){g.beginPath();g.moveTo(x,0);g.lineTo(x,height);g.stroke();}g.setLineDash([]);
 const cursor=(r.start+position())/state.buffer.duration*width;g.strokeStyle='#88e4e1';g.lineWidth=2*ratio;g.beginPath();g.moveTo(cursor,0);g.lineTo(cursor,height);g.stroke();
}
function tick(){labels();$('seek').value=position();paint();if(state.playing)state.raf=requestAnimationFrame(tick);}
function halt(reset=true){
 state.playRequest++;
 const p=state.playing?position():state.cursor;state.playing=false;cancelAnimationFrame(state.raf);
 if(state.graph){state.graph.dispose();state.graph=null;}state.cursor=reset?0:p;
 controls();labels();$('seek').value=state.cursor;paint();
}
async function play(){
 if(!state.buffer||state.busy||state.playing)return;
 const request=++state.playRequest;
 try{
  const ctx=await context();await ctx.resume();if(request!==state.playRequest||state.busy||state.playing)return;
  const r=range();if(state.cursor>=r.length-.01)state.cursor=0;
  state.graph=buildGraph(ctx,state.buffer,state.mode,params());
  const graph=state.graph;state.base=state.cursor;state.started=ctx.currentTime;state.playing=true;
  graph.source.onended=()=>{if(state.graph!==graph)return;halt(true);status('Selection finished. Try A/B or keep your experiment.');};
  graph.start(state.started,r.start,state.cursor,r.length);controls();status(state.mode==='original'?'Listening to A · Original.':'Listening to B · With effects.');tick();
 }catch(error){halt(false);status('Playback failed: '+error.message,true);}
}
function mode(value){state.mode=value;if(state.graph)state.graph.apply(state.mode,params());labels();invalidateDownload();if(state.playing)status(value==='original'?'Listening to A · Original.':'Listening to B · With effects.');}
async function load(file){
 if(!file||state.busy)return;
 if(file.size>80*1024*1024){status('Choose an audio file up to 80 MB.',true);return;}
 halt();busy(true,'Opening your audio locally…');
 try{
  const ctx=await context(),buffer=await ctx.decodeAudioData(await file.arrayBuffer());
  if(buffer.duration>600)throw new Error('Choose a file up to 10 minutes long.');
  if(buffer.duration<0.05)throw new Error('The file is too short to select a fragment.');
  state.buffer=buffer;state.file=file;state.peaks=peaks(buffer);state.cursor=0;
  $('start').value=0;$('end').value=(Math.floor(Math.min(30,buffer.duration)*1000)/1000).toFixed(3);state.lastSelection={start:0,end:Number($('end').value)};$('end').max=buffer.duration;$('start').max=buffer.duration;
  $('file-name').textContent=file.name;$('file-hint').textContent='Click to replace · your original stays unchanged';
  $('file-meta').textContent=seconds(buffer.duration)+' · '+Math.round(buffer.sampleRate/100)/10+' kHz · '+buffer.numberOfChannels+' CH';
  invalidateDownload();status('Audio ready. Play A, then try a preset and compare B.');
 }catch(error){status('Could not open this audio: '+error.message+' Try WAV or MP3 if the format is unsupported.',true);}
 finally{busy(false);labels();paint();$('file').value='';}
}
function setSelection(full=false){
 if(!state.buffer||state.busy)return;
 const old=state.lastSelection||{start:0,end:Math.min(30,state.buffer.duration)};
 if(full){$('start').value=0;$('end').value=state.buffer.duration.toFixed(3);}
 try{const r=range();state.lastSelection={start:r.start,end:r.end};halt();invalidateDownload();labels();paint();status('Selected '+r.length.toFixed(2)+' seconds.'+(r.length>300?' Choose 5 minutes or less before exporting.':''));}
 catch(error){$('start').value=old.start;$('end').value=old.end;status(error.message,true);}
}
async function exportAudio(){
 if(!state.buffer||state.busy)return;
 let r;try{r=range();if(r.length>300.001)throw new Error('Export up to 5 minutes at a time. Shorten the selected fragment.');}catch(error){status(error.message,true);return;}
 halt();const p=params(),selectedMode=state.mode;busy(true,'Rendering your '+seconds(r.length)+' selection locally…');invalidateDownload();
 try{
  const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!C)throw new Error('Offline audio rendering is unavailable in this browser.');
  const ctx=new C(2,Math.ceil(r.length*44100),44100),graph=buildGraph(ctx,state.buffer,selectedMode,p);
  graph.start(0,r.start,0,r.length);let rendered;try{rendered=await ctx.startRendering();}finally{graph.dispose();}
  status('Encoding the WAV…');
  const result=await encodeWav(rendered,$('protect').checked,progress=>{$('export').firstChild.textContent='Encoding '+Math.round(progress*100)+'% ';});
  const blob=new Blob([result.bytes],{type:'audio/wav'});state.url=URL.createObjectURL(blob);
  const base=state.file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,75)||'noxis';
  const a=$('download');a.href=state.url;a.download=base+'-'+selectedMode+'-'+r.start.toFixed(1)+'-'+r.end.toFixed(1)+'.wav';a.hidden=false;a.click();
  $('export-info').textContent='WAV ready · '+(blob.size/1024/1024).toFixed(1)+' MB · '+r.length.toFixed(2)+' s · '+(result.scale<1?'export level reduced by '+(-20*Math.log10(result.scale)).toFixed(1)+' dB to prevent clipping.':'export level unchanged.');
  status('Your experiment is ready. Use Download WAV again if the download did not start.');
 }catch(error){status('Export failed: '+error.message,true);}
 finally{$('export').firstChild.textContent='↓ Export WAV ';busy(false);labels();}
}
$('file').onchange=()=>load($('file').files[0]);$('drop').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!state.busy){e.preventDefault();$('file').click();}};
$('drop').onclick=e=>{if(state.busy)e.preventDefault();};
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();if(!state.busy)$('drop').classList.add('over');});
$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');load(e.dataTransfer.files[0]);};
$('play').onclick=play;$('pause').onclick=()=>{halt(false);status('Paused. Play continues from this position.');};$('stop').onclick=()=>{halt();status('Stopped. Selection rewound.');};
$('original').onclick=()=>mode('original');$('effects').onclick=()=>mode('effects');
for(const id of ['tone','echo','delay','reverb','volume'])$(id).oninput=()=>{if(state.graph)state.graph.apply(state.mode,params());labels();invalidateDownload();};
for(const id of ['fadeIn','fadeOut'])$(id).onchange=()=>{const value=Number($(id).value);$(id).value=Number.isFinite(value)?clamp(value,0,10):DEFAULTS[id];const wasPlaying=state.playing;halt(false);invalidateDownload();if(wasPlaying)play();};
for(const id of ['start','end'])$(id).onchange=()=>setSelection();$('full').onclick=()=>setSelection(true);
$('seek').onchange=()=>{if(!state.buffer)return;const wasPlaying=state.playing,wanted=Number($('seek').value);halt(false);state.cursor=clamp(wanted,0,range().length);$('seek').value=state.cursor;labels();paint();if(wasPlaying)play();};
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{for(const [key,value] of Object.entries(PRESETS[button.dataset.preset]))$(key).value=value;mode('effects');status(button.textContent+' selected. Play B, then compare with A.');};
$('reset').onclick=()=>{for(const [key,value] of Object.entries(PRESETS.clean))$(key).value=value;mode('effects');status('Effects reset. Selection, fades and volume kept.');};
$('export').onclick=exportAudio;$('protect').onchange=invalidateDownload;
$('back').onclick=e=>{if(document.referrer){try{const u=new URL(document.referrer);if(u.origin===location.origin&&!u.pathname.includes('/sound-lab/')){e.preventDefault();history.back();}}catch{}}};
window.addEventListener('resize',paint);window.addEventListener('pagehide',()=>{halt();invalidateDownload();state.ctx?.close().catch(()=>{});});
labels();controls();paint();
