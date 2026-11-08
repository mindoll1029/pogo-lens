import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Pass downloaded files for reproducible/offline builds, or fetch both upstreams.
const sources=['https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json','https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json'];
const raw=await Promise.all(sources.map(async(u,i)=>process.argv[i+2]?await readFile(process.argv[i+2],'utf8'):await fetch(u).then(r=>{if(!r.ok)throw Error(r.status);return r.text()})));
const [p,g]=raw.map(JSON.parse);const rows=g.map(x=>x.data);const cpm=rows.find(x=>x.playerLevel)?.playerLevel.cpMultiplier;
if(!Array.isArray(cpm)||cpm.length<51||!Array.isArray(p.pokemon))throw Error('Invalid upstream schema');
const moves={};for(const r of rows){const m=r.moveSettings;if(!m?.power||!m.durationMs||!m.energyDelta||typeof m.movementId!=='string')continue;const id=m.movementId.replace(/_FAST$/,'');moves[id]={id,type:String(m.pokemonType).replace('POKEMON_TYPE_','').toLowerCase(),power:m.power,energy:m.energyDelta,seconds:m.durationMs/1000};}
const pokemon=p.pokemon.filter(x=>!x.speciesId.endsWith('_shadow')&&x.released!==false).map(x=>({id:x.speciesId,name:x.speciesName,dex:x.dex,stats:x.baseStats,types:x.types,fast:x.fastMoves.filter(k=>moves[k]?.energy>0),charged:[...new Set([...x.chargedMoves,'FRUSTRATION','RETURN'])].filter(k=>moves[k]?.energy<0),elite:[...(x.eliteMoves||[])],mega:x.speciesId.includes('_mega')||x.speciesId.includes('_primal')}));
if(pokemon.length<500||Object.keys(moves).length<100)throw Error('Incomplete data');
const out={schema:1,checkedAt:new Date().toISOString(),upstreamTimestamp:p.timestamp,sources,sha256:raw.map(x=>createHash('sha256').update(x).digest('hex')),cpm:cpm.slice(0,51),pokemon,moves};
await writeFile(new URL('./dist/data.json',import.meta.url),JSON.stringify(out));console.log(`Saved ${pokemon.length} species/forms, ${Object.keys(moves).length} PvE moves. Review data before distribution.`);
