'use strict';
// Zero-dependency classroom demo server. Run: node server.js
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const undercover=require('./lib/undercover.cjs');
const PORT=Number(process.env.PORT)||3000, rooms=new Map();
const LESSONS={
 l1:{name:'第一课 · 数字和朋友',words:[{word:'一',options:['一','二','三','四']},{word:'三',options:['一','三','五','七']},{word:'十',options:['二','六','八','十']},{word:'朋友',options:['朋友','生日','星期','名字']},{word:'五',options:['五','六','七','八']},{word:'八',options:['二','四','六','八']}]},
 l2:{name:'第二课 · 日期和生日',words:[{word:'生日',options:['生日','朋友','名字','现在']},{word:'今天',options:['今天','昨天','明天','星期']},{word:'月',options:['天','月','年','号']},{word:'星期',options:['星期','生日','朋友','名字']},{word:'七天',options:['三天','五天','七天','十天']}]}
};
const id=()=>crypto.randomBytes(16).toString('hex');
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function cleanName(s){return String(s||'').trim().slice(0,22).replace(/[<>]/g,'')||'同学'}
function roomView(r,token){if(r.game==='undercover')return undercover.snapshot(r,token);let me=r.players.find(x=>x.token===token);let isHost=token===r.host;return {room:r.code,mode:r.mode,lesson:r.lesson,phase:r.phase,round:r.round,roundId:r.roundId,drawerId:r.drawerId,drawerName:r.players.find(x=>x.id===r.drawerId)?.name||'',isHost,isDrawer:me?.id===r.drawerId,meId:me?.id||'',players:r.players.map(p=>({id:p.id,name:p.name,score:p.score,answered:p.answered})),strokes:r.strokes,correctCount:r.players.filter(p=>p.answered).length,word:(isHost||me?.id===r.drawerId)?r.word?.word:null,options:(!isHost&&me?.id!==r.drawerId&&r.phase==='playing'&&r.mode==='choice')?r.options:null,remaining: r.phase==='playing'?Math.max(0,Math.ceil((r.deadline-Date.now())/1000)):60,message:r.message||'',results:r.phase==='result'?{word:r.word?.word,winners:r.winners}:null}}
function broadcast(r){for(const s of [...r.subscribers]){try{s.res.write('data: '+JSON.stringify(roomView(r,s.token))+'\n\n')}catch{r.subscribers.delete(s)}}}
function drawNext(r){r.round++;r.roundId=id();r.phase='playing';r.strokes=[];r.winners=[];r.message='';let next=r.players[(r.round-1)%r.players.length];r.drawerId=next.id;let pool=LESSONS[r.lesson].words;r.word=pool[(r.round-1)%pool.length];r.options=[...r.word.options].sort(()=>Math.random()-.5);r.deadline=Date.now()+60000;for(const p of r.players)p.answered=false;broadcast(r)}
function endRound(r,message='本轮结束'){if(r.phase!=='playing')return;r.phase='result';r.message=message;broadcast(r)}
function authorize(r,token){if(!r)throw new Error('房间不存在或已过期');if(token!==r.host&&!r.players.some(p=>p.token===token))throw new Error('你尚未加入这个房间')}
async function api(req,res,url){if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{games:['drawing','undercover']});if(req.method==='GET'&&url.pathname==='/api/events'){
 const r=rooms.get(url.searchParams.get('room'));const token=url.searchParams.get('token');try{authorize(r,token)}catch(e){return json(res,403,{error:e.message})}
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 1500\n\n');const sub={res,token};r.subscribers.add(sub);res.write('data: '+JSON.stringify(roomView(r,token))+'\n\n');req.on('close',()=>r.subscribers.delete(sub));return;
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>18000)return json(res,413,{error:'请求过大'})}
 let b;try{b=JSON.parse(raw||'{}')}catch{return json(res,400,{error:'无效请求'})}
 try{
 if(url.pathname==='/api/create'){if(b.game==='undercover'&&b.teacherPreview!==true)throw Error('新词库待教师审核，仅供教师预览');let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));let r={game:b.game==='undercover'?'undercover':'drawing',code,host:id(),mode:'choice',lesson:LESSONS[b.lesson]?b.lesson:'l1',phase:'lobby',round:0,roundId:'',drawerId:null,players:[],strokes:[],subscribers:new Set(),created:Date.now(),message:''};rooms.set(code,r);return json(res,200,{room:code,token:r.host})}
 if(url.pathname==='/api/join'){let r=rooms.get(String(b.room||'').toUpperCase());if(!r)throw new Error('房间不存在');if(r.game==='undercover'&&r.phase!=='lobby')throw Error('本轮已经开始，请等待新房间 / Game already started');if(b.game&&b.game!==r.game)throw Error('房间类型不匹配 / Wrong game room');if(r.players.length>=30)throw new Error('房间已满');let token=id(),player={id:id(),token,name:cleanName(b.name),score:0,answered:false};r.players.push(player);broadcast(r);return json(res,200,{room:r.code,token,playerId:player.id})}
 let r=rooms.get(String(b.room||'').toUpperCase());authorize(r,b.token);let host=b.token===r.host,me=r.players.find(p=>p.token===b.token);
 if(url.pathname==='/api/state')return json(res,200,roomView(r,b.token));
 if(r.game==='undercover'){undercover.action(r,url.pathname,b,host,me);broadcast(r);return json(res,200,{ok:true});}
 switch(url.pathname){
 case '/api/config':if(!host)throw Error('仅教师可以切换模式');if(r.phase==='playing')throw Error('请在本轮结束后切换');if(!['choice','type'].includes(b.mode))throw Error('未知模式');r.mode=b.mode;broadcast(r);break;
 case '/api/start':if(!host)throw Error('只有教师可以开始');if(r.players.length<2)throw Error('至少需要两名学生');if(r.phase==='playing')throw Error('本轮进行中');drawNext(r);break;
 case '/api/stroke':if(r.phase!=='playing'||me?.id!==r.drawerId)throw Error('只有画画者可绘画');if(r.strokes.length>4000)throw Error('画板已满，请清空');if(!Array.isArray(b.points)||b.points.length>60)throw Error('画线数据无效');let pts=b.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1));if(pts.length){r.strokes.push({points:pts});broadcast(r)}break;
 case '/api/clear':if(r.phase!=='playing'||me?.id!==r.drawerId)throw Error('只有画画者可清空');r.strokes=[];broadcast(r);break;
 case '/api/answer':if(r.phase!=='playing'||!me||me.id===r.drawerId)throw Error('当前无法答题');if(me.answered)throw Error('这一轮你已经答过');if(Date.now()>r.deadline){endRound(r,'时间到');throw Error('本轮时间已到')};let answer=String(b.answer||'').trim().replace(/[\s。！!？?]/g,'');if(r.mode==='choice'&&!r.options.includes(answer))throw Error('请点击一个选项');if(!answer||answer.length>30)throw Error('请输入有效答案');me.answered=true;let correct=answer===r.word.word;if(correct){me.score+=10;r.winners.push(me.name);r.message=`🎉 ${me.name} 答对了！`;}else{r.message=`${me.name} 已提交答案`;}if(r.players.filter(p=>p.id!==r.drawerId).every(p=>p.answered))endRound(r,'所有同学已完成答题');else broadcast(r);return json(res,200,{ok:true,correct});
 case '/api/end':if(!host)throw Error('只有教师可以结束');endRound(r,'教师结束了本轮');break;
 default:return json(res,404,{error:'未知操作'});
 }
 return json(res,200,{ok:true});
 }catch(e){return json(res,400,{error:e.message})}
}
const staticFiles={'/undercover.html':'undercover.html','/assets/js/undercover.mjs':'assets/js/undercover.mjs','/numbers.html':'numbers.html','/data/lessons/L01.json':'data/lessons/L01.json','/assets/js/numbers.mjs':'assets/js/numbers.mjs','/assets/js/lesson-core.mjs':'assets/js/lesson-core.mjs','/assets/css/lesson.css':'assets/css/lesson.css','/':'index.html','/index.html':'index.html','/multiplayer.html':'multiplayer.html','/learn.html':'learn.html',
 '/assets/css/home.css':'assets/css/home.css','/assets/js/home.js':'assets/js/home.js','/assets/js/catalog.js':'assets/js/catalog.js','/assets/images/adventure.svg':'assets/images/adventure.svg'};
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'Bad URL'})};if(url.pathname.startsWith('/api/'))return api(req,res,url);let f=staticFiles[url.pathname];if(!f)return json(res,404,{error:'Not found'});fs.readFile(path.join(__dirname,f),(err,content)=>{if(err)return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':({'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'}[path.extname(f)]||'text/html; charset=utf-8'),'Cache-Control':'no-store'});res.end(content)})});
setInterval(()=>{let now=Date.now();for(const [key,r]of rooms){if(r.phase==='playing'){if(now>r.deadline)endRound(r,'时间到！');else broadcast(r)}if(now-r.created>8*3600e3){for(const s of r.subscribers)s.res.end();rooms.delete(key)}}},1000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`中文冒险岛多人游戏: http://localhost:${PORT}/multiplayer.html`));
