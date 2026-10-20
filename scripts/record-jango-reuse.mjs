// Copy a prepared original byte-for-byte. This operation never calls image generation.
import {assertOpenVersion} from './jango-history.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {local,readJson,writeJson,fileHash,policy,contextBinding,canonical,validateInputLineage,validateCandidateRecord} from './jango-design-gate.mjs';

export function recordReuse(id){
 assertOpenVersion(id);
 const match=/^(\d\d)-(v\d+)(?:-([a-z0-9]+))?$/.exec(id??'');
 assert(match&&Number(match[1])>=1&&Number(match[1])<=32,'Versioned job ID required');
 assert(match[2]!=='v18','v18 MASTER is immutable');
 const base='design/jango/emoticons/kakao-32/'+match[2],source=`${base}/source-originals/${match[1]}${match[3]?'-'+match[3]:''}.png`;
 const preflight=`design/jango/quality/jobs/${id}/preflight.json`,p=readJson(preflight);
 assert.equal(p.id,id,'Preparation ID mismatch');
 assert.equal(p.policyVersion,policy().version,'Retired preparation cannot record new work');
 assert.equal(canonical(p.context),canonical(contextBinding(policy(),p.styleProfile)),'Stale preparation context');
 assert.equal(fileHash(p.input),p.inputSHA256,'Input changed after preparation');
 validateInputLineage(p.input);
 assert.equal(p.composition?.panel,Number(match[1]),'Composition panel mismatch');
 for(const file of p.references)assert.equal(fileHash(file),p.referenceHashes[file],'Reference changed after preparation');
 assert.equal(fileHash(p.prompt),p.promptSHA256,'Prompt changed after preparation');
 const recordFile=`${base}/derivation-records/${id}.json`;
 assert(!fs.existsSync(local(source))&&!fs.existsSync(local(recordFile)),'Preserve existing derivation; use a new job ID');
 fs.mkdirSync(path.dirname(local(source)),{recursive:true});fs.copyFileSync(local(p.input),local(source));
 const record={id,tool:'deterministic-layout',operation:'layout-lettering-only',imageGeneration:false,origin:p.input,originSHA256:p.inputSHA256,source,sourceSHA256:fileHash(source),preflight,preflightSHA256:fileHash(preflight),prompt:p.prompt,promptSHA256:p.promptSHA256,inputs:[{role:'source-original',file:p.input,sha256:p.inputSHA256}],preparationNote:'The preparation prompt was not sent to an image generator. Only a byte-identical copy and subsequent layout/lettering are performed.',approval:'candidate; no external signature'};
 writeJson(recordFile,record);
 validateCandidateRecord({id,source,preflight,derivationRecord:recordFile});
 return {source,recordFile};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(recordReuse(process.argv[2])));
