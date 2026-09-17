import Foundation
import AVFoundation
import CoreVideo

setbuf(stdout, nil)
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let url = root.appendingPathComponent("jango-walkthrough-reel.mp4")
let asset = AVURLAsset(url: url)
let video = asset.tracks(withMediaType: .video)[0]
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: video, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
output.alwaysCopiesSampleData = false
reader.add(output)
guard reader.startReading() else { fatalError("Cannot start video decode: \(String(describing: reader.error))") }
var frames = 0
var maximumTimestampError = 0.0
var first = -1.0
var last = -1.0
var dimensionsValid = true
while let sample = output.copyNextSampleBuffer() {
    let time = CMSampleBufferGetPresentationTimeStamp(sample).seconds
    if frames == 0 { first = time }
    last = time
    maximumTimestampError = max(maximumTimestampError, abs(time - Double(frames) / 30.0))
    if let buffer = CMSampleBufferGetImageBuffer(sample) {
        dimensionsValid = dimensionsValid && CVPixelBufferGetWidth(buffer) == 1080 && CVPixelBufferGetHeight(buffer) == 1920
    } else { dimensionsValid = false }
    frames += 1
}
let map = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("frame-map.json"))) as! [[String:Any]]
let sourceErrors = map.compactMap { item -> Double? in
    guard let requested = item["source_requested"] as? Double, let actual = item["source_actual"] as? Double else { return nil }
    return abs(requested - actual)
}
let expectedFrames = map.count
let size = (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as! NSNumber).intValue
let passed = reader.status == .completed && frames == expectedFrames && dimensionsValid && maximumTimestampError < 0.0001 && abs(asset.duration.seconds - Double(frames) / 30.0) < 0.001 && (sourceErrors.max() ?? 99) < 0.06
let report: [String:Any] = [
    "passed": passed, "path": url.path, "bytes": size,
    "duration_seconds": asset.duration.seconds, "width": video.naturalSize.width, "height": video.naturalSize.height,
    "fps": video.nominalFrameRate, "decoded_frames": frames, "expected_frames": expectedFrames,
    "first_timestamp": first, "last_timestamp": last, "max_timestamp_error_seconds": maximumTimestampError,
    "reader_completed": reader.status == .completed, "audio_tracks": asset.tracks(withMediaType: .audio).count,
    "source_sample_max_error_seconds": sourceErrors.max() ?? -1,
    "endcard_frames": map.filter { $0["segment"] as? String == "endcard" }.count,
    "source_audio_note": "Original recording was verified silent. Output intentionally has no added music or voiceover."
]
let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
try json.write(to: root.appendingPathComponent("verification.json"))
print(String(data: json, encoding: .utf8)!)
guard passed else { exit(1) }
