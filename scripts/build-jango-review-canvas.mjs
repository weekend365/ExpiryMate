// Build a self-contained Canvas from measured local review artifacts; no network or approval actions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root,readJson,readPng,local} from './jango-design-gate.mjs';
import {resizePremultiplied} from '../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const require=createRequire(path.join(root,'apps/mobile/package.json'));
const {PNG}=require('pngjs');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7);
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
assert(base&&/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base),'Explicit version required');
assert(output?.endsWith('.canvas.tsx'),'Canvas output path required');
const png=(file,size)=>{if(!size)return 'data:image/png;base64,'+fs.readFileSync(local(file)).toString('base64');const source=readPng(file),scale=Math.min(size/source.width,size/source.height);return 'data:image/png;base64,'+PNG.sync.write(resizePremultiplied(source,Math.round(source.width*scale),Math.round(source.height*scale))).toString('base64');};
const plan=readJson(base+'/plan.json'),selection=readJson(base+'/selection.json'),review=readJson(base+'/visual-review.json');
const rows=plan.map(p=>{const k=String(p.n).padStart(2,'0');return {n:p.n,title:p.title,line:p.line,mouthMode:p.mouthMode,source:base+'/'+selection[k].source,sticker:base+'/stickers/'+k+'.png',...review.items.find(r=>r.number===p.n),images:{stickers:png(base+'/stickers/'+k+'.png',240),artwork:png(base+'/artwork/'+k+'.png',240),faces:png(base+'/faces/'+k+'.png',200)}};});
const sheets={};
for(const mode of ['caption','expression'])for(const size of [80,120])for(const background of ['light','dark']){const key=`${mode}-${size}-${background}`,file=base+'/'+key+'.png';sheets[key]={src:png(file),width:readPng(file).width};}
const appReview={light:png("design/jango/app-review-light.png"),dark:png("design/jango/app-review-dark.png"),branding:png("design/jango/branding-review.png")};
const data={base,isMaster:base.endsWith("/v18"),rows,sheets,appReview,pairs:review.pairs,limitations:review.limitations,method:review.method};
const source=`import {Button,H1,H2,Text,useState,useHostTheme,useCanvasAction} from 'cursor/canvas';
const data=${JSON.stringify(data)};
type Mode='stickers'|'artwork'|'faces';
export default function JangoReview(){
 const theme=useHostTheme(),dispatch=useCanvasAction();
 const [mode,setMode]=useState<Mode>('stickers'),[size,setSize]=useState<80|120>(120),[dark,setDark]=useState(false),[selected,setSelected]=useState(1),[subset,setSubset]=useState<number[]|null>(null);
 const current=data.rows.find(r=>r.n===selected)!;
 const shown=subset?data.rows.filter(r=>subset.includes(r.n)):data.rows;
 const sheetKey=(mode==='stickers'?'caption':'expression')+'-'+size+'-'+(dark?'dark':'light');
 const sheet=data.sheets[sheetKey as keyof typeof data.sheets];
 const count=data.rows.filter(r=>r.mouthStatus==='pass').length;
 const open=(path:string)=>dispatch({type:'openFile',path});
 return <main style={{padding:24,color:theme.text.primary,background:theme.bg.editor,maxWidth:1500,margin:'auto',fontSize:13,lineHeight:1.6}}>
 <H1>장고 {data.base.split("/").at(-1)} · 크레파스 32종</H1>
 <Text>{data.isMaster?"사용자가 지정한 유일한 MASTER 32종입니다. 대표 24번을 앱 기본·아이콘·스플래시에 적용했습니다.":"v18 MASTER에서 제작한 검토 후보이며 자동 채택하지 않습니다."} 서명된 이모티콘 출시는 별도입니다.</Text>
 <p style={{color:theme.text.secondary}}>{data.isMaster?"MASTER":"후보"} 32종 · 현재 입 자동 검사 통과 {count}종 · 나머지는 재검토 · 제작 당시 재검토 이력 보존</p>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'}}>
 <Button onClick={()=>open(data.base+'/index.html')}>HTML 갤러리</Button><Button onClick={()=>open(data.base+'/README.md')}>제작·검수 안내</Button><Button onClick={()=>open(data.base+'/visual-review.json')}>검토 기록</Button>
 </div>
 <H2>앱과 브랜딩 적용</H2><p>idle 24 · happy 02 · worry 17 · cooking 23 · empty 20 · speak 01 · think 11 · point 14</p><img src={dark?data.appReview.dark:data.appReview.light} alt="앱 크기별 비교" style={{width:"100%"}}/><img src={data.appReview.branding} alt="24번 기반 브랜딩" style={{width:"100%"}}/>
 <H2>실제 작은 출력 비교</H2>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
 {([['stickers','문구 포함'],['artwork','문구 제외'],['faces','얼굴 확대']] as const).map(([value,label])=><Button key={value} variant={mode===value?'primary':'secondary'} onClick={()=>setMode(value)}>{label}</Button>)}
 {([80,120] as const).map(value=><Button key={value} variant={size===value?'primary':'secondary'} onClick={()=>setSize(value)}>{value}px</Button>)}
 <Button onClick={()=>setDark(v=>!v)}>{dark?'밝은 배경으로':'어두운 배경으로'}</Button>
 </div>
 <p style={{color:theme.text.secondary}}>각 칸의 그림은 {size}×{size}px입니다. 좁은 창에서는 가로로 스크롤합니다. 문구 제외 화면은 최종 위치·크기를 유지합니다.</p>
 <div style={{overflowX:'auto',border:'1px solid '+theme.stroke.secondary}}><img src={sheet.src} alt={size+'px 전체 32종 '+(dark?'어두운':'밝은')+' 배경'} style={{width:sheet.width,maxWidth:'none',display:'block'}}/></div>
 <H2 style={{marginTop:24}}>감정과 손동작 비교</H2>
 {data.pairs.map(pair=><div key={pair.numbers.join('-')} style={{display:'flex',alignItems:'baseline',gap:14,borderBottom:'1px solid '+theme.stroke.tertiary,padding:'10px 0',flexWrap:'wrap'}}><Button onClick={()=>setSubset(pair.numbers)}>{pair.numbers.map(n=>String(n).padStart(2,'0')).join(' / ')}</Button><div style={{flex:'1 1 280px'}}><strong>{pair.result}</strong><div style={{color:theme.text.secondary}}>{pair.evidence}</div></div></div>)}
 <div style={{display:'flex',gap:8,margin:'18px 0'}}><Button onClick={()=>setSubset(null)}>전체 32종</Button><Button onClick={()=>setSubset(data.rows.filter(r=>r.mouthStatus!=='pass').map(r=>r.n))}>입 재검토 컷</Button></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16}}>{shown.map(row=><figure key={row.n} style={{margin:0,textAlign:'center',padding:8,background:selected===row.n?theme.fill.tertiary:theme.bg.editor}}><button onClick={()=>setSelected(row.n)} style={{border:0,background:'transparent',color:theme.text.primary,cursor:'pointer'}}><img src={row.images[mode]} alt={row.n+' '+row.title} width={120} height={120} style={{objectFit:'contain'}}/><figcaption>{String(row.n).padStart(2,'0')} · {row.title}</figcaption></button><small style={{color:theme.text.secondary}}>입 {row.mouthStatus==='pass'?'자동 통과':'재검토'}</small></figure>)}</div>
 <section style={{marginTop:28,borderTop:'1px solid '+theme.stroke.primary,paddingTop:18}}><H2>{String(current.n).padStart(2,'0')} · {current.title}</H2><div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}><img src={current.images.stickers} alt={current.title+' 240px'} width={240} height={240}/><img src={current.images.faces} alt={current.title+' 얼굴 확대'} width={200} height={180} style={{objectFit:'contain'}}/><div style={{flex:'1 1 300px'}}><p>{current.observation}</p><p>입 모드 {current.mouthMode} · 입 검사 {current.mouthStatus} · 준비 {current.preparation} · 규격 {current.technicalStatus}</p><p style={{color:theme.text.secondary}}>{current.reviewNote}</p><div style={{display:'flex',gap:8}}><Button onClick={()=>open(current.source)}>전체 원본 열기</Button><Button onClick={()=>open(current.sticker)}>360px 후보 열기</Button></div></div></div></section>
 <section style={{marginTop:24,color:theme.text.secondary}}><H2>검토 범위</H2><p>{data.method}</p><ul>{data.limitations.map((s,n)=><li key={n}>{s}</li>)}</ul></section>
 </main>;
}
`;
fs.writeFileSync(output,source);
console.log(`Built self-contained Canvas: ${output} (${fs.statSync(output).size} bytes)`);
