import Foundation
import AVFoundation
import AppKit
import CoreImage
import CoreVideo

setbuf(stdout, nil)
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let source = root.deletingLastPathComponent().appendingPathComponent("app-walkthrough-reel-v3/jango-walkthrough-reel.mp4")
let destination = root.appendingPathComponent("video-9x16.mp4")
let expected = root.appendingPathComponent("expected")
try FileManager.default.createDirectory(at: expected, withIntermediateDirectories: true)
guard !FileManager.default.fileExists(atPath: destination.path) else { fatalError("Refusing overwrite") }
let width = 1080, height = 1920, fps = 30
let sourceWidth = 1206.0, sourceHeight = 2622.0
let scale = Double(height) / sourceHeight
let displayWidth = sourceWidth * scale
let side = (Double(width) - displayWidth) / 2
let display = CGRect(x: side, y: 0, width: displayWidth, height: Double(height))
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.cacheIntermediates: false])
let cream = CGColor(red: 1, green: 252.0/255, blue: 245.0/255, alpha: 1)
let asset = AVURLAsset(url: source)
let track = asset.tracks(withMediaType: .video)[0]
let reader = try AVAssetReader(asset: asset)
let readOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
readOutput.alwaysCopiesSampleData = false
reader.add(readOutput)
let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 14_000_000,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: 60,
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
guard reader.startReading() else { throw reader.error! }
guard writer.startWriting() else { throw writer.error! }
writer.startSession(atSourceTime: .zero)
let checkpoints: Set<Int> = [0, 90, 264, 450, 584, 720, 810, 900, 979]
var frame = 0
while let sample = readOutput.copyNextSampleBuffer() {
    try autoreleasepool {
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sample)
        guard abs(timestamp.seconds - Double(frame)/30) < 0.0001 else { fatalError("Source timing changed") }
        guard let sourceBuffer = CMSampleBufferGetImageBuffer(sample), CVPixelBufferGetWidth(sourceBuffer) == 1206, CVPixelBufferGetHeight(sourceBuffer) == 2622 else { fatalError("Unexpected source geometry") }
        let waiting = Date()
        while !input.isReadyForMoreMediaData {
            if writer.status == .failed { throw writer.error! }
            guard Date().timeIntervalSince(waiting) < 40 else { fatalError("Encoder stalled") }
            Thread.sleep(forTimeInterval: 0.002)
        }
        var optional: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adaptor.pixelBufferPool!, &optional) == kCVReturnSuccess, let buffer = optional else { fatalError("Pixel allocation failed") }
        let sourceImage = CIImage(cvPixelBuffer: sourceBuffer)
        guard let cg = ci.createCGImage(sourceImage, from: sourceImage.extent, format: .RGBA8, colorSpace: srgb) else { fatalError("Source image failed") }
        CVPixelBufferLockBaseAddress(buffer, [])
        let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: srgb, bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)!
        context.setFillColor(cream)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.interpolationQuality = .high
        context.draw(cg, in: display)
        if checkpoints.contains(frame) {
            let png = NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!
            try png.write(to: expected.appendingPathComponent(String(format: "frame-%05d.png", frame)))
        }
        CVPixelBufferUnlockBaseAddress(buffer, [])
        guard adaptor.append(buffer, withPresentationTime: timestamp) else { throw writer.error! }
        frame += 1
        if frame % 120 == 0 { print("REFRAME", frame, "/ 980") }
    }
}
guard reader.status == .completed, frame == 980 else { fatalError("Incomplete source decode") }
input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: 980, timescale: 30))
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
guard done.wait(timeout: .now() + 50) == .success, writer.status == .completed else { throw writer.error! }
let report: [String: Any] = [
    "source": source.path, "output": destination.path,
    "width": width, "height": height, "fps": fps, "frames": frame,
    "display_rect": [side, 0, displayWidth, Double(height)],
    "source_crop": [0, 0, 1206, 2622], "scale": scale,
    "side_padding_color": "#FFFCF5", "fixed_layout_entire_video": true,
    "reencoded_video_passes_this_revision": 1, "target_video_bitrate": 14_000_000,
    "caption_timing_and_position": "Preserved proportionally with the complete frame"
]
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: root.appendingPathComponent("render-settings.json"))
print("REFRAME_COMPLETE", destination.path)
