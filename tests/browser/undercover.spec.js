const {test,expect}=require('@playwright/test');
test('each device receives its own secret word, restores it on reload and votes independently',async({browser})=>{
 test.setTimeout(60000);const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [host,...players]=await Promise.all(contexts.map(c=>c.newPage()));await host.goto('/undercover.html');await host.locator('#draft-confirm').check();await host.locator('#create').click();await expect(host.locator('#code')).toHaveText(/^[A-F0-9]{6}$/);const code=await host.locator('#code').textContent();
  for(const [i,p]of players.entries()){await p.goto('/undercover.html');await p.locator('#room-code').fill(code);await p.locator('#nickname').fill('Panda '+i);await p.locator('#join').click();await expect(p.locator('#session')).toBeVisible();}
  await host.locator('#start').click();await expect(host.locator('#stage')).toContainText('教师端不接收');await expect(host.locator('.secret-word')).toHaveCount(0);
  const words=[];for(const p of players){await p.locator('#toggle-word').click();await expect(p.locator('.secret-word')).not.toHaveText('🔒');words.push(await p.locator('.secret-word').textContent());}
  expect(new Set(words).size).toBe(2);await players[0].reload();await expect(players[0].locator('#session')).toBeVisible();await expect(players[0].locator('.secret-word')).toHaveText('🔒');await players[0].locator('#toggle-word').click();await expect(players[0].locator('.secret-word')).toHaveText(words[0]);
  await host.locator('#open-vote').click();for(const p of players){await expect(p.locator('#vote')).toBeVisible();await p.locator('#submit-vote').click();}
  for(const p of [host,...players])await expect(p.locator('#stage')).toContainText('本轮揭晓');await expect(host.locator('#stage')).toContainText('Undercover word');await host.locator('#start').click();await expect(players[0].locator('.secret-word')).toHaveText('🔒');
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
