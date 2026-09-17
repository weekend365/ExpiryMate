import Foundation
import AppKit
import AVFoundation
import QuartzCore
import CoreText

enum CaptionError: Error { case failure(String) }
struct Cue {
    let start: Int
    let end: Int
    let text: String
}

setbuf(stdout, nil)
let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fontURL = URL(fileURLWithPath: CommandLine.arguments[3])
let fps: Int32 = 24
let cues = [
    Cue(start: 0, end: 40, text: "이걸로 뭘 해 먹지?"),
    Cue(start: 95, end: 115, text: "두부랑 버섯,"),
    Cue(start: 115, end: 138, text: "내일까지야."),
    Cue(start: 138, end: 161, text: "전골 어때?"),
    Cue(start: 161, end: 190, text: "오, 좋다!"),
    Cue(start: 244, end: 284, text: "장고야, 고마워.")
]

guard !FileManager.default.fileExists(atPath: outputURL.path) else { throw CaptionError.failure("Choose a new output filename") }
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
let font = CTFontCreateWithName("Pretendard-Bold" as CFString, 64, nil)
print("FONT", CTFontCopyPostScriptName(font))

func captionImage(_ text: String) throws -> CGImage {
    let width = 1000, height = 140
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 1, alpha: 1)
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    var ascent: CGFloat = 0, descent: CGFloat = 0, leading: CGFloat = 0
    let measured = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))
    guard measured <= 860 else { throw CaptionError.failure("Caption exceeds safe horizontal bounds") }
    let box = CGRect(x: (CGFloat(width) - measured - 60) / 2, y: 18, width: measured + 60, height: 104)
    context.setFillColor(CGColor(red: 0.025, green: 0.06, blue: 0.05, alpha: 0.72))
    context.addPath(CGPath(roundedRect: box, cornerWidth: 22, cornerHeight: 22, transform: nil))
    context.fillPath()
    context.textMatrix = .identity
    context.textPosition = CGPoint(x: (CGFloat(width) - measured) / 2, y: (CGFloat(height) - ascent - descent) / 2 + descent)
    CTLineDraw(line, context)
    return context.makeImage()!
}

let asset = AVURLAsset(url: inputURL)
guard let sourceVideo = asset.tracks(withMediaType: .video).first else { throw CaptionError.failure("No source video") }
let composition = AVMutableComposition()
let video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let fullRange = CMTimeRange(start: .zero, duration: CMTime(value: 15, timescale: 1))
try video.insertTimeRange(fullRange, of: sourceVideo, at: .zero)
video.preferredTransform = sourceVideo.preferredTransform
for sourceAudio in asset.tracks(withMediaType: .audio) {
    let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try audio.insertTimeRange(sourceAudio.timeRange, of: sourceAudio, at: sourceAudio.timeRange.start)
}

let size = CGSize(width: 1080, height: 1920)
let parent = CALayer()
parent.frame = CGRect(origin: .zero, size: size)
parent.masksToBounds = true
let videoLayer = CALayer()
videoLayer.frame = parent.bounds
parent.addSublayer(videoLayer)
let qa = outputURL.deletingLastPathComponent().appendingPathComponent("qa")
try FileManager.default.createDirectory(at: qa, withIntermediateDirectories: true)
for (index, cue) in cues.enumerated() {
    let cg = try captionImage(cue.text)
    let overlay = CALayer()
    // Center at y=1630 in top-down image coordinates; no captions in the end card.
    overlay.frame = CGRect(x: 40, y: 220, width: 1000, height: 140)
    overlay.contents = cg
    overlay.contentsScale = 1
    overlay.opacity = 0
    let show = CAKeyframeAnimation(keyPath: "opacity")
    if cue.start == 0 {
        show.values = [1, 0, 0]
        show.keyTimes = [0, NSNumber(value: Double(cue.end) / 360.0), 1]
    } else {
        show.values = [0, 1, 0, 0]
        show.keyTimes = [0, NSNumber(value: Double(cue.start) / 360.0), NSNumber(value: Double(cue.end) / 360.0), 1]
    }
    show.calculationMode = .discrete
    show.beginTime = AVCoreAnimationBeginTimeAtZero
    show.duration = 15
    show.isRemovedOnCompletion = false
    show.fillMode = .forwards
    overlay.add(show, forKey: "caption-\(index)")
    parent.addSublayer(overlay)
    if index == 0 {
        try NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!.write(to: qa.appendingPathComponent("caption-design.png"))
    }
}

let videoComposition = AVMutableVideoComposition()
videoComposition.renderSize = size
videoComposition.frameDuration = CMTime(value: 1, timescale: fps)
videoComposition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
videoComposition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
videoComposition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
let instruction = AVMutableVideoCompositionInstruction()
instruction.timeRange = fullRange
let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: video)
layerInstruction.setTransform(sourceVideo.preferredTransform, at: .zero)
instruction.layerInstructions = [layerInstruction]
videoComposition.instructions = [instruction]
videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)

let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality)!
exporter.outputURL = outputURL
exporter.outputFileType = .mp4
exporter.videoComposition = videoComposition
exporter.timeRange = fullRange
exporter.shouldOptimizeForNetworkUse = true
print("EXPORTING", outputURL.path)
let done = DispatchSemaphore(value: 0)
exporter.exportAsynchronously { done.signal() }
guard done.wait(timeout: .now() + 180) == .success else {
    exporter.cancelExport()
    throw CaptionError.failure("Export timeout")
}
guard exporter.status == .completed else { throw exporter.error ?? CaptionError.failure("Export failed") }

func timestamp(_ frame: Int) -> String {
    let ms = Int((Double(frame) * 1000 / Double(fps)).rounded())
    return String(format: "%02d:%02d:%02d,%03d", ms / 3_600_000, (ms / 60_000) % 60, (ms / 1000) % 60, ms % 1000)
}
let srt = cues.enumerated().map { "\($0.offset + 1)\n\(timestamp($0.element.start)) --> \(timestamp($0.element.end))\n\($0.element.text)\n" }.joined(separator: "\n")
try srt.write(to: outputURL.deletingPathExtension().appendingPathExtension("srt"), atomically: true, encoding: .utf8)
print("DONE")

let result = AVURLAsset(url: outputURL)
print("DURATION", result.duration.seconds)
for track in result.tracks {
    print("TRACK", track.mediaType.rawValue, track.naturalSize, track.nominalFrameRate, track.timeRange.start.seconds, track.timeRange.duration.seconds)
}
let generator = AVAssetImageGenerator(asset: result)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 540, height: 960)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
for frame in [0, 20, 94, 96, 114, 115, 126, 148, 174, 190, 252, 284, 288, 359] {
    let cg = try generator.copyCGImage(at: CMTime(value: Int64(frame), timescale: fps), actualTime: nil)
    let out = qa.appendingPathComponent(String(format: "frame-%03d.png", frame))
    try NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!.write(to: out)
    print("QA", out.path)
}
