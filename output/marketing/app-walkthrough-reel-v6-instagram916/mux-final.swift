import Foundation
import AVFoundation
import CryptoKit

setbuf(stdout, nil)
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let videoURL = root.appendingPathComponent("video-9x16.mp4")
let speechURL = root.appendingPathComponent("jango-carefree-mix.wav")
let encodedAudioURL = root.appendingPathComponent("jango-carefree-mix.m4a")
let outputURL = root.appendingPathComponent("jango-walkthrough-carefree-9x16.mp4")

func export(_ asset: AVAsset, preset: String, to url: URL, type: AVFileType) throws {
    guard !FileManager.default.fileExists(atPath: url.path) else { fatalError("Refusing to replace \(url.path)") }
    let session = AVAssetExportSession(asset: asset, presetName: preset)!
    session.outputURL = url
    session.outputFileType = type
    session.shouldOptimizeForNetworkUse = true
    let credit = AVMutableMetadataItem()
    credit.keySpace = .common
    credit.key = AVMetadataKey.commonKeyDescription as NSString
    credit.value = "Music: Carefree by Kevin MacLeod (https://incompetech.com/music/royalty-free/index.html?gt=&isrc=USUAN1400037). CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Excerpted and volume edited." as NSString
    session.metadata = [credit]
    let finished = DispatchSemaphore(value: 0)
    session.exportAsynchronously { finished.signal() }
    guard finished.wait(timeout: .now() + 50) == .success, session.status == .completed else {
        throw session.error ?? NSError(domain: "JangoExport", code: 1)
    }
}

let videoAsset = AVURLAsset(url: videoURL)
let originalVideo = videoAsset.tracks(withMediaType: .video)[0]
if !CommandLine.arguments.contains("--verify-only") {
try export(AVURLAsset(url: speechURL), preset: AVAssetExportPresetAppleM4A, to: encodedAudioURL, type: .m4a)
print("AUDIO_ENCODED")
let audioAsset = AVURLAsset(url: encodedAudioURL)
let composition = AVMutableComposition()
let video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let range = CMTimeRange(start: .zero, duration: videoAsset.duration)
try video.insertTimeRange(range, of: originalVideo, at: .zero)
video.preferredTransform = originalVideo.preferredTransform
let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
try audio.insertTimeRange(range, of: audioAsset.tracks(withMediaType: .audio)[0], at: .zero)
try export(composition, preset: AVAssetExportPresetPassthrough, to: outputURL, type: .mp4)
print("NARRATED_VIDEO_COMPLETE", outputURL.path)
}

// Confirm that adding audio left every compressed video sample untouched.
func videoDigest(_ asset: AVAsset) throws -> (String, Int) {
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: asset.tracks(withMediaType: .video)[0], outputSettings: nil)
    reader.add(output)
    guard reader.startReading() else { throw reader.error! }
    var digest = SHA256()
    var count = 0
    while let sample = output.copyNextSampleBuffer() {
        guard let block = CMSampleBufferGetDataBuffer(sample) else {
            print("EMPTY_VIDEO_SAMPLE", CMSampleBufferGetNumSamples(sample), CMSampleBufferGetTotalSampleSize(sample))
            guard CMSampleBufferGetTotalSampleSize(sample) == 0 else { fatalError("Missing nonempty video sample") }
            continue
        }
        var data = Data(count: CMBlockBufferGetDataLength(block))
        let status = data.withUnsafeMutableBytes { bytes in
            CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: bytes.count, destination: bytes.baseAddress!)
        }
        guard status == noErr else { fatalError("Video sample read failed") }
        digest.update(data: data)
        count += 1
    }
    guard reader.status == .completed else { throw reader.error! }
    return (digest.finalize().map { String(format: "%02x", $0) }.joined(), count)
}
let finalAsset = AVURLAsset(url: outputURL)
let before = try videoDigest(videoAsset)
let after = try videoDigest(finalAsset)
let audioReader = try AVAssetReader(asset: finalAsset)
let audioOutput = AVAssetReaderTrackOutput(track: finalAsset.tracks(withMediaType: .audio)[0], outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false])
audioReader.add(audioOutput)
guard audioReader.startReading() else { throw audioReader.error! }
var peak: Float = 0
var decodedSamples = 0
while let sample = audioOutput.copyNextSampleBuffer() {
    guard let block = CMSampleBufferGetDataBuffer(sample) else { fatalError("Missing audio data") }
    var samples = [Float](repeating: 0, count: CMBlockBufferGetDataLength(block) / 4)
    let status = samples.withUnsafeMutableBytes { bytes in
        CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: bytes.count, destination: bytes.baseAddress!)
    }
    guard status == noErr else { fatalError("Audio sample read failed") }
    for value in samples { peak = max(peak, abs(value)) }
    decodedSamples += samples.count
}
let passed = before == after && after.1 == 980 && audioReader.status == .completed && peak > 0.05 && peak < 1 && abs(finalAsset.duration.seconds - 980.0 / 30.0) < 0.02
let report: [String: Any] = ["passed": passed, "video_samples_unchanged": before == after, "video_sample_count": after.1, "video_digest": after.0, "duration_seconds": finalAsset.duration.seconds, "width": originalVideo.naturalSize.width, "height": originalVideo.naturalSize.height, "audio_decoded_samples": decodedSamples, "audio_peak": peak, "audio_peak_dbfs": 20 * log10(peak), "audio_decode_completed": audioReader.status == .completed, "voice": "AI Voice Generator delicate + Carefree by Kevin MacLeod", "output": outputURL.path]
let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
try json.write(to: root.appendingPathComponent("verification.json"))
print(String(data: json, encoding: .utf8)!)
guard passed else { exit(1) }
