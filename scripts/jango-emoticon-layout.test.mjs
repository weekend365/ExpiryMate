import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validatePlan,titleFor,validateLayout,cropFor,placement} from './jango-emoticon-layout.mjs';
import {local,readJson,readPng,fileHash,technical,visibleBounds} from './jango-design-gate.mjs';
import {readMasterSet} from './jango-master-set.mjs';
const base='design/jango/emoticons/kakao-32/v18',plan=readJson(base+'/plan.json'),set=readMasterSet();
const example=()=>structuredClone(plan[0]);
test('MASTER roster retains exact 32 titles, lines, mouth modes and original 96 protected assets',()=>{
 validatePlan(plan);const original=readJson('design/jango/quality/history/v18-creation/'+base+'/manifest.json');
 for(const p of plan){const m=set.entries.find(e=>e.number===p.n),old=original.find(e=>e.number===p.n);assert.equal(p.line,m.line);assert.equal(p.title,m.title);assert.equal(p.mouthMode,m.mouthMode);assert.equal(fileHash(m.source),old.sourceSHA256);assert.equal(fileHash(m.sticker),old.sha256);assert.equal(fileHash(m.lettering),old.letteringSHA256);assert.equal(p.composition.panel,p.n);}
});
test('silent titles and missing/duplicate roster entries are rejected correctly',()=>{
 assert.equal(titleFor({n:3,title:'잘 자',line:''}),'잘 자');assert.equal(titleFor({n:3,line:''}),'장고 03');
 const p=structuredClone(plan);p[1].title=p[0].title;assert.throws(()=>validatePlan(p),/Unique semantic/);p[1].title='다른 제목';p[1].n=1;assert.throws(()=>validatePlan(p),/Unique numbers/);
});
test('invalid framing, omitted framing intent and excluded character cannot be hidden',()=>{
 for(const rect of [[0,0,1255,100],[-1,0,100,100],[0,0,0,100],[0,0,10.5,100]]){const p=example();Object.assign(p.layout,{framingCrop:rect,framingNote:'intent'});assert.throws(()=>validateLayout(p,{width:1254,height:1254}));}
 const p=example();p.layout.framingCrop=[0,0,1000,1000];delete p.layout.framingNote;assert.throws(()=>validateLayout(p,{width:1254,height:1254}),/intent/);assert.throws(()=>cropFor([400,400,900,900],{width:1254,height:1254},{framingCrop:[0,0,100,100]}),/excludes/);
 assert.deepEqual(placement(800,1000,[40,40,944,944]),{width:755,height:944,x:134,y:40});
});
test('caption kind, typography, rotation and exact multiline order are enforced',()=>{
 for(const change of [p=>p.captionKind='silent',p=>p.captionKind='unknown',p=>p.layout.lettering.rotation=11,p=>p.layout.lettering.font='Missing',p=>p.layout.lettering.x=1024]){const p=example();change(p);assert.throws(()=>validateLayout(p,{width:1254,height:1254}));}
 const p=example();p.line='항상 고마워!';p.layout.lettering.lines=['항상','고마워!'];p.layout.symbols=[{text:'zzz',x:800,y:300,size:100,rotation:5}];assert(validateLayout(p,{width:1254,height:1254}));
 for(const change of [r=>r.layout.lettering.lines=['고마워!','항상'],r=>r.layout.lettering.lines=['항상','고마워'],r=>r.layout.symbols[0].rotation=11,r=>r.layout.symbols[0].x=-1,r=>r.layout.symbols[0].text='임의 문구']){const bad=structuredClone(p);change(bad);assert.throws(()=>validateLayout(bad,{width:1254,height:1254}));}
});
test('32 PNGs retain transparent edges, safe margins and exact caption-free layout without collisions',()=>{
 for(const p of plan){const k=String(p.n).padStart(2,'0'),sticker=readPng(base+'/stickers/'+k+'.png'),letters=readPng(base+'/lettering/'+k+'.png'),art=readPng(base+'/artwork/'+k+'.png');assert.equal(technical(sticker).status,'pass');assert(visibleBounds(sticker).margin>=8);let overlap=0;for(let i=3;i<art.data.length;i+=4)if(art.data[i]>100&&letters.data[i]>100)overlap++;assert.equal(overlap,0,k);}
});
test('Gaegu font and license match preserved source provenance',()=>{const p=readJson(base+'/fonts/provenance.json');for(const[f,hash]of Object.entries(p.files))assert.equal(fileHash(base+'/fonts/'+f),hash);});
test('MASTER builder verifies without overwriting and no previous version input is needed',()=>{execFileSync(process.execPath,['scripts/build-jango-emoticons.mjs'],{stdio:'pipe'});assert.equal(readMasterSet().entries.length,32);});
test('macOS lettering reproduces frozen v18 output in a separate version and refuses MASTER writes',{skip:process.platform!=='darwin'},()=>{
 const temp='design/jango/emoticons/kakao-32/v'+Date.now();fs.mkdirSync(local(temp));
 try{fs.copyFileSync(local(base+'/plan.json'),local(temp+'/plan.json'));fs.mkdirSync(local(temp+'/fonts'));for(const name of ['Gaegu-Regular.ttf','Gaegu-Bold.ttf'])fs.linkSync(local(base+'/fonts/'+name),local(temp+'/fonts/'+name));execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',temp],{stdio:'pipe'});for(const entry of set.entries)assert.equal(fileHash(temp+'/lettering/'+String(entry.number).padStart(2,'0')+'.png'),entry.letteringSHA256);assert.throws(()=>execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',base],{stdio:'pipe'}),/immutable/);}finally{fs.rmSync(local(temp),{recursive:true,force:true});}
});
