const {test,expect}=require('@playwright/test');
const pack=require('../../data/lessons/L01.json');
async function enter(page){await page.goto('/numbers.html');await expect(page.locator('#draft-gate')).toBeVisible();await page.locator('#preview').click();}
async function stage(page,name){await page.locator(`[data-stage="${name}"]`).click();}
test('teacher draft gate, shared vocabulary and responsive page',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/numbers.html');await expect(page.locator('#lesson-app')).toBeHidden();await page.locator('#preview').click();
 await expect(page.locator('.word-tile')).toHaveCount(pack.vocabulary.length);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#pinyin').uncheck();await expect(page.locator('#activity .py')).toHaveCount(0);await page.locator('#pinyin').check();await expect(page.locator('#activity .py').first()).toBeVisible();
 await page.locator('#lock-mode').check();await expect(page.locator('[data-stage="quiz"]')).toBeDisabled();await expect(page.locator('[data-stage="exit"]')).toBeDisabled();await page.locator('#lock-mode').uncheck();await expect(page.locator('[data-stage="exit"]')).toBeEnabled();
 await page.screenshot({path:testInfo.outputPath('numbers-read.png'),fullPage:true});expect(errors).toEqual([]);
});
test('complete core lesson, feedback and review-only Exit Ticket with idempotent XP',async({page})=>{
 test.setTimeout(60000);await enter(page);await page.locator('#read-done').click();await expect(page.locator('#feedback')).toContainText('两项自查');
 await page.locator('#read-aloud').check();await page.locator('#read-listen').check();await page.locator('#read-done').click();await page.locator('#read-done').click();await expect(page.locator('#xp')).toHaveText('10');
 await stage(page,'match');
 for(let i=0;i<10;i++){const id=pack.matching[i].vocabulary_id;await page.locator(`[data-left="${id}"]`).click();await page.locator(`[data-right="${id}"]`).click();if(i===4)await page.locator('#match-next').click();}
 await expect(page.locator('#xp')).toHaveText('30');await stage(page,'patterns');
 await expect(page.locator('.instruction-en')).toContainText('how many good friends');await page.locator('#pinyin').uncheck();await expect(page.locator('.instruction-en')).toBeVisible();
 for(const q of pack.comprehension){await page.locator(`[data-answer="${q.correct_index}"]`).click();await expect(page.locator('#feedback')).toContainText(q.explanation);await page.locator('#pattern-next').click();}
 await page.locator('#spoken').check();await page.locator('#patterns-done').click();await expect(page.locator('#xp')).toHaveText('50');await stage(page,'quiz');
 for(const q of pack.quizzes){await page.locator(`[data-answer="${q.correct_index}"]`).click();await expect(page.locator('#feedback')).toContainText(q.explanation);await page.locator('#next-question').click();}
 await expect(page.locator('#activity')).toContainText('答对 5 / 5');await expect(page.locator('#xp')).toHaveText('70');await stage(page,'exit');
 await page.locator('#submit-exit').click();await expect(page.locator('#feedback')).toContainText('请回答知识检查');
 await page.locator('[data-answer="3"]').click();await page.locator('#exit-text').fill('我有四个好朋友。');await page.locator('#exit-spoken').check();await page.locator('#exit-written').check();await page.locator('#submit-exit').click();
 await expect(page.locator('#completion')).toHaveText('5 / 5');await expect(page.locator('#xp')).toHaveText('80');await expect(page.locator('#activity')).toContainText('待教师审核');await page.locator('#submit-exit').click();await expect(page.locator('#xp')).toHaveText('80');
 const download=page.waitForEvent('download');await page.locator('#export-result').click();expect((await download).suggestedFilename()).toBe('L01-demo-review.json');
 await page.reload();await page.locator('#preview').click();await expect(page.locator('#xp')).toHaveText('0');
});
test('undercover secrets hide between players; draw secret stays out of guesser view',async({page})=>{
 await enter(page);await stage(page,'spy');await expect(page.locator('a[href="/undercover.html"]')).toContainText('进入多人房间');await expect(page.locator('#spy-action')).toHaveCount(0);await stage(page,'draw');await page.locator('#draw-secret').click();const answer=await page.locator('.secret-word').textContent();await page.locator('#hide-secret').click();await expect(page.locator('.secret-word')).toHaveCount(0);await expect(page.locator('#activity')).not.toContainText('画出'+answer+'个');
 const c=page.locator('#draw-board'),r=await c.boundingBox();await page.mouse.move(r.x+40,r.y+40);await page.mouse.down();await page.mouse.move(r.x+90,r.y+90);await page.mouse.up();
 const ink=await c.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data).some((x,i)=>i%4===3&&x>0));expect(ink).toBe(true);
 await page.locator('#guess-ready').click();await expect(page.locator('[data-guess]')).toHaveCount(4);await page.locator('[data-guess]').filter({hasText:answer}).click();await expect(page.locator('#activity')).toContainText('猜对了');await expect(page.locator('#xp')).toHaveText('5');
 await page.locator('#new-draw').click();await page.locator('#draw-mode').selectOption('typing');await page.locator('#draw-secret').click();const typedAnswer=await page.locator('.secret-word').textContent();await page.locator('#hide-secret').click();await page.locator('#guess-ready').click();await page.locator('#guess-text').fill('不是数字');await page.locator('#guess-form button').click();await expect(page.locator('#feedback')).toContainText('再试一次');await page.locator('#guess-text').fill(typedAnswer);await page.locator('#guess-form button').click();await expect(page.locator('#activity')).toContainText('猜对了');await expect(page.locator('#xp')).toHaveText('5');
});
test('quiz timeout explains answer and failed data load offers recovery',async({page})=>{
 await page.clock.install();await enter(page);await stage(page,'quiz');await page.clock.fastForward(21000);await expect(page.locator('#feedback')).toContainText('时间到');await expect(page.locator('#next-question')).toBeVisible();
 await page.route('**/data/lessons/L01.json',route=>route.fulfill({status:503,body:'Unavailable'}));await page.goto('/numbers.html');await expect(page.locator('#load-error')).toContainText('503');await expect(page.locator('#preview')).toBeDisabled();
});
