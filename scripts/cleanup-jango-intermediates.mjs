import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonical,fileHash,filesIn,local,readJson,sha,writeJson} from './jango-design-gate.mjs';
import {cleanupReceipt,intermediateRecord,isPrunableIntermediate,reconstructedHash} from './jango-intermediate-artifacts.mjs';
import {hasHistory,historicalEvidence,verifyHistory} from './jango-history.mjs';

const versions=[20,21,22,23].map(n=>'design/jango/emoticons/kakao-32/v'+n);
const apply=process.argv.includes('--apply');
if(fs.existsSync(local(cleanupReceipt))){
  const receipt=readJson(cleanupReceipt);
  for(const entry of receipt.removed){
    assert(!fs.existsSync(local(entry.file)),'A pruned cache was regenerated: '+entry.file);
    if(hasHistory())assert.equal(historicalEvidence(entry.file,entry.sha256).status,'previously-pruned');
    else reconstructedHash(entry);
  }
  if(hasHistory())verifyHistory();
  console.log(JSON.stringify({status:hasHistory()?'closed-history; previous receipt preserved':'already-clean',files:receipt.removed.length,bytes:receipt.removedBytes}));
}else{
  const files=versions.flatMap(filesIn).filter(isPrunableIntermediate);
  assert.equal(files.length,197,'Review a changed inventory before pruning');
  // Complete every reconstruction and hash check before removing any file.
  const removed=files.map(intermediateRecord);
  const protectedScopes=[...versions,'design/jango/emoticons/kakao-32/v18','design/jango/masters','design/jango/reference','design/jango/quality/jobs','design/jango/quality/candidates','design/jango/quality/history','apps/mobile/assets'];
  const pruned=new Set(files);
  const preservedFiles=()=>[...new Set([...protectedScopes.flatMap(filesIn),'design/jango/master-set.json','design/jango/style-master.json'])].filter(file=>!pruned.has(file)).sort().map(file=>({file,sha256:fileHash(file)}));
  const before=preservedFiles(),removedBytes=removed.reduce((sum,entry)=>sum+entry.bytes,0);
  const receipt={schemaVersion:1,date:'2026-10-20',authorization:'지금 결과물 마음에 들어. 단, 변경사항 커밋전에 불필요한 리소스는 제거해줘.',purpose:'Remove unused, byte-reconstructible build caches before commit; retain original artwork, final stickers, active previews and provenance.',builder:'scripts/build-jango-emoticons.mjs',reproduceFlag:'--keep-intermediates',preserved:{scopes:protectedScopes,files:before.length,inventorySHA256:sha(canonical(before))},removedFiles:removed.length,removedBytes,categories:Object.fromEntries(['characters','thumbs','preview-120'].map(type=>{const entries=removed.filter(entry=>entry.recipe.type===type);return[type,{files:entries.length,bytes:entries.reduce((sum,entry)=>sum+entry.bytes,0)}];})),removed};
  if(apply){
    const baseline='/private/tmp/jango-cleanup-preserved-20261020.json';
    fs.writeFileSync(baseline,JSON.stringify(before,null,2)+'\n');
    // Persist the exact reconstruction recipes before the first unlink.
    writeJson(cleanupReceipt,receipt);
    for(const entry of removed){
      assert(isPrunableIntermediate(entry.file));
      assert.equal(fileHash(entry.file),entry.sha256,'Cache changed since inventory');
      fs.unlinkSync(local(entry.file));
    }
    for(const base of versions)for(const dir of ['characters','thumbs']){
      const target=local(base+'/'+dir);
      if(fs.existsSync(target)&&fs.readdirSync(target).length===0)fs.rmdirSync(target);
    }
    assert.deepEqual(preservedFiles(),before,'Protected assets changed during cleanup');
  }
  console.log(JSON.stringify({status:apply?'cleaned':'dry-run',files:removed.length,bytes:removedBytes,preservedFiles:before.length,receipt:cleanupReceipt}));
}
