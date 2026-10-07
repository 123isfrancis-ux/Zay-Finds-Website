import catalogue from '../../lib/regional-catalogue';
import {createStore} from '../../lib/trending-store';
import {sameOrigin} from '../../lib/trending-api';
import {safeSearch} from '../../lib/dashboard';
import {fitSignalKey} from '../../lib/fit-signals';
const ids=new Set(catalogue.items.filter(i=>i.visibility!=='hidden').map(i=>i.id));
const vocabulary=new Set(catalogue.items.flatMap(i=>i.name.toLowerCase().replace(/[^a-z -]/g,' ').split(/\s+/)));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 if(!sameOrigin(req))return res.status(403).end();
 const body=req.body;
 if(!String(req.headers['content-type']||'').startsWith('application/json')||!body||typeof body.session!=='string'||! /^[a-f0-9-]{36}$/.test(body.session)||!Array.isArray(body.events)||!body.events.length||body.events.length>20)return res.status(400).end();
 if(req.headers.dnt==='1'||req.headers['sec-gpc']==='1'||/bot|crawler|spider|headless/i.test(req.headers['user-agent']||''))return res.status(204).end();
 const events=[];
 for(const event of body.events){if(event?.type==='image_error'&&ids.has(event.id))events.push('image:'+event.id);else if(event?.type==='search_empty'&&typeof event.query==='string'&&event.query.length<=80)events.push('search:'+safeSearch(event.query,vocabulary));else {const key=fitSignalKey(event,ids);if(!key)return res.status(400).end();events.push(key);}}
 try{const store=createStore();if(!store)return res.status(204).end();const address=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();const ok=await store.signals(body.session,address,events);return res.status(ok?204:429).end();}catch{return res.status(503).end();}
}
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
