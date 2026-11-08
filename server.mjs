import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
http.createServer(async(req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+path.sep))throw Error(); const f=await readFile(p===root||p.endsWith(path.sep)?path.join(p,'index.html'):p);res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript','json':'application/json','css':'text/css'})[p.split('.').pop()]||'text/html; charset=utf-8');res.end(f)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('GO Lens: http://localhost:4173'));
