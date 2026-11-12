// Type colors come from the --type-* tokens in style.css (white-safe fills, >= 4.6:1 against --type-ink).
// The hex values are the same colors, used only if the stylesheet is missing.
const types={normal:['노말','#6c747c'],fire:['불꽃','#c15003'],water:['물','#3277b3'],electric:['전기','#887106'],grass:['풀','#2e833b'],ice:['얼음','#2a7f7a'],fighting:['격투','#b74d59'],poison:['독','#9a59af'],ground:['땅','#a5633a'],flying:['비행','#5e72a3'],psychic:['에스퍼','#bd4e63'],bug:['벌레','#6c7a04'],rock:['바위','#817247'],ghost:['고스트','#6370ad'],dragon:['드래곤','#4d70b7'],dark:['악','#626171'],steel:['강철','#457b89'],fairy:['페어리','#a05b95']};
// One drawn mark per type on a 24-unit grid, all in the same round 2.2 stroke (see .move-type-icon svg).
// Drawn rather than typed: Unicode symbols change shape per device, and some turn into color emoji on iOS.
const marks={
 normal:'<circle cx="12" cy="12" r="6"/>',
 fire:'<path d="M12 3.5c.6 3 4.8 4.9 4.8 9.6a4.8 4.8 0 0 1-9.6 0c0-2.6 1.6-3.9 2.7-5.3.2 1.5.8 2.6 1.9 3 .1-2.9-.2-4.9.2-7.3z"/>',
 water:'<path d="M12 3.5c3 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.7 9 7.5 12 3.5z"/>',
 electric:'<path d="M13.5 3 6.5 13.2h5.2L10.5 21l7-10.2h-5.2z"/>',
 grass:'<path d="M5.5 18.5c0-8 5-13 13.5-13 0 8.5-5 13-13.5 13z"/><path d="M5.5 18.5 13 11"/>',
 ice:'<path d="M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5"/>',
 fighting:'<path d="M8 20.5v-3C6.2 16.3 5 14.3 5 12V9.5A5.5 5.5 0 0 1 10.5 4H13a6 6 0 0 1 6 6v2.5c0 2-1 3.8-3 5v3z"/><path d="M8 17.5h8M5 11.5c1.6-1.1 3.6-1.4 5.5-.7"/>',
 poison:'<circle cx="10" cy="14.5" r="4.5"/><circle cx="16.5" cy="7" r="2.5"/>',
 ground:'<path d="M3.5 18h17M5 18l5-10.5 3.5 6 2.2-3.2L19 18"/>',
 flying:'<path d="M4 17.5c6 .3 11-2.8 13.5-9.5l2.5-2c-.6 8.5-6.5 13-16 11.5z"/><path d="M8.5 15.5c3-1 5.4-3 7-6"/>',
 psychic:'<path d="M9.5 13.25a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0a7.5 7.5 0 0 1 15 0"/>',
 bug:'<path d="M12 7.5a5 5 0 0 1 5 5V15a5 5 0 0 1-10 0v-2.5a5 5 0 0 1 5-5z"/><path d="M12 7.5V20M9.5 4.5l1 3M14.5 4.5l-1 3M7 13H4.5M17 13h2.5"/>',
 rock:'<path d="M7 19.5 4 12.5l4-6.5h7.5l4.5 5.5-2 8z"/><path d="M8 6l3.5 6.5 8.5-1M11.5 12.5 7 19.5"/>',
 ghost:'<path d="M6 20v-9a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><path d="M10 11v.5M14 11v.5"/>',
 dragon:'<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M12 8.2c-.9 1.1-1.3 2.4-1.3 3.8s.4 2.7 1.3 3.8c.9-1.1 1.3-2.4 1.3-3.8s-.4-2.7-1.3-3.8z"/>',
 dark:'<path d="M15.5 4a8 8 0 1 0 4.5 13.5A6.5 6.5 0 0 1 15.5 4z"/>',
 steel:'<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/><circle cx="12" cy="12" r="3"/>',
 fairy:'<path d="M12 3.5c.8 4.4 4.1 7.7 8.5 8.5-4.4.8-7.7 4.1-8.5 8.5-.8-4.4-4.1-7.7-8.5-8.5 4.4-.8 7.7-4.1 8.5-8.5z"/>'
};
const key=type=>type in types?type:'normal';
export function typeColor(type){const k=key(type);return `var(--type-${k}, ${types[k][1]})`;}
export function typeIcon(type){
 const k=key(type),name=types[k][0];
 const icon=document.createElement('span');icon.className='move-type-icon';icon.style.setProperty('--type',typeColor(type));
 icon.title=name+' 타입';icon.setAttribute('role','img');icon.setAttribute('aria-label',name+' 타입');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 svg.innerHTML=marks[k];icon.append(svg);
 return icon;
}
export function moveLabel(move){const label=document.createElement('span');label.className='move-name';label.append(typeIcon(move.type),move.name);return label;}
export function typeName(type){return types[key(type)][0];}
