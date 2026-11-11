const {test,expect}=require('@playwright/test');
test('homepage renders cards without horizontal overflow and dialog supports keyboard',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('#lesson-cards .lesson-card')).toHaveCount(4);
 await expect(page.locator('#game-cards a')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'登录 / 注册'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('#dialog-title')).toHaveText('账号系统 · 建设中');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.locator('[data-feature="北京文化冒险"]').click();
 await expect(page.locator('#dialog-description')).toContainText('概念预览');
 await page.getByRole('button',{name:'继续浏览'}).click();
 expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('homepage.png'),fullPage:true});
});
test('lesson deep links, matching feedback, pinyin and quiz work',async({page})=>{
 await page.goto('/learn.html?lesson=l2&step=read');
 await expect(page.locator('#lessonPicker')).toHaveValue('l2');
 await expect(page.locator('.pinyin').first()).toBeVisible();
 await page.locator('#pinyinToggle').uncheck();await expect(page.locator('.pinyin')).toHaveCount(0);
 await page.goto('/learn.html?lesson=l1&step=match');
 await page.locator('[data-left="0"]').click();await page.locator('[data-right="0"]').click();
 await expect(page.locator('#matchFeedback')).toContainText('配对正确');
 await expect(page.locator('#points')).toHaveText('10');
 await page.goto('/learn.html?lesson=l1&step=quiz');await page.locator('[data-answer="1"]').click();
 await expect(page.locator('#quizFeedback')).toContainText('正确');
 await page.locator('#nextQ').click();await expect(page.locator('.sub')).toContainText('第 2 / 5 题');
 await page.goto('/learn.html?lesson=invalid&step=invalid');await expect(page.locator('#lessonPicker')).toHaveValue('l1');
});
test('all game cards open their corresponding functional page',async({page})=>{
 for(const [index,step] of [[0,'match'],[1,'quiz']]){
  await page.goto('/');await page.locator('#game-cards a').nth(index).click();
  await expect(page).toHaveURL(new RegExp('step='+step));await expect(page.locator('#content')).not.toBeEmpty();
 }
 await page.goto('/');await page.locator('#game-cards a').nth(2).click();await expect(page).toHaveURL(/undercover.html/);await expect(page.locator('#join')).toBeVisible();
 await page.goto('/');await page.locator('#game-cards a').nth(3).click();
 await expect(page.locator('#create')).toBeVisible();await expect(page.locator('#join')).toBeVisible();
});
test('two student browsers can join teacher room and receive isolated roles',async({browser})=>{
 const host=await browser.newContext(),studentA=await browser.newContext(),studentB=await browser.newContext();
 try{
  const h=await host.newPage(),a=await studentA.newPage(),b=await studentB.newPage();
  await h.goto('/multiplayer.html');await h.locator('#create').click();
  await expect(h.locator('#code')).toHaveText(/^[A-F0-9]{6}$/);const code=await h.locator('#code').textContent();
  for(const [page,name] of [[a,'Panda A'],[b,'Panda B']]){await page.goto('/multiplayer.html');await page.locator('#joinCode').fill(code);await page.locator('#joinName').fill(name);await page.locator('#join').click();await expect(page.locator('#session')).toBeVisible();}
  await h.locator('#start').click();await expect(a.locator('.secret')).toBeVisible();await expect(b.locator('.secret')).toHaveCount(0);await expect(b.locator('[data-answer]')).toHaveCount(4);
  const word=await a.locator('.secret').textContent();await b.locator('[data-answer]').filter({hasText:word}).click();
  await expect(b.locator('#stage')).toContainText('本轮结束');await expect(b.locator('#people')).toContainText('⭐10');
 }finally{await Promise.all([host.close(),studentA.close(),studentB.close()]);}
});
test('legacy lesson concept options are readable without unlearned Chinese labels',async({page})=>{
 await page.goto('/learn.html?lesson=l1&step=quiz');
 for(const answer of [1,0,1,2]){await page.locator(`[data-answer="${answer}"]`).click();await page.locator('#nextQ').click();}
 await expect(page.locator('.question')).toContainText('what does “几个” ask about');
 for(const [index,text]of ['Name','Place','Quantity (how many)','Time'].entries())await expect(page.locator(`[data-answer="${index}"]`)).toContainText(text);
 await page.locator('[data-answer="2"]').click();await expect(page.locator('#quizFeedback')).toContainText('how many');
});
test('teacher and one guest can share a link, draw and swap roles with only two devices',async({browser})=>{
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);try{
  const h=await contexts[0].newPage(),g=await contexts[1].newPage();await h.goto('/multiplayer.html?lesson=l01draft');await h.locator('#draftWords').check();await h.locator('#hostPlays').check();await h.locator('#create').click();await expect(h.locator('#code')).toHaveText(/^[A-F0-9]{6}$/);const code=await h.locator('#code').textContent();const link=await h.locator('#inviteLink').inputValue();expect(link).not.toContain('token');
  await g.goto(link);await expect(g.locator('#joinCode')).toHaveValue(code);await g.locator('#joinName').fill('Panda 2');await g.locator('#join').click();await expect(g.locator('#people')).toContainText('Panda 2');await h.locator('#start').click();await expect(h.locator('#clear')).toBeVisible();await expect(g.locator('.secret')).toHaveCount(0);const answer=await h.locator('.secret').textContent();await g.locator('[data-answer]').filter({hasText:answer}).click();await expect(h.locator('#stage')).toContainText('本轮结束');await h.locator('#start').click();await expect(g.locator('#clear')).toBeVisible();await expect(h.locator('.secret')).toHaveCount(0);const second=await g.locator('.secret').textContent();await h.locator('[data-answer]').filter({hasText:second}).click();await expect(g.locator('#stage')).toContainText('本轮结束');
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
