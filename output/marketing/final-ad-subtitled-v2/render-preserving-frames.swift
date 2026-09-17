import Foundation
import AppKit
import AVFoundation
import CoreText
import CoreVideo

enum RenderError: Error { case failure(String) }
struct Cue { let start: Int; let end: Int; let text: String }
setbuf(stdout, nil)
let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fontURL = URL(fileURLWithPath: CommandLine.arguments[3])
let folder = outputURL.deletingLastPathComponent()
let videoOnlyURL = folder.appendingPathComponent("video-preserved-frames.mp4")
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
guard !FileManager.default.fileExists(atPath: outputURL.path), !FileManager.default.fileExists(atPath: videoOnlyURL.path) else {
    throw RenderError.failure("Output exists")
}
let cues = [
    Cue(start: 0, end: 40, text: "이걸로 뭘 해 먹지?"),
    Cue(start: 95, end: 115, text: "두부랑 버섯,"),
    Cue(start: 115, end: 138, text: "내일까지야."),
    Cue(start: 138, end: 161, text: "전골 어때?"),
    Cue(start: 161, end: 190, text: "오, 좋다!"),
    Cue(start: 244, end: 284, text: "장고야, 고마워.")
]
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
let font = CTFontCreateWithName("Pretendard-Bold" as CFString, 64, nil)
func artwork(_ text: String) -> CGImage {
    let context = CGContext(data: nil, width: 1000, height: 140, bitsPerComponent: 8, bytesPerRow: 4000,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 1, alpha: 1)
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    var ascent: CGFloat = 0, descent: CGFloat = 0, leading: CGFloat = 0
    let measured = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))
    let box = CGRect(x: (1000 - measured - 60) / 2, y: 18, width: measured + 60, height: 104)
    context.setFillColor(CGColor(red: 0.025, green: 0.06, blue: 0.05, alpha: 0.72))
    context.addPath(CGPath(roundedRect: box, cornerWidth: 22, cornerHeight: 22, transform: nil))
    context.fillPath()
    context.textPosition = CGPoint(x: (1000 - measured) / 2, y: (140 - ascent - descent) / 2 + descent)
    CTLineDraw(line, context)
    return context.makeImage()!
}
let captionImages = cues.map { artwork($0.text) }
let asset = AVURLAsset(url: inputURL)
guard let sourceTrack = asset.tracks(withMediaType: .video).first else { throw RenderError.failure("No video") }
let width = Int(sourceTrack.naturalSize.width), height = Int(sourceTrack.naturalSize.height)
guard width == 1080, height == 1920, sourceTrack.preferredTransform == .identity else { throw RenderError.failure("Unexpected source geometry") }
let reader = try AVAssetReader(asset: asset)
let readerOutput = AVAssetReaderTrackOutput(track: sourceTrack, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
readerOutput.alwaysCopiesSampleData = false
reader.add(readerOutput)
let writer = try AVAssetWriter(outputURL: videoOnlyURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 22_000_000,
        AVVideoExpectedSourceFrameRateKey: 24,
        AVVideoMaxKeyFrameIntervalKey: 48,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ],
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2
    ]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
writer.add(input)
guard writer.startWriting() else { throw writer.error! }
writer.startSession(atSourceTime: .zero)
guard reader.startReading() else { throw reader.error! }
var sourceTimes: [Double] = []
while let sample = readerOutput.copyNextSampleBuffer() {
    try autoreleasepool {
        let waitStart = Date()
        while !input.isReadyForMoreMediaData {
            if writer.status == .failed { throw writer.error! }
            if Date().timeIntervalSince(waitStart) > 30 { throw RenderError.failure("Encoder stalled") }
            Thread.sleep(forTimeInterval: 0.002)
        }
        let pts = CMSampleBufferGetPresentationTimeStamp(sample)
        guard let original = CMSampleBufferGetImageBuffer(sample) else { throw RenderError.failure("Missing decoded frame") }
        var optionalBuffer: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adaptor.pixelBufferPool!, &optionalBuffer) == kCVReturnSuccess,
            let buffer = optionalBuffer else { throw RenderError.failure("No output buffer") }
        CVPixelBufferLockBaseAddress(original, .readOnly)
        CVPixelBufferLockBaseAddress(buffer, [])
        let sourceBase = CVPixelBufferGetBaseAddress(original)!
        let destBase = CVPixelBufferGetBaseAddress(buffer)!
        let sourceStride = CVPixelBufferGetBytesPerRow(original)
        let destStride = CVPixelBufferGetBytesPerRow(buffer)
        for row in 0..<height { memcpy(destBase.advanced(by: row * destStride), sourceBase.advanced(by: row * sourceStride), width * 4) }
        CVPixelBufferUnlockBaseAddress(original, .readOnly)
        if let cueIndex = cues.firstIndex(where: { pts.seconds >= Double($0.start)/24 && pts.seconds < Double($0.end)/24 }) {
            let context = CGContext(data: destBase, width: width, height: height, bitsPerComponent: 8, bytesPerRow: destStride,
                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)!
            context.draw(captionImages[cueIndex], in: CGRect(x: 40, y: 220, width: 1000, height: 140))
        }
        CVPixelBufferUnlockBaseAddress(buffer, [])
        // Append every decoded frame at its original timestamp. No frame-rate resampling.
        guard adaptor.append(buffer, withPresentationTime: pts) else { throw writer.error! }
        sourceTimes.append(pts.seconds)
    }
}
guard reader.status == .completed else { throw reader.error! }
input.markAsFinished()
writer.endSession(atSourceTime: asset.duration)
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
guard done.wait(timeout: .now() + 60) == .success, writer.status == .completed else { throw writer.error ?? RenderError.failure("Video export failed") }
print("VIDEO_DONE frames=\(sourceTimes.count)")

let rendered = AVURLAsset(url: videoOnlyURL)
let composition = AVMutableComposition()
let range = CMTimeRange(start: .zero, duration: asset.duration)
let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try videoTrack.insertTimeRange(range, of: rendered.tracks(withMediaType: .video)[0], at: .zero)
for sourceAudio in asset.tracks(withMediaType: .audio) {
    let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try audio.insertTimeRange(sourceAudio.timeRange, of: sourceAudio, at: sourceAudio.timeRange.start)
}
let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
export.outputURL = outputURL
export.outputFileType = .mp4
export.shouldOptimizeForNetworkUse = true
export.timeRange = range
let muxDone = DispatchSemaphore(value: 0)
export.exportAsynchronously { muxDone.signal() }
guard muxDone.wait(timeout: .now() + 55) == .success, export.status == .completed else { throw export.error ?? RenderError.failure("Audio mux failed") }
try JSONSerialization.data(withJSONObject: ["frames": sourceTimes.count, "presentation_times": sourceTimes], options: [.prettyPrinted]).write(to: folder.appendingPathComponent("preserved-timestamps.json"))
try FileManager.default.removeItem(at: videoOnlyURL)
print("OUTPUT", outputURL.path)

let result = AVURLAsset(url: outputURL)
print("DURATION", result.duration.seconds)
for track in result.tracks { print("TRACK", track.mediaType.rawValue, track.nominalFrameRate, track.estimatedDataRate, track.timeRange.duration.seconds) }
let qa = folder.appendingPathComponent("qa")
try FileManager.default.createDirectory(at: qa, withIntermediateDirectories: true)
let gen = AVAssetImageGenerator(asset: result)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 540, height: 960)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
for seconds in [0.0, 5.25, 10.5, 12.0, 14.958333333333334] {
    let cg = try gen.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
    let url = qa.appendingPathComponent(String(format: "frame-%.2f.png", seconds))
    try NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!.write(to: url)
    print("QA", url.path)
}
