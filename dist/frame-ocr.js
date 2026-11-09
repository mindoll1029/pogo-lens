import {inferLevel} from './observation.js';

let reader;

async function getReader() {
 if(!globalThis.Tesseract) {
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=new URL('ocr/tesseract.min.js',document.baseURI);
   script.onload=resolve;
   script.onerror=reject;
   document.head.append(script);
  });
 }
 const folder=new URL('ocr/',document.baseURI);
 return Tesseract.createWorker('kor+eng',1,{
  workerPath:new URL('worker.min.js',folder).href,
  corePath:new URL('tesseract-core-lstm.wasm.js',folder).href,
  langPath:folder.href.slice(0,-1),
  workerBlobURL:false,
  cacheMethod:'none'
 });
}

const normalizeName=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function readCPDigits(text) {
 const values=new Set();
 for(const line of text.normalize('NFKC').split(/\r?\n/)){
  const digits=line.match(/^\s*[^\d\s]{0,3}\s*(\d(?:[ ,]*\d){1,4})\s*$/)?.[1];
  const value=Number(digits?.replace(/\D/g,''));
  if(value>=10&&value<=20000)values.add(value);
 }
 return values.size===1?[...values][0]:null;
}

export function formAppearance(canvas,species) {
 const sample=document.createElement('canvas');
 sample.width=sample.height=16;
 const ctx=sample.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(canvas,canvas.width*.28,canvas.height*.17,canvas.width*.44,canvas.height*.17,0,0,16,16);
 const pixels=ctx.getImageData(0,0,16,16).data;
 return {species,pixels:Array.from(pixels).filter((_,i)=>i%4!==3)};
}

export function matchAppearance(possible,appearance,references) {
 if(!appearance)return null;
 const scores=possible.map(p=>{
  const samples=references.filter(r=>r.species===p.id&&r.pixels.length===appearance.pixels.length);
  const distance=Math.min(...samples.map(r=>r.pixels.reduce((sum,value,i)=>sum+Math.abs(value-appearance.pixels[i]),0)/r.pixels.length));
  return {p,distance};
 }).sort((a,b)=>a.distance-b.distance);
 // shortcut: compare only close, similarly framed appearances from confirmed local cards.
 return scores[0]?.distance<=8&&scores[1]?.distance-scores[0].distance>=4?scores[0].p:null;
}

export function readObservation(db,text,iv,trainer,{species,cp:knownCP,hp:knownHP,cpText='',state={},appearance,references=[]}={}) {
 text=text.normalize('NFKC');
 const hpMatch=text.match(/(?:\bHP\s*[:：]?\s*)?(\d{1,4})\s*\/\s*(\d{1,4})\s*HP\b/i)
  ||text.match(/\bHP\s*[:：]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);
 const hp=knownHP??(hpMatch?Number(hpMatch[2]):null);
 const lines=new Set(text.split(/[\r\n]+/).flatMap(line=>[
  normalizeName(line),...line.split(/\s+/).map(normalizeName)
 ]).filter(Boolean));
 const family=p=>p.name.split(' (')[0];
 const matches=db.pokemon.filter(p=>[p.name,p.englishName,family(p)].some(name=>name&&lines.has(normalizeName(name))));
 const explicitForms=matches.filter(p=>p.name!==family(p)&&lines.has(normalizeName(p.name)));
 const possible=species?[species]:explicitForms.length===1?explicitForms:matches;
 const cp=knownCP??readCPDigits(cpText);
 const canCheck=iv&&cp&&Number.isInteger(trainer)&&trainer>=1&&trainer<=80;
 const fits=(p,values)=>canCheck&&inferLevel(db,p,values,trainer,{cp,hp},state).levels.length>0;
 const visual=matchAppearance(possible,appearance,references);
 const consistent=possible.filter(p=>fits(p,iv));
 let pokemon=visual||(possible.length===1?possible[0]:consistent.length===1?consistent[0]:null);
 if(!pokemon&&canCheck&&hp&&!consistent.length){
  const offsets=[-1,0,1],nearby=possible.filter(p=>offsets.some(a=>offsets.some(d=>offsets.some(h=>{
   const values=[iv[0]+a,iv[1]+d,iv[2]+h];
   return values.every(value=>value>=0&&value<=15)&&fits(p,values);
  }))));
  if(nearby.length===1)pokemon=nearby[0];
 }
 const names=new Set(possible.map(family));
 return {pokemon,name:pokemon?.name||(names.size===1?[...names][0]:null),observed:{cp,hp},verified:!!pokemon&&!!fits(pokemon,iv)};
}

export async function recognizeFrame(canvas,db,iv,trainer,known={}) {
 // shortcut: standalone file mode uses the existing manual CP reader until OCR assets can be served.
 if(location.protocol==='file:')return {pokemon:null,observed:{}};
 function crop(source,x,y,w,h,zoom=1){
  const image=document.createElement('canvas');
  image.width=Math.round(source.width*w*zoom);
  image.height=Math.round(source.height*h*zoom);
  image.getContext('2d').drawImage(source,source.width*x,source.height*y,source.width*w,source.height*h,0,0,image.width,image.height);
  return image;
 }
 const overview=crop(canvas,0,.025,1,.625);
 const appearance=known.references?.length?formAppearance(canvas):null;
 reader??=getReader().catch(error=>{reader=null;throw error});
 const worker=await reader;
 const read=async image=>(await worker.recognize(image,{tessedit_pageseg_mode:'11'})).data.text;
 let text=await read(overview);
 let result=readObservation(db,text,iv,trainer,known);
 if(!result.name&&!known.species){
  text+='\n'+await read(crop(overview,.12,.39,.76,.53,1.4));
 }
 let cpText='';
 if(!known.cp){
  cpText=await read(crop(overview,.26,.025,.51,.12,2));
  if(!readCPDigits(cpText))cpText=await read(crop(overview,.25,.025,.52,.26,1.6));
 }
 return readObservation(db,text,iv,trainer,{...known,cpText,appearance});
}
