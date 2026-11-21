export const DEFAULTS=Object.freeze({tone:100,echo:0,delay:0.28,reverb:0,volume:0.7,fadeIn:0.25,fadeOut:0.6});
export const PRESETS=Object.freeze({clean:{tone:100,echo:0,delay:0.28,reverb:0},warm:{tone:73,echo:0.10,delay:0.19,reverb:0.28},cosmic:{tone:88,echo:0.4,delay:0.42,reverb:0.42}});
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function selection(start,end,duration){
 if(![start,end,duration].every(Number.isFinite)||start<0||end>duration+0.001||end-start<0.05)throw new Error('Choose an end at least 0.05 seconds after the start, within the audio file.');
 return {start,end:Math.min(end,duration),length:Math.min(end,duration)-start};
}
function set(param,value,time,smooth){if(smooth&&param.setTargetAtTime)param.setTargetAtTime(value,time,0.025);else param.value=value;}
export function scheduleEnvelope(param,when,offset,total,fadeIn,fadeOut){
 const a=clamp(fadeIn,0,total/2),b=clamp(fadeOut,0,total/2);
 const value=t=>Math.min(a?t/a:1,b?(total-t)/b:1,1);
 param.cancelScheduledValues(when);param.setValueAtTime(clamp(value(offset),0,1),when);
 if(a>offset)param.linearRampToValueAtTime(1,when+a-offset);
 if(b&&total-b>offset)param.linearRampToValueAtTime(1,when+total-b-offset);
 if(b)param.linearRampToValueAtTime(0,when+total-offset);
}
export function buildGraph(ctx,buffer,mode,settings){
 const nodes=[],add=n=>(nodes.push(n),n),gain=v=>{const n=add(ctx.createGain());n.gain.value=v;return n;};
 const source=add(ctx.createBufferSource());source.buffer=buffer;
 const direct=gain(1),effect=gain(0),mix=gain(1),envelope=gain(1),volume=gain(settings.volume);
 const tone=add(ctx.createBiquadFilter());tone.type='lowpass';tone.Q.value=0.3;
 source.connect(direct);direct.connect(mix);source.connect(tone);
 const dry=gain(1);tone.connect(dry);dry.connect(effect);
 const delay=add(ctx.createDelay(1)),feedback=gain(0.28),echo=gain(0);
 tone.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(echo);echo.connect(effect);
 const room=gain(0);
 for(const seconds of [0.043,0.059,0.071,0.089]){
  const line=add(ctx.createDelay(1)),damp=add(ctx.createBiquadFilter()),back=gain(0.68),level=gain(0.22);
  line.delayTime.value=seconds;damp.type='lowpass';damp.frequency.value=Math.min(5800,ctx.sampleRate*0.45);damp.Q.value=0.2;
  tone.connect(line);line.connect(damp);damp.connect(back);back.connect(line);damp.connect(level);level.connect(room);
 }
 room.connect(effect);effect.connect(mix);mix.connect(envelope);envelope.connect(volume);volume.connect(ctx.destination);
 function apply(nextMode,p,smooth=true){
  const t=ctx.currentTime,original=nextMode==='original';
  set(direct.gain,original?1:0,t,smooth);set(effect.gain,original?0:1,t,smooth);
  set(tone.frequency,Math.min(500*Math.pow(40,clamp(p.tone,0,100)/100),ctx.sampleRate*0.49),t,smooth);
  set(echo.gain,clamp(p.echo,0,0.65),t,smooth);set(delay.delayTime,clamp(p.delay,0.08,0.75),t,smooth);
  set(room.gain,clamp(p.reverb,0,0.6),t,smooth);set(volume.gain,clamp(p.volume,0,1),t,smooth);
 }
 apply(mode,settings,false);
 return {source,apply,start(when,start,offset,total){scheduleEnvelope(envelope.gain,when,offset,total,settings.fadeIn,settings.fadeOut);source.start(when,start+offset,total-offset);},dispose(){source.onended=null;try{source.stop();}catch{}for(const node of nodes)try{node.disconnect();}catch{}}};
}
export function peaks(buffer,count=1100){
 const result=new Float32Array(count),channels=Array.from({length:Math.min(buffer.numberOfChannels,2)},(_,c)=>buffer.getChannelData(c));
 for(let i=0;i<count;i++){
  const from=Math.floor(i*buffer.length/count),to=Math.max(from+1,Math.floor((i+1)*buffer.length/count)),stride=Math.max(1,Math.floor((to-from)/60));
  for(const data of channels)for(let j=from;j<Math.min(to,data.length);j+=stride)result[i]=Math.max(result[i],Math.abs(data[j]));
 }
 return result;
}
export async function encodeWav(buffer,preventClipping=true,onProgress=()=>{}){
 const channels=Math.min(2,buffer.numberOfChannels),length=buffer.length;
 const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));let peak=0;
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 for(let start=0;start<length;start+=262144){
  const end=Math.min(length,start+262144);
  for(const channel of data)for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(channel[i]));
  onProgress(0.4*end/length);await yieldUI();
 }
 const scale=preventClipping&&peak>0.98?0.98/peak:1;
 const bytes=new ArrayBuffer(44+length*channels*2),view=new DataView(bytes);
 const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*channels*2,true);
 let at=44;
 for(let start=0;start<length;start+=65536){
  const end=Math.min(length,start+65536);
  for(let i=start;i<end;i++)for(let c=0;c<channels;c++){
   const v=clamp(data[c][i]*scale,-1,1);view.setInt16(at,Math.round(v*(v<0?32768:32767)),true);at+=2;
  }
  onProgress(0.4+0.6*end/length);await yieldUI();
 }
 return {bytes,peak,scale};
}
