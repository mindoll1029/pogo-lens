// Type colors come from the --type-* tokens in style.css (white-safe fills, >= 4.6:1 against --type-ink).
// The hex values are the same colors, used only if the stylesheet is missing.
const types={normal:['노말','#6c747c','●'],fire:['불꽃','#c15003','♨'],water:['물','#3277b3','◕'],electric:['전기','#887106','ϟ'],grass:['풀','#2e833b','♣'],ice:['얼음','#2a7f7a','❄'],fighting:['격투','#b74d59','✦'],poison:['독','#9a59af','◆'],ground:['땅','#a5633a','▲'],flying:['비행','#5e72a3','➤'],psychic:['에스퍼','#bd4e63','◎'],bug:['벌레','#6c7a04','✺'],rock:['바위','#817247','⬟'],ghost:['고스트','#6370ad','◉'],dragon:['드래곤','#4d70b7','✧'],dark:['악','#626171','☾'],steel:['강철','#457b89','⬢'],fairy:['페어리','#a05b95','✿']};
const key=type=>type in types?type:'normal';
export function typeColor(type){const k=key(type);return `var(--type-${k}, ${types[k][1]})`;}
export function typeIcon(type){const [name,,symbol]=types[key(type)];const icon=document.createElement('span');icon.className='move-type-icon';icon.style.setProperty('--type',typeColor(type));icon.textContent=symbol;icon.title=name+' 타입';icon.setAttribute('role','img');icon.setAttribute('aria-label',name+' 타입');return icon;}
export function moveLabel(move){const label=document.createElement('span');label.className='move-name';label.append(typeIcon(move.type),move.name);return label;}
export function typeName(type){return types[key(type)][0];}
