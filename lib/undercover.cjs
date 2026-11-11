'use strict';
const crypto=require('node:crypto');
const pack=require('../data/lessons/L01.json');
function getWord(id){const w=pack.vocabulary.find(w=>w.id===id);if(!w||!w.undercover_pairable||!w.age_appropriate)throw Error('词对不可用于本游戏');return w;}
function start(r){
 if(!['lobby','result'].includes(r.phase))throw Error('本轮已经开始');
 if(r.players.length<3)throw Error('至少需要 3 名玩家 / At least 3 players are required');
 const pairs=pack.game_prompts.undercover;const pair=pairs[crypto.randomInt(pairs.length)];const words=[getWord(pair.regular_id),getWord(pair.undercover_id)];
 const spy=crypto.randomInt(r.players.length),flip=crypto.randomInt(2);r.regular=words[flip];r.secret=words[1-flip];r.round++;r.roundId=crypto.randomBytes(16).toString('hex');r.phase='discussion';r.assignments=new Map();r.votes=new Map();r.seen=new Set();
 r.players.forEach((p,i)=>r.assignments.set(p.id,{word:i===spy?r.secret:r.regular,spy:i===spy}));
}
function snapshot(r,token){
 const me=r.players.find(p=>p.token===token),isHost=token===r.host,active=['discussion','voting'].includes(r.phase);
 const mine=me&&r.assignments?.get(me.id);
 return {game:'undercover',room:r.code,lesson:'L01',contentStatus:'draft',phase:r.phase,round:r.round,roundId:r.roundId,isHost,meId:me?.id||'',myWord:active&&mine?{hanzi:mine.word.hanzi,pinyin:mine.word.pinyin,english:mine.word.english}:null,myVote:r.votes?.get(me?.id)||null,players:r.players.map(p=>({id:p.id,name:p.name,seen:r.seen?.has(p.id)||false,voted:r.votes?.has(p.id)||false})),results:r.phase==='result'?{regular_word:r.regular.hanzi,undercover_word:r.secret.hanzi,players:r.players.map(p=>({id:p.id,name:p.name,isUndercover:r.assignments.get(p.id).spy,votes:[...r.votes.values()].filter(v=>v===p.id).length}))}:null};
}
function action(r,route,b,host,me){
 if(route==='/api/start'){if(!host)throw Error('只有教师可以开始');start(r);return;}
 if(route==='/api/seen'){if(!me||!['discussion','voting'].includes(r.phase))throw Error('当前无法查看词语');r.seen.add(me.id);return;}
 if(route==='/api/open-vote'){if(!host)throw Error('只有教师可以开始投票');if(r.phase!=='discussion')throw Error('请先开始讨论');r.phase='voting';return;}
 if(route==='/api/vote'){
  if(!me||r.phase!=='voting')throw Error('当前无法投票');if(b.roundId!==r.roundId)throw Error('轮次已改变，请重新查看');if(r.votes.has(me.id))throw Error('本轮已经投票');if(b.target===me.id||!r.players.some(p=>p.id===b.target))throw Error('请选择另一位玩家');r.votes.set(me.id,b.target);if(r.votes.size===r.players.length)r.phase='result';return;
 }
 if(route==='/api/reveal'){if(!host)throw Error('只有教师可以揭晓');if(!['discussion','voting'].includes(r.phase))throw Error('没有正在进行的轮次');r.phase='result';return;}
 throw Error('此操作不适用于谁是卧底房间');
}
module.exports={start,snapshot,action};
