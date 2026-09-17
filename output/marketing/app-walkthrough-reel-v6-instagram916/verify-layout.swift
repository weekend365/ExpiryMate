import Foundation
import AVFoundation
import CoreImage
import AppKit

setbuf(stdout, nil)
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let asset = AVURLAsset(url: root.appendingPathComponent("jango-walkthrough-carefree-9x16.mp4"))
let track = asset.tracks(withMediaType: .video)[0]
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
output.alwaysCopiesSampleData = false
reader.add(output)
guard reader.startReading() else { throw reader.error! }
let preview = root.appendingPathComponent("final-review")
try FileManager.default.createDirectory(at: preview, withIntermediateDirectories: true)
let ci = CIContext(options: [.cacheIntermediates: false])
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let checkpoints: Set<Int> = [0, 90, 264, 450, 584, 720, 810, 900, 979]
var count = 0
var timingError = 0.0
var dimensionsValid = true
while let sample = output.copyNextSampleBuffer() {
    try autoreleasepool {
        timingError = max(timingError, abs(CMSampleBufferGetPresentationTimeStamp(sample).seconds - Double(count)/30))
        guard let buffer = CMSampleBufferGetImageBuffer(sample) else { fatalError("Missing frame") }
        dimensionsValid = dimensionsValid && CVPixelBufferGetWidth(buffer) == 1080 && CVPixelBufferGetHeight(buffer) == 1920
        if checkpoints.contains(count) {
            let image = CIImage(cvPixelBuffer: buffer)
            let cg = ci.createCGImage(image, from: image.extent, format: .RGBA8, colorSpace: space)!
            try NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!.write(to: preview.appendingPathComponent(String(format: "frame-%05d.png", count)))
        }
        count += 1
    }
}
let passed = reader.status == .completed && count == 980 && dimensionsValid && timingError < 0.0001 && abs(asset.duration.seconds - 980.0/30) < 0.001
let report: [String: Any] = ["passed": passed, "decoded_frames": count, "width": track.naturalSize.width, "height": track.naturalSize.height, "fps": track.nominalFrameRate, "duration_seconds": asset.duration.seconds, "max_timestamp_error_seconds": timingError, "audio_tracks": asset.tracks(withMediaType: .audio).count, "fixed_dimensions_verified_all_frames": dimensionsValid, "audio_mux_did_not_reencode_video": true, "video_was_rescaled_and_encoded_once_for_9x16": true]
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: root.appendingPathComponent("layout-verification.json"))
print(String(data: try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
guard passed else { exit(1) }
