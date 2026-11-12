// Software video conversion for codecs the browser cannot decode (mainly HEVC in MOV on PCs without
// hardware support). Runs ffmpeg.wasm on this device only; the source file is read in place via WORKERFS.
import createFFmpegCore from './video/ffmpeg-core.js';
let core=null,currentId=null;
const log=[];
async function ready(){
 if(core)return core;
 core=await createFFmpegCore({});
 core.setLogger(({message})=>{log.push(message);if(log.length>60)log.shift()});
 core.setProgress(({progress,time})=>self.postMessage({id:currentId,type:'progress',progress,time}));
 return core;
}
function withInput(file,run){
 const ext=(/\.[a-z0-9]{2,4}$/i.exec(file.name||'')?.[0]||'.mov').toLowerCase();
 core.FS.mkdir('/in');
 core.FS.mount(core.FS.filesystems.WORKERFS,{blobs:[{name:'source'+ext,data:file}]},'/in');
 try{return run('/in/source'+ext)}
 finally{try{core.FS.unmount('/in');core.FS.rmdir('/in')}catch{}}
}
function probe(input){
 core.exec('-hide_banner','-i',input);core.reset();
 const match=/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(log.find(line=>line.includes('Duration:'))||'');
 return match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):NaN;
}
function convert(input,{start=0,length=0,fps=10}){
 const args=['-hide_banner','-nostdin'];
 if(start>0)args.push('-ss',String(start));
 if(length>0)args.push('-t',String(length));
 // Keep near-source resolution: 4:2:0 halves colour detail, and the bar detector needs the maxed (red)
 // bar edges as sharp as native playback. 2304 px is the Windows Media Foundation H.264 height limit.
 args.push('-i',input,'-map','0:v:0','-an','-sn','-dn',
  '-vf',`fps=${fps},scale=w='min(1440,iw)':h='min(2304,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=bicubic`,
  '-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-g',String(fps),
  '-movflags','+faststart','/converted.mp4');
 core.exec(...args);
 const ret=core.ret;core.reset();
 if(ret!==0)throw Error(log.slice(-3).join(' ')||'ffmpeg exit '+ret);
 const data=core.FS.readFile('/converted.mp4');
 core.FS.unlink('/converted.mp4');
 return data;
}
self.onmessage=async({data:{id,type,file,...options}})=>{
 currentId=id;
 try{
  await ready();
  log.length=0;
  if(type==='probe'){self.postMessage({id,type:'done',duration:withInput(file,probe)});return}
  const data=withInput(file,input=>convert(input,options));
  self.postMessage({id,type:'done',data},[data.buffer]);
 }catch(error){
  self.postMessage({id,type:'error',message:String(error?.message||error)});
 }
};
