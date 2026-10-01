// Recompute evidence only; preparation records, candidate dispositions and releases are immutable here.
import path from 'node:path';
import {filesIn,quality,audit,writeJson,masterIds} from './jango-design-gate.mjs';
const counts={pass:0,stale:0,missing:0,"master-adoption":0};
for(const id of masterIds()){const report=audit(id);writeJson(`${quality}/reports/${id}.json`,report);counts[report.preparation]++;}
for(const file of filesIn(`${quality}/candidates`)){
 const id=path.basename(file,'.json'),report=audit(id);
 writeJson(`${quality}/reports/${id}.json`,report);counts[report.preparation]++;
}
console.log(JSON.stringify({preparation:counts,note:'Reports refreshed. No preparation or release was approved.'}));
