import Foundation
import AVFoundation
import AppKit
import CoreMedia

enum JoinError: Error { case failure(String) }
let mainURL = URL(fileURLWithPath: CommandLine.arguments[1])
let endURL = URL(fileURLWithPath: CommandLine.arguments[2])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[3])
guard !FileManager.default.fileExists(atPath: outputURL.path) else {
    throw JoinError.failure("Output exists; choose a new filename")
}
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
let mainAsset = AVURLAsset(url: mainURL)
let endAsset = AVURLAsset(url: endURL)
guard let mainVideo = mainAsset.tracks(withMediaType: .video).first,
      let endVideo = endAsset.tracks(withMediaType: .video).first else {
    throw JoinError.failure("Missing video track")
}
let mainDuration = CMTime(value: 12, timescale: 1)
let endDuration = CMTime(value: 3, timescale: 1)
let finalDuration = CMTime(value: 15, timescale: 1)
guard CMTimeCompare(mainVideo.timeRange.duration, mainDuration) >= 0,
      CMTimeCompare(endVideo.timeRange.duration, endDuration) >= 0 else {
    throw JoinError.failure("A video is shorter than the requested timeline")
}
let composition = AVMutableComposition()
guard let video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    throw JoinError.failure("Cannot create video track")
}
try video.insertTimeRange(CMTimeRange(start: .zero, duration: mainDuration), of: mainVideo, at: .zero)
try video.insertTimeRange(CMTimeRange(start: .zero, duration: endDuration), of: endVideo, at: mainDuration)
video.preferredTransform = mainVideo.preferredTransform
var audioIncluded = false
for originalAudio in mainAsset.tracks(withMediaType: .audio) {
    guard let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
        throw JoinError.failure("Cannot create audio track")
    }
    let sourceStart = CMTimeMaximum(.zero, originalAudio.timeRange.start)
    let sourceEnd = CMTimeMinimum(mainDuration, CMTimeRangeGetEnd(originalAudio.timeRange))
    if CMTimeCompare(sourceEnd, sourceStart) > 0 {
        try audio.insertTimeRange(CMTimeRange(start: sourceStart, end: sourceEnd), of: originalAudio, at: sourceStart)
        audioIncluded = true
    }
}
guard CMTimeCompare(composition.duration, finalDuration) == 0 else {
    throw JoinError.failure("Timeline is not exactly 15 seconds")
}
guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
    throw JoinError.failure("Cannot create passthrough export")
}
exporter.outputURL = outputURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true
exporter.timeRange = CMTimeRange(start: .zero, duration: finalDuration)
let done = DispatchSemaphore(value: 0)
exporter.exportAsynchronously { done.signal() }
guard done.wait(timeout: .now() + 55) == .success else {
    exporter.cancelExport()
    throw JoinError.failure("Export timed out")
}
guard exporter.status == .completed else {
    throw exporter.error ?? JoinError.failure("Export failed")
}
print("Export completed: \(outputURL.path)")
print("Main: 0.000–12.000; end card: 12.000–15.000; original audio included=\(audioIncluded); passthrough=true")

let result = AVURLAsset(url: outputURL)
print("duration_seconds=\(CMTimeGetSeconds(result.duration))")
for track in result.tracks {
    if track.mediaType == .video {
        let size = track.naturalSize.applying(track.preferredTransform)
        print("video=\(abs(size.width))x\(abs(size.height)), fps=\(track.nominalFrameRate), duration=\(CMTimeGetSeconds(track.timeRange.duration))")
    } else if track.mediaType == .audio {
        print("audio_start=\(CMTimeGetSeconds(track.timeRange.start)), audio_duration=\(CMTimeGetSeconds(track.timeRange.duration))")
    }
}
let qa = outputURL.deletingLastPathComponent().appendingPathComponent("qa")
try FileManager.default.createDirectory(at: qa, withIntermediateDirectories: true)
let generator = AVAssetImageGenerator(asset: result)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 540, height: 960)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
for frame in [287, 288, 359] {
    let cg = try generator.copyCGImage(at: CMTime(value: Int64(frame), timescale: 24), actualTime: nil)
    let bitmap = NSBitmapImageRep(cgImage: cg)
    let pngURL = qa.appendingPathComponent("frame-\(frame).png")
    try bitmap.representation(using: .png, properties: [:])!.write(to: pngURL)
    print(pngURL.path)
}
