import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import CoreVideo

enum ExportError: Error { case failure(String) }
let imagePath = CommandLine.arguments[1]
let videoPath = CommandLine.arguments[2]
guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: imagePath) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw ExportError.failure("Cannot load artwork") }
let width = 1080
let height = 1920
let fps: Int32 = 24
let frameCount = 72
let url = URL(fileURLWithPath: videoPath)
if FileManager.default.fileExists(atPath: videoPath) { throw ExportError.failure("Output already exists; choose a new version") }
let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 12_000_000,
        AVVideoExpectedSourceFrameRateKey: Int(fps),
        AVVideoMaxKeyFrameIntervalKey: Int(fps),
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
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
guard writer.canAdd(input) else { throw ExportError.failure("Cannot add H264 video input") }
writer.add(input)
guard writer.startWriting() else { throw writer.error ?? ExportError.failure("Cannot start encoder") }
writer.startSession(atSourceTime: .zero)
let space = CGColorSpace(name: CGColorSpace.sRGB)!
for index in 0..<frameCount {
    let waitStart = Date()
    while !input.isReadyForMoreMediaData {
        if writer.status == .failed { throw writer.error ?? ExportError.failure("Encoder failed") }
        if Date().timeIntervalSince(waitStart) > 30 { throw ExportError.failure("Encoder input timed out") }
        Thread.sleep(forTimeInterval: 0.002)
    }
    var pixelBuffer: CVPixelBuffer?
    guard let pool = adaptor.pixelBufferPool,
          CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer) == kCVReturnSuccess,
          let buffer = pixelBuffer else { throw ExportError.failure("No pixel buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: space, bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { throw ExportError.failure("No graphics context") }
    context.interpolationQuality = .high
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let t = Double(index) / Double(frameCount - 1)
    let ease = t * t * (3 - 2 * t)
    let scale = max(Double(width)/Double(image.width), Double(height)/Double(image.height)) * (1 + 0.025 * ease)
    let drawWidth = Double(image.width) * scale
    let drawHeight = Double(image.height) * scale
    context.draw(image, in: CGRect(x: (Double(width)-drawWidth)/2, y: (Double(height)-drawHeight)/2, width: drawWidth, height: drawHeight))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(index), timescale: fps)) else {
        throw writer.error ?? ExportError.failure("Cannot append frame")
    }
}
input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: 3, timescale: 1))
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
guard finished.wait(timeout: .now() + 45) == .success else { throw ExportError.failure("Finish timed out") }
guard writer.status == .completed else { throw writer.error ?? ExportError.failure("Export failed") }
print("Exported: \(videoPath)")
print("1080x1920, H264, 24fps, 72 frames, 3.000 seconds, silent, 100% to 102.5% slow zoom")
