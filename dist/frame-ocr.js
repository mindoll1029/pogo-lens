import {inferLevel,parseCPText} from './observation.js';

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

export function readObservation(db,text,iv,trainer,{species,cp:knownCP,hp:knownHP,cpText='',state={}}={}) {
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
 const labelled=[...new Set([parseCPText(text),parseCPText(cpText)].filter(Boolean))];
 const digitLine=cpText.trim().match(/^\d{2,5}$/)?.[0];
 const candidates=knownCP?[knownCP]:[...new Set([...labelled,...(digitLine?[Number(digitLine)]:[])])];
 const compatible=cp=>iv&&Number.isInteger(trainer)&&trainer>=1&&trainer<=80
  ?possible.filter(p=>inferLevel(db,p,iv,trainer,{cp,hp},state).levels.length)
  :[];
 const verified=candidates.filter(cp=>compatible(cp).length);
 const cp=knownCP??(verified.length===1?verified[0]:!verified.length&&labelled.length===1?labelled[0]:null);
 const consistent=cp?compatible(cp):[];
 const pokemon=consistent.length===1?consistent[0]:possible.length===1?possible[0]:null;
 return {pokemon,observed:{cp,hp},verified:consistent.length>0};
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
 reader??=getReader().catch(error=>{reader=null;throw error});
 const worker=await reader;
 const read=async image=>(await worker.recognize(image,{tessedit_pageseg_mode:'11'})).data.text;
 let text=await read(overview),result=readObservation(db,text,iv,trainer,known);
 if(!result.pokemon&&!known.species){
  text+='\n'+await read(crop(overview,.12,.39,.76,.53,1.4));
  result=readObservation(db,text,iv,trainer,known);
 }
 if(!known.cp&&(!result.observed.cp||iv&&result.pokemon&&!result.verified)){
  const cpText=await read(crop(overview,.16,0,.68,.345,1.6));
  result=readObservation(db,text,iv,trainer,{...known,cpText});
 }
 return result;
}
