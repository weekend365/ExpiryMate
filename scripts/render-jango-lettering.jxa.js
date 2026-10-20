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
  if(/^design\/jango\/emoticons\/kakao-32\/v(?:20|21|22|23)$/.test(relative)) throw Error('Closed historical version cannot regenerate resources');
  const plan = JSON.parse(read(base + '/plan.json'));
  const only=argv[1]===undefined?null:argv[1].split(',').map(Number);
  if(only!==null&&(!only.length||new Set(only).size!==only.length||!only.every(n=>Number.isInteger(n)&&n>=1&&n<=32&&plan.some(row=>row.n===n))))throw Error('Valid unique lettering numbers required');
  const rows=only===null?plan:plan.filter(row=>only.includes(row.n));
  if (rows.some(row=>row.layout)) for (const name of new Set(['Gaegu-Regular','Gaegu-Bold',...rows.map(row=>row.layout?.lettering?.font).filter(Boolean)])) $.CTFontManagerRegisterFontsForURL($.NSURL.fileURLWithPath(base + '/fonts/'+name+'.ttf'), 1, null);
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(base + '/lettering', true, $({}), null);
  const calibrations={};
  if(rows.some(row=>row.layout?.lettering?.sizeBasis==='font-reference')) $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(base + '/lettering-calibration', true, $({}), null);
  const records = [];
  for (const row of rows) {
    if(row.layout?.lettering?.inkHeight!==undefined){
      const spec=row.layout.lettering;
      let calibration;
      if(spec.sizeBasis==='font-reference'){
        const key=spec.font+'-'+spec.size+'-'+spec.referenceText;
        if(!calibrations[key]){
          const referenceBitmap=$.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null,1024,1024,8,4,true,false,$.NSDeviceRGBColorSpace,4096,32);
          const referenceContext=$.NSGraphicsContext.graphicsContextWithBitmapImageRep(referenceBitmap);
          void $.NSGraphicsContext.saveGraphicsState;$.NSGraphicsContext.setCurrentContext(referenceContext);
          const referenceAttrs=$.NSMutableDictionary.alloc.init,referenceFont=$.NSFont.fontWithNameSize(spec.font,spec.size);
          if(!referenceFont)throw Error('Reference font not registered');
          referenceAttrs.setObjectForKey(referenceFont,$.NSFontAttributeName);
          referenceAttrs.setObjectForKey($.NSColor.colorWithCalibratedWhiteAlpha(0.13,1),$.NSForegroundColorAttributeName);
          const reference=$(spec.referenceText),referenceSize=reference.sizeWithAttributes(referenceAttrs);
          if(referenceSize.width>980||referenceSize.height>980)throw Error('Reference text exceeds canvas');
          reference.drawAtPointWithAttributes($.NSMakePoint((1024-referenceSize.width)/2,(1024-referenceSize.height)/2),referenceAttrs);
          void $.NSGraphicsContext.restoreGraphicsState;
          const relativeFile=relative+'/lettering-calibration/'+spec.font+'-'+spec.size+'-'+Object.keys(calibrations).length+'.png';
          if(!referenceBitmap.representationUsingTypeProperties($.NSPNGFileType,$({})).writeToFileAtomically(root+'/'+relativeFile,true))throw Error('Reference PNG write failed');
          calibrations[key]={file:relativeFile,font:spec.font,fontSize1024:spec.size,text:spec.referenceText};
        }
        calibration=calibrations[key];
      }
      const bitmap=$.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null,1024,1024,8,4,true,false,$.NSDeviceRGBColorSpace,4096,32);
      const context=$.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap);
      void $.NSGraphicsContext.saveGraphicsState;$.NSGraphicsContext.setCurrentContext(context);
      const attrs=$.NSMutableDictionary.alloc.init,font=$.NSFont.fontWithNameSize(spec.font,spec.size);
      if(!font)throw Error('Font not registered');
      attrs.setObjectForKey(font,$.NSFontAttributeName);
      attrs.setObjectForKey($.NSColor.colorWithCalibratedWhiteAlpha(0.13,1),$.NSForegroundColorAttributeName);
      if(spec.inkStrokePercent){attrs.setObjectForKey($.NSColor.colorWithCalibratedWhiteAlpha(0.13,1),$.NSStrokeColorAttributeName);attrs.setObjectForKey($(-spec.inkStrokePercent),$.NSStrokeWidthAttributeName);}
      const at=row.line.indexOf('…'),main=$(at>=0?row.line.slice(0,at):row.line),mainSize=main.sizeWithAttributes(attrs);
      if(at>=0&&at!==row.line.length-1)throw Error('Only a trailing ellipsis is supported by normalized lettering');
      let punctuation,punctuationSize;
      if(at>=0){punctuation=attrs.mutableCopy;punctuation.setObjectForKey($.NSFont.fontWithNameSize(spec.font,spec.size*spec.punctuationScale),$.NSFontAttributeName);punctuationSize=$('…').sizeWithAttributes(punctuation);}
      const width=mainSize.width+(punctuationSize?punctuationSize.width:0);
      if(width>980||mainSize.height>980)throw Error('Raw normalized lettering exceeds canvas');
      const origin=$.NSMakePoint((1024-width)/2,(1024-mainSize.height)/2);
      main.drawAtPointWithAttributes(origin,attrs);
      if(punctuationSize)$('…').drawAtPointWithAttributes($.NSMakePoint(origin.x+mainSize.width,origin.y),punctuation);
      void $.NSGraphicsContext.restoreGraphicsState;
      const png=bitmap.representationUsingTypeProperties($.NSPNGFileType,$({}));
      if(!png.writeToFileAtomically(base+'/lettering/'+String(row.n).padStart(2,'0')+'.png',true))throw Error('PNG write failed');
      records.push({number:row.n,line:row.line,fontSize1024:spec.size,symbols:[],font:spec.font,placement:spec,...(calibration?{calibration}:{}),normalization:{complete:false}});
      continue;
    }
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
