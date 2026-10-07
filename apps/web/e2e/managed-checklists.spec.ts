import {expect,test} from '@playwright/test';
import fs from 'node:fs';
const entries:any[]=process.env.MANAGED_CHECKLIST_STATE && fs.existsSync(process.env.MANAGED_CHECKLIST_STATE)?JSON.parse(fs.readFileSync(process.env.MANAGED_CHECKLIST_STATE,'utf8')):[];
for(const entry of entries) {
  test(`${entry.path} preserves the reviewed board and checked tasks`,async({page},info)=>{
    await page.goto(entry.path);
    await expect(page.locator('h1')).toContainText(entry.title);
    const leaves=entry.items.filter((item:any)=>item.section_code.trim().split('.').length===3);
    expect(leaves.length).toBeGreaterThan(0);
    const boxes=page.locator('main input[type=checkbox]');
    await expect(boxes).toHaveCount(leaves.length);
    for(const item of leaves) await expect(page.locator('main')).toContainText(item.title.trim());
    const first=boxes.first();
    await first.locator('..').click();await expect(first).toBeChecked();
    await page.reload();await expect(boxes.first()).toBeChecked();
    await boxes.first().locator('..').click();await expect(boxes.first()).not.toBeChecked();
    await page.reload();await expect(boxes.first()).not.toBeChecked();
    await page.screenshot({path:info.outputPath('checklist.png'),fullPage:true});
  });
  test(`${entry.path} saves account progress`,async({page,context},info)=>{
    const auth=JSON.parse(fs.readFileSync(process.env.MANAGED_CHECKLIST_AUTH!,'utf8')).find((account:any)=>account.project===info.project.name);
    await context.addCookies([{name:'app_session',value:auth.token,url:'http://127.0.0.1:3000',httpOnly:true,sameSite:'Lax'}]);
    const loaded=page.waitForResponse(response=>response.url().includes('/api/checklists/progress?slug=')&&response.status()===200);
    await page.goto(entry.path);
    await loaded;
    const box=page.locator('main input[type=checkbox]').first();
    if(await box.isChecked()) {
      const cleared=page.waitForResponse(response=>response.url().includes('/api/checklists/progress')&&response.request().method()==='PUT'&&response.status()===200);
      await box.locator('..').click();await cleared;await expect(box).not.toBeChecked();
    }
    const saved=page.waitForResponse(response=>response.url().includes('/api/checklists/progress')&&response.request().method()==='PUT'&&response.status()===200);
    await box.locator('..').click();await saved;await expect(box).toBeChecked();
    await page.evaluate(()=>localStorage.clear());
    await page.reload();await expect(page.locator('main input[type=checkbox]').first()).toBeChecked();
    const reset=page.waitForResponse(response=>response.url().includes('/api/checklists/progress')&&response.request().method()==='PUT'&&response.status()===200);
    await page.locator('main input[type=checkbox]').first().locator('..').click();await reset;
    await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('main input[type=checkbox]').first()).not.toBeChecked();
    await page.screenshot({path:info.outputPath('account-checklist.png'),fullPage:true});
  });
}
