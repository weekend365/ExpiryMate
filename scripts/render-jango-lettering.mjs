// Opt-in measured glyph sizing and pixel outlines; the historical JXA path remains unchanged.
import {assertOpenVersion} from './jango-history.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {root,local,readJson,writeJson,fileHash,readPng} from './jango-design-gate.mjs';
import {validateLayout} from './jango-emoticon-layout.mjs';
import {resizePremultiplied} from '../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const require=createRequire(path.join(root,'apps/mobile/package.json')),{PNG}=require('pngjs');

function bounds(png){
 let l=png.width,t=png.height,r=-1,b=-1;
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>0){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 return r<0?null:[l,t,r+1,b+1];
}
function composite(dst,src,left,top){
 for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){
  const s=(y*src.width+x)*4,d=((top+y)*dst.width+left+x)*4,a=src.data[s+3]/255,b=dst.data[d+3]/255,alpha=a+b*(1-a);
  for(let c=0;c<3;c++)dst.data[d+c]=alpha?Math.round((src.data[s+c]*a+dst.data[d+c]*b*(1-a))/alpha):0;
  dst.data[d+3]=Math.round(alpha*255);
 }
}
// Rotate the separate text layer with premultiplied bilinear sampling; never edit character artwork.
export function rotateLettering(source,degrees=0){
 assert(Number.isFinite(degrees)&&Math.abs(degrees)<=10,'Lettering rotation out of bounds');
 if(degrees===0)return source;
 const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const width=Math.ceil(Math.abs(source.width*c)+Math.abs(source.height*s))+2,height=Math.ceil(Math.abs(source.width*s)+Math.abs(source.height*c))+2;
 const result=new PNG({width,height});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=x-(width-1)/2,dy=y-(height-1)/2,sx=c*dx+s*dy+(source.width-1)/2,sy=-s*dx+c*dy+(source.height-1)/2;
  const x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0,rgba=[0,0,0,0];
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){
   const xx=x0+i,yy=y0+j;if(xx<0||yy<0||xx>=source.width||yy>=source.height)continue;
   const at=(yy*source.width+xx)*4,weight=(i?fx:1-fx)*(j?fy:1-fy),alpha=source.data[at+3]/255;
   rgba[3]+=alpha*weight;for(let k=0;k<3;k++)rgba[k]+=source.data[at+k]*alpha*weight;
  }
  const at=(y*width+x)*4;result.data[at+3]=Math.round(rgba[3]*255);
  for(let k=0;k<3;k++)result.data[at+k]=rgba[3]?Math.round(rgba[k]/rgba[3]):0;
 }
 return result;
}
export function normalizeLettering(source,spec,reference=null){
 const rect=bounds(source);assert(rect,'Normalized caption must contain ink');
 const tight=new PNG({width:rect[2]-rect[0],height:rect[3]-rect[1]});PNG.bitblt(source,tight,rect[0],rect[1],tight.width,tight.height,0,0);
 const radius=spec.outlinePx,pad=Math.ceil(radius+1),usesReference=spec.sizeBasis==='font-reference';
 const referenceBounds=reference?bounds(reference):null;
 if(usesReference)assert(referenceBounds,'Reference lettering must contain ink');
 const referenceHeight=referenceBounds?referenceBounds[3]-referenceBounds[1]:null;
 const scale=usesReference?spec.inkHeight/referenceHeight:Math.min(spec.inkHeight/tight.height,(spec.maxWidth-2*pad)/tight.width);
 assert(Number.isFinite(scale)&&scale>0,'Invalid normalized caption size');
 if(usesReference)assert(Math.round(tight.width*scale)+2*pad<=spec.maxWidth,'Caption exceeds shared font size width; change layout or size tier, never stretch or auto-fit this caption');
 const ink=resizePremultiplied(tight,Math.max(1,Math.round(tight.width*scale)),Math.max(1,Math.round(tight.height*scale)));
 const outlined=new PNG({width:ink.width+pad*2,height:ink.height+pad*2}),kernel=[];
 for(let dy=-pad;radius>0&&dy<=pad;dy++)for(let dx=-pad;dx<=pad;dx++){const weight=Math.max(0,Math.min(1,radius+.5-Math.hypot(dx,dy)));if(weight>0)kernel.push({dx,dy,weight});}
 for(let y=0;y<ink.height;y++)for(let x=0;x<ink.width;x++){
  const alpha=ink.data[(y*ink.width+x)*4+3];if(!alpha)continue;
  for(const {dx,dy,weight} of kernel){const i=((y+pad+dy)*outlined.width+x+pad+dx)*4;outlined.data[i]=outlined.data[i+1]=outlined.data[i+2]=255;outlined.data[i+3]=Math.max(outlined.data[i+3],Math.round(alpha*weight));}
 }
 composite(outlined,ink,pad,pad);
 const rotated=rotateLettering(outlined,spec.rotation??0),box=bounds(rotated),width=box[2]-box[0],height=box[3]-box[1],left=Math.round(spec.x-width/2),top=Math.round(spec.y-height/2);
 assert(left>=0&&top>=0&&left+width<=1024&&top+height<=1024,'Normalized caption outside canvas');
 const result=new PNG({width:1024,height:1024}),cropped=new PNG({width,height});PNG.bitblt(rotated,cropped,box[0],box[1],width,height,0,0);PNG.bitblt(cropped,result,0,0,width,height,left,top);
 return {png:result,metrics:{complete:true,method:usesReference?'shared-reference-font-size-with-pixel-outline':'normalized-ink-with-pixel-outline',inkHeight:ink.height,outlinePx:radius,punctuationScale:spec.punctuationScale,...(usesReference?{sizeBasis:spec.sizeBasis,referenceText:spec.referenceText,referenceInkHeight:spec.inkHeight,rawReferenceInkHeight:referenceHeight,rawCaptionInkHeight:tight.height,scale,effectiveFontSize1024:spec.size*scale}:{}),...(spec.rotation?{rotation:spec.rotation}:{}),bounds:[left,top,width,height]}};
}
export function renderLettering(base,only=null){
 assert(/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base),'Canonical version directory required');
 assert(base!=='design/jango/emoticons/kakao-32/v18','v18 MASTER lettering is immutable');
 assertOpenVersion(base);
 const plan=readJson(base+'/plan.json');
 if(only!==null)assert(Array.isArray(only)&&only.length>0&&new Set(only).size===only.length&&only.every(n=>Number.isInteger(n)&&n>=1&&n<=32&&plan.some(row=>row.n===n)),'Valid unique lettering numbers required');
 const rows=only===null?plan:plan.filter(row=>only.includes(row.n));
 for(const row of rows)if(row.layout?.lettering?.inkHeight!==undefined)validateLayout(row,{width:1024,height:1024});
 execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',base,...(only===null?[]:[only.join(',')])],{cwd:root,stdio:'pipe'});
 const records=readJson(base+'/lettering-record.json');
 for(const row of rows){
  if(row.layout?.lettering?.inkHeight===undefined)continue;
  const file=base+'/lettering/'+String(row.n).padStart(2,'0')+'.png',record=records.find(r=>r.number===row.n);
  const calibration=row.layout.lettering.sizeBasis==='font-reference'?record.calibration:null;
  if(calibration){assert.equal(calibration.font,row.layout.lettering.font);assert.equal(calibration.fontSize1024,row.layout.lettering.size);assert.equal(calibration.text,row.layout.lettering.referenceText);}
  const normalized=normalizeLettering(readPng(file),row.layout.lettering,calibration?readPng(calibration.file):null);
  fs.writeFileSync(local(file),PNG.sync.write(normalized.png,{colorType:6}));
  if(calibration)calibration.sha256=fileHash(calibration.file);
  if(row.layout.lettering.inkStrokePercent)normalized.metrics.inkStrokePercent=row.layout.lettering.inkStrokePercent;
  Object.assign(record,{normalization:normalized.metrics,sha256:fileHash(file)});
 }
 writeJson(base+'/lettering-record.json',records);
 return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').map(Number)??null;
 console.log(`Rendered ${renderLettering(process.argv[2],only).length} lettering layers.`);
}
