import Foundation
import AppKit
import AVFoundation

setbuf(stdout, nil)
let source = CommandLine.arguments[1]
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let interval = Double(CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "5")!
let asset = AVURLAsset(url: URL(fileURLWithPath: source))
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let duration = asset.duration.seconds
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 540, height: 1174)
gen.requestedTimeToleranceBefore = CMTime(seconds: 0.025, preferredTimescale: 600)
gen.requestedTimeToleranceAfter = CMTime(seconds: 0.025, preferredTimescale: 600)
var frames: [(Double, CGImage)] = []
var times = stride(from: 0.0, to: duration, by: interval).map { $0 }
if CommandLine.arguments.count > 4 { times = CommandLine.arguments[4].split(separator: ",").compactMap { Double($0) } }
for time in times {
    do {
        let image = try gen.copyCGImage(at: CMTime(seconds: min(time,duration-0.05), preferredTimescale: 600), actualTime: nil)
        let url = output.appendingPathComponent(String(format: "frame-%06.2f.png", time))
        try NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!.write(to: url)
        frames.append((time,image))
    } catch { print("FRAME_ERROR",time,error) }
}
for offset in stride(from: 0, to: frames.count, by: 6) {
    let slice = Array(frames[offset..<min(offset+6,frames.count)])
    let width = 1080, height = 1600
    let context = CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(gray:0.15,alpha:1));context.fill(CGRect(x:0,y:0,width:width,height:height))
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext:context,flipped:false)
    for (index,pair) in slice.enumerated() {
        let x = CGFloat(index%3)*360, y = CGFloat(1-index/3)*800
        let scale = min(340/CGFloat(pair.1.width),740/CGFloat(pair.1.height))
        let w=CGFloat(pair.1.width)*scale,h=CGFloat(pair.1.height)*scale
        context.draw(pair.1,in:CGRect(x:x+(360-w)/2,y:y+40,width:w,height:h))
        (String(format:"%.2f s",pair.0) as NSString).draw(at:CGPoint(x:x+18,y:y+8),withAttributes:[.font:NSFont.monospacedDigitSystemFont(ofSize:24,weight:.semibold),.foregroundColor:NSColor.white])
    }
    NSGraphicsContext.restoreGraphicsState()
    try NSBitmapImageRep(cgImage:context.makeImage()!).representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("sheet-\(offset/6+1).png"))
}
var tracks:[[String:Any]]=[]
for t in asset.tracks {
    tracks.append(["type":t.mediaType.rawValue,"duration":t.timeRange.duration.seconds,"fps":t.nominalFrameRate,"width":t.naturalSize.width,"height":t.naturalSize.height,"dataRate":t.estimatedDataRate])
}
try JSONSerialization.data(withJSONObject:["source":source,"duration":duration,"tracks":tracks,"sample_times":times],options:[.prettyPrinted,.sortedKeys]).write(to:output.appendingPathComponent("metadata.json"))
print("INSPECTED",duration,"seconds",frames.count,"frames",output.path)
