/* global ObjC, $ */
// Typography only: all characters, scenes, props and balloons are image_gen artwork.
ObjC.import('AppKit');
ObjC.import('CoreText');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function run(argv) {
  const root=argv[0],base=argv[1];
  if(!base.endsWith('/output/marketing/jango-sns-ep01-final-v3'))throw Error('Episode directory required');
  const read=p=>ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));
  const spec=JSON.parse(read(base+'/episode.json')),{width:W,height:H}=spec.format;
  for(const font of spec.fonts)$.CTFontManagerRegisterFontsForURL($.NSURL.fileURLWithPath(root+'/'+font),1,null);
  const report=[];
  for(const p of spec.panels){
    if(p.preservedFile)continue;
    const bitmap=$.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null,W,H,8,4,true,false,$.NSDeviceRGBColorSpace,W*4,32);
    const context=$.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap);
    void $.NSGraphicsContext.saveGraphicsState;$.NSGraphicsContext.setCurrentContext(context);
    const records=[];
    for(const t of p.texts){
      const [x,y,w,h]=t.box,a=$.NSMutableDictionary.alloc.init,font=t.font||'Gaegu-Bold';
      const f=$.NSFont.fontWithNameSize(font,t.size);if(!f)throw Error('Font not found: '+font);
      a.setObjectForKey(f,$.NSFontAttributeName);
      a.setObjectForKey($.NSColor.colorWithCalibratedRedGreenBlueAlpha(0.29,0.25,0.22,1),$.NSForegroundColorAttributeName);
      const metrics=t.lines.map(s=>$(s).sizeWithAttributes(a));
      const width=Math.max(...metrics.map(s=>s.width)),height=(t.lines.length-1)*t.lineHeight+Math.max(...metrics.map(s=>s.height));
      if(width>w||height>h)throw Error('Text overflow panel '+p.number+': '+t.lines.join('/')+' '+width+'x'+height+' exceeds '+w+'x'+h);
      t.lines.forEach((s,i)=>$(s).drawAtPointWithAttributes($.NSMakePoint(x+(w-metrics[i].width)/2,H-y-i*t.lineHeight-metrics[i].height),a));
      records.push({...t,font,measuredWidth:width,measuredHeight:height,overflow:false});
    }
    void $.NSGraphicsContext.restoreGraphicsState;
    const output=base+'/lettering/'+String(p.number).padStart(2,'0')+'.png';
    if(!bitmap.representationUsingTypeProperties($.NSPNGFileType,$({})).writeToFileAtomically(output,true))throw Error('PNG write failed');
    report.push({panel:p.number,text:records});
  }
  $(JSON.stringify(report,null,2)+'\n').writeToFileAtomicallyEncodingError(base+'/typography-report.json',true,$.NSUTF8StringEncoding,null);
  return 'Rendered and measured Korean lettering for panels 1, 3 and 4; panel 2 untouched.';
}
