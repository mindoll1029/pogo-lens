import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detect,fullBarCorrection,sameAppraisal,sameVideoPokemon,signature,distance} from '../dist/vision.js';
import {readObservation,cpFromOverview} from '../dist/frame-ocr.js';
import {inferLevel} from '../dist/observation.js';

const db=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
const azumarill=db.pokemon.find(p=>p.id==='azumarill');
test('Stored Banette appraisal can recover CP and uniquely correct full bars',()=>{
 const cp=cpFromOverview('719\ncr1998\n다크펫\n132/132HP');
 assert.equal(cp,1998);
 const p=db.pokemon.find(p=>p.id==='banette');
 const fit=iv=>inferLevel(db,p,iv,40,{cp,hp:132}).level;
 assert.deepEqual(fullBarCorrection([7,14,14],fit),[7,15,15]);
 assert.equal(fullBarCorrection([7,14,14],()=>true),null);
});

test('CP comes from the number in its crop even when the prefix was misread',()=>{
 const iv=[0,15,15];
 const corrected=readObservation(db,'Ｃ Ｐ １４９８\n마 릴 리',iv,40,{cpText:'1400'});
 assert.equal(corrected.pokemon.id,azumarill.id);
 assert.equal(corrected.observed.cp,1400);
 assert.equal(corrected.verified,true);
 const unknown=readObservation(db,'별명',iv,40,{cpText:'1400'});
 assert.equal(unknown.observed.cp,1400);
 assert.equal(unknown.pokemon,null);
});

test('Display the recognized family when form is uncertain, or resolve it from appearance',()=>{
 const text='다크펫';
 const undecided=readObservation(db,text,[7,14,14],40,{cpText:'cr1998'});
 assert.equal(undecided.name,'다크펫');
 assert.equal(undecided.pokemon,null);
 assert.equal(undecided.observed.cp,1998);
 const appearance={pixels:[26,82,27]};
 const references=[{species:'banette',pixels:[26,82,27]},{species:'banette_mega',pixels:[100,20,170]}];
 const result=readObservation(db,text,[7,14,14],40,{cpText:'cr1998',appearance,references});
 assert.equal(result.pokemon.id,'banette');
 const nearby=readObservation(db,text+'\n132/132HP',[7,14,14],40,{cpText:'cr1998'});
 assert.equal(nearby.pokemon.id,'banette');
 assert.equal(nearby.verified,false);
});

function appraisalFrame(ivs,offsetY=0){
 const width=540,height=1120,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const [i,iv] of ivs.entries()){
  for(let y=690+i*66+offsetY;y<703+i*66+offsetY;y++){
   for(let x=65;x<307;x++){
    const divider=[144,145,146,147,225,226,227,228].includes(x);
    const rgb=divider?[255,255,255]:x-65<242*iv/15?[238,155,75]:[210,210,210];
    data.set(rgb,(y*width+x)*4);
   }
  }
 }
 return {width,height,data};
}

test('An empty attack track does not block automatic IV and level recovery',()=>{
 const result=detect(appraisalFrame([0,15,15]));
 assert.equal(result.tracks,true);
 assert.deepEqual(result.iv,[0,15,15]);
 const {pokemon,observed}=readObservation(db,'마 릴 리 ♀',result.iv,40,{cpText:'1,400'});
 assert.equal(pokemon.id,'azumarill');
 assert.equal(inferLevel(db,pokemon,result.iv,40,observed).level,40);
});

test('Video import requires matching complete appraisal bars across nearby frames',()=>{
 const still=detect(appraisalFrame([0,15,15]));
 const slightJitter=detect(appraisalFrame([0,15,15],2));
 const sliding=detect(appraisalFrame([0,15,15],16));
 const filling=detect(appraisalFrame([0,14,15]));
 const partial=detect(appraisalFrame([15,15]),{x0:65/540,x1:307/540,ys:[696,762,828].map(y=>y/1120)});
 assert.equal(partial.candidate,true);
 assert.equal(sameAppraisal(still,slightJitter),true);
 assert.equal(sameAppraisal(still,sliding),false);
 assert.equal(sameAppraisal(still,filling),false);
 assert.equal(sameAppraisal(still,partial),false);
 assert.equal(sameAppraisal(still,null),false);
});

test('Adjacent appraisals deduplicate by IV and identity even when the background changes',()=>{
 const first=appraisalFrame([7,15,15]),second=appraisalFrame([7,15,15]);
 second.data.fill(84,0,second.width*500*4);
 assert.ok(distance(signature(first),signature(second))>.12);
 const a={detected:detect(first),card:{species:'banette',observed:{cp:1998,hp:132}}};
 const b={detected:detect(second),card:{species:'banette',observed:{cp:1998,hp:132}}};
 assert.equal(sameVideoPokemon(a,b),true);
 assert.equal(sameVideoPokemon(a,{...b,card:{...b.card,species:'banette_mega'}}),false);
 assert.equal(sameVideoPokemon(a,{...b,card:{...b.card,observed:{cp:1999,hp:132}}}),false);
 assert.equal(sameVideoPokemon(a,{...b,card:{...b.card,observed:{cp:1998,hp:131}}}),false);
 assert.equal(sameVideoPokemon(a,{...b,card:{species:'banette',observed:{cp:null}}}),false);
 const unresolved={detected:b.detected,card:{recognizedName:'다크펫',observed:{cp:1998,hp:132}}};
 assert.equal(sameVideoPokemon(unresolved,unresolved),true);
 assert.equal(sameVideoPokemon(a,unresolved),false);
});
