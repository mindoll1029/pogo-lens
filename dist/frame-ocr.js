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

export function readObservation(db,text,iv,trainer) {
 const cp=parseCPText(text.replace(/C\s+P/gi,'CP'));
 const hpMatch=text.match(/(?:\bHP\s*[:：]?\s*)?(\d{1,4})\s*\/\s*(\d{1,4})\s*HP\b/i)
  ||text.match(/\bHP\s*[:：]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);
 const observed={cp,hp:hpMatch?Number(hpMatch[2]):null};
 const lines=new Set(text.split(/[\r\n]+/).flatMap(line=>[
  normalizeName(line),...line.split(/\s+/).map(normalizeName)
 ]).filter(Boolean));
 const matches=db.pokemon.filter(p=>[p.name,p.englishName].some(name=>name&&lines.has(normalizeName(name))));
 const familyNames=new Set(matches.map(p=>normalizeName(p.name.split(' (')[0])));
 const possible=db.pokemon.filter(p=>familyNames.has(normalizeName(p.name.split(' (')[0])));
 const consistent=iv&&cp?possible.filter(p=>inferLevel(db,p,iv,trainer,observed).levels.length):[];
 // CP and HP can distinguish forms with different stats. Never pick an arbitrary form.
 const pokemon=consistent.length===1?consistent[0]:possible.length===1?possible[0]:null;
 return {pokemon,observed};
}

export async function recognizeFrame(canvas,db,iv,trainer) {
 if(location.protocol==='file:')return {pokemon:null,observed:{}};
 const crop=document.createElement('canvas');
 const top=Math.round(canvas.height*.055);
 crop.width=canvas.width;
 crop.height=Math.round(canvas.height*.65)-top;
 crop.getContext('2d').drawImage(canvas,0,top,crop.width,crop.height,0,0,crop.width,crop.height);
 reader??=getReader().catch(error=>{reader=null;throw error});
 const worker=await reader;
 const {data}=await worker.recognize(crop,{tessedit_pageseg_mode:'11'});
 return readObservation(db,data.text,iv,trainer);
}
