/* global console */
// Official imagegen supplies all new character artwork. This script only limits
// that edit to its subject region, preserves original scene pixels, and letters.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readMasterSet} from '../../../scripts/jango-master-set.mjs';
import {resizePremultiplied} from '../../../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const base=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(base,'../../..');
const require=createRequire(root+'/apps/mobile/package.json'),{PNG}=require('pngjs');
const read=p=>PNG.sync.read(fs.readFileSync(p));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(name,p)=>fs.writeFileSync(base+'/'+name,PNG.sync.write(p));
const prep=JSON.parse(fs.readFileSync(base+'/preparation.json'));
for(const f of prep.inputFiles)assert.equal(hash(root+'/'+f.file),f.sha256);
const original=read(root+'/output/marketing/jango-sns-ep01-direction-v3/discovery-art-r1.png');
const generated=read(base+'/artwork/02-style-r1.png');
assert.equal(generated.width,original.width);assert.equal(generated.height,original.height);
// A reviewed local edit boundary, not character illustration or a MASTER mask.
const subject=[[102,620],[110,593],[139,553],[175,528],[222,508],[240,483],[292,464],[337,464],[381,476],[400,490],[430,477],[467,479],[501,501],[518,527],[535,540],[546,571],[545,603],[534,628],[515,650],[523,680],[539,702],[555,727],[573,818],[589,882],[661,941],[675,963],[681,998],[677,1024],[660,1046],[622,1058],[591,1056],[560,1051],[544,1058],[565,1130],[565,1156],[548,1177],[525,1187],[534,1204],[556,1216],[571,1240],[570,1265],[557,1281],[524,1289],[442,1288],[414,1276],[409,1244],[405,1232],[389,1230],[369,1231],[377,1246],[377,1271],[358,1289],[300,1295],[251,1291],[229,1280],[226,1253],[236,1224],[262,1201],[271,1178],[275,1157],[257,1137],[263,1104],[253,1100],[249,1080],[261,1061],[274,1058],[274,1022],[267,1009],[238,1018],[207,1017],[177,1009],[159,992],[148,962],[131,822],[126,787],[144,749],[174,730],[186,724],[177,716],[143,709],[113,690],[102,655]];
// Preserve the exact existing tofu tray; it is a scene prop, not the style target.
const tray=[[377,935],[384,927],[568,880],[596,886],[656,904],[662,912],[662,921],[650,931],[641,970],[638,975],[611,980],[583,989],[560,998],[501,1013],[477,1018],[466,1017],[461,1007],[447,994],[429,986],[410,983],[402,982],[396,958]];
function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const edited=new PNG({width:original.width,height:original.height});original.data.copy(edited.data);
const mask=new PNG({width:original.width,height:original.height});
let changed=0;
for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
  const i=(y*original.width+x)*4;
  if(inside(x+.5,y+.5,subject)&&!inside(x+.5,y+.5,tray)){
    generated.data.copy(edited.data,i,i,i+4);mask.data.set([255,255,255,255],i);changed++;
  }
}
save('artwork/02-localized-r1.png',edited);save('edit-region-mask.png',mask);
function lettersOver(art,letters){const out=new PNG({width:art.width,height:art.height});assert.equal(art.width,letters.width);assert.equal(art.height,letters.height);art.data.copy(out.data);for(let i=0;i<out.data.length;i+=4){const a=letters.data[i+3]/255;for(let c=0;c<3;c++)out.data[i+c]=Math.round(letters.data[i+c]*a+art.data[i+c]*(1-a));out.data[i+3]=255;}return out;}
const p1art=read(root+'/output/marketing/jango-sns-ep01-final-v3/artwork/01-r1.png'),p1letters=read(base+'/lettering/01.png');
const p1=lettersOver(p1art,p1letters),p2letters=read(root+'/output/marketing/jango-sns-ep01-direction-v3/discovery-lettering-r1.png'),p2=lettersOver(edited,p2letters);
save('jango-ep01-v4-01-dialogue.png',p1);save('jango-ep01-v4-02-style.png',p2);
let p1OutsideDifferences=0,p2OutsideDifferences=0;
for(let i=0;i<p1.data.length;i+=4)if(p1letters.data[i+3]===0&&!p1.data.subarray(i,i+4).equals(p1art.data.subarray(i,i+4)))p1OutsideDifferences++;
for(let i=0;i<edited.data.length;i+=4)if(mask.data[i+3]===0&&!edited.data.subarray(i,i+4).equals(original.data.subarray(i,i+4)))p2OutsideDifferences++;
assert.equal(p1OutsideDifferences,0);assert.equal(p2OutsideDifferences,0);
function pair(name,a,b,w=561,h=701,gap=20){const p=new PNG({width:w*2+gap*3,height:h+gap*2});for(let i=0;i<p.data.length;i+=4)p.data.set([253,248,242,255],i);for(const [n,art]of[a,b].entries())PNG.bitblt(resizePremultiplied(art,w,h),p,0,0,w,h,gap+n*(w+gap),gap);save(name,p);}
pair('review-two-panels.png',p1,p2);pair('style-before-after.png',read(root+'/output/marketing/jango-sns-ep01-direction-v3/discovery-review-r1.png'),p2);
pair('review-mobile-360.png',p1,p2,360,450,12);
const validation={width:p1.width,height:p1.height,exactFirstDialogue:'냉장고에 뭐 있더라… 그냥 배달 시킬까?',firstPanelOutsideLetteringChangedPixels:p1OutsideDifferences,secondPanelOutsideLocalEditMaskChangedPixels:p2OutsideDifferences,editMaskPixels:changed,originalSecondLetteringSHA256:hash(root+'/output/marketing/jango-sns-ep01-direction-v3/discovery-lettering-r1.png'),masterFilesVerified:Object.keys(readMasterSet().assets).length,originalInputHashesPreserved:prep.inputFiles.every(f=>hash(root+'/'+f.file)===f.sha256),generatedSource:'generated_images/exec-26748107-33c1-4139-a441-11ed71cda82f.png',generatedSourceSHA256:hash(base+'/artwork/02-style-r1.png'),generationTool:'built-in image_gen',generationCalls:1,localization:'Original pixels restored outside a manually delineated Jango edit boundary; original tofu tray preserved. Boundary visual review required.',outputs:['jango-ep01-v4-01-dialogue.png','jango-ep01-v4-02-style.png','review-two-panels.png','style-before-after.png'].map(file=>({file,sha256:hash(base+'/'+file)})),userAdoption:null};
fs.writeFileSync(base+'/validation.json',JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify(validation,null,2));
