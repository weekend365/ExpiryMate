// Storage aliases are evidence of byte preservation, never provenance edges.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const historyIndex='design/jango/quality/history/emoticons-v20-v23/index.json';
export const historyIndexSHA256='aa08214f69d2b5447614f70c4f972706a687eb6db2fdd1a57171589a1ad25785';
export const closedVersions=['v20','v21','v22','v23'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);
export function historyLocal(file){
  assert(typeof file==='string'&&!path.isAbsolute(file)&&file===path.posix.normalize(file)&&!file.includes('\\')&&!file.split('/').includes('..'),'Canonical repository path required');
  const resolved=path.resolve(root,file);assert(resolved.startsWith(root+path.sep),'Path escapes repository');
  let parent=resolved;while(!fs.existsSync(parent))parent=path.dirname(parent);
  assert.equal(fs.realpathSync(parent),parent,'Symlink paths are not allowed');
  return resolved;
}
export const hasHistory=()=>fs.existsSync(historyLocal(historyIndex));
export function assertOpenVersion(value){
  assert(!/(?:^|[-/])v(?:20|21|22|23)(?:[-/]|$)/.test(value),'Closed historical version cannot create, register, audit, promote or export resources');
}
let cached;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function readHistory(){
  const bytes=fs.readFileSync(historyLocal(historyIndex)),hash=digest(bytes);
  assert.equal(hash,historyIndexSHA256,'History index integrity mismatch');
  if(cached?.hash===hash)return cached.value;
  const index=JSON.parse(bytes);
  assert.equal(index.schemaVersion,1);assert.equal(index.status,'closed-historical-records');
  assert.deepEqual(index.versions,closedVersions);
  const keys=new Set();
  for(const row of index.entries){
    historyLocal(row.file);assert(!keys.has(row.file),'Duplicate historical path');keys.add(row.file);
    assert(/^[a-f0-9]{64}$/.test(row.sha256),'Invalid historical hash');
    assert(['relocated','deduplicated','retired'].includes(row.state),'Invalid historical state');
    if(row.state==='retired')assert(!row.target,'Retired artifact cannot claim retained bytes');
    else {historyLocal(row.target);assert.notEqual(row.target,row.file,'Storage alias must be direct');}
  }
  for(const row of index.entries)assert(!row.target||!keys.has(row.target),'Storage aliases cannot chain or replace provenance traversal');
  cached={hash,value:freeze(index)};return cached.value;
}
export function historicalPath(file,expected){
  const original=historyLocal(file);
  const index=hasHistory()?readHistory():null;
  const row=index?.entries.find(row=>row.file===file);
  if(row&&(expected===undefined||row.sha256===expected)){
    assert.notEqual(row.state,'retired','Retired artifact has no current bytes: '+file);
    const physical=historyLocal(row.target);
    assert.equal(digest(fs.readFileSync(physical)),row.sha256,'Preserved historical bytes changed: '+file);
    return physical;
  }
  assert(fs.existsSync(original),'Missing historical file or matching hash: '+file);
  if(expected!==undefined)assert.equal(digest(fs.readFileSync(original)),expected,'Historical hash mismatch: '+file);
  return original;
}
export const historicalHash=(file,expected)=>digest(fs.readFileSync(historicalPath(file,expected)));
export const readHistoricalJson=(file,expected)=>JSON.parse(fs.readFileSync(historicalPath(file,expected),'utf8'));
export function archivedCandidate(input){
  if(!hasHistory())return undefined;
  const row=readHistory().candidates.find(row=>row.source===input);
  return row?readHistoricalJson(row.file,row.sha256):undefined;
}
// Explicitly distinguishes an authorized deletion from a current measurement.
export function historicalEvidence(file,expected){
  const index=readHistory(),row=index.entries.find(row=>row.file===file);
  if(row){
    assert.equal(row.sha256,expected,'Historical snapshot hash mismatch: '+file);
    if(row.state==='retired')return {status:'retired',measured:false,sha256:row.sha256};
    return {status:row.state,measured:true,sha256:historicalHash(file,expected)};
  }
  const prior=index.priorCleanup;
  if(prior){
    const receipt=readHistoricalJson(prior.file,prior.sha256),removed=receipt.removed.find(row=>row.file===file);
    if(removed){assert.equal(removed.sha256,expected,'Prior cleanup snapshot hash mismatch');return {status:'previously-pruned',measured:false,sha256:removed.sha256};}
  }
  return {status:'current',measured:true,sha256:historicalHash(file,expected)};
}
export function verifyHistory(){
  const index=readHistory(),counts={relocated:0,deduplicated:0,retired:0};
  for(const row of index.entries){
    counts[row.state]++;
    if(row.state!=='retired')assert.equal(historicalHash(row.file,row.sha256),row.sha256);
    if(/^design\/jango\/(?:emoticons\/kakao-32\/v(?:20|21|22|23)\/|quality\/(?:candidates|reports|jobs)\/\d{2}-v(?:20|21|22|23)-)/.test(row.file))assert(!fs.existsSync(historyLocal(row.file)),'Closed resource regenerated: '+row.file);
  }
  for(const version of closedVersions)assert(!fs.existsSync(historyLocal('design/jango/emoticons/kakao-32/'+version)),'Closed version directory regenerated');
  // The baseline is the migration's historical snapshot. Active releases/app
  // files may later change through their own approved workflows; their current
  // validity is checked by the gate, not frozen by a historical receipt.
  assert.equal(digest(canonical(index.baseline.files)),index.baseline.inventorySHA256,'Historical baseline integrity mismatch');
  const walk=directory=>{for(const entry of fs.readdirSync(historyLocal(directory),{withFileTypes:true})){
    assert(!entry.isSymbolicLink(),'Symlinks are not allowed');const file=directory+'/'+entry.name;
    if(entry.isDirectory())walk(file);else assert(!/\.(?:png|ttf|zip)$/i.test(file),'History must contain records only');
  }};
  walk('design/jango/emoticons/kakao-32/history');walk('design/jango/quality/history/emoticons-v20-v23');
  assert.equal(historicalHash(index.priorCleanup.file,index.priorCleanup.sha256),index.priorCleanup.sha256);
  return {status:'verified',...index.removed,records:counts,closedCandidates:index.candidates.length};
}
