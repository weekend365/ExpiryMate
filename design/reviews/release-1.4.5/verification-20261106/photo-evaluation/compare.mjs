/* global process, console */
// Local, explicit evaluation. No database, quota, or deployment.
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const review=dirname(fileURLToPath(import.meta.url)),root=resolve(review,'../../../../..');
const api=join(root,'apps/api'),req=createRequire(join(api,'package.json'));
const baselineRevision='cf37517d81d63ffea70c6235c6324a74bc4ead8b';
req('@nestjs/common').Logger.overrideLogger(false);
const tmp=fs.mkdtempSync(join(tmpdir(),'jango-photo-compare-'));
fs.symlinkSync(join(api,'node_modules'),join(tmp,'node_modules'),'dir');
const dir=join(api,'src/modules/inventory'),hashes={};
const load=p=>import(pathToFileURL(p).href);
for(const [stem,target] of [['inventory-photo-parse.service','v1'],['inventory-photo-parse.normalize','normalize-v1']]){
 const source=execFileSync('git',['show',`${baselineRevision}:apps/api/src/modules/inventory/${stem}.ts`],{cwd:root,encoding:'utf8'});
 hashes[stem]=createHash('sha256').update(source).digest('hex');
 fs.writeFileSync(join(tmp,target+'.ts'),source.replace(/from "(\.[^"]+)"/g,(_,p)=>`from ${JSON.stringify(resolve(dir,p))}`));
}
const current=await load(join(dir,'inventory-photo-parse.service.ts')),old=await load(join(tmp,'v1.ts'));
const normal=await load(join(dir,'inventory-photo-parse.normalize.ts')),oldNormal=await load(join(tmp,'normalize-v1.ts'));
const {prepareVisionImage}=await load(join(dir,'inventory-photo-parse.image.ts'));
const {runEvaluationJobs}=await load(join(api,'scripts/ai-evaluation-scheduler.ts'));
const {calculateOpenAiCostUsd}=await load(join(api,'src/common/openai-model-config.ts'));
const provenance=JSON.parse(fs.readFileSync(join(root,'docs/operations/ai-evaluations/current-baseline-2026-10-20/photo-provenance.json'),'utf8'));
const dataDir='/tmp/jango-photo-quality-data';
const cases=provenance.fridge.filter(p=>fs.existsSync(join(dataDir,p.file)));
for(const c of cases)if(createHash('sha256').update(fs.readFileSync(join(dataDir,c.file))).digest('hex')!==c.sha256)throw Error('Image hash mismatch');
const jobs=cases.flatMap((c,i)=>(i%2?['v2','v1']:['v1','v2']).map(variant=>({c,variant})));
if(jobs.length>58)throw Error('60 request cap');
const output=join(review,'live-results.jsonl');
const manifest={model:'gpt-5.6-luna',modelBasis:'Unchanged code default and approved 2026-10-20 baseline. Production configuration gpt-5.6-luna verified on 2026-11-06; local dev override not used.',maxCalls:60,maxCostUsd:.8,originalTotalLimitUsd:1,priorFailedRequestReserveUsd:.2,priorCallCount:2,plannedCalls:jobs.length,availableCases:cases.map(c=>c.id),missingCases:provenance.fridge.filter(c=>!cases.includes(c)).map(c=>c.id),baselineRevision,baselineSourceSha256:hashes,tokenCeilings:{v1:1800,v2:4096},nativePreprocessingIncluded:false,comparison:'same image bytes and model, alternating order, one call per variant, no retries',accuracyStatus:'Requires visual review; candidate count is not accuracy.'};
fs.writeFileSync(join(review,'live-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({plannedCalls:jobs.length,model:manifest.model,keyAvailable:!!process.env.OPENAI_API_KEY}));
if(!process.argv.includes('--run'))process.exit(0);
if(!process.env.OPENAI_API_KEY)throw Error('Missing local key');
if(fs.existsSync(output))throw Error('Refuse to overwrite paid run');
fs.writeFileSync(output,'',{flag:'wx'});
let calls=0;
try{
 const spent=await runEvaluationJobs({jobs,concurrency:1,budgetUsd:.8,allowance:()=>.1,run:async({c,variant})=>{
  if(++calls>60)throw Error('Call cap');
  process.env.INVENTORY_PHOTO_PARSE_MAX_OUTPUT_TOKENS=String(manifest.tokenCeilings[variant]);
  const mod=variant==='v1'?old:current,norm=variant==='v1'?oldNormal:normal;
  const service=new mod.InventoryPhotoParseService({},{});
  const image=prepareVisionImage(fs.readFileSync(join(dataDir,c.file)));
  const start=Date.now();let record;
  try{
   const result=await service.recognizeItems('fridge',image,manifest.model,`eval:${c.id}`);
   record={caseId:c.id,variant,model:manifest.model,sourceSha256:c.sha256,status:'succeeded',durationMs:Date.now()-start,usage:result.usage,costUsd:result.estimatedCostUsd,items:norm.normalizePhotoParseItems('fridge',result.items)};
  }catch(error){
   const usage=error?.usage;
   record={caseId:c.id,variant,status:'failed',durationMs:Date.now()-start,failureCode:error?.failureCode??'provider_error',usage:usage??{usageStatus:'unavailable'},costUsd:usage?calculateOpenAiCostUsd(usage,manifest.model):0};
  }
  fs.appendFileSync(output,JSON.stringify(record)+'\n');
  return{costUsd:record.costUsd,accountingComplete:record.usage.usageStatus==='reported'};
 },settled:({c,variant},spent)=>console.log(JSON.stringify({caseId:c.id,variant,calls,spent}))});
 fs.writeFileSync(join(review,'live-settlement.json'),JSON.stringify({calls,costUsd:spent,completed:true})+'\n');
}catch(error){fs.writeFileSync(join(review,'live-settlement.json'),JSON.stringify({calls,completed:false,reason:error.message})+'\n');console.error(error.message);process.exitCode=1;}
