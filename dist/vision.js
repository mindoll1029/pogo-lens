const ink=(r,g,b)=>(r>155&&g>65&&g<205&&b<150&&r>g*1.2&&g>b*1.12)||(r>180&&g<135&&b>65&&b<195&&r>g*1.7);
export function detect(image,calibration){const {width:w,height:h,data:d}=image;const pixel=(x,y)=>{const i=(Math.round(y)*w+Math.round(x))*4;return ink(d[i],d[i+1],d[i+2])};
 if(calibration){const {x0,x1,ys}=calibration,iv=ys.map(y=>{let last=0,hits=0;for(let x=Math.round(x0*w);x<x1*w;x++){if(pixel(x,y*h)){last=x-x0*w;hits++}}return hits<2?0:Math.min(15,Math.max(0,Math.round((last+1)/((x1-x0)*w)*15)))});const nonempty=ys.filter(y=>{let n=0;for(let x=x0*w;x<x1*w;x+=2)if(pixel(x,y*h))n++;return n>2}).length;return {candidate:nonempty>=2,iv,confidence:'보정 좌표 사용 · 확인 필요'};}
 const bands=[];let active=null;for(let y=Math.floor(h*.42);y<h*.94;y++){let count=0;for(let x=Math.floor(w*.06);x<w*.85;x+=2)if(pixel(x,y))count++;if(count>w*.025){if(!active)active={start:y,end:y};else active.end=y}else if(active){if(active.end-active.start>=2&&active.end-active.start<h*.035)bands.push(active);active=null}}
 for(let i=0;i<bands.length-2;i++){const a=bands[i],b=bands[i+1],c=bands[i+2],gap=b.start-a.start;if(gap>h*.02&&gap<h*.13&&Math.abs(c.start-b.start-gap)<h*.012)return {candidate:true,iv:null,confidence:'조사 막대 후보 · 좌표 보정 필요'};}return {candidate:false};
}
export function signature(image){const {width:w,height:h,data}=image;const a=[];for(let y=1;y<17;y++)for(let x=1;x<10;x++){const i=(Math.floor(h*y/18)*w+Math.floor(w*x/11))*4;a.push(Math.round((data[i]+data[i+1]+data[i+2])/48))}return a;}
export function distance(a,b){return a.reduce((n,x,i)=>n+Math.abs(x-b[i]),0)/a.length;}
