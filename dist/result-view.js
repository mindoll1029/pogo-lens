import {moveLabel} from './move-types.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const stateName=s=>s==='shadow'?'그림자':s==='purified'?'정화':'일반';
export function leagueBadge(cap,name,percentile,sub=''){
 const league=cap===1500?'슈퍼리그':cap===2500?'하이퍼리그':'마스터리그';
 const row=el('div','league-badge'),icon=el('img','league-icon');
 icon.src=cap===1500?'badges/great.png':cap===2500?'badges/ultra.png':'badges/master.png';
 icon.alt='';
 const label=el('span','league-label');
 label.append(el('span',null,name||league));
 if(sub)label.append(el('small',null,sub));
 row.append(icon,label,el('strong','league-percent',percentile.toFixed(2)+'%'));
 return row;
}
function heading(root,text){root.append(el('h3','resulttitle',text))}
function metric(title,value,sub,right){const n=el('div','metric'),a=el('div');a.append(el('small',null,title),el('strong',null,value),el('small',null,sub));n.append(a);if(right){const b=el('div','right');b.append(el('strong',null,right[0]),el('small',null,right[1]));n.append(b)}return n}
function tierBadge(tier){
 const badge=el('span','tier-badge',tier);
 badge.dataset.tier=tier;
 badge.setAttribute('aria-label',tier+' 등급');
 return badge;
}
function note(root,text){root.append(el('p','micro',text))}
function table(headers,rows){const wrap=el('div','tablewrap'),t=el('table'),head=el('thead'),tr=el('tr');for(const h of headers)tr.append(el('th',null,h));head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const c of row){const td=el('td');td.append(c);tr.append(td)}body.append(tr)}t.append(body);wrap.append(t);return wrap}
export function renderResults(root,r,{db,p,iv,max,level,shadow,threshold}){root.replaceChildren();root.append(metric('개체값 IV',r.iv.toFixed(2)+'%',iv.join(' / '),r.current?[`CP ${r.current.cp}`,`현재 레벨 ${level}`]:null));
heading(root,'추천 리그');const badges=el('div','previewbadges');for(const c of r.previews)badges.append(leagueBadge(c.cap,null,c.percentile,c.name+' · '+stateName(c.state)));if(!r.previews.length)badges.append(el('p',null,'이 폼의 PvP 후보가 없습니다.'));root.append(badges);
 heading(root,`현재 종·폼의 리그 결과 / 최대 레벨 ${max}`);r.leagues.forEach((result,i)=>{
  if(!result)return;
  const caps=[1500,2500,Infinity],name=['슈퍼리그','하이퍼리그','마스터리그'][i];
  root.append(leagueBadge(caps[i],name,result.percentile,'스탯곱 '+result.percent.toFixed(3)+'% · #'+result.rank.toLocaleString()+' · CP '+result.cp+' · 레벨 '+result.level));
 });if(p.mega)note(root,'메가·원시회귀는 PvP 계산에서 제외합니다.');
 heading(root,'레이드 기술 등급 / 동일 종·폼의 조합 비교');const raid=r.raid;for(const selectedRaid of r.ownedRaids||[raid]){if(selectedRaid.chosen){const rating=metric('보유 기술의 중립 벤치마크 등급','',`${db.moves[selectedRaid.chosen.fast].name} + ${db.moves[selectedRaid.chosen.charged].name}`, [selectedRaid.chosen.percent.toFixed(1)+'%','이 종·폼의 최상위 기술 대비']);rating.querySelector('strong').append(tierBadge(selectedRaid.chosen.tier));const names=rating.querySelectorAll('small')[1];names.replaceChildren(moveLabel(db.moves[selectedRaid.chosen.fast]),' + ',moveLabel(db.moves[selectedRaid.chosen.charged]));root.append(rating);}else note(root,'노말·스페셜 기술을 선택하면 등급을 표시합니다. 화풀이/은혜갚기는 기술 등급 비교에서 제외됩니다.');
}
 const moves=el('details');moves.append(el('summary',null,`기술 조합 ${raid.moves.length}개 비교`),table(['노말','스페셜','등급','최상위 대비'],raid.moves.map(m=>[moveLabel(db.moves[m.fast]),moveLabel(db.moves[m.charged]),tierBadge(m.tier),m.percent.toFixed(1)+'%'])));root.append(moves);
 if(raid.current)root.append(metric('현재 개체 / 중립 전투 평균 DPS',raid.current.dps.toFixed(2),`레벨 ${level} / IV ${iv.join('/')} / ${shadow?'그림자':'일반/메가'} / 180초 기준`));else if(raid.currentRange)root.append(metric('현재 개체 / 추정 레벨 범위 DPS',raid.currentRange.low.toFixed(2)+'–'+raid.currentRange.high.toFixed(2),'CP에 일치하는 복수 레벨의 양 끝값 / 정확한 레벨 미확정'));else note(root,'현재 개체의 DPS는 CP로 레벨을 추정하고 보유 기술을 선택하면 계산합니다.');
 heading(root,'배틀 스탯 / 레벨 50 / IV 100% 기준');if(raid.battle){for(const [key,label] of [['output','데미지량'],['tank','탱커력'],['duel','배틀 능력치']]){const line=el('div','statline'),bar=el('progress');bar.max=100;bar.value=Math.min(100,raid.battle[key]);line.append(el('span',null,label),bar,el('b',null,raid.battle[key].toFixed(1)+'%'));root.append(line)}}else note(root,'기술을 선택하면 세 가지 배틀 스탯을 표시합니다.');
}

