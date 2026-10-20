import assert from 'node:assert/strict';
export const titleFor = row => row.title?.trim() || row.line?.trim() || `장고 ${String(row.n).padStart(2,'0')}`;
export function validatePlan(plan) {
 assert.equal(plan.length,32,'32 entries required');
 assert.deepEqual(plan.map(p=>p.n).sort((a,b)=>a-b),Array.from({length:32},(_,i)=>i+1),'Unique numbers 1–32 required');
 assert.equal(new Set(plan.map(titleFor)).size,32,'Unique semantic titles required');
 for(const row of plan) if(row.layout) {
  assert(typeof row.title==='string'&&row.title.trim(),'Semantic title required independently of caption');
  assert(typeof row.line==='string','Output line must be a string');
 }
}
export function validRect(rect,width,height,label){
 assert(Array.isArray(rect)&&rect.length===4&&rect.every(Number.isInteger),`${label}: integer rectangle required`);
 const [x,y,w,h]=rect;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`${label}: out of bounds`);return rect;
}
export function validateLayout(row,source){
 if(!row.layout)return null;
 const layout=row.layout;
 assert(layout.framing===undefined||layout.framing==='full-body','Unknown framing mode');
 if(layout.framing==='full-body')assert(!layout.framingCrop,'Full-body framing must not crop the original');
 validRect(layout.characterBox,1024,1024,'Character box');
 assert(['silent','reaction','dialogue'].includes(row.captionKind),'Unknown caption kind');
 assert.equal(row.captionKind==='silent',row.line==='','Caption kind / line mismatch');
 if(layout.framingCrop){validRect(layout.framingCrop,source.width,source.height,'Framing crop');assert(typeof layout.framingNote==='string'&&layout.framingNote.trim(),'Framing intent required');}
 if(row.line){const l=layout.lettering;assert(l&&Number.isFinite(l.x)&&Number.isFinite(l.y)&&l.x>0&&l.x<1024&&l.y>0&&l.y<1024,'Lettering center required');assert(Number.isFinite(l.size)&&l.size>=60&&l.size<=220,'Lettering size out of bounds');assert(Number.isFinite(l.rotation)&&Math.abs(l.rotation)<=10,'Lettering rotation out of bounds');assert(['Gaegu-Regular','Gaegu-Bold','GamjaFlower-Regular'].includes(l.font),'Unknown lettering font');assert(Number.isFinite(l.outline)&&l.outline>=0&&l.outline<=12,'Outline out of bounds');}
 if(layout.lettering?.sizeBasis!==undefined){const l=layout.lettering;assert.equal(l.sizeBasis,'font-reference','Unknown lettering size basis');assert(Number.isFinite(l.inkHeight),'Reference sizing requires measured lettering');assert(typeof l.referenceText==='string'&&l.referenceText.trim()===l.referenceText&&l.referenceText.length>=2&&l.referenceText.length<=20&&!/[\n\r…]/.test(l.referenceText),'Stable reference text required');}
 if(layout.lettering?.inkStrokePercent!==undefined){const l=layout.lettering;assert.equal(l.sizeBasis,'font-reference','Ink reinforcement requires shared font sizing');assert(Number.isFinite(l.inkStrokePercent)&&l.inkStrokePercent>=0&&l.inkStrokePercent<=3,'Ink reinforcement out of bounds');}
 if(layout.lettering?.lines){assert(Array.isArray(layout.lettering.lines)&&layout.lettering.lines.length>=1&&layout.lettering.lines.length<=3&&layout.lettering.lines.every(s=>typeof s==='string'&&s.trim()===s&&s.length),'Invalid caption lines');assert.equal(layout.lettering.lines.join(' '),row.line,'Caption lines must preserve exact reading order and text');}
 if(layout.lettering?.inkHeight!==undefined){const l=layout.lettering;assert(Number.isFinite(l.inkHeight)&&l.inkHeight>=60&&l.inkHeight<=180,'Ink height out of bounds');assert(Number.isFinite(l.outlinePx)&&l.outlinePx>=0&&l.outlinePx<=16,'Pixel outline out of bounds');assert(Number.isFinite(l.punctuationScale)&&l.punctuationScale>=0.4&&l.punctuationScale<=1,'Punctuation scale out of bounds');assert(!l.lines&&!layout.symbols?.length,'Normalized lettering requires a single line without extra symbols');assert(Number.isFinite(l.maxWidth)&&l.maxWidth>2*l.outlinePx&&l.maxWidth<=944,'Normalized lettering width out of bounds');}
 for(const symbol of layout.symbols??[]){assert(['?','zzz','♪'].includes(symbol.text),'Unknown text symbol');assert(Number.isFinite(symbol.x)&&symbol.x>0&&symbol.x<1024&&Number.isFinite(symbol.y)&&symbol.y>0&&symbol.y<1024,'Symbol center required');assert(Number.isFinite(symbol.size)&&symbol.size>=60&&symbol.size<=220,'Symbol size out of bounds');assert(Number.isFinite(symbol.rotation)&&Math.abs(symbol.rotation)<=10,'Symbol rotation out of bounds');}
 return layout;
}
export function cropFor(sourceBox,source,layout){
 if(layout?.framing==='full-body')assert(!layout.framingCrop,'Full-body framing must not crop the original');
 if(layout?.framingCrop){const [x,y,w,h]=layout.framingCrop;const l=Math.max(x,sourceBox[0]-4),t=Math.max(y,sourceBox[1]-4),r=Math.min(x+w,sourceBox[2]+4),b=Math.min(y+h,sourceBox[3]+4);assert(r>l&&b>t,'Framing crop excludes character');return[l,t,r-l,b-t];}
 const [l,t,r,b]=sourceBox,x=Math.max(0,l-4),y=Math.max(0,t-4);return [x,y,Math.min(source.width,r+4)-x,Math.min(source.height,b+4)-y];
}
export function placement(width,height,box){const [x,y,w,h]=box,scale=Math.min(w/width,h/height),targetWidth=Math.max(1,Math.round(width*scale)),targetHeight=Math.max(1,Math.round(height*scale));return{width:targetWidth,height:targetHeight,x:x+Math.floor((w-targetWidth)/2),y:y+Math.floor((h-targetHeight)/2)};}
