import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=['https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json','https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json'];
const raw=await Promise.all(sources.map(async(u,i)=>process.argv[i+2]?await readFile(process.argv[i+2],'utf8'):await fetch(u).then(r=>{if(!r.ok)throw Error(r.status);return r.text()})));
const [p,g]=raw.map(JSON.parse),locale=JSON.parse(await readFile(new URL('localization-ko.json',import.meta.url),'utf8'));
Object.assign(locale.overrides,{SCALD_BLASTOISE:'열탕(거북왕)',HYDRO_PUMP_BLASTOISE:'하이드로펌프(거북왕)',WRAP_GREEN:'김밥말이',WRAP_PINK:'김밥말이',WATER_GUN_FAST_BLASTOISE:'물대포(거북왕)',TECHNO_BLAST_WATER:'테크노버스터(물)',WEATHER_BALL_NORMAL:'웨더볼(노말)'});
const rows=g.map(x=>x.data),cpm=rows.find(x=>x.playerLevel)?.playerLevel.cpMultiplier;
if(!Array.isArray(cpm)||cpm.length<51||!Array.isArray(p.pokemon))throw Error('Invalid upstream schema');
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const needed=new Set(p.pokemon.flatMap(x=>[...x.fastMoves,...x.chargedMoves]).concat(['FRUSTRATION','RETURN']));
const moves={};for(const r of rows){const m=r.moveSettings;if(typeof m?.movementId!=='string'||!m.durationMs)continue;const id=m.movementId.replace(/_FAST$/,''),base=id.replace(/_PLUS_PLUS$/,'').replace(/_PLUS$/,''),name=locale.overrides[id]||locale.moves[norm(base)];if(!name){if(needed.has(id))throw Error('Missing Korean move name: '+id);continue}moves[id]={id,name:name+(id.endsWith('_PLUS_PLUS')?'++':id.endsWith('_PLUS')?'+':''),type:String(m.pokemonType).replace('POKEMON_TYPE_','').toLowerCase(),power:m.power||0,energy:m.energyDelta||0,seconds:m.durationMs/1000};}
const pokemon=p.pokemon.filter(x=>!x.speciesId.endsWith('_shadow')&&x.released!==false).map(x=>{const form=x.speciesName.match(/\((.+)\)/)?.[1],base=locale.species[x.dex];if(!base||form&&!(form in locale.forms))throw Error('Missing Korean species/form: '+x.speciesName);const mega=x.speciesId.includes('_mega')||x.speciesId.includes('_primal'),shadow=p.pokemon.find(s=>s.speciesId===x.speciesId+'_shadow');return {id:x.speciesId,name:base+(form&&locale.forms[form]?` (${locale.forms[form]})`:''),englishName:x.speciesName,dex:x.dex,stats:x.baseStats,types:x.types,evolutions:x.family?.evolutions||[],fast:x.fastMoves.filter(k=>moves[k]&&moves[k].energy>=0),charged:x.chargedMoves.filter(k=>!['FRUSTRATION','RETURN'].includes(k)&&moves[k]?.energy<0),elite:x.eliteMoves||[],mega,shadowAllowed:!mega&&!!shadow&&shadow.released!==false};});
if(pokemon.length<500||Object.keys(moves).length<100)throw Error('Incomplete data');
const out={schema:2,checkedAt:new Date().toISOString(),upstreamTimestamp:p.timestamp,sources:[...sources,...locale.sources],sha256:raw.map(x=>createHash('sha256').update(x).digest('hex')),cpm:cpm.slice(0,51),pokemon,moves};
await writeFile(new URL('./dist/data.json',import.meta.url),JSON.stringify(out));console.log(`Saved ${pokemon.length} Korean species/forms, ${Object.keys(moves).length} Korean PvE moves.`);

