import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {URL} from 'node:url';
import console from 'node:console';
const dir=path.dirname(new URL(import.meta.url).pathname),root='/Users/namu/Desktop/ExpiryMate';
const css=['Regular','Medium','SemiBold','Bold','ExtraBold'].map(w=>`@font-face{font-family:Pretendard-${w};src:url('/fonts/Pretendard-${w}.otf')}`).join('');
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/app.js'){res.setHeader('content-type','application/javascript');res.end(fs.readFileSync(path.join(dir,'app.js')));return;}
 if(/^\/fonts\/Pretendard-(Regular|Medium|SemiBold|Bold|ExtraBold)\.otf$/.test(url.pathname)){res.setHeader('content-type','font/otf');res.end(fs.readFileSync(path.join(root,'apps/mobile/assets',url.pathname)));return;}
 res.setHeader('content-type','text/html;charset=utf-8');
 if(url.pathname==='/frame'){res.end(`<!doctype html><meta charset="utf-8"><style>${css}html,body,#root{margin:0;width:100%;height:100%;background:#fffdf8}*{box-sizing:border-box}</style><div id="root"></div><script>fetch=()=>Promise.reject(new Error('Offline demonstration: network disabled'));XMLHttpRequest=class{constructor(){throw new Error('Offline demonstration')}};WebSocket=class{constructor(){throw new Error('Offline demonstration')}};</script><script src="/app.js"></script>`);return;}
 res.end(`<!doctype html><meta charset="utf-8"><title>장고 앱 UI · 예시 데이터 시연</title><style>html,body{margin:0;background:#fffdf8;width:100%;min-height:1800px}iframe{width:420px;height:900px;border:0;transform:scale(2);transform-origin:top left}</style><iframe src="/frame?width=420" title="현재 앱 UI 예시"></iframe>`);
}).listen(48767,'127.0.0.1',()=>console.log('Offline app demo: http://127.0.0.1:48767'));
