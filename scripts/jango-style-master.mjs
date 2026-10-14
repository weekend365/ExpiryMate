import fs from 'node:fs';
import assert from 'node:assert/strict';
import {masterPath, masterHash, masterSetPath, readMasterSet} from './jango-master-set.mjs';

export const styleMasterPath = 'design/jango/style-master.json';
export const styleMasterRecordPath = 'design/jango/masters/v18/master.json';
export const historicalStyleMasterRecordPath = 'design/jango/masters/v19/master.json';

// The selected original set is authoritative. Adoption never changes source pixels
// or grants a signed emoticon release.
export function validateStyleMaster(record) {
  assert.equal(record.version, 1);
  assert.equal(record.id, 'jango-v18');
  assert.equal(record.masterVersion, 'v18');
  assert.equal(record.kind, 'active-character-master-set');
  assert.equal(record.status, 'user-adopted');
  assert.equal(record.styleProfile, 'handdrawn-crayon');
  assert.equal(record.authority.type, 'explicit-user-instruction');
  assert(record.authority.sourceThreadId && record.authority.quote, 'User restoration evidence required');
  const directory = 'design/jango/emoticons/kakao-32/v18/source-originals';
  assert.equal(record.sourceDirectory, directory, 'Active originals directory mismatch');
  assert.equal(record.poseRegistry.file, masterSetPath);
  assert.equal(masterHash(masterSetPath), record.poseRegistry.sha256, 'MASTER registry hash mismatch');
  const set = readMasterSet();
  assert.equal(record.representative, set.representative);
  assert.deepEqual(record.images.map(ref => ref.number), set.entries.map(entry => entry.number), 'All 32 selected originals required');
  assert.deepEqual(fs.readdirSync(masterPath(directory)).sort(), set.entries.map(entry => entry.source.slice(directory.length + 1)).sort(), 'Original inventory mismatch');
  for (const ref of record.images) {
    const entry = set.entries.find(e => e.number === ref.number);
    assert.equal(ref.file, entry.source, 'Original selection mismatch');
    assert.equal(ref.sha256, entry.sourceSHA256, 'Original source hash mismatch');
    const png = fs.readFileSync(masterPath(ref.file));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [ref.width, ref.height], 'Original dimensions mismatch');
  }
  const representative = record.images.find(ref => ref.number === record.representative);
  assert.deepEqual(record.image, { file: representative.file, sha256: representative.sha256, width: representative.width, height: representative.height }, 'Representative mismatch');
  assert.equal(record.previousMaster.file, historicalStyleMasterRecordPath);
  assert.equal(record.previousMaster.active, false, 'v19 must remain historical');
  assert.equal(masterHash(historicalStyleMasterRecordPath), record.previousMaster.sha256, 'Historical v19 record hash mismatch');
  validateHistoricalStyleMaster(JSON.parse(fs.readFileSync(masterPath(historicalStyleMasterRecordPath), 'utf8')));
  assert.deepEqual(record.scope.appliesTo, ['app-character','branding-character','emoticon-character','sns-cartoon','marketing','video-character']);
  return record;
}

// Preserve the exact v19 adoption/scene as historical evidence, not an active sprite.
export function validateHistoricalStyleMaster(record) {
  assert.equal(record.version, 1);
  assert.equal(record.id, 'jango-v19');
  assert.equal(record.masterVersion, 'v19');
  assert.equal(record.kind, 'active-character-style-master');
  assert.equal(record.status, 'user-adopted');
  assert.equal(record.styleProfile, 'colored-pencil');
  assert.equal(record.authority.type, 'explicit-user-instruction');
  assert(record.authority.messageId && record.authority.quote, 'User adoption evidence required');
  assert(record.authority.versionDesignation.messageId && record.authority.versionDesignation.quote, 'v19 designation evidence required');
  assert.equal(record.image.file, 'design/jango/masters/v19/master-scene.png');
  assert.equal(masterHash(record.image.file), record.image.sha256, 'Active style image hash mismatch');
  assert.equal(record.image.sha256, record.source.sha256, 'Adopted image must preserve approved source bytes');
  const png = fs.readFileSync(masterPath(record.image.file));
  assert(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Style MASTER must be PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [record.image.width, record.image.height]);
  assert.equal(record.legacyPoseRegistry.file, masterSetPath);
  assert.equal(record.legacyPoseRegistry.activeMaster, false, 'v18 must remain historical');
  assert.equal(masterHash(masterSetPath), record.legacyPoseRegistry.sha256, 'Legacy pose registry changed');
  const set = readMasterSet();
  assert.deepEqual(record.provenance.identityAncestors.map(ref => ref.masterNumber), [24, 1]);
  for (const ref of record.provenance.identityAncestors) {
    const entry = set.entries.find(e => e.number === ref.masterNumber);
    assert.equal(ref.file, entry.source, 'Style identity lineage mismatch');
    assert.equal(ref.sha256, entry.sourceSHA256, 'Style identity lineage hash mismatch');
  }
  assert.deepEqual(record.scope.appliesTo, ['app-character','branding-character','emoticon-character','sns-cartoon','marketing','video-character']);
  return record;
}

export function readStyleMaster() {
  const active = JSON.parse(fs.readFileSync(masterPath(styleMasterPath), 'utf8'));
  assert.equal(active.version, 1);
  assert.equal(active.activeMasterVersion, 'v18', 'v18 must be the active MASTER');
  assert.equal(active.master.file, styleMasterRecordPath);
  assert.equal(masterHash(styleMasterRecordPath), active.master.sha256, 'v18 MASTER record hash mismatch');
  return validateStyleMaster(JSON.parse(fs.readFileSync(masterPath(styleMasterRecordPath), 'utf8')));
}
