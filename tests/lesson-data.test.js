const {test}=require('node:test');
const assert=require('node:assert/strict');
const pack=require('../data/lessons/L01.json');
test('L01 records remain drafts with stable unique IDs and complete game flags',()=>{
 assert.equal(pack.status,'draft');assert.equal(pack.publication.reviewed_by,null);const ids=[];
 function walk(node){if(!node||typeof node!=='object')return;if(node.id){ids.push(node.id);assert.equal(node.status,'draft',node.id);}for(const value of Object.values(node))walk(value);}walk(pack);
 assert.equal(ids.length,new Set(ids).size);assert.ok(ids.length>40);
 for(const w of pack.vocabulary){assert.ok(w.hanzi&&w.pinyin&&w.english);for(const k of ['drawable','undercover_pairable','quiz_suitable','age_appropriate'])assert.equal(typeof w[k],'boolean');}
});
test('all exercise vocabulary references resolve and quizzes have a unique answer',()=>{
 const ids=new Set(pack.vocabulary.map(w=>w.id));function walk(node){if(!node||typeof node!=='object')return;for(const [key,value] of Object.entries(node)){if(['vocabulary_id','answer_id','regular_id','undercover_id','audio_vocabulary_id'].includes(key))assert.ok(ids.has(value),value);if(['vocabulary_ids','choice_ids'].includes(key))for(const id of value)assert.ok(ids.has(id),id);walk(value);}}walk(pack);
 for(const q of [...pack.quizzes,...pack.comprehension,pack.assessments.exit_ticket[0]]){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<4);assert.ok(q.explanation&&q.difficulty);}
});
test('drawing and undercover pools use suitable shared words and fair options',async()=>{
 const {word,optionsFor,eligible,assignRoles}=await import('../assets/js/lesson-core.mjs');
 for(const p of pack.game_prompts.drawing){assert.ok(word(pack,p.answer_id).drawable);assert.equal(p.choice_ids.length,4);assert.equal(new Set(p.choice_ids).size,4);assert.ok(p.choice_ids.includes(p.answer_id));assert.equal(optionsFor(pack,p).length,4);}
 for(const p of pack.game_prompts.undercover){assert.notEqual(p.regular_id,p.undercover_id);assert.ok(word(pack,p.regular_id).undercover_pairable);assert.ok(word(pack,p.undercover_id).undercover_pairable);const roles=assignRoles(p,4,()=>.5);assert.equal(roles.filter(r=>r.isSpy).length,1);assert.equal(roles.length,4);}
 assert.equal(eligible(pack,'drawing').length,10);assert.throws(()=>assignRoles(pack.game_prompts.undercover[0],2));
});
test('reward ledger is idempotent and optional games respect teacher stage locks',async()=>{
 const {award,canVisit,normalizeAnswer,shuffle}=await import('../assets/js/lesson-core.mjs');const completed=new Set();assert.equal(award(completed,pack,'read'),10);assert.equal(award(completed,pack,'read'),0);assert.equal(canVisit('patterns',completed,true),false);assert.equal(canVisit('match',completed,true),true);assert.equal(canVisit('exit',completed,false),true);assert.equal(canVisit('draw',completed,true),false);for(const s of ['match','patterns','quiz'])award(completed,pack,s);assert.equal(canVisit('exit',completed,true),true);assert.equal(normalizeAnswer(' 三。 '),'三');assert.deepEqual(shuffle([1,2,3],()=>.5).sort(),[1,2,3]);
});
