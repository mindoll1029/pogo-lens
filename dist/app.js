import {detect,signature,distance} from './vision.js';
import {applyGrowth,resetGrowth,evolutionTargets} from './growth.js';
import {recognizeFrame} from './frame-ocr.js';
import {renderResults,candidateKey,leagueBadge} from './result-view.js';
import {legalMoves,trainerCap,inferLevel,recognizeCP,digitTemplates} from './observation.js';
const $=s=>document.querySelector(s), el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const db=await fetch('data.json').then(r=>{if(!r.ok)throw Error('DB 로드 실패');return r.json()});
const storage=await new Promise((resolve,reject)=>{const r=indexedDB.open('go-lens-private',1);r.onupgradeneeded=()=>r.result.createObjectStore('cards',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}).catch(()=>null);
let editCalSnapshot=null;
let editing=false,saving=false,draftPvpUse='',editRevision=0;
let cards=[],selected=null,cancel=false,busy=false,videoURL=null,cal=null,calpoints=null,job=0;
try{cal=JSON.parse(localStorage.getItem('go-lens-cal')||'null')}catch{}
try{$('#trainer').value=Number(localStorage.getItem('go-lens-trainer'))||''}catch{}
function status(s){$('#status').textContent=s}
$('.textlink').onclick=()=>{$('#guide').open=true};
async function transaction(mode,fn){if(!storage)throw Error('기기 저장소를 사용할 수 없습니다.');return new Promise((resolve,reject)=>{const t=storage.transaction('cards',mode),req=fn(t.objectStore('cards'));let value;req.onsuccess=()=>value=req.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}
async function save(card){try{await transaction('readwrite',s=>s.put(card));}catch{status('기기 저장에 실패했습니다. 이 탭을 닫으면 이 카드가 사라질 수 있습니다.')}const i=cards.findIndex(x=>x.id===card.id),root=$('#cards');
 const item=renderCard(card);
 if(i<0){
  cards.push(card);
  root.prepend(item);
 }else{
  cards[i]=card;
  const current=root.children[cards.length-1-i];
  current.replaceChildren(...item.childNodes);
  current.onclick=item.onclick;
 }
 syncCollection();
 }
function syncCollection(){
 $('#count').textContent=cards.length;
 $('#empty').hidden=cards.length>0;
 $('#clear').disabled=!cards.length||busy;
}
function render(){
 $('#cards').replaceChildren(...cards.slice().reverse().map(renderCard));
 syncCollection();
}
function renderCard(c){const b=el('button','card');b.type='button';const img=el('img','card-shot');img.loading='lazy';img.decoding='async';img.src=c.image;img.alt=c.demo?'예제 조사 화면':`조사 화면 ${c.time?.toFixed(1)||0}초`;b.append(img);const body=el('div','cardbody');body.append(el('h3',null,db.pokemon.find(p=>p.id===c.species)?.name||'포켓몬 미확인'));const line=el('div','ivline');
 if(c.iv?.every(Number.isInteger)){
  const percent=c.iv.reduce((sum,value)=>sum+value,0)/45*100;
  line.append(el('strong',null,c.iv.join(' / ')),el('small',null,percent.toFixed(1)+'% IV'));
 }else line.append(el('strong',null,'IV 확인 필요'));
 body.append(line);
 const trainer=Number($('#trainer').value)||c.trainer,pokemon=db.pokemon.find(p=>p.id===c.species);
 if(pokemon&&c.iv&&Number.isInteger(trainer)&&trainer>=1&&trainer<=80){
  const estimate=inferLevel(db,pokemon,c.iv,trainer,c.observed,{purified:c.purified});
  const level=estimate.level??(estimate.status==='range'?estimate.levels[0]+'–'+estimate.levels.at(-1):null);
  body.append(el('p','card-level',level?'레벨 '+level:'레벨 확인 필요'));
 }if(c.preview?.length){const badges=el('div','cardpreviews');for(const x of c.preview)badges.append(leagueBadge(x.cap,db.pokemon.find(p=>p.englishName===x.name)?.name||x.name,x.percentile));body.append(badges)}b.append(body);b.onclick=()=>open(c);return b;}
try{cards=await transaction('readonly',s=>s.getAll());render()}catch{status('기기 저장소를 사용할 수 없습니다. 분석한 카드는 이 탭에서만 볼 수 있습니다.')}
const worker=new Worker('worker.js',{type:'module'}),pending=new Map();worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(data.error)):p.resolve(data.result)}};worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('분석 작업을 실행하지 못했습니다. 페이지를 새로 열어 주세요.'))}pending.clear()};
function calculate(data){return new Promise((resolve,reject)=>{const id=++job,timer=setTimeout(()=>{pending.delete(id);reject(Error('계산 시간이 초과되었습니다. 다시 시도해 주세요.'))},60000);pending.set(id,{resolve,reject,timer});worker.postMessage(id===1?{id,db,...data}:{id,...data})})}
function options(select,items,placeholder){select.replaceChildren();if(placeholder){const o=el('option',null,placeholder);o.value='';select.append(o)}for(const [value,label] of items){const o=el('option',null,label);o.value=value;select.append(o)}}
function speciesOptions(query='',value=''){const list=db.pokemon.filter(p=>`${p.name} ${p.englishName||''} ${p.id} ${p.dex}`.toLowerCase().includes(query.toLowerCase()));options($('#species'),list.map(p=>[p.id,`${p.name} / #${p.dex}`]),'종·폼을 직접 선택하세요');if(list.some(p=>p.id===value))$('#species').value=value;}
function getState(){return {shadow:$('#state-shadow').checked,purified:$('#state-purified').checked,lucky:$('#state-lucky').checked}}
function moveOptions(p,fast='',charged=''){const allowed=!!p?.shadowAllowed&&!p?.mega;for(const k of ['shadow','purified']){$('#state-'+k).disabled=!allowed;if(!allowed)$('#state-'+k).checked=false}let moves={fast:[],charged:[]};if(p)moves=legalMoves(db,p,getState());const label=k=>`${db.moves[k]?.name||'이름 확인 필요'}${p?.elite?.includes(k)?' / 한정/레거시':''}`;options($('#fast'),moves.fast.map(k=>[k,label(k)]),'실제 보유 기술 선택');options($('#charged'),moves.charged.map(k=>[k,label(k)]),'실제 보유 기술 선택');if(moves.fast.includes(fast))$('#fast').value=fast;if(moves.charged.includes(charged))$('#charged').value=charged;}

let imageObj=null;async function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('이미지를 읽을 수 없습니다.'));i.src=src})}
async function open(c){editing=false;editRevision++;draftPvpUse=c.pvpUse||'';if(!$('#trainer').value&&c.trainer)$('#trainer').value=c.trainer;selected=c;calpoints=null;cpPoints=null;$('#search').value='';const pokemon=db.pokemon.find(p=>p.id===c.species);options($('#species'),pokemon?[[pokemon.id,pokemon.name]]:[],null);$('#state-shadow').checked=c.shadow||false;$('#state-purified').checked=c.purified||false;$('#state-lucky').checked=c.lucky||false;moveOptions(db.pokemon.find(p=>p.id===c.species),c.fast,c.charged);['atk','def','hp'].forEach((k,i)=>$('#'+k).value=c.iv?.[i]??0);syncIV();$('#iv-confirm').checked=!!c.iv;$('#observed-cp').value=c.observed?.cp||'';$('#observed-hp').value=c.observed?.hp||'';$('#threshold').value=c.threshold??90;$('#cpfloor').value=(c.cpFloor??.9)*100;showError('');$('#results').replaceChildren();$('#calhelp').textContent=c.confidence||'조사 막대를 확인하고 IV 슬라이더를 조정하세요.';applyEditMode();$('#edit').disabled=true;const detail=$('#detail'),revision=editRevision;
 $('#card-fields').open=false;
 $('#source-panel').open=!matchMedia('(max-width: 760px)').matches;
 $('#pokemon-name').textContent=pokemon?.name||'포켓몬 미확인';
 const willAnalyze=c.confirmed&&validTrainer();
 resultStatus(willAnalyze?'분석 결과를 불러오는 중입니다…':!c.confirmed?'수정하기에서 포켓몬과 IV를 확인한 뒤 저장하면 리그 결과를 볼 수 있습니다.':'설정에서 트레이너 레벨을 저장해 주세요.');
 if(!detail.open)detail.showModal();
 detail.scrollTop=0;
 const shot=$('#shot');
 shot.hidden=true;
 imageObj=null;
 try{
  const image=await loadImage(c.image);
  if(revision!==editRevision||!detail.open)return;
  imageObj=image;
  shot.hidden=false;
  draw();
  if(!c.observed?.cp)readCP();
 }catch{
  if(revision!==editRevision||!detail.open)return;
  $('#calhelp').textContent='저장된 스크린샷을 열 수 없습니다.';
 }
 updateGrowthSummary();
 if(willAnalyze)await analyze(false);
 if(selected?.id!==c.id||!detail.open)return;
 applyEditMode();
 $('#edit').disabled=false;
 }

function draw(){const cv=$('#shot');cv.width=imageObj.naturalWidth;cv.height=imageObj.naturalHeight;const ctx=cv.getContext('2d');ctx.drawImage(imageObj,0,0);if(calpoints){ctx.fillStyle='#00ddff';for(const [x,y] of calpoints){ctx.beginPath();ctx.arc(x*cv.width,y*cv.height,7,0,Math.PI*2);ctx.fill()}}}
$('#search').oninput=e=>speciesOptions(e.target.value,$('#species').value);$('#species').onchange=()=>{$('#species-apply').disabled=!$('#species').value};
$('#calibrate').onclick=()=>{cpPoints=null;calpoints=[];$('#calhelp').textContent='1/5 / 첫 막대의 왼쪽 시작점을 클릭하세요 (빈 부분 포함 전체 길이 기준).';draw()};
$('#shot').onclick=e=>{if(!editing||!calpoints)return;const cv=$('#shot'),r=cv.getBoundingClientRect(),scale=Math.min(r.width/cv.width,r.height/cv.height),dw=cv.width*scale,dh=cv.height*scale,x=(e.clientX-r.left-(r.width-dw)/2)/dw,y=(e.clientY-r.top-(r.height-dh)/2)/dh;if(x<0||x>1||y<0||y>1)return;calpoints.push([x,y]);draw();const prompts=['','첫 막대의 오른쪽 끝을 클릭하세요 (15 IV 길이).','공격 막대 중앙을 클릭하세요.','방어 막대 중앙을 클릭하세요.','HP 막대 중앙을 클릭하세요.'];if(calpoints.length<5){$('#calhelp').textContent=`${calpoints.length+1}/5 / ${prompts[calpoints.length]}`;return}const [a,b,c,d,h]=calpoints;if(b[0]-a[0]<.1||!(c[1]<d[1]&&d[1]<h[1])){$('#calhelp').textContent='좌표 순서가 올바르지 않습니다. 보정을 다시 시작하세요.';calpoints=null;return}cal={x0:a[0],x1:b[0],ys:[c[1],d[1],h[1]]};calpoints=null;draw();const result=detect(cv.getContext('2d').getImageData(0,0,cv.width,cv.height),cal);['atk','def','hp'].forEach((k,i)=>$('#'+k).value=result.iv[i]);syncIV();$('#iv-confirm').checked=false;updateEstimate();$('#calhelp').textContent='좌표 보정 완료. 판독한 IV를 확인하고 저장하세요. 같은 화면 배치에서만 유효합니다.'};
function metric(title,value,sub,right){const n=el('div','metric'),a=el('div');a.append(el('small',null,title),el('strong',null,value),el('small',null,sub));n.append(a);if(right){const b=el('div','right');b.append(el('strong',null,right[0]),el('small',null,right[1]));n.append(b)}return n}
async function analyze(persist=true){if(persist&&!editing)return;const revision=editRevision,c=selected;showError('');try{const p=db.pokemon.find(p=>p.id===$('#species').value);if(!p)throw Error('종과 폼을 선택하세요.');if(!$('#iv-confirm').checked)throw Error('조사 막대를 확인한 뒤 IV 확인에 체크하세요.');const iv=['atk','def','hp'].map(k=>Number($('#'+k).value)),trainer=Number($('#trainer').value),state=getState(),max=50,threshold=Number($('#threshold').value),cpFloor=Number($('#cpfloor').value)/100;if(!validTrainer()){if(persist)openSettings();return}legalMoves(db,p,state);if(!Number.isFinite(threshold)||threshold<0||threshold>100||cpFloor<0||cpFloor>1)throw Error('기준은 0–100%로 입력하세요.');const observed={cp:Number($('#observed-cp').value)||null,hp:Number($('#observed-hp').value)||null};if(c.observed?.calculatedLevel&&c.observed.cp===observed.cp&&c.observed.hp===observed.hp)observed.calculatedLevel=c.observed.calculatedLevel;if(observed.cp&&(!Number.isInteger(observed.cp)||observed.cp<10||observed.cp>20000)||observed.hp&&(!Number.isInteger(observed.hp)||observed.hp<10||observed.hp>2000))throw Error('CP·HP는 화면에 보이는 정수로 입력하세요.');const inference=inferLevel(db,p,iv,trainer,observed,state),level=inference.level,data={p,iv,trainer,observed,...state,max,threshold,cpFloor,fast:$('#fast').value,charged:$('#charged').value};if(persist){saving=true;applyEditMode()}$('#analyze').disabled=true;$('#analyze').textContent='레벨 / 진화 후보 / 기술 비교 중…';const r=await calculate(data);if(selected?.id!==c.id||revision!==editRevision)return;const updated={...c,pvpUse:draftPvpUse,species:p.id,iv,trainer,observed,...state,level:undefined,max:undefined,threshold,cpFloor,fast:data.fast,charged:data.charged,confirmed:true,preview:r.previews.map(x=>({name:x.name,cap:x.cap,state:x.state,percentile:x.percentile}))};if(persist){await save(updated);selected=updated;try{if(cal)localStorage.setItem('go-lens-cal',JSON.stringify(cal))}catch{}}resultStatus('');renderResults($('#results'),r,{...data,level,inference,db,card:updated,onFlag:value=>{if(editing)draftPvpUse=value},onTable:async candidate=>calculate({mode:'table',p:db.pokemon.find(x=>x.id===candidate.species),cap:candidate.cap,max:50})});if(persist){editing=false;editRevision++;$('#card-fields').open=false;$('#source-panel').open=!matchMedia('(max-width: 760px)').matches;$('#detail').scrollTop=0}applyEditMode();}catch(e){if(revision===editRevision){if(persist)showError(e.message);else resultStatus('분석 결과를 열 수 없습니다. 카드를 다시 열거나 정보를 확인해 주세요.')}}finally{saving=false;applyEditMode();$('#analyze').disabled=false;$('#analyze').textContent='수정 저장 / 분석하기'}}

$('#analyze').onclick=()=>analyze();
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
$('#download').onclick=()=>{const a=el('a');a.href=selected.image;a.download=`go-lens-${selected.id}.jpg`;a.click()};
$('#delete').onclick=async()=>{if(!editing)return;if(!selected||!confirm('이 카드와 스크린샷을 기기에서 삭제할까요?'))return;try{await transaction('readwrite',s=>s.delete(selected.id))}catch{}cards=cards.filter(c=>c.id!==selected.id);$('#detail').close();render()};
$('#clear').onclick=async()=>{if(busy){status('분석을 중지한 뒤 삭제하세요.');return}if(!confirm('이 기기의 모든 분석 카드와 보정 좌표를 삭제할까요?'))return;try{await transaction('readwrite',s=>s.clear())}catch{}cards=[];cal=null;try{localStorage.removeItem('go-lens-cal')}catch{}render();status('기기에 저장된 카드와 보정 좌표를 삭제했습니다.')};
const canvas=document.createElement('canvas');function frame(source){const w=source.videoWidth||source.naturalWidth,h=source.videoHeight||source.naturalHeight;if(!w||!h)throw Error('영상/이미지 프레임을 읽지 못했습니다.');canvas.width=Math.min(w,720);canvas.height=Math.round(h*canvas.width/w);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,canvas.width,canvas.height);return ctx.getImageData(0,0,canvas.width,canvas.height)}
async function addFrame(source,time=0,force=false){
 const pixels=frame(source),detected=detect(pixels,cal);
 if(!force&&!detected.candidate)return false;
 const sig=signature(pixels);
 if(!force&&cards.slice(-30).some(c=>c.sig&&distance(c.sig,sig)<.12))return false;
 const image=canvas.toDataURL('image/jpeg',.84);
 const iv=detected.candidate?detected.iv:null;
 const trainer=Number($('#trainer').value);
 const card={id:crypto.randomUUID(),image,time,iv,confidence:detected.confidence||'조사 화면을 확인하세요.',sig,confirmed:false};
 if(detected.candidate){
  try{
   const {pokemon,observed}=await recognizeFrame(canvas,db,iv,trainer);
   card.observed=observed;
   if(pokemon)card.species=pokemon.id;
   if(pokemon&&iv&&detected.tracks){
    const inference=inferLevel(db,pokemon,iv,trainer,observed);
    if(['matched','range'].includes(inference.status)){
     const result=await calculate({mode:'preview',p:pokemon,iv,observed,trainer});
     card.confirmed=true;
     card.preview=result.previews;
     card.trainer=trainer;
    }
   }
  }catch{
   card.confidence='자동 판독을 완료하지 못했습니다. 수정하기에서 확인하세요.';
  }
 }
 await save(card);
 return true;
}
function waitVideo(v,event,action){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('영상을 읽는 시간이 초과되었습니다. MP4 또는 스크린샷으로 다시 시도하세요.')),20000),ok=()=>finish(),bad=()=>finish(Error('이 브라우저가 영상 코덱을 재생하지 못합니다. H.264 MP4 또는 스크린샷을 사용하세요.'));function finish(err){clearTimeout(timer);v.removeEventListener(event,ok);v.removeEventListener('error',bad);err?reject(err):resolve()}v.addEventListener(event,ok,{once:true});v.addEventListener('error',bad,{once:true});action()})}
$('#stop').onclick=()=>{cancel=true;status('현재 프레임 처리 후 중지합니다. 저장된 카드는 유지됩니다.')};
$('#capture').onclick=async()=>{if(busy)return;try{await addFrame($('#video'),$('#video').currentTime,true);status('현재 장면을 저장했습니다. 카드를 선택해 교정하세요.')}catch(e){status(e.message)}};
let queuedFiles=[];
async function importFiles(files){if(busy||!files.length)return;if(!validTrainer()){queuedFiles=files;openSettings();return}busy=true;cancel=false;syncCollection();status('파일을 읽는 중입니다…');$('#progress').removeAttribute('value');$('#files').disabled=true;$('#stop').hidden=false;$('#progress').hidden=false;let n=0;try{for(const file of files){if(cancel)break;if(file.type.startsWith('image/')||/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)){const url=URL.createObjectURL(file);try{const img=await loadImage(url);await addFrame(img,0,true);n++}finally{URL.revokeObjectURL(url)}continue}if(!file.type.startsWith('video/')&&!/\.(mp4|mov|m4v)$/i.test(file.name)){status('영상 또는 이미지 파일만 선택하세요.');continue}if(file.size>1024**3)throw Error('영상은 1GB 이하로 나누어 선택하세요.');if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);const v=$('#video');await waitVideo(v,'loadedmetadata',()=>{v.src=videoURL;v.load()});$('#videoPanel').hidden=false;if(!Number.isFinite(v.duration)||v.duration>900)throw Error('MVP는 최대 15분 영상까지 지원합니다. 짧게 나누어 주세요.');v.pause();const step=Number($('#interval').value);for(let t=.05;t<v.duration&&!cancel;t+=step){await waitVideo(v,'seeked',()=>v.currentTime=Math.min(t,v.duration-.001));if(await addFrame(v,t))n++;$('#progress').value=t/v.duration;status(`${Math.floor(t)} / ${Math.floor(v.duration)}초 확인 / 새 카드 ${n}개 / 화면을 열어 두세요.`);await new Promise(r=>setTimeout(r,0))}}status(`${cancel?'중지':'분석 완료'} / 새 카드 ${n}개. ${n?'자동 분석 결과를 확인하세요. 확인이 필요한 값은 카드에서 수정할 수 있습니다.':'탐지된 화면이 없으면 미리보기에서 직접 저장하거나 스크린샷을 추가하세요.'}`)}catch(e){status(e.message)}finally{busy=false;syncCollection();$('#files').disabled=false;$('#files').value='';$('#stop').hidden=true;$('#progress').hidden=true}}
$('#files').onchange=e=>importFiles([...e.target.files]);const drop=$('#drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');importFiles([...e.dataTransfer.files])};
$('#demo').onclick=async()=>{if(!$('#trainer').value)$('#trainer').value=40;const cv=document.createElement('canvas');cv.width=390;cv.height=720;const c=cv.getContext('2d');c.fillStyle='#e9eee0';c.fillRect(0,0,390,720);c.fillStyle='#456347';c.font='20px sans-serif';c.fillText('CP1400',135,65);c.font='16px sans-serif';c.fillText('예제 / 마릴리',40,100);c.font='100px sans-serif';c.fillText('◎',145,240);c.fillStyle='#fffdf5';c.fillRect(28,350,334,300);c.fillStyle='#3e5c42';c.font='18px sans-serif';c.fillText('EXAMPLE / 0 / 15 / 15',48,390);['ATTACK','DEFENSE','HP'].forEach((t,i)=>{c.fillStyle='#50684a';c.font='12px sans-serif';c.fillText(t,48,428+i*60);c.fillStyle='#e3e5d9';c.fillRect(48,440+i*60,270,10);if(i){c.fillStyle='#ec9a48';c.fillRect(48,440+i*60,270,10)}});await save({id:crypto.randomUUID(),image:cv.toDataURL('image/jpeg'),demo:true,species:'azumarill',iv:[0,15,15],observed:{cp:1400},trainer:40,confirmed:true,confidence:'예제 데이터 / 실제 포켓몬 아님',time:0});status('예제 카드를 추가했습니다. 선택하면 계산 결과를 볼 수 있습니다.')};


$('.editor').addEventListener('input',e=>{if(!editing)return;editRevision++;if(!e.target.closest('#results'))$('#results').replaceChildren()});

const cpCanvas=document.createElement('canvas');let templates;let cpPoints=null;
function syncIV(){for(const k of ['atk','def','hp'])$('#'+k+'-value').textContent=editing||selected?.iv?$('#'+k).value:'?'}
function updateEstimate(){const p=db.pokemon.find(p=>p.id===$('#species').value);$('#pokemon-name').textContent=p?.name||'포켓몬 미확인';if(!p||!validTrainer())return null;try{return inferLevel(db,p,['atk','def','hp'].map(k=>Number($('#'+k).value)),Number($('#trainer').value),{cp:$('#observed-cp').value,hp:$('#observed-hp').value},getState())}catch{return null}}
function readCP(rect={x0:.2,y0:.065,x1:.82,y1:.22}){if(!imageObj)return;$('#results').replaceChildren();const w=imageObj.naturalWidth,h=imageObj.naturalHeight;cpCanvas.width=500;cpCanvas.height=Math.min(500,Math.max(24,Math.round((rect.y1-rect.y0)*h/((rect.x1-rect.x0)*w)*500)));const ctx=cpCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(imageObj,rect.x0*w,rect.y0*h,(rect.x1-rect.x0)*w,(rect.y1-rect.y0)*h,0,0,cpCanvas.width,cpCanvas.height);const r=recognizeCP(ctx.getImageData(0,0,cpCanvas.width,cpCanvas.height),templates??=digitTemplates(document.createElement('canvas')));if(r){$('#observed-cp').value=r.cp;$('#calhelp').textContent='CP 자동 판독 '+r.cp+' / '+r.confidence+' / 원본과 비교해 주세요.'}else $('#calhelp').textContent='CP를 읽지 못했습니다. CP 영역을 선택하거나 화면의 CP를 교정 입력하세요.';updateEstimate();return r}
for(const k of ['atk','def','hp'])$('#'+k).oninput=()=>{syncIV();$('#iv-confirm').checked=true;updateEstimate()};for(const k of ['observed-cp','observed-hp'])$('#'+k).oninput=updateEstimate;
for(const k of ['shadow','purified','lucky'])$('#state-'+k).onchange=()=>{if($('#state-'+k).checked){if(k==='shadow'){$('#state-purified').checked=false;$('#state-lucky').checked=false}else $('#state-shadow').checked=false}const f=$('#fast').value,c=$('#charged').value;moveOptions(db.pokemon.find(p=>p.id===$('#species').value),f,c);updateEstimate()};
$('#cp-read').onclick=()=>readCP();$('#cp-crop').onclick=()=>{cpPoints=[];calpoints=null;$('#calhelp').textContent='CP 숫자만 포함하는 영역의 왼쪽 위, 오른쪽 아래를 차례로 클릭하세요.'};const ivClick=$('#shot').onclick;$('#shot').onclick=e=>{if(!editing)return;if(!cpPoints)return ivClick(e);const cv=$('#shot'),r=cv.getBoundingClientRect(),scale=Math.min(r.width/cv.width,r.height/cv.height),dw=cv.width*scale,dh=cv.height*scale,x=(e.clientX-r.left-(r.width-dw)/2)/dw,y=(e.clientY-r.top-(r.height-dh)/2)/dh;if(x<0||x>1||y<0||y>1)return;cpPoints.push([x,y]);if(cpPoints.length===1){$('#calhelp').textContent='CP 숫자 영역의 오른쪽 아래를 클릭하세요.';return}const [a,b]=cpPoints;cpPoints=null;if(b[0]-a[0]<.03||b[1]-a[1]<.005){$('#calhelp').textContent='영역이 너무 작습니다. CP 영역을 다시 선택하세요.';return}readCP({x0:a[0],y0:a[1],x1:b[0],y1:b[1]})};




function applyEditMode(){const dialog=$('#detail');dialog.classList.toggle('editing',editing);syncIV();for(const control of dialog.querySelectorAll('.editor input,.editor select,.editor textarea'))control.disabled=!editing||saving;for(const id of ['calibrate','cp-crop','cp-read','delete'])$('#'+id).hidden=!editing;$('#analyze').hidden=!editing;$('#edit').hidden=editing;$('#cancel-edit').hidden=!editing;$('#cancel-edit').disabled=saving;for(const id of ['calibrate','cp-crop','cp-read','delete'])$('#'+id).disabled=saving;$('#choose-species').hidden=!editing;$('#evolve').hidden=editing;$('#power-up').hidden=editing;$('#growth-reset').disabled=saving;if(editing&&!saving){const f=$('#fast').value,c=$('#charged').value;moveOptions(db.pokemon.find(p=>p.id===$('#species').value),f,c)}}
$('#edit').onclick=()=>{if(!selected)return;editCalSnapshot=cal?structuredClone(cal):null;editing=true;editRevision++;resultStatus('');$('#card-fields').open=true;$('#source-panel').open=true;applyEditMode();$('#detail').scrollTop=0;$('#atk').focus({preventScroll:true})};
$('#cancel-edit').onclick=async()=>{if(!selected||saving)return;cal=editCalSnapshot?structuredClone(editCalSnapshot):null;const saved=cards.find(c=>c.id===selected.id)||selected;await open(saved)};
$('#detail').addEventListener('close',()=>{if(editing&&!saving)cal=editCalSnapshot?structuredClone(editCalSnapshot):null;editing=false;editRevision++;calpoints=null;cpPoints=null});

function validTrainer(){try{trainerCap(Number($('#trainer').value));return true}catch{return false}}
function resultStatus(message){const field=$('#result-status');field.textContent=message;field.hidden=!message;}
function showError(message){const field=$('#save-feedback');field.textContent=message;field.hidden=!message}
let trainerBeforeSettings='',speciesBeforePicker='';
function openSettings(){trainerBeforeSettings=$('#trainer').value;$('#settings-error').hidden=true;if(!$('#settings-dialog').open)$('#settings-dialog').showModal();$('#trainer').focus()}
$('#settings-open').onclick=openSettings;
function cancelSettings(){queuedFiles=[];$('#files').value='';$('#trainer').value=trainerBeforeSettings;$('#settings-dialog').close()}
$('#settings-cancel').onclick=cancelSettings;$('#settings-dialog').addEventListener('cancel',()=>{queuedFiles=[];$('#files').value='';$('#trainer').value=trainerBeforeSettings});
$('#settings-form').onsubmit=async e=>{e.preventDefault();if(!validTrainer()){$('#settings-error').textContent='1부터 80까지의 레벨을 입력하세요.';$('#settings-error').hidden=false;return}try{localStorage.setItem('go-lens-trainer',$('#trainer').value)}catch{}$('#settings-dialog').close();render();const files=queuedFiles;queuedFiles=[];if(files.length)await importFiles(files);if($('#detail').open){updateEstimate();if(selected?.confirmed&&!editing)await analyze(false)}};
$('#choose-species').onclick=()=>{if(!editing)return;speciesBeforePicker=$('#species').value;$('#search').value='';speciesOptions('',speciesBeforePicker);$('#species-apply').disabled=!$('#species').value;$('#species-picker').showModal();$('#search').focus()};
function cancelSpecies(){speciesOptions('',speciesBeforePicker);$('#species-picker').close()}
$('#species-cancel').onclick=cancelSpecies;$('#species-picker').addEventListener('cancel',()=>speciesOptions('',speciesBeforePicker));
$('#species-apply').onclick=()=>{if(!editing||!$('#species').value)return;editRevision++;moveOptions(db.pokemon.find(p=>p.id===$('#species').value));updateEstimate();$('#results').replaceChildren();$('#species-picker').close()};

let growthKind='power';
function updateGrowthSummary(){const history=selected?.growthHistory||[],evolved=history.filter(x=>x.kind==='evolve').reduce((n,x)=>n+x.count,0),powered=history.filter(x=>x.kind==='power').reduce((n,x)=>n+x.count,0);$('#growth-summary').hidden=!history.length;$('#growth-label').textContent=[evolved?'진화 '+evolved+'회':'',powered?'강화 '+powered+'회':''].filter(Boolean).join(' / ')+' 적용';}
function growthMoves(){const p=db.pokemon.find(x=>x.id===$('#evolve-target').value);if(!p){options($('#evolve-fast'),[],'선택 안 함');options($('#evolve-charged'),[],'선택 안 함');return}const m=legalMoves(db,p,{shadow:selected.shadow,purified:selected.purified,lucky:selected.lucky});options($('#evolve-fast'),m.fast.map(id=>[id,db.moves[id].name]),'선택 안 함');options($('#evolve-charged'),m.charged.map(id=>[id,db.moves[id].name]),'선택 안 함');}
function refreshGrowth(){const p=db.pokemon.find(x=>x.id===selected?.species);if(!p)return;const count=Number($('#growth-count').value);if(growthKind==='evolve'){const targets=evolutionTargets(db,p,count,{shadow:selected.shadow,purified:selected.purified,lucky:selected.lucky}),previous=$('#evolve-target').value;options($('#evolve-target'),targets.map(x=>[x.p.id,x.p.name]),targets.length?'진화할 포켓몬 선택':'가능한 진화 없음');if(targets.some(x=>x.p.id===previous))$('#evolve-target').value=previous;else if(targets.length===1)$('#evolve-target').value=targets[0].p.id;growthMoves();$('#growth-preview').textContent='진화 횟수에 맞는 종과 기술을 선택하세요.';$('#growth-apply').disabled=!targets.length;}else{$('#growth-apply').disabled=false;try{const result=applyGrowth(db,selected,Number($('#trainer').value),{kind:'power',count});$('#growth-preview').textContent='레벨 '+result.observed.calculatedLevel+' / CP '+result.observed.cp+' / HP '+result.observed.hp;$('#growth-error').hidden=true}catch(e){$('#growth-preview').textContent=e.message;$('#growth-apply').disabled=true}}}
function openGrowth(kind){if(!selected||editing)return;if(!validTrainer()){openSettings();return}growthKind=kind;$('#growth-title').textContent=kind==='evolve'?'진화하기':'강화하기';$('#growth-count-label').textContent=kind==='evolve'?'진화 횟수':'강화 횟수 (1회당 0.5레벨)';$('#growth-count').value=1;$('#growth-count').max=kind==='evolve'?10:100;$('#evolve-options').hidden=kind!=='evolve';$('#growth-error').hidden=true;refreshGrowth();$('#growth-dialog').showModal();}
$('#evolve').onclick=()=>openGrowth('evolve');$('#power-up').onclick=()=>openGrowth('power');$('#growth-count').oninput=refreshGrowth;$('#evolve-target').onchange=growthMoves;$('#growth-cancel').onclick=()=>$('#growth-dialog').close();
$('#growth-form').onsubmit=async e=>{e.preventDefault();const button=$('#growth-apply');button.disabled=true;try{const updated=applyGrowth(db,selected,Number($('#trainer').value),{kind:growthKind,count:Number($('#growth-count').value),target:$('#evolve-target').value,fast:$('#evolve-fast').value,charged:$('#evolve-charged').value});await save(updated);$('#growth-dialog').close();await open(updated)}catch(err){$('#growth-error').textContent=err.message;$('#growth-error').hidden=false}finally{button.disabled=false}};
$('#growth-reset').onclick=async()=>{if(!selected?.growthBase||saving)return;const restored=resetGrowth(selected);await save(restored);await open(restored)};
