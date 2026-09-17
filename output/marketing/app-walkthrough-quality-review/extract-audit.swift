import Foundation
import AVFoundation
import AppKit

setbuf(stdout,nil)
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let marketing=root.deletingLastPathComponent()
let files:[(String,URL)]=[
 ("source",URL(fileURLWithPath:"/Users/namu/Downloads/ScreenRecording_09-17-2026 10-52-50_1.mov")),
 ("v1",marketing.appendingPathComponent("app-walkthrough-reel-v1/jango-walkthrough-reel.mp4")),
 ("v2",marketing.appendingPathComponent("app-walkthrough-reel-v2/jango-walkthrough-reel.mp4")),
 ("v3",marketing.appendingPathComponent("app-walkthrough-reel-v3/jango-walkthrough-reel.mp4")),
 ("narrated",marketing.appendingPathComponent("app-walkthrough-reel-v4-narrated/jango-walkthrough-narrated.mp4"))
]
func fourcc(_ value:FourCharCode)->String {
 String(bytes:[UInt8((value>>24)&255),UInt8((value>>16)&255),UInt8((value>>8)&255),UInt8(value&255)],encoding:.ascii) ?? "unknown"
}
var metadata:[[String:Any]]=[]
for (label,url) in files {
 print("READING",label,url.path)
 let a=AVURLAsset(url:url)
 guard let t=a.tracks(withMediaType:.video).first else {print("NO_VIDEO_TRACK",label);continue}
 guard let description=t.formatDescriptions.first else {print("NO_FORMAT",label);continue}
 let d=description as! CMFormatDescription
 let e=CMFormatDescriptionGetExtensions(d)! as NSDictionary
 let atoms=e[kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms] as? NSDictionary
 var bitDepth=8
 if let hvcC=atoms?["hvcC"] as? Data,hvcC.count>18 { bitDepth=8+Int(hvcC[17]&7) }
 metadata.append(["label":label,"path":url.path,"width":t.naturalSize.width,"height":t.naturalSize.height,"duration":a.duration.seconds,"fps":t.nominalFrameRate,"estimated_video_bitrate_mbps":t.estimatedDataRate/1_000_000,"codec":fourcc(CMFormatDescriptionGetMediaSubType(d)),"bit_depth_luma":bitDepth,"color_primaries":e[kCMFormatDescriptionExtension_ColorPrimaries] ?? "unspecified","transfer_function":e[kCMFormatDescriptionExtension_TransferFunction] ?? "unspecified","color_matrix":e[kCMFormatDescriptionExtension_YCbCrMatrix] ?? "unspecified","bytes":(try FileManager.default.attributesOfItem(atPath:url.path)[.size] as! NSNumber).intValue])
}
try JSONSerialization.data(withJSONObject:metadata,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("video-metadata.json"))
let refs=marketing.appendingPathComponent("app-walkthrough-reel-v3/render-review")
let names=try FileManager.default.contentsOfDirectory(at:refs,includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent < $1.lastPathComponent}
let final=AVURLAsset(url:files.last!.1)
let gen=AVAssetImageGenerator(asset:final)
gen.appliesPreferredTrackTransform=true
gen.dynamicRangePolicy = .forceSDR
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let frames=root.appendingPathComponent("encoded-frames")
try FileManager.default.createDirectory(at:frames,withIntermediateDirectories:true)
let srgb=CGColorSpace(name:CGColorSpace.sRGB)!
var samples:[[String:Any]]=[]
for ref in names {
 let index=Int(ref.deletingPathExtension().lastPathComponent.replacingOccurrences(of:"frame-",with:""))!
 if index>=860 {continue}
 var actual=CMTime.zero
 let cg=try gen.copyCGImage(at:CMTime(value:Int64(index),timescale:30),actualTime:&actual)
 let c=CGContext(data:nil,width:1206,height:2622,bitsPerComponent:8,bytesPerRow:1206*4,space:srgb,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 c.draw(cg,in:CGRect(x:0,y:0,width:1206,height:2622))
 let to=frames.appendingPathComponent(ref.lastPathComponent)
 try NSBitmapImageRep(cgImage:c.makeImage()!).representation(using:.png,properties:[:])!.write(to:to)
 samples.append(["frame":index,"time":Double(index)/30,"decoded_time":actual.seconds,"reference":ref.path,"encoded":to.path])
}
try JSONSerialization.data(withJSONObject:samples,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("sample-pairs.json"))
print("EXTRACTED",samples.count,"matched pairs")
print(String(data:try JSONSerialization.data(withJSONObject:metadata,options:[.prettyPrinted,.sortedKeys]),encoding:.utf8)!)
