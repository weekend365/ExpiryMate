// Run with: osascript -l JavaScript scripts/render-jango-lettering.jxa.js
// Deterministic typography only; never draws or modifies character anatomy.
/* global ObjC, $ */
ObjC.import('AppKit');
ObjC.import('CoreText');
// osascript calls this entry point by name.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function run(argv) {
  const root = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
  const relative = argv[0] || 'design/jango/emoticons/kakao-32/v18';
  if (!/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(relative)) throw Error('Canonical version directory required');
  const base = root + '/' + relative;
  const read = p => ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null));
  if(relative==='design/jango/emoticons/kakao-32/v18') throw Error('v18 MASTER lettering is immutable; create a new version');
  const rows = JSON.parse(read(base + '/plan.json'));
  if (rows.some(row=>row.layout)) for (const weight of ['Regular','Bold']) $.CTFontManagerRegisterFontsForURL($.NSURL.fileURLWithPath(base + '/fonts/Gaegu-'+weight+'.ttf'), 1, null);
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(base + '/lettering', true, $({}), null);
  const records = [];
  for (const row of rows) {
    const bitmap = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, 1024, 1024, 8, 4, true, false, $.NSDeviceRGBColorSpace, 4096, 32);
    const context = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap);
    void $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(context);
    const custom=row.layout?.lettering;
    const layers = [{text:row.line, ...custom}, ...(row.layout?.symbols || []).map(symbol=>({...custom,lines:undefined,maxWidth:300,...symbol}))];
    let captionSize;
    for (const layer of layers) {
    void $.NSGraphicsContext.saveGraphicsState;
    const spec=custom?layer:undefined;
    let size = spec?.size || 140, text, attrs, measured, lineMetrics;
    do {
      attrs = $.NSMutableDictionary.alloc.init;
      const font=$.NSFont.fontWithNameSize(spec?.font || 'Gaegu-Regular', size);
      if(!font) throw Error('Font not registered');
      attrs.setObjectForKey(font, $.NSFontAttributeName);
      attrs.setObjectForKey($.NSColor.colorWithCalibratedWhiteAlpha(0.13, 1), $.NSForegroundColorAttributeName);
      attrs.setObjectForKey($.NSColor.whiteColor, $.NSStrokeColorAttributeName);
      attrs.setObjectForKey($(-(spec?.outline ?? 8)), $.NSStrokeWidthAttributeName);
      text = $((spec?.lines || [layer.text]).join('\n'));
      measured = text.sizeWithAttributes(attrs);
      lineMetrics=spec?.lines?.map(line=>({text:$(line),size:$(line).sizeWithAttributes(attrs)}));
      if(lineMetrics)measured={width:Math.max(...lineMetrics.map(line=>line.size.width)),height:lineMetrics.reduce((sum,line)=>sum+line.size.height,0)};
      if (measured.width <= (spec?.maxWidth || 920)) break;
      size -= 2;
    } while (size > 60);
    if (layer.text) {
      if(spec){const transform=$.NSAffineTransform.transform;transform.translateXByYBy(spec.x,1024-spec.y);transform.rotateByDegrees(-spec.rotation);void transform.concat;}
      const origin = spec ? $.NSMakePoint(-measured.width/2,-measured.height/2) : $.NSMakePoint((1024-measured.width)/2, 1024-40-measured.height);
      const draw=()=>{if(lineMetrics){let y=measured.height/2;for(const line of lineMetrics){y-=line.size.height;line.text.drawAtPointWithAttributes($.NSMakePoint(-line.size.width/2,y),attrs);}}else text.drawAtPointWithAttributes(origin,attrs);};
      draw();
      attrs.setObjectForKey($(0), $.NSStrokeWidthAttributeName);
      draw();
    }
    void $.NSGraphicsContext.restoreGraphicsState;
    if(layer===layers[0])captionSize=size;
    }
    void $.NSGraphicsContext.restoreGraphicsState;
    const png = bitmap.representationUsingTypeProperties($.NSPNGFileType, $({}));
    if (!png.writeToFileAtomically(base + '/lettering/' + String(row.n).padStart(2, '0') + '.png', true)) throw Error('PNG write failed');
    records.push({number: row.n, line: row.line, fontSize1024: captionSize, symbols:row.layout?.symbols || [], font: custom?.font || 'Gaegu-Regular', placement:custom || 'top'});
  }
  $(JSON.stringify(records, null, 2) + '\n').writeToFileAtomicallyEncodingError(base + '/lettering-record.json', true, $.NSUTF8StringEncoding, null);
  return 'Rendered '+rows.length+' transparent lettering layers with bundled fonts.';
}
