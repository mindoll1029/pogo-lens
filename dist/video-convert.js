// On-device converter for videos the browser cannot decode. One worker (and one ffmpeg.wasm instance)
// serves a whole import so long videos can be converted segment by segment with bounded memory.
const loadError='영상 변환 모듈을 불러오지 못했습니다. 사이트 주소로 열어 다시 시도하거나 스크린샷을 사용하세요.';
const abortError=()=>new DOMException('변환을 중지했습니다.','AbortError');
export function createConverter(){
 let worker=null,seq=0;
 const pending=new Map();
 const fail=error=>{
  for(const request of pending.values()){request.cleanup();request.reject(error)}
  pending.clear();
  worker?.terminate();
  worker=null;
 };
 const start=()=>{
  if(worker)return worker;
  worker=new Worker('convert-worker.js',{type:'module'});
  worker.onmessage=({data})=>{
   const request=pending.get(data.id);
   if(!request)return;
   if(data.type==='progress'){request.progress?.(data);return}
   pending.delete(data.id);
   request.cleanup();
   if(data.type==='error')request.reject(Error('영상을 변환하지 못했습니다. ('+data.message+')'));
   else request.resolve(data);
  };
  worker.onerror=event=>{event.preventDefault?.();fail(Error(loadError))};
  return worker;
 };
 const request=(message,{signal,progress}={})=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return}
  let target;
  try{target=start()}catch{reject(Error(loadError));return}
  const id=++seq,abort=()=>fail(abortError());
  signal?.addEventListener('abort',abort,{once:true});
  pending.set(id,{resolve,reject,progress,cleanup:()=>signal?.removeEventListener('abort',abort)});
  target.postMessage({...message,id});
 });
 return {
  async probe(file,{signal}={}){return (await request({type:'probe',file},{signal})).duration},
  // length 0 converts from start to the end of the file.
  async convert(file,{start=0,length=0,duration=length,onProgress,signal}={}){
   let started=false;
   const result=await request({type:'convert',file,start,length},{signal,progress:({time,progress})=>{
    const ratio=duration>0&&time>0?time/1e6/duration:progress;
    // After a seek, ffmpeg's first tick can report the seek position as if the segment were done.
    if(!Number.isFinite(ratio)||!started&&ratio>=.99)return;
    started=true;
    onProgress?.(Math.min(1,Math.max(0,ratio)));
   }});
   return new Blob([result.data],{type:'video/mp4'});
  },
  close(){worker?.terminate();worker=null;pending.clear()}
 };
}
