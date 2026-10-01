// Conservative geometry screen for user-authorized neutral-line and sad-arc.
// Does not certify identity, placement, rounded caps, or emotional readability.
function geometry(png, roi, threshold, alphaMin) {
  const [x0,y0,w,h]=roi, columns=[];
  for(let x=0;x<w;x++) {
    const ys=[];
    for(let y=0;y<h;y++) {
      const i=((y+y0)*png.width+x+x0)*4;
      if(png.data[i+3]>alphaMin && Math.max(...png.data.subarray(i,i+3))<threshold) ys.push(y);
    }
    if(ys.length) columns.push({x,y:ys.reduce((a,b)=>a+b,0)/ys.length,thickness:ys.length,span:ys.at(-1)-ys[0]+1});
  }
  if(columns.length<12) return null;
  const width=columns.at(-1).x-columns[0].x+1;
  const interior=columns.filter(c=>(c.x-columns[0].x)/width>=0.15 && (c.x-columns[0].x)/width<=0.85);
  const band=(lo,hi)=>columns.filter(c=>(c.x-columns[0].x)/width>=lo && (c.x-columns[0].x)/width<=hi);
  const avg=(xs,key)=>xs.reduce((a,b)=>a+b[key],0)/xs.length;
  const left=band(0.1,0.25),middle=band(0.4,0.6),right=band(0.75,0.9);
  if(!left.length||!middle.length||!right.length||!interior.length) return null;
  const slope=(avg(right,'y')-avg(left,'y'))/(avg(right,'x')-avg(left,'x'));
  const residuals=interior.map(c=>c.y-slope*c.x);
  return {width,coverage:columns.length/width,thicknessRatio:avg(interior,'thickness')/width,
    splitColumns:interior.some(c=>c.span-c.thickness>2),
    curvature:((avg(left,'y')+avg(right,'y'))/2-avg(middle,'y'))/width,
    flatness:(Math.max(...residuals)-Math.min(...residuals))/width,
    slope};
}
export function screenLineMouth(png,roi,rules,mode,measureMouth) {
  const limits=rules.lineMouthScreen;
  const samples=rules.mouthScreen.thresholds.map(threshold=>{
    const m=measureMouth(png,roi,threshold,rules.mouthScreen.alphaMin);
    const g=geometry(png,roi,threshold,rules.mouthScreen.alphaMin);
    const ambiguous=m.components!==1||m.touchesEdge||m.pixels<rules.mouthScreen.minPixels||!g||g.coverage<limits.minCoverage||Math.abs(g.slope)>limits.maxSlope;
    const closed=m.holes>rules.mouthScreen.maxHolePixels;
    const badStroke=g&&(g.thicknessRatio<limits.minThicknessRatio||g.thicknessRatio>limits.maxThicknessRatio||g.splitColumns);
    const badCurve=g&&(mode==='neutral-line'
      ? Math.abs(g.curvature)>limits.maxNeutralCurvature||g.flatness>limits.maxNeutralFlatness
      : g.curvature<limits.minSadCurvature||g.curvature>limits.maxSadCurvature);
    const status=ambiguous?'needs-review':closed||badStroke||badCurve?'fail':'pass';
    return {threshold,...m,geometry:g,status,reason:ambiguous?'unmeasurable-or-ambiguous':closed?'closed-outline':badStroke?'invalid-stroke':badCurve?'wrong-curvature':'line-screen-only'};
  });
  const statuses=new Set(samples.map(s=>s.status));
  return {mode,status:statuses.size===1?samples[0].status:'needs-review',samples};
}
