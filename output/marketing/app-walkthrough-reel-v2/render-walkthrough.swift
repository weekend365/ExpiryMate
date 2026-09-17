import Foundation
import AppKit
import AVFoundation
import CoreImage
import CoreText
import CoreVideo

enum RenderFailure: Error { case message(String) }
struct Segment {
    let id: String
    let sourceStart: Double
    let sourceEnd: Double
    let frames: Int
    let chapter: String
    let caption: String
    let note: String
}
setbuf(stdout,nil)
let root=URL(fileURLWithPath:CommandLine.arguments[2])
let sourceURL=URL(fileURLWithPath:CommandLine.arguments[1])
let previewOnly=CommandLine.arguments.contains("--preview")
let width=1080,height=1920,fps=30
let endFrames=120
let segments:[Segment]=[
 .init(id:"hook",sourceStart:80.92,sourceEnd:81.65,frames:60,chapter:"재료 등록부터 요리 추천까지",caption:"남은 두부로\n오늘 뭐 먹지?",note:"추천 결과 미리보기"),
 .init(id:"open-entry",sourceStart:13.0,sourceEnd:15.1,frames:42,chapter:"01  재료 등록",caption:"냉장고 재료부터 넣어요",note:"입력 방식 선택"),
 .init(id:"name",sourceStart:15.1,sourceEnd:19.85,frames:90,chapter:"01  재료 등록",caption:"재료 이름을 넣고",note:"입력 구간 1.58배속"),
 .init(id:"date",sourceStart:19.85,sourceEnd:22.75,frames:72,chapter:"01  재료 등록",caption:"유통기한을 골라주세요",note:"날짜 선택 1.21배속"),
 .init(id:"saved",sourceStart:22.75,sourceEnd:24.7,frames:54,chapter:"01  재료 등록",caption:"두부 등록, 끝!",note:"등록 결과 확인"),
 .init(id:"settings",sourceStart:40.8,sourceEnd:44.65,frames:60,chapter:"02  요리 추천",caption:"어떤 재료로 요리할까요?",note:"추천 설정 진입"),
 .init(id:"ingredients",sourceStart:44.65,sourceEnd:55.75,frames:90,chapter:"02  요리 추천",caption:"추천에 쓸 재료를 골라요",note:"재료 선택 구간 3.7배속"),
 .init(id:"apply",sourceStart:55.75,sourceEnd:60.9,frames:54,chapter:"02  요리 추천",caption:"조건을 정하고 추천받기",note:"조건 적용 2.86배속"),
 .init(id:"wait-start",sourceStart:60.9,sourceEnd:62.1,frames:20,chapter:"02  요리 추천",caption:"장고가 요리를 고르는 중",note:"대기 구간 편집"),
 .init(id:"wait-end",sourceStart:75.9,sourceEnd:78.8,frames:42,chapter:"02  요리 추천",caption:"장고가 요리를 고르는 중",note:"중간 대기 13.8초 생략"),
 .init(id:"results",sourceStart:78.8,sourceEnd:81.4,frames:75,chapter:"02  요리 추천",caption:"두부 표고 김치전, 어때요?",note:"실제 추천 결과"),
 .init(id:"recipe",sourceStart:81.4,sourceEnd:86.5,frames:90,chapter:"03  레시피 확인",caption:"필요한 재료와 조리법까지",note:"추천 요리 상세 1.7배속"),
 .init(id:"cooking-step",sourceStart:93.5,sourceEnd:96.0,frames:66,chapter:"03  레시피 확인",caption:"한 단계씩 따라 해보세요",note:"실제 조리 안내 화면"),
 .init(id:"cooking-timer",sourceStart:96.0,sourceEnd:98.25,frames:45,chapter:"03  레시피 확인",caption:"순서와 타이머도 함께",note:"조리 단계 시연, 실제 조리 완료 아님")
]
let bodyFrames=segments.reduce(0){$0+$1.frames}
let totalFrames=bodyFrames+endFrames
let totalDuration=Double(totalFrames)/Double(fps)
try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
let qa=root.appendingPathComponent(previewOnly ? "layout-preview" : "render-review")
try FileManager.default.createDirectory(at:qa,withIntermediateDirectories:true)
let fontRoot=URL(fileURLWithPath:"/Users/namu/Desktop/ExpiryMate/apps/mobile/assets/fonts")
for file in ["Pretendard-Bold.otf","Pretendard-SemiBold.otf","Pretendard-Regular.otf"] {
 CTFontManagerRegisterFontsForURL(fontRoot.appendingPathComponent(file) as CFURL,.process,nil)
}
let cream=CGColor(red:1,green:0.988,blue:0.961,alpha:1)
let ink=CGColor(red:0.102,green:0.122,blue:0.153,alpha:1)
let green=CGColor(red:0.09,green:0.43,blue:0.33,alpha:1)
let gray=CGColor(red:0.39,green:0.43,blue:0.42,alpha:1)
let mint=CGColor(red:0.82,green:0.965,blue:0.90,alpha:1)
let srgb=CGColorSpace(name:CGColorSpace.sRGB)!
let ciContext=CIContext(options:[.workingColorSpace:CGColorSpace(name:CGColorSpace.extendedLinearSRGB)!, .cacheIntermediates:false])
let asset=AVURLAsset(url:sourceURL)
let gen=AVAssetImageGenerator(asset:asset)
gen.appliesPreferredTrackTransform=true
gen.dynamicRangePolicy = .matchSource
gen.requestedTimeToleranceBefore=CMTime(seconds:0.009,preferredTimescale:60000)
gen.requestedTimeToleranceAfter=CMTime(seconds:0.009,preferredTimescale:60000)
let endcard=NSImage(contentsOf:root.appendingPathComponent("endcard.png"))!.cgImage(forProposedRect:nil,context:nil,hints:nil)!

func rectTop(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->CGRect {CGRect(x:x,y:CGFloat(height)-y-h,width:w,height:h)}
func text(_ value:String,top:CGFloat,size:CGFloat,color:CGColor,center:Bool=false,weight:String="Bold",x:CGFloat=72,in context:CGContext) {
 let font=CTFontCreateWithName("Pretendard-\(weight)" as CFString,size,nil)
 let attrs:[NSAttributedString.Key:Any]=[NSAttributedString.Key(kCTFontAttributeName as String):font,NSAttributedString.Key(kCTForegroundColorAttributeName as String):color]
 let line=CTLineCreateWithAttributedString(NSAttributedString(string:value,attributes:attrs))
 var ascent:CGFloat=0,descent:CGFloat=0,leading:CGFloat=0
 let w=CGFloat(CTLineGetTypographicBounds(line,&ascent,&descent,&leading))
 if w>940 {print("TEXT_OVERFLOW",value,w)}
 context.textPosition=CGPoint(x:center ? (CGFloat(width)-w)/2 : x,y:CGFloat(height)-top-ascent)
 CTLineDraw(line,context)
}

func makeFrame(segment:Segment?,time:Double,elapsed:Double,context:CGContext)->Double? {
 context.setFillColor(cream);context.fill(CGRect(x:0,y:0,width:width,height:height))
 context.interpolationQuality = .high
 guard let s=segment else {
   // Keep the generated endcard's CTA above the Reel caption controls.
   let ratio=CGFloat(endcard.height)/CGFloat(endcard.width)
   context.draw(endcard,in:rectTop(63,15,954,954*ratio))
   return nil
 }
 var actual=CMTime.zero
 do {
   let cg=try gen.copyCGImage(at:CMTime(seconds:time,preferredTimescale:60000),actualTime:&actual)
   guard cg.width == 1206 && cg.height == 2622 else {
     throw RenderFailure.message("Source frame dimensions changed")
   }
   // Use the entire original frame, with one fixed scale and position.
   let ci=CIImage(cgImage:cg,options:[.toneMapHDRtoSDR:false,.contentHeadroom:1.0])
       .applyingFilter("CIExposureAdjust",parameters:[kCIInputEVKey:1.4])
   let converted=ciContext.createCGImage(ci,from:ci.extent,format:.RGBA8,colorSpace:srgb)!
   let displayWidth:CGFloat=1206.0*1920.0/2622.0
   context.draw(converted,in:rectTop((1080-displayWidth)/2,0,displayWidth,1920))
 } catch {print("DECODE_ERROR",time,error);return nil}
 // One fixed subtitle panel over the original navigation-header area.
 // Its geometry is constant, including the opening two-line hook.
 let panel=rectTop(132,148,816,124)
 context.setFillColor(CGColor(red:0.06,green:0.09,blue:0.08,alpha:0.87))
 context.addPath(CGPath(roundedRect:panel,cornerWidth:22,cornerHeight:22,transform:nil))
 context.fillPath()
 let lines=s.caption.split(separator:"\n").map(String.init)
 let top:CGFloat=lines.count == 2 ? 157 : 184
 for (i,line) in lines.enumerated(){
   text(line,top:top+CGFloat(i)*54,size:48,color:CGColor(gray:1,alpha:1),center:true,in:context)
 }
 return actual.seconds
}

var timeline:[[String:Any]]=[]
var cursor=0
for s in segments {
 timeline.append(["id":s.id,"source_start":s.sourceStart,"source_end":s.sourceEnd,"output_start":Double(cursor)/30,"output_end":Double(cursor+s.frames)/30,"speed":(s.sourceEnd-s.sourceStart)/(Double(s.frames)/30),"caption":s.caption,"chapter":s.chapter,"note":s.note,"source_frame":[0,0,1206,2622],"display_frame":[(1080.0-1206.0*1920.0/2622.0)/2,0,1206.0*1920.0/2622.0,1920],"subtitle_panel":[132,148,816,124]])
 cursor+=s.frames
}
timeline.append(["id":"endcard","output_start":Double(bodyFrames)/30,"output_end":totalDuration,"note":"New generated Jango endcard, 4 seconds"])
try JSONSerialization.data(withJSONObject:["source":sourceURL.path,"source_duration":asset.duration.seconds,"output_duration":totalDuration,"fps":fps,"width":width,"height":height,"audio":"Source PCM verified silent; no audio added","layout":"Full uncropped original frame, constant scale and position, fixed subtitle overlay","segments":timeline],options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("edit-timeline.json"))
func timestamp(_ seconds:Double)->String {
 let ms=Int((seconds*1000).rounded());return String(format:"%02d:%02d:%02d,%03d",ms/3600000,ms/60000%60,ms/1000%60,ms%1000)
}
var srt="";cursor=0
for (index,s) in segments.enumerated(){srt+="\(index+1)\n\(timestamp(Double(cursor)/30)) --> \(timestamp(Double(cursor+s.frames)/30))\n\(s.caption)\n\n";cursor+=s.frames}
srt+="\(segments.count+1)\n\(timestamp(Double(bodyFrames)/30)) --> \(timestamp(totalDuration))\n장고야 부탁해\n프로필 링크에서 다운로드\n"
try srt.write(to:root.appendingPathComponent("jango-walkthrough-ko.srt"),atomically:true,encoding:.utf8)

if previewOnly {
 var elapsed=0.0
 for (i,s) in segments.enumerated() {
  let c=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:srgb,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  _=makeFrame(segment:s,time:(s.sourceStart+s.sourceEnd)/2,elapsed:elapsed,context:c)
  try NSBitmapImageRep(cgImage:c.makeImage()!).representation(using:.png,properties:[:])!.write(to:qa.appendingPathComponent(String(format:"%02d-%@.png",i,s.id)))
  elapsed+=Double(s.frames)/30
 }
 let c=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:srgb,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 _=makeFrame(segment:nil,time:0,elapsed:elapsed,context:c)
 try NSBitmapImageRep(cgImage:c.makeImage()!).representation(using:.png,properties:[:])!.write(to:qa.appendingPathComponent("14-endcard.png"))
 print("PREVIEW_COMPLETE",totalDuration,root.path)
 exit(0)
}

let outputURL=root.appendingPathComponent("jango-walkthrough-reel.mp4")
guard !FileManager.default.fileExists(atPath:outputURL.path) else {throw RenderFailure.message("Refusing overwrite")}
let writer=try AVAssetWriter(outputURL:outputURL,fileType:.mp4)
writer.shouldOptimizeForNetworkUse=true
let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:width,AVVideoHeightKey:height,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:14_000_000,AVVideoExpectedSourceFrameRateKey:fps,AVVideoMaxKeyFrameIntervalKey:60,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel],AVVideoColorPropertiesKey:[AVVideoColorPrimariesKey:AVVideoColorPrimaries_ITU_R_709_2,AVVideoTransferFunctionKey:AVVideoTransferFunction_ITU_R_709_2,AVVideoYCbCrMatrixKey:AVVideoYCbCrMatrix_ITU_R_709_2]])
input.expectsMediaDataInRealTime=false
let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA,kCVPixelBufferWidthKey as String:width,kCVPixelBufferHeightKey as String:height,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
writer.add(input);guard writer.startWriting() else {throw writer.error!};writer.startSession(atSourceTime:.zero)
var audit:[[String:Any]]=[]
var segmentIndex=0,segmentFirstFrame=0
for f in 0..<totalFrames {
 try autoreleasepool {
  let startWait=Date()
  while !input.isReadyForMoreMediaData {
   if writer.status == .failed {throw writer.error!}
   if Date().timeIntervalSince(startWait)>40 {throw RenderFailure.message("Encoder stall")}
   Thread.sleep(forTimeInterval:0.002)
  }
  while segmentIndex<segments.count && f>=segmentFirstFrame+segments[segmentIndex].frames {segmentFirstFrame+=segments[segmentIndex].frames;segmentIndex+=1}
  let s:Segment?=segmentIndex<segments.count ? segments[segmentIndex]:nil
  let sourceTime=s.map {$0.sourceStart+Double(f-segmentFirstFrame)/Double($0.frames)*($0.sourceEnd-$0.sourceStart)} ?? 0
  var optional:CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault,adaptor.pixelBufferPool!,&optional)==kCVReturnSuccess,let buffer=optional else {throw RenderFailure.message("Pixel buffer allocation")}
  CVPixelBufferLockBaseAddress(buffer,[])
  let c=CGContext(data:CVPixelBufferGetBaseAddress(buffer)!,width:width,height:height,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:srgb,bitmapInfo:CGBitmapInfo.byteOrder32Little.rawValue|CGImageAlphaInfo.premultipliedFirst.rawValue)!
  let actual=makeFrame(segment:s,time:sourceTime,elapsed:Double(f)/30,context:c)
  if s != nil && actual == nil {throw RenderFailure.message("Source decode failed")}
  if f==segmentFirstFrame || f%90==0 || f==totalFrames-1 {
   try NSBitmapImageRep(cgImage:c.makeImage()!).representation(using:.png,properties:[:])!.write(to:qa.appendingPathComponent(String(format:"frame-%05d.png",f)))
  }
  CVPixelBufferUnlockBaseAddress(buffer,[])
  guard adaptor.append(buffer,withPresentationTime:CMTime(value:Int64(f),timescale:30)) else {throw writer.error!}
  var entry:[String:Any]=["frame":f,"output_time":Double(f)/30,"segment":s?.id ?? "endcard"]
  if let actual {entry["source_requested"]=sourceTime;entry["source_actual"]=actual;entry["display_frame"]=[(1080.0-1206.0*1920.0/2622.0)/2,0,1206.0*1920.0/2622.0,1920]}
  audit.append(entry)
  if f%90==0 {print("RENDER",f,"/",totalFrames)}
 }
}
input.markAsFinished();writer.endSession(atSourceTime:CMTime(value:Int64(totalFrames),timescale:30))
let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()}
guard done.wait(timeout: .now() + 60) == .success, writer.status == .completed else {throw writer.error ?? RenderFailure.message("Writer finish")}
try JSONSerialization.data(withJSONObject:audit,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("frame-map.json"))
print("VIDEO_COMPLETE",outputURL.path,"duration",totalDuration,"frames",totalFrames)
