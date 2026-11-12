import {moveLabel} from './move-types.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const stateName=s=>s==='shadow'?'그림자':s==='purified'?'정화':'일반';
const leagueName=cap=>cap===1500?'슈퍼리그':cap===2500?'하이퍼리그':'마스터리그';
// Each badge path appears once so the standalone build can inline it.
const leagueIcon=cap=>cap===1500?'badges/great.png':cap===2500?'badges/ultra.png':'badges/master.png';
// Every league score shows two decimals, floored so rank 2 never displays as 100.00%.
// The small epsilon keeps values like 99.98 (stored as 99.97999…) from flooring a step too far.
const percentFloor=value=>(Math.floor(value*100+1e-6)/100).toFixed(2)+'%';
export function leagueBadge(cap,name,percentile,sub=''){
 const row=el('div','league-badge'),icon=el('img','league-icon');
 icon.src=leagueIcon(cap);
 icon.alt='';
 const label=el('span','league-label');
 label.append(el('span',null,name||leagueName(cap)));
 if(sub)label.append(el('small',null,sub));
 row.append(icon,label,el('strong','league-percent',percentFloor(percentile)));
 return row;
}
function metric(title,value,sub){const n=el('div','metric'),a=el('div');a.append(el('small',null,title),el('strong',null,value),el('small',null,sub));n.append(a);return n}
function tierBadge(tier){
 const badge=el('span','tier-badge',tier);
 badge.dataset.tier=tier;
 badge.setAttribute('aria-label',tier+' 등급');
 return badge;
}
const note=text=>el('p','micro',text);
function table(headers,rows){const wrap=el('div','tablewrap'),t=el('table'),head=el('thead'),tr=el('tr');for(const h of headers)tr.append(el('th',null,h));head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const c of row){const td=el('td');td.append(c);tr.append(td)}body.append(tr)}t.append(body);wrap.append(t);return wrap}
const infoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/></svg>';
function section(key,title,info){
 const root=el('section','result-section'),head=el('div','divider'),heading=el('h3','divider-title',title);
 root.id='result-'+key;heading.id='result-'+key+'-title';root.setAttribute('aria-labelledby',heading.id);
 head.append(heading);root.append(head);
 if(info){
  const button=el('button','info-button'),text=el('p','micro section-note',info);
  button.type='button';button.innerHTML=infoIcon;
  text.id='result-'+key+'-note';text.hidden=true;
  button.setAttribute('aria-label',title+' 설명');button.setAttribute('aria-controls',text.id);button.setAttribute('aria-expanded','false');
  button.onclick=()=>{text.hidden=!text.hidden;button.setAttribute('aria-expanded',String(!text.hidden))};
  head.append(button);root.append(text);
 }
 return root;
}
function pvpBox(candidate){
 const box=el('div','pvp-box'),icon=el('img','league-icon'),label=el('span','pvp-label');
 icon.src=leagueIcon(candidate.cap);icon.alt='';
 label.append(el('span','pvp-name',candidate.name),el('small',null,[leagueName(candidate.cap),candidate.state==='shadow'||candidate.state==='purified'?stateName(candidate.state):''].filter(Boolean).join(' · ')));
 box.append(icon,label,el('strong','pvp-percent',percentFloor(candidate.percentile)));
 return box;
}
function raidRow(db,chosen){
 const row=el('div','raid-row'),info=el('div','raid-info'),moves=el('div','raid-moves'),score=el('div','raid-score');
 moves.append(moveLabel(db.moves[chosen.fast]),el('span','raid-plus','+'),moveLabel(db.moves[chosen.charged]));
 info.append(el('small',null,'보유 기술의 중립 벤치마크 등급'),moves);
 score.append(el('strong',null,chosen.percent.toFixed(1)+'%'),el('small',null,'최상위 기술 대비'));
 row.append(tierBadge(chosen.tier),info,score);
 return row;
}
export function renderResults(root,r,{db,p,iv,max,level,shadow}){
 root.replaceChildren();
 const raid=r.raid,owned=(r.ownedRaids||[raid]).map(x=>x.chosen).filter(Boolean);
 const best=owned.slice().sort((a,b)=>b.percent-a.percent)[0];
 if(best)root.dataset.bestTier=best.tier;else delete root.dataset.bestTier;

 const pvp=section('pvp','PvP IV','PvP 대표 점수는 랭크 백분위수입니다. 진화형·정화 후보를 비교하며 스탯곱 비율은 별도로 표시합니다.');
 const boxes=el('div','pvp-boxes');
 for(const c of r.previews)boxes.append(pvpBox(c));
 if(!r.previews.length)boxes.append(note('이 폼의 PvP 후보가 없습니다.'));
 pvp.append(boxes);
 const leagues=r.leagues.map((result,i)=>result&&leagueBadge([1500,2500,Infinity][i],null,result.percentile,'스탯곱 '+result.percent.toFixed(3)+'% · #'+result.rank.toLocaleString()+' · CP '+result.cp+' · 레벨 '+result.level)).filter(Boolean);
 if(leagues.length){const list=el('div','league-list');list.append(el('h4',null,`현재 종·폼의 리그 결과 / 최대 레벨 ${max}`),...leagues);pvp.append(list)}
 if(p.mega)pvp.append(note('메가·원시회귀는 PvP 계산에서 제외합니다.'));

 const raids=section('raid','레이드 기술 등급','레이드 기술 등급은 동일 종·폼의 중립 기술 조합을 비교하고 S가 최상위입니다. 기술 등급은 현재 IV/레벨과 무관합니다.');
 for(const chosen of owned)raids.append(raidRow(db,chosen));
 if(!owned.length)raids.append(note('노말·스페셜 기술을 선택하면 등급을 표시합니다. 화풀이/은혜갚기는 기술 등급 비교에서 제외됩니다.'));
 const moves=el('details','combo-table');moves.append(el('summary',null,`기술 조합 ${raid.moves.length}개 비교`),table(['노말','스페셜','등급','최상위 대비'],raid.moves.map(m=>[moveLabel(db.moves[m.fast]),moveLabel(db.moves[m.charged]),tierBadge(m.tier),m.percent.toFixed(1)+'%'])));raids.append(moves);
 if(raid.current)raids.append(metric('현재 개체 / 중립 전투 평균 DPS',raid.current.dps.toFixed(2),`레벨 ${level} / IV ${iv.join('/')} / ${shadow?'그림자':'일반/메가'} / 180초 기준`));
 else if(raid.currentRange)raids.append(metric('현재 개체 / 추정 레벨 범위 DPS',raid.currentRange.low.toFixed(2)+'–'+raid.currentRange.high.toFixed(2),'CP에 일치하는 복수 레벨의 양 끝값 / 정확한 레벨 미확정'));
 else raids.append(note('현재 개체의 DPS는 CP로 레벨을 추정하고 보유 기술을 선택하면 계산합니다.'));

 const battle=section('battle','배틀 스탯');
 battle.append(el('p','section-sub','레벨 50 / IV 100% 기준'));
 if(raid.battle){for(const [key,label] of [['output','데미지량'],['tank','탱커력'],['duel','배틀 능력치']]){const line=el('div','statline'),bar=el('progress');bar.max=100;bar.value=Math.min(100,raid.battle[key]);bar.setAttribute('aria-label',label);line.append(el('span',null,label),bar,el('b',null,raid.battle[key].toFixed(1)+'%'));battle.append(line)}}
 else battle.append(note('기술을 선택하면 세 가지 배틀 스탯을 표시합니다.'));

 root.append(pvp,raids,battle);
}
