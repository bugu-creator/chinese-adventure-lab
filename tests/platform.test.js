'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const vm=require('node:vm');
let server,base;
before(async()=>{server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3187'}});base='http://127.0.0.1:3187';await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});});
after(()=>server?.kill());
async function post(route,body){const res=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
async function view(room,token){const controller=new AbortController();const res=await fetch(base+`/api/events?room=${room}&token=${token}`,{signal:controller.signal});if(!res.ok){controller.abort();return {status:res.status};}const reader=res.body.getReader();let text='';try{while(!text.includes('data: ')){text+=new TextDecoder().decode((await reader.read()).value);}return JSON.parse(text.split('data: ')[1].split('\n\n')[0]);}finally{controller.abort();}}
test('homepage, learning, multiplayer and assets use explicit routes and correct MIME',async()=>{for(const [route,mime] of [['/','text/html'],['/index.html','text/html'],['/learn.html?lesson=l2&step=read','text/html'],['/multiplayer.html','text/html'],['/assets/css/home.css','text/css'],['/assets/js/home.js','text/javascript'],['/assets/js/catalog.js','text/javascript'],['/assets/images/adventure.svg','image/svg+xml']]){const res=await fetch(base+route);assert.equal(res.status,200,route);assert.ok(res.headers.get('content-type').startsWith(mime));assert.ok((await res.text()).length>100);}assert.equal((await fetch(base+'/server.js')).status,404);assert.equal((await fetch(base+'/assets/../README.md')).status,404);});
test('all static homepage links resolve to existing routes or sections',async()=>{const html=await (await fetch(base)).text();for(const [,href] of html.matchAll(/href="([^"]+)"/g)){if(href.startsWith('#'))assert.ok(html.includes(`id="${href.slice(1)}"`),href);else assert.equal((await fetch(base+href)).status,200,href);}assert.match(html,/建设中/);assert.doesNotMatch(html,/Lv\.8|620\s*\/\s*800|1,280/);});
test('learning and multiplayer inline JavaScript compile; lessons and deep links remain present',()=>{for(const file of ['learn.html','multiplayer.html']){const html=fs.readFileSync(file,'utf8');new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);}const lesson=fs.readFileSync('learn.html','utf8');assert.match(lesson,/entryParams/);assert.match(lesson,/l1:/);assert.match(lesson,/l2:/);for(const name of ['read','match','quiz','spy','draw','teacher'])assert.match(lesson,new RegExp('function '+name+'\\('));});
test('student join request retains the entered room rather than empty session state',async()=>{let payload;const context={room:'',token:'',fetch:async(url,init)=>{payload=JSON.parse(init.body);return {ok:true,json:async()=>({ok:true})};}};vm.createContext(context);const html=fs.readFileSync('multiplayer.html','utf8');const fn=html.match(/async function call\(endpoint,data\)\{[^\n]+/)[0];vm.runInContext(fn,context);await vm.runInContext("call('join',{room:'ABC123',name:'Panda'})",context);assert.equal(payload.room,'ABC123');});
test('multiplayer lifecycle preserves secrets, role permissions, board and scores',async()=>{const host=(await post('create',{lesson:'l1'})).data;const room=host.room;const p1=(await post('join',{room,name:'Panda A'})).data;const p2=(await post('join',{room,name:'Panda B'})).data;assert.equal((await post('start',p1)).status,400);assert.equal((await post('start',host)).status,200);const h=await view(room,host.token),d=await view(room,p1.token),g=await view(room,p2.token);assert.equal(d.isDrawer,true);assert.equal(d.word,h.word);assert.equal(g.word,null);assert.equal(g.options.length,4);assert.equal((await view(room,'invalid')).status,403);assert.equal((await post('stroke',{...p2,points:[[0,0],[1,1]]})).status,400);assert.equal((await post('stroke',{...p1,points:[[0,0],[1,1]]})).status,200);assert.equal((await view(room,p2.token)).strokes.length,1);assert.equal((await post('answer',{...p1,answer:h.word})).status,400);assert.equal((await post('answer',{...p2,answer:h.word})).data.correct,true);const result=await view(room,p2.token);assert.equal(result.phase,'result');assert.equal(result.players.find(p=>p.id===p2.playerId).score,10);assert.equal((await post('answer',{...p2,answer:h.word})).status,400);await post('config',{...host,mode:'type'});await post('start',host);const next=await view(room,p1.token);assert.equal(next.mode,'type');assert.equal(next.word,null);assert.equal(next.options,null);assert.equal((await view(room,p2.token)).isDrawer,true);await post('end',host);assert.equal((await view(room,p1.token)).phase,'result');});
test('undercover assigns private per-player words and authorizes voting/reveal on the server',async()=>{
 const host=(await post('create',{game:'undercover',teacherPreview:true})).data;
 const room=host.room,players=[];
 assert.equal((await post('create',{game:'undercover'})).status,400);
 for(let i=0;i<3;i++)players.push((await post('join',{room,name:'Panda '+i,game:'undercover'})).data);
 assert.equal((await view(room,players[0].token)).myWord,null);
 assert.equal((await post('start',players[0])).status,400);
 await post('start',host);
 const views=await Promise.all(players.map(p=>view(room,p.token))),h=await view(room,host.token);
 assert.equal(h.myWord,null);assert.equal(h.results,null);
 assert.equal(new Set(views.map(s=>s.myWord.hanzi)).size,2);
 for(const s of views){assert.equal(s.game,'undercover');assert.equal(s.players.length,3);assert.equal(s.results,null);assert.equal(s.players.some(p=>'word'in p||'token'in p||'isUndercover'in p),false);}
 const saved=(await post('state',players[0])).data;assert.deepEqual(saved.myWord,views[0].myWord);
 assert.equal((await post('join',{room,name:'Late',game:'undercover'})).status,400);
 assert.equal((await post('reveal',players[0])).status,400);
 assert.equal((await post('stroke',{...players[0],points:[[0,0]]})).status,400);
 assert.equal((await post('open-vote',players[0])).status,400);await post('open-vote',host);
 assert.equal((await post('vote',{...players[0],target:players[0].playerId,roundId:views[0].roundId})).status,400);
 assert.equal((await post('vote',{...players[0],target:players[1].playerId,roundId:'old'})).status,400);
 for(let i=0;i<3;i++)assert.equal((await post('vote',{...players[i],target:players[(i+1)%3].playerId,roundId:views[i].roundId})).status,200);
 const result=await view(room,players[0].token);assert.equal(result.phase,'result');assert.equal(result.results.players.filter(p=>p.isUndercover).length,1);
 assert.equal((await post('vote',{...players[0],target:players[1].playerId,roundId:views[0].roundId})).status,400);
 await post('start',host);const next=await view(room,players[0].token);assert.notEqual(next.roundId,views[0].roundId);assert.equal(next.myVote,null);assert.equal(next.results,null);
});
test('two people can play drawing with the host as a player without revealing the host guesser answer',async()=>{
 const host=(await post('create',{hostPlays:true,lesson:'l01draft',teacherPreview:true})).data;
 assert.equal((await post('start',host)).status,400);
 const guest=(await post('join',{room:host.room,name:'Panda'})).data;
 await post('start',host);const first=await view(host.room,host.token),g=await view(host.room,guest.token);
 assert.equal(first.isHost,true);assert.equal(first.isDrawer,true);assert.equal(first.players.length,2);assert.ok(first.word);assert.ok(first.drawerInstruction);assert.equal(g.word,null);assert.equal(g.drawerInstruction,null);
 await post('answer',{...guest,answer:first.word});await post('start',host);
 const second=await view(host.room,host.token),drawer=await view(host.room,guest.token);assert.equal(second.isHost,true);assert.equal(second.isDrawer,false);assert.equal(second.word,null);assert.equal(second.drawerInstruction,null);assert.equal(second.options.length,4);assert.equal(drawer.isDrawer,true);
 assert.equal((await post('answer',{...host,answer:drawer.word})).data.correct,true);
 assert.equal((await view(host.room,host.token)).phase,'result');
});
