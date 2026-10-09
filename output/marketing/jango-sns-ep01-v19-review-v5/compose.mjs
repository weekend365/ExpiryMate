/* global console */
// Official imagegen supplies new character pixels; preserve the original scene
// outside reviewed edit boundaries. No character drawing or v18 sticker overlay.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readMasterSet} from '../../../scripts/jango-master-set.mjs';
import {readStyleMaster} from '../../../scripts/jango-style-master.mjs';
import {resizePremultiplied} from '../../../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const base=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(base,'../../..');
const require=createRequire(root+'/apps/mobile/package.json'),{PNG}=require('pngjs');
const read=p=>PNG.sync.read(fs.readFileSync(p));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(name,p)=>fs.writeFileSync(base+'/'+name,PNG.sync.write(p));
const prep=JSON.parse(fs.readFileSync(base+'/preparation.json'));
const regions=JSON.parse(fs.readFileSync(base+'/edit-regions.json'));
for(const f of [...prep.inputFiles,...prep.canonicalRules])assert.equal(hash(root+'/'+f.file),f.sha256,'Original input changed');
const v19=readStyleMaster(),legacy=readMasterSet();
function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
fs.mkdirSync(base+'/masks',{recursive:true});
fs.mkdirSync(base+'/qa',{recursive:true});
const outputs=[];
for(const number of [1,2,3,4]){
  const id=String(number).padStart(2,'0'),file=`jango-ep01-v5-${id}.png`;
  if(number===2){
    fs.copyFileSync(root+'/'+prep.approvedPanel2.file,base+'/'+file);
    assert.equal(hash(base+'/'+file),prep.approvedPanel2.sha256);
    outputs.push({panel:2,file,sha256:hash(base+'/'+file),approvedBytesPreserved:true});continue;
  }
  const p=prep.panels.find(p=>p.number===number),region=regions.panels[number];
  const original=read(root+'/'+p.references[0].file),generated=read(base+`/artwork/${id}-style-r1.png`),letters=read(root+'/'+p.originalLettering);
  assert.equal(original.width,1122);assert.equal(original.height,1402);
  assert.deepEqual([generated.width,generated.height],[original.width,original.height]);
  const result=new PNG({width:original.width,height:original.height}),mask=new PNG({width:original.width,height:original.height});original.data.copy(result.data);
  let changed=0,outsideChanged=0,letteringChanged=0,protectedChanged=0,maskPixels=0;
  for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
    const i=(y*original.width+x)*4,protectedPixel=region.protectedRectangles.some(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h);
    if(inside(x+.5,y+.5,region.subject)&&letters.data[i+3]===0&&!protectedPixel){generated.data.copy(result.data,i,i,i+4);mask.data.set([255,255,255,255],i);maskPixels++;}
    const different=!result.data.subarray(i,i+4).equals(original.data.subarray(i,i+4));
    if(different){changed++;if(!mask.data[i+3])outsideChanged++;if(letters.data[i+3])letteringChanged++;if(protectedPixel)protectedChanged++;}
    assert.equal(result.data[i+3],255);
  }
  assert.equal(outsideChanged,0);assert.equal(letteringChanged,0);assert.equal(protectedChanged,0);assert(changed>10000);
  save(file,result);save(`masks/${id}.png`,mask);
  const mobile=resizePremultiplied(result,360,450);save(`qa/${id}-mobile.png`,mobile);
  const comparison=new PNG({width:original.width*2,height:original.height});PNG.bitblt(original,comparison,0,0,original.width,original.height,0,0);PNG.bitblt(result,comparison,0,0,result.width,result.height,result.width,0);save(`qa/${id}-before-after.png`,comparison);
  outputs.push({panel:number,file,sha256:hash(base+'/'+file),generatedSource:`artwork/${id}-style-r1.png`,generatedSourceSHA256:hash(base+`/artwork/${id}-style-r1.png`),mask:`masks/${id}.png`,maskSHA256:hash(base+`/masks/${id}.png`),maskPixels,changedPixels:changed,outsideMaskChangedPixels:outsideChanged,originalLetteringChangedPixels:letteringChanged,protectedSceneChangedPixels:protectedChanged});
}
function preview(file,w,h,gap){const sheet=new PNG({width:w*2+gap*3,height:h*2+gap*3});for(let i=0;i<sheet.data.length;i+=4)sheet.data.set([253,248,242,255],i);for(const [n,out] of outputs.entries()){const resized=resizePremultiplied(read(base+'/'+out.file),w,h);PNG.bitblt(resized,sheet,0,0,w,h,gap+n%2*(w+gap),gap+Math.floor(n/2)*(h+gap));}save(file,sheet);return {file,width:sheet.width,height:sheet.height,sha256:hash(base+'/'+file)};}
const overview=preview('jango-ep01-v5-overview.png',561,701,20),mobile=preview('review-mobile-360.png',360,450,12);
const validation={format:{width:1122,height:1402},masterVersion:v19.masterVersion,masterSHA256:v19.image.sha256,approvedPanel2BytePreservation:true,outputs,overview,mobile,legacyAssetsVerified:Object.keys(legacy.assets).length,inputHashesPreserved:true,originalLetteringPreserved:true,composition:'Original finished panel plus official generated pixels inside reviewed Jango edit boundary. Text and non-target scene outside boundary preserved exactly; boundary visual review required.',userAdoption:null};
fs.writeFileSync(base+'/validation.json',JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({outputs:outputs.map(o=>({panel:o.panel,file:o.file,changedPixels:o.changedPixels??0})),approvedPanel2BytePreservation:true,originalLetteringPreserved:true},null,2));
