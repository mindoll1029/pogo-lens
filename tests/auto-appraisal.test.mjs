import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detect} from '../dist/vision.js';
import {readObservation} from '../dist/frame-ocr.js';
import {inferLevel} from '../dist/observation.js';

const db=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
const azumarill=db.pokemon.find(p=>p.id==='azumarill');

test('Targeted CP reading recovers a value missed or misread in the overview',()=>{
 const iv=[0,15,15];
 const corrected=readObservation(db,'Ｃ Ｐ １４９８\n마 릴 리',iv,40,{cpText:'1400'});
 assert.equal(corrected.pokemon.id,azumarill.id);
 assert.equal(corrected.observed.cp,1400);
 assert.equal(corrected.verified,true);
 const unknown=readObservation(db,'별명',iv,40,{cpText:'1400'});
 assert.equal(unknown.observed.cp,null);
 assert.equal(unknown.pokemon,null);
});

test('An empty attack track does not block automatic IV and level recovery',()=>{
 const width=540,height=1120,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const [i,iv] of [0,15,15].entries()){
  for(let y=690+i*66;y<703+i*66;y++){
   for(let x=65;x<307;x++){
    const rgb=x-65<242*iv/15?[238,155,75]:[210,210,210];
    data.set(rgb,(y*width+x)*4);
   }
  }
 }
 const result=detect({width,height,data});
 assert.equal(result.tracks,true);
 assert.deepEqual(result.iv,[0,15,15]);
 const {pokemon,observed}=readObservation(db,'CP 1,400\n마 릴 리 ♀',result.iv,40);
 assert.equal(pokemon.id,'azumarill');
 assert.equal(inferLevel(db,pokemon,result.iv,40,observed).level,40);
});
