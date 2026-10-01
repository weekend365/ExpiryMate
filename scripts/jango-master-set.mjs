import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const masterSetPath='design/jango/master-set.json';
export function masterPath(file){
 assert(typeof file==='string'&&!path.isAbsolute(file)&&file===path.posix.normalize(file)&&!file.split('/').includes('..')&&!file.includes('\\'),'Canonical MASTER path required');
 const result=path.join(repository,file);
 assert(fs.realpathSync(result)===result,'MASTER symlinks not allowed');
 return result;
}
export const masterHash=file=>createHash('sha256').update(fs.readFileSync(masterPath(file))).digest('hex');
export function readMasterSet(){
 const set=JSON.parse(fs.readFileSync(masterPath(masterSetPath),'utf8'));
 assert.equal(set.version,1);assert.equal(set.id,'jango-v18');assert.equal(set.representative,24);
 assert.deepEqual(set.entries.map(e=>e.number),Array.from({length:32},(_,i)=>i+1));
 assert.equal(new Set(set.entries.map(e=>e.title)).size,32);
 for(const entry of set.entries)for(const [key,hashKey]of [['source','sourceSHA256'],['sticker','stickerSHA256'],['lettering','letteringSHA256']]){
  assert(entry[key].startsWith('design/jango/emoticons/kakao-32/v18/'),'MASTER outside v18');
  assert.equal(masterHash(entry[key]),entry[hashKey],`MASTER bytes changed: ${entry[key]}`);
  assert.equal(set.assets[entry[key]],entry[hashKey],'MASTER inventory mismatch');
 }
 for(const [file,hash]of Object.entries(set.assets))assert.equal(masterHash(file),hash,`MASTER asset changed: ${file}`);
 return set;
}
