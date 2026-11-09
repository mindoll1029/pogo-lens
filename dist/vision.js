const ink=(r,g,b)=>(r>155&&g>65&&g<205&&b<150&&r>g*1.2&&g>b*1.12)||(r>180&&g<135&&b>65&&b<195&&r>g*1.7);
// Match the entire track, including the unfilled part. A zero IV still has a track.
function appraisalTracks({width:w,height:h,data}) {
 const rows=[];
 const rgb=(x,y)=>4*(y*w+x);
 for(let y=Math.floor(h*.43);y<Math.floor(h*.94);y+=2) {
  let start=-1,last=-1,lastFill=-1,colored=0;
  for(let x=Math.floor(w*.04);x<Math.floor(w*.89);x++) {
   const i=rgb(x,y),r=data[i],g=data[i+1],b=data[i+2];
   const fill=ink(r,g,b);
   const gray=Math.max(r,g,b)-Math.min(r,g,b)<28&&r>=145&&r<=233;
   if(fill||gray) {
    if(start<0)start=x;
    last=x;
    colored+=Number(fill);
    if(fill)lastFill=x;
   }
   if(start<0||x-last<=Math.max(2,w*.008))continue;
   const length=last-start+1;
   if(length>=w*.18&&length<=w*.66&&start<w*.52) {
    const center=Math.round((start+last)/2),up=rgb(center,y-Math.ceil(h*.012)),down=rgb(center,y+Math.ceil(h*.012));
    if(data[up]>=235||data[down]>=235)rows.push({y,start,end:last,lastFill,colored});
   }
   start=-1;
   lastFill=-1;
   colored=0;
  }
 }
 const bands=[];
 for(const row of rows) {
  const band=bands.findLast(b=>row.y-b.at(-1).y<=4&&Math.abs(row.start-b[0].start)<w*.02&&Math.abs(row.end-b[0].end)<w*.02);
  if(band)band.push(row);
  else bands.push([row]);
 }
 const tracks=bands.filter(b=>b.length>=2&&b.at(-1).y-b[0].y<h*.024).map(b=>b[Math.floor(b.length/2)]);
 for(const a of tracks) {
  const aligned=tracks.filter(b=>b.y>a.y&&Math.abs(b.start-a.start)<w*.018&&Math.abs(b.end-a.end)<w*.018);
  for(const b of aligned) {
   const gap=b.y-a.y;
   if(gap<h*.018||gap>h*.09)continue;
   const c=aligned.find(t=>Math.abs(t.y-b.y-gap)<h*.006);
   if(!c||a.colored+b.colored+c.colored<w*.02)continue;
   // Divider lines are inside the fill, so use its endpoint instead of counting colored pixels.
   const iv=[a,b,c].map(t=>Math.max(0,Math.round(15*(t.lastFill-t.start+1)/(t.end-t.start+1))));
   return {candidate:true,iv,confidence:'조사 막대 자동 판독',tracks:true};
  }
 }
 return null;
}
export function detect(image,calibration){const {width:w,height:h,data:d}=image;const pixel=(x,y)=>{const i=(Math.round(y)*w+Math.round(x))*4;return ink(d[i],d[i+1],d[i+2])};
 const automatic=appraisalTracks(image);if(automatic)return automatic;
 if(calibration){const {x0,x1,ys}=calibration,iv=ys.map(y=>{let last=0,hits=0;for(let x=Math.round(x0*w);x<x1*w;x++){if(pixel(x,y*h)){last=x-x0*w;hits++}}return hits<2?0:Math.min(15,Math.max(0,Math.round((last+1)/((x1-x0)*w)*15)))});const nonempty=ys.filter(y=>{let n=0;for(let x=x0*w;x<x1*w;x+=2)if(pixel(x,y*h))n++;return n>2}).length;return {candidate:nonempty>=2,iv,confidence:'보정 좌표 사용 · 확인 필요'};}
 const bands=[];let active=null;for(let y=Math.floor(h*.42);y<h*.94;y++){let count=0;for(let x=Math.floor(w*.06);x<w*.85;x+=2)if(pixel(x,y))count++;if(count>w*.025){if(!active)active={start:y,end:y};else active.end=y}else if(active){if(active.end-active.start>=2&&active.end-active.start<h*.035)bands.push(active);active=null}}
 for(let i=0;i<bands.length-2;i++){const a=bands[i],b=bands[i+1],c=bands[i+2],gap=b.start-a.start;if(gap>h*.02&&gap<h*.13&&Math.abs(c.start-b.start-gap)<h*.012)return {candidate:true,iv:null,confidence:'조사 막대 후보 · 좌표 보정 필요'};}return {candidate:false};
}
export function signature(image){const {width:w,height:h,data}=image;const a=[];for(let y=1;y<17;y++)for(let x=1;x<10;x++){const i=(Math.floor(h*y/18)*w+Math.floor(w*x/11))*4;a.push(Math.round((data[i]+data[i+1]+data[i+2])/48))}return a;}
export function distance(a,b){return a.reduce((n,x,i)=>n+Math.abs(x-b[i]),0)/a.length;}

export function fullBarCorrection(iv,matches){
 const candidates=[iv];
 iv.forEach((value,i)=>{
  if(value===14)candidates.push(...candidates.map(row=>row.map((v,j)=>i===j?15:v)));
 });
 const fitting=candidates.slice(1).filter(matches);
 return fitting.length===1?fitting[0]:null;
}
