// Candidate review only. Never writes the immutable v18 gallery or changes app assets.
import {assertOpenVersion} from './jango-history.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {titleFor} from './jango-emoticon-layout.mjs';
import {local,readJson} from './jango-design-gate.mjs';
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7);
assert(base&&/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base),'Explicit canonical version required');
assertOpenVersion(base);
assert(base!=='design/jango/emoticons/kakao-32/v18','v18 MASTER gallery is immutable');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').map(Number);
const version=base.split('/').at(-1),plan=readJson(base+'/plan.json'),selections=readJson(base+'/selection.json'),review=readJson(base+'/visual-review.json');
if(only)assert(only.length&&new Set(only).size===only.length&&only.every(n=>Number.isInteger(n)&&n>=1&&n<=32&&plan.some(p=>p.n===n)),'Valid unique review numbers required');
const rows=only?plan.filter(p=>only.includes(p.n)):plan;
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const change=readJson(base+'/change-record.json'),previous=change.baseVersion;assert(/^v\d+$/.test(previous),'Invalid comparison version');
const reused=rows.filter(p=>p.operation==='layout-lettering-only').length,redrawn=rows.length-reused;
const heading=change.concept??'전신과 Gaegu Bold';
const modes=[['stickers','문구 포함'],['artwork-360','문구 없는 동일 배치'],['faces','얼굴 확대'],['../'+previous+'/stickers',previous+' 이전 배치']];
const cards=rows.map(p=>{
 const k=String(p.n).padStart(2,'0'),item=review.items.find(x=>x.number===p.n),title=titleFor(p);
 return `<article><h2>${k} · ${escape(title)}</h2><div class="visual"><img class="asset" src="stickers/${k}.png" data-number="${k}" alt="${escape(title)}" width="240" height="240" loading="lazy"></div><p>${escape(item.observation)}</p><small>입 자동 검사: ${escape(item.mouthStatus)} · ${escape(item.sourceOperation)}</small><p><a href="stickers/${k}.png" download>360px 후보 PNG</a> · <a href="artwork-360/${k}.png" download>문구 없는 PNG</a> · <a href="${escape(selections[k].source)}">전신 원화</a></p></article>`;
}).join('');
const pairs=review.pairs.map(pair=>`<div class="pair">${pair.numbers.map(n=>`<figure><img src="artwork-360/${String(n).padStart(2,'0')}.png" width="120" height="120" alt="${n}번 문구 없는 실제 배치"><figcaption>${String(n).padStart(2,'0')}</figcaption></figure>`).join('')}<p>${escape(pair.result)}<br><small>${escape(pair.evidence)}</small></p></div>`).join('');
const fontComparison=change.fontReview?`<details><summary>대표 여섯 컷 · 서체 비교 과정</summary><p>열 순서: ${change.fontReview.numbers.map(n=>String(n).padStart(2,'0')).join(' · ')}. 아래 이미지의 행 순서는 다음과 같습니다.</p><ol>${change.fontReview.rows.map(label=>`<li>${escape(label)}</li>`).join('')}</ol><img src="font-comparison-180-light.png" alt="${escape(change.fontReview.rows.join(' / '))} 서체 비교"><p><a href="font-comparison-80-dark.png">80px 어두운 배경 비교</a> · <a href="font-comparison-120-dark.png">120px 어두운 배경 비교</a> · <a href="${escape(change.fontReview.record)}">서체 선택 근거</a></p></details>`:'';
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>장고 ${version} 전신 ${rows.length}종 검토</title>
<style>body{margin:0;background:#f5f6f0;color:#252c28;font:16px/1.6 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:24px}h1{font-size:26px}h2{font-size:18px}a{color:inherit}button{font:inherit;background:#fff;color:#252c28;border:1px solid #a5b1a9;border-radius:6px;min-height:44px;padding:8px 12px;cursor:pointer}nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}section.large{grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))}article{border-top:1px solid #a5b1a9;padding-top:12px}.visual{display:flex;justify-content:center;align-items:center;min-height:250px}img{object-fit:contain;max-width:100%;height:auto}body.dark{background:#293a31;color:#f5f6f0}body.dark button{background:#34473c;color:#f5f6f0}.pair{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid #a5b1a9;padding:12px 0}figure{margin:0}figcaption{text-align:center}small{font-size:13px}a{overflow-wrap:anywhere}</style>
<main><h1>장고 ${version} · ${escape(heading)} ${rows.length}종</h1><p>${escape(previous)} 선택 원화 재사용 ${reused}종 + 새 작화 ${redrawn}종. ${change.typography?escape(change.typography.fontDisplayName)+' 서체와 공통 크기 기준으로 문구를 조판하고 전신을 배치했습니다.':'문구별 크기·위치·기울기를 별도로 조판하고 전신을 배치했습니다.'}</p><p>이 묶음은 검토 후보입니다. MASTER 채택·앱 적용·카카오 판매 승인·외부 서명된 출시는 별도입니다.</p>
<nav><button id="theme" aria-pressed="false" onclick="toggleTheme()">밝은 / 어두운 배경</button><a href="README.md">제작·검수 안내</a><a href="visual-review.json">관찰 기록</a><a href="inspection-status.json">자동 검사</a></nav>
<nav><a href="${rows.length===32?'preview-light.png':'caption-360-light.png'}">전체 미리보기</a><a href="caption-80-dark.png">80px 어두운 배경</a><a href="caption-120-light.png">120px 밝은 배경</a><a href="caption-360-dark.png">360px 어두운 배경</a><a href="comparison-${previous}.png">${previous} 전후 비교</a></nav>
${fontComparison}
<h2>문구와 동작 비교</h2>${pairs}
<h2>${rows.length}종 개별 보기</h2><nav>${modes.map(([folder,label])=>`<button onclick="setMode('${folder}')">${escape(label)}</button>`).join('')}${[80,120,240,360].map(n=>`<button onclick="setSize(${n})">${n}px</button>`).join('')}</nav><p>문구 없는 화면도 최종 스티커와 같은 배치입니다. 원화는 각 컷의 링크로 확인할 수 있습니다.</p><section id="gallery">${cards}</section>
<h2>검토 범위</h2><p>${escape(review.method)}</p><ul>${review.limitations.map(s=>`<li>${escape(s)}</li>`).join('')}</ul></main>
<script>function toggleTheme(){const value=document.body.classList.toggle('dark');document.getElementById('theme').setAttribute('aria-pressed',String(value))}function setMode(folder){document.querySelectorAll('.asset').forEach(image=>image.src=folder+'/'+image.dataset.number+'.png')}function setSize(size){document.getElementById('gallery').classList.toggle('large',size===360);document.querySelectorAll('.asset').forEach(image=>{image.width=size;image.height=size})}</script></html>`;
fs.writeFileSync(local(base+'/index.html'),html);
console.log(`Built ${version} full-body candidate gallery.`);
