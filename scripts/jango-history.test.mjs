import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {local,fileHash,filesIn,readJson,prepare,audit,promote,validateInputLineage} from './jango-design-gate.mjs';
import {assertOpenVersion,historicalPath,historicalHash,historicalEvidence,historyIndex,readHistory,readHistoricalJson,verifyHistory} from './jango-history.mjs';
import {recordReuse} from './record-jango-reuse.mjs';

test('retirement retains 97 originals and diagnostics as exact bytes and closes 97 candidates',()=>{
 const index=readHistory(),verified=verifyHistory();
 assert.equal(verified.files,767);assert.equal(verified.bytes,316344917);assert.equal(verified.closedCandidates,97);
 const sources=index.entries.filter(row=>/\/v(?:20|21|22|23)\/source-originals\/.+\.png$/.test(row.file));
 const diagnostics=index.entries.filter(row=>/\/jobs\/.+\.png$/.test(row.file));
 assert.equal(sources.length,97);assert.equal(diagnostics.length,97);
 for(const row of [...sources,...diagnostics]){assert.equal(row.state,'deduplicated');assert.equal(historicalHash(row.file,row.sha256),row.sha256);assert(!fs.existsSync(local(row.file)));}
 assert.equal(filesIn('design/jango/quality/candidates').length,32);
 for(const row of index.candidates){assert(!fs.existsSync(local(row.file)));assert.equal(readHistoricalJson(row.file,row.sha256).id,row.id);}
 for(const row of index.entries.filter(row=>row.state==='retired')){assert.equal(historicalEvidence(row.file,row.sha256).measured,false);assert.throws(()=>historicalHash(row.file,row.sha256),/no current bytes/);}
});
test('history rejects wrong hashes, missing or altered preserved bytes, unknown paths and symlinks',()=>{
 const row=readHistory().entries.find(row=>row.file.includes('/v21/source-originals/03-'));
 assert.throws(()=>historicalHash(row.file,'0'.repeat(64)));
 assert.throws(()=>historicalPath('design/jango/emoticons/kakao-32/v21/source-originals/unknown.png',row.sha256),/Missing historical/);
 assert.throws(()=>historicalPath('../outside.png',row.sha256),/Canonical/);
 const target=local(row.target),bytes=fs.readFileSync(target),temporary=target+'.history-test';
 try{
  fs.renameSync(target,temporary);assert.throws(()=>historicalHash(row.file,row.sha256),/ENOENT/);
  fs.symlinkSync(temporary,target);assert.throws(()=>historicalHash(row.file,row.sha256),/Symlink/);
  fs.unlinkSync(target);fs.writeFileSync(target,Buffer.from('altered bytes'));assert.throws(()=>historicalHash(row.file,row.sha256),/bytes changed/);
 }finally{if(fs.existsSync(target))fs.unlinkSync(target);fs.renameSync(temporary,target);}
 assert.equal(fileHash(row.target),row.sha256);assert.deepEqual(fs.readFileSync(target),bytes);
});
test('tampered history index fails its pinned digest without accepting alternate mappings',()=>{
 const file=local(historyIndex),bytes=fs.readFileSync(file);
 try{fs.appendFileSync(file,'\n');assert.throws(()=>readHistory(),/integrity mismatch/);assert.throws(()=>historicalHash(readJson(historyIndex).entries[0].file),/integrity mismatch/);}
 finally{fs.writeFileSync(file,bytes);}
 assert.equal(readHistory().schemaVersion,1);
});
test('physical storage aliases do not replace logical provenance or bypass cycle detection',()=>{
 const source='design/jango/emoticons/kakao-32/v22/source-originals/03-r1.png';
 const row=readHistory().entries.find(row=>row.file===source);
 assert.equal(row.target,'design/jango/emoticons/kakao-32/v24/source-originals/03-r1.png');
 assert.doesNotThrow(()=>validateInputLineage(row.target));
 assert.throws(()=>validateInputLineage(source,new Set([source])),/Cyclic/);
 // v24 -> v22 -> v21 -> v20 -> MASTER remains the provenance graph even
 // when v22 and v21 source bytes are physically stored in this same v24 file.
 const active=readJson('design/jango/quality/candidates/03-v24-r1.json');
 assert.equal(readJson(active.derivationRecord).origin,source);
 const archived=readHistoricalJson('design/jango/quality/candidates/03-v22-r1.json');
 assert.equal(readHistoricalJson(archived.derivationRecord).origin,'design/jango/emoticons/kakao-32/v21/source-originals/03-r1.png');
});
test('closed versions cannot be prepared, regenerated, registered, promoted or exported',()=>{
 const source=readJson('design/jango/master-set.json').entries[0].source;
 for(const version of ['v20','v21','v22','v23']){
  const base='design/jango/emoticons/kakao-32/'+version,id='01-'+version+'-r1';
  assert.throws(()=>assertOpenVersion(base),/Closed historical/);
  assert.throws(()=>prepare(id,source,'test'),/Closed historical/);
  assert.throws(()=>recordReuse(id),/Closed historical/);
  assert.throws(()=>audit(id),/Closed historical/);
  assert.throws(()=>promote(id,{}),/Closed historical/);
  for(const script of ['build-jango-emoticons.mjs','build-jango-expression-review.mjs','build-jango-review-gallery.mjs','build-jango-review-canvas.mjs','register-jango-emoticon-review.mjs'])assert.throws(()=>execFileSync(process.execPath,['scripts/'+script,'--base='+base],{stdio:'pipe'}),/Closed historical/);
  assert.throws(()=>execFileSync(process.execPath,['scripts/render-jango-lettering.mjs',base],{stdio:'pipe'}),/Closed historical/);
  assert.throws(()=>execFileSync(process.execPath,['scripts/record-jango-image.mjs',id,'/private/tmp/unused.png'],{stdio:'pipe'}),/Closed historical/);
  if(process.platform==='darwin')assert.throws(()=>execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',base],{stdio:'pipe'}),/Closed historical/);
  assert(!fs.existsSync(local(base)));
 }
 // Export only accepts the live registry and signed release list; no retired
 // candidate can enter that list through promote or through an archive alias.
 assert.equal(readJson('design/jango/quality/releases.json').entries.length,0);
 const releaseFile=local('design/jango/quality/releases.json'),releaseBytes=fs.readFileSync(releaseFile);
 try{
  fs.writeFileSync(releaseFile,JSON.stringify({version:1,entries:[{id:'29-v23-r1',review:{}}]}));
  assert.throws(()=>execFileSync(process.execPath,['scripts/jango-design-gate.mjs','export'],{stdio:'pipe'}),/Closed historical/);
 }finally{fs.writeFileSync(releaseFile,releaseBytes);}
 assert.throws(()=>prepare('new-history-input', 'design/jango/emoticons/kakao-32/v22/source-originals/01-r1.png','test'),/Closed historical/);
});
