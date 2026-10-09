/* global console */
// Composes accurate lettering over image_gen scenes; preserves the approved first and second panels.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readMasterSet} from '../../../scripts/jango-master-set.mjs';
import {resizePremultiplied} from '../../../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const base=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(base,'../../..');
const require=createRequire(path.join(root,'apps/mobile/package.json')),{PNG}=require('pngjs');
const spec=JSON.parse(fs.readFileSync(path.join(base,'episode.json'))),prep=JSON.parse(fs.readFileSync(path.join(base,'preparation.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileHash=p=>hash(fs.readFileSync(p));
readMasterSet();
for(const r of [...prep.canonicalRules,...prep.preservedPanels,...prep.panels.flatMap(p=>p.references)])assert.equal(fileHash(path.join(root,r.file)),r.sha256,'Reference changed');
for(const p of spec.panels)if(p.preservedFile){
  assert.equal(fileHash(path.resolve(base,p.preservedFile)),p.sha256,'Approved panel changed');
  assert.equal(fileHash(path.join(base,p.output)),p.sha256,'Approved panel copy changed');
}
execFileSync('/usr/bin/osascript',['-l','JavaScript',path.join(base,'lettering.jxa.js'),root,base],{stdio:'inherit'});
const outputs=[];
for(const p of spec.panels){
  if(!p.preservedFile){
    const art=PNG.sync.read(fs.readFileSync(path.join(base,p.artwork))),letters=PNG.sync.read(fs.readFileSync(path.join(base,'lettering',String(p.number).padStart(2,'0')+'.png')));
    assert.equal(art.width,spec.format.width);assert.equal(art.height,spec.format.height);
    assert.equal(art.width,letters.width);assert.equal(art.height,letters.height);
    for(let i=0;i<art.data.length;i+=4){
      const a=letters.data[i+3]/255;
      for(let c=0;c<3;c++)art.data[i+c]=Math.round(letters.data[i+c]*a+art.data[i+c]*(1-a));
      art.data[i+3]=255;
    }
    fs.writeFileSync(path.join(base,p.output),PNG.sync.write(art));
  }
  const file=path.join(base,p.output),image=PNG.sync.read(fs.readFileSync(file));
  assert.equal(image.width,spec.format.width);assert.equal(image.height,spec.format.height);
  for(let i=3;i<image.data.length;i+=4)assert.equal(image.data[i],255,'Opaque final panel required');
  outputs.push({panel:p.number,file:p.output,width:image.width,height:image.height,sha256:fileHash(file),bytes:fs.statSync(file).size,approvedPanelPreserved:Boolean(p.preservedFile)});
}
function preview(file,width,height,gap){
  const sheet=new PNG({width:width*2+gap*3,height:height*2+gap*3});
  for(let i=0;i<sheet.data.length;i+=4)sheet.data.set([253,248,242,255],i);
  for(let i=0;i<outputs.length;i++){
    const source=PNG.sync.read(fs.readFileSync(path.join(base,outputs[i].file)));
    PNG.bitblt(resizePremultiplied(source,width,height),sheet,0,0,width,height,gap+i%2*(width+gap),gap+Math.floor(i/2)*(height+gap));
  }
  fs.writeFileSync(path.join(base,file),PNG.sync.write(sheet));
  return {file,width:sheet.width,height:sheet.height,sha256:fileHash(path.join(base,file))};
}
const overview=preview('jango-ep01-v6-overview.png',561,701,20),mobile=preview('review-mobile-360.png',360,450,8);
const report={outputs,overview,mobile,masterAssetsVerified:Object.keys(readMasterSet().assets).length,typography:'typography-report.json',approvedPanels1And2BytePreservation:'pass',networkRequired:false};
fs.writeFileSync(path.join(base,'render-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('Assembled 4 panels and review sheets; approved panels 1 and 2 remain byte-identical.');
