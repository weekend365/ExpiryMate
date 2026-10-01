// Diagnostic crops/layout only. Does not alter source art or approve candidates.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root,local,readJson,readPng} from './jango-design-gate.mjs';
import {resizePremultiplied} from '../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const require=createRequire(path.join(root,'apps/mobile/package.json'));
const {PNG}=require('pngjs');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7);
if(!base||!/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base))throw Error('Explicit canonical version directory required');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').map(Number);
const selections=readJson(`${base}/selection.json`);
const sourceFor=p=>`${base}/${selections[String(p.n).padStart(2,'0')].source}`;
const inspection=readJson(`${base}/inspection.json`),rows=readJson(`${base}/plan.json`).filter(p=>(!only||only.includes(p.n))&&fs.existsSync(local(sourceFor(p))));
function sheet(items,size,name,dark=false,actualLayout=false){
 const cell=actualLayout?size+8:size;
 const dst=new PNG({width:cell*8,height:cell*Math.ceil(items.length/8)}),rgb=dark?[41,58,49]:[245,246,240];
 for(let i=0;i<dst.data.length;i+=4)dst.data.set([...rgb,255],i);
 items.forEach((src,n)=>{
 const scale=Math.min((actualLayout?size:size-8)/src.width,(actualLayout?size:size-8)/src.height),p=resizePremultiplied(src,Math.round(src.width*scale),Math.round(src.height*scale)),left=n%8*cell+Math.floor((cell-p.width)/2),top=Math.floor(n/8)*cell+Math.floor((cell-p.height)/2);
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const s=(y*p.width+x)*4,d=((y+top)*dst.width+x+left)*4,a=p.data[s+3]/255;for(let c=0;c<3;c++)dst.data[d+c]=Math.round(p.data[s+c]*a+dst.data[d+c]*(1-a));}
 });
 fs.writeFileSync(local(`${base}/${name}.png`),PNG.sync.write(dst));
}
for(const size of [80,120])for(const dark of [false,true])for(const [folder,prefix]of [['artwork','expression'],['stickers','caption']])sheet(rows.map(p=>readPng(`${base}/${folder}/${String(p.n).padStart(2,'0')}.png`)),size,`${prefix}-${size}-${dark?'dark':'light'}`,dark,true);
const change=fs.existsSync(local(`${base}/change-record.json`))?readJson(`${base}/change-record.json`):null;
if(change?.baseVersion){
 if(!/^v\d+$/.test(change.baseVersion))throw Error('Invalid comparison version');
 const previous=base.replace(/v\d+$/,change.baseVersion);
 sheet(rows.flatMap(p=>[previous,base].map(dir=>readPng(`${dir}/stickers/${String(p.n).padStart(2,'0')}.png`))),240,`comparison-${change.baseVersion}`,false,true);
}
const faces=[],mouths=[];
fs.mkdirSync(local(`${base}/faces`),{recursive:true});
for(const p of rows){const k=String(p.n).padStart(2,'0'),src=readPng(sourceFor(p)),entry=inspection[k];if(!entry)throw Error(`Inspection coordinates missing: ${k}`);
 for(const [key,list] of [['faceRoi',faces],['mouthRoi',mouths]]){const [x,y,w,h]=entry[key];if(x<0||y<0||x+w>src.width||y+h>src.height)throw Error(`Invalid ${key} ${k}`);const crop=new PNG({width:w,height:h});PNG.bitblt(src,crop,x,y,w,h,0,0);list.push(crop);if(key==='faceRoi')fs.writeFileSync(local(`${base}/faces/${k}.png`),PNG.sync.write(resizePremultiplied(crop,240,Math.round(h/w*240))));}
}
sheet(faces,180,'expression-faces');sheet(mouths,120,'mouth-contact');
console.log(`Built expression previews for ${rows.length} candidates in numeric order.`);
