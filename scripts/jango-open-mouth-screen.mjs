// Conservative colour/geometry screen for the explicitly selected speak-open mode.
// Passing this screen never substitutes for visual approval of anatomy or intent.
import assert from "node:assert/strict";

export function measureOpenMouth(png, roi, threshold, alphaMin) {
  assert(Array.isArray(roi) && roi.length === 4 && roi.every(Number.isInteger), "Integer mouth ROI required");
  const [x0,y0,w,h] = roi;
  assert(w >= 8 && h >= 8 && x0 >= 0 && y0 >= 0 && x0+w <= png.width && y0+h <= png.height, "Invalid mouth ROI");
  const dark = [], pink = [], mask = new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const i=((y0+y)*png.width+x0+x)*4, [r,g,b,a]=png.data.subarray(i,i+4);
    if(a<=alphaMin) continue;
    const isDark=Math.max(r,g,b)<threshold;
    const isPink=r>150 && g>60 && r>g*1.2 && r>b*1.1 && Math.abs(g-b)<65;
    if(isDark) dark.push([x,y]);
    if(isPink) pink.push([x,y]);
    if(isDark || isPink) mask[y*w+x]=1;
  }
  const points=[...dark,...pink];
  if(!points.length) return {pixels:0,touchesEdge:false};
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const l=Math.min(...xs),r=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys),width=r-l+1,height=b-t+1;
  let other=0,interior=0;
  for(let y=t;y<=b;y++) {
    let left=r+1,right=l-1;
    for(let x=l;x<=r;x++) if(mask[y*w+x]) {left=Math.min(left,x);right=Math.max(right,x);}
    for(let x=left;x<=right;x++) {interior++;if(!mask[y*w+x])other++;}
  }
  return {pixels:points.length,darkPixels:dark.length,pinkPixels:pink.length,
    aspect:width/height,darkFraction:dark.length/points.length,pinkFraction:pink.length/points.length,
    pinkCenterX:pink.length ? (pink.reduce((s,p)=>s+p[0],0)/pink.length-l)/width : null,
    pinkCenterY:pink.length ? (pink.reduce((s,p)=>s+p[1],0)/pink.length-t)/height : null,
    interiorOtherFraction:interior ? other/interior : 1,
    touchesEdge:l===0 || t===0 || r===w-1 || b===h-1};
}

export function screenOpenMouth(png, roi, rules, reference, measureDark) {
  const limits=rules.openMouthScreen;
  const samples=rules.mouthScreen.thresholds.map(threshold=>{
    const m=measureOpenMouth(png,roi,threshold,rules.mouthScreen.alphaMin);
    const ref=measureOpenMouth(reference,rules.openMouthReference.mouthRoi,threshold,rules.mouthScreen.alphaMin);
    const dark=measureDark(png,roi,threshold,rules.mouthScreen.alphaMin);
    const ambiguous=m.pixels<limits.minPixels || m.touchesEdge || dark.components!==1;
    const valid=m.darkFraction>=limits.minDarkFraction && m.darkFraction<=limits.maxDarkFraction
      && m.pinkFraction>=limits.minPinkFraction && m.pinkFraction<=limits.maxPinkFraction
      && m.pinkCenterY>=limits.minPinkCenterY && m.pinkCenterX>=limits.minPinkCenterX && m.pinkCenterX<=limits.maxPinkCenterX
      && m.aspect/ref.aspect>=limits.minAspectRelative && m.aspect/ref.aspect<=limits.maxAspectRelative
      && m.interiorOtherFraction<=limits.maxInteriorOtherFraction;
    return {threshold,...m,referenceAspect:ref.aspect,status:ambiguous?"needs-review":valid?"pass":"fail",
      reason:ambiguous?"unmeasurable-or-ambiguous":valid?"speak-reference-screen-only":"speak-interior-or-shape-mismatch"};
  });
  const statuses=new Set(samples.map(x=>x.status));
  return {mode:"speak-open",status:statuses.size===1?samples[0].status:"needs-review",samples};
}
