import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/export ((?:async )?function|const|let)/g,'$1');
const [html,cssSource,app,vision,viewSource,engine,ratings,worker,data,observation,growth,frameOcr]=await Promise.all(['dist/index.html','dist/style.css','dist/app.js','dist/vision.js','dist/result-view.js','dist/engine.js','dist/ratings.js','dist/worker.js','dist/data.json','dist/observation.js','dist/growth.js','dist/frame-ocr.js'].map(read));
let view=viewSource;
for(const badge of ['great','ultra','master']){
 const path='badges/'+badge+'.png';
 const contents=await readFile(new URL('dist/'+path,import.meta.url));
 view=view.replace(path,'data:image/png;base64,'+contents.toString('base64'));
}
const css=cssSource.replace('@import url("./tokens.css");',await read('dist/tokens.css')).replace('@import url("./base.css");',await read('dist/base.css'));
const workerCode=[engine,ratings,observation,worker].map(strip).join('\n');
const dbStart=app.indexOf("const db=await fetch('data.json')"),dbEnd=app.indexOf('\n',dbStart);
if(dbStart<0||dbEnd<0)throw Error('Data import anchor missing');
let main=app.slice(0,dbStart)+'const db='+data+';'+app.slice(dbEnd);
main=strip(main).replace("new Worker('worker.js',{type:'module'})",`new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerCode)}],{type:'text/javascript'})))`);
const script=`const {detect,signature,distance}=(()=>{${strip(vision)};return {detect,signature,distance}})();\nconst {renderResults,candidateKey,leagueBadge}=(()=>{${strip(view)};return {renderResults,candidateKey,leagueBadge}})();\nconst {legalMoves,trainerCap,inferLevel,recognizeCP,digitTemplates,applyGrowth,resetGrowth,evolutionTargets,recognizeFrame}=(()=>{${strip(engine)}\n${strip(observation)}\n${strip(growth)}\n${strip(frameOcr).replace('async function recognizeFrame','async function recognizeFrame')};return {legalMoves,trainerCap,inferLevel,recognizeCP,digitTemplates,applyGrowth,resetGrowth,evolutionTargets,recognizeFrame}})();\n${main}`;
const output=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`).replace('<script type="module" src="app.js"></script>',`<script type="module">${script.replaceAll('</script','<\\/script')}</script>`);
await writeFile(new URL('../go-lens-offline.html',import.meta.url),output);console.log('Created go-lens-offline.html');
