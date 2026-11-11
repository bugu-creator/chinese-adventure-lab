export function shuffle(items, random = Math.random) { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out; }
export function word(pack,id){const value=pack.vocabulary.find(w=>w.id===id);if(!value)throw Error('Missing vocabulary: '+id);return value;}
export function optionsFor(pack,prompt){return prompt.choice_ids.map(id=>word(pack,id));}
export function eligible(pack,game){return pack.vocabulary.filter(w=>w.age_appropriate && w[game==='drawing'?'drawable':'undercover_pairable']);}
export function assignRoles(prompt,count,random=Math.random){if(!Number.isInteger(count)||count<3||count>12)throw Error('需要 3–12 名玩家');const spy=Math.floor(random()*count);return Array.from({length:count},(_,i)=>({wordId:i===spy?prompt.undercover_id:prompt.regular_id,isSpy:i===spy}));}
export function award(completed,pack,stage){if(completed.has(stage))return 0;completed.add(stage);return pack.rewards[stage]||0;}
export function canVisit(stage,completed,locked){if(!locked)return true;const required=['read','match','patterns','quiz'];const index=required.indexOf(stage);return required.slice(0,index<0?required.length:index).every(s=>completed.has(s));}
export function normalizeAnswer(text){return String(text).trim().replace(/[\s。！!？?]/g,'');}
