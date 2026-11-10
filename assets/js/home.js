import {lessons, games, featureDescriptions} from './catalog.js';
const lessonsRoot = document.querySelector('#lesson-cards');
lessonsRoot.innerHTML = lessons.map((lesson, index) => {
 const body = `<span class="lesson-icon" aria-hidden="true">${lesson.icon}</span><span class="lesson-number">LESSON ${String(index+1).padStart(2,'0')}</span><h3>${lesson.title}</h3><p>${lesson.english}</p><span class="lesson-status">${lesson.id?'开始探索 →':'◷ 建设中'}</span>`;
 return lesson.id ? `<a class="lesson-card available" href="/learn.html?lesson=${lesson.id}&step=read">${body}</a>` : `<article class="lesson-card upcoming">${body}</article>`;
}).join('');
document.querySelector('#game-cards').innerHTML = games.map(game => `<a class="game-card ${game.color}" href="${game.url || '/learn.html?lesson=l1&step='+game.step}"><span class="game-icon" aria-hidden="true">${game.icon}</span><h3>${game.title}</h3><p>${game.description}</p><span class="play" aria-hidden="true">▶</span></a>`).join('');
const dialog = document.querySelector('#feature-dialog');
document.querySelectorAll('[data-feature]').forEach(button => button.addEventListener('click', () => {
 const feature = button.dataset.feature;
 document.querySelector('#dialog-title').textContent = feature+' · 建设中';
 document.querySelector('#dialog-description').textContent = featureDescriptions[feature] || '文化介绍、原创词汇和语言挑战正在规划中。此地区目前为概念预览，尚未开放互动关卡。';
 dialog.showModal();
}));
document.querySelectorAll('.close, .close-dialog').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); } });
