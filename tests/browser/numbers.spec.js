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
test('lesson classroom games link to individual-device multiplayer rooms',async({page})=>{
 await enter(page);await stage(page,'spy');await expect(page.locator('a[href="/undercover.html"]')).toContainText('进入多人房间');await expect(page.locator('#spy-action')).toHaveCount(0);
 await stage(page,'draw');await expect(page.locator('a[href="/multiplayer.html?lesson=l01draft"]')).toContainText('进入多人');await expect(page.locator('#activity')).toContainText('两名学生');
});
test('quiz timeout explains answer and failed data load offers recovery',async({page})=>{
 await page.clock.install();await enter(page);await stage(page,'quiz');await page.clock.fastForward(21000);await expect(page.locator('#feedback')).toContainText('时间到');await expect(page.locator('#next-question')).toBeVisible();
 await page.route('**/data/lessons/L01.json',route=>route.fulfill({status:503,body:'Unavailable'}));await page.goto('/numbers.html');await expect(page.locator('#load-error')).toContainText('503');await expect(page.locator('#preview')).toBeDisabled();
});
