import {test,expect} from '@playwright/test';
for(const width of [320,390])test('mobile games start, pause, rotate and persist recreational badges '+width,async({page})=>{
 await page.setViewportSize({width,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/connect/novogen/juegos');await expect(page.getByRole('heading',{name:'Tu pausa para jugar',exact:true})).toBeVisible();
 const start=page.getByRole('button',{name:'Nueva partida',exact:true});await expect(start).toBeEnabled();
 const position=()=>page.locator('.snake .color-2').evaluateAll(cells=>cells.map(c=>Array.from(c.parentElement!.children).indexOf(c)).join(','));
 const initial=await position();await start.click();await expect.poll(position).not.toBe(initial);
 await page.getByRole('button',{name:'Pausar',exact:true}).click();const paused=await position();await page.waitForTimeout(300);expect(await position()).toBe(paused);
 await page.getByRole('button',{name:'Bloques',exact:true}).click();await start.click();await page.getByRole('button',{name:'Girar pieza',exact:true}).click();await page.getByRole('button',{name:'Dejar caer',exact:true}).click();await expect.poll(()=>page.locator('.blocks .game-cell:not(.color-0)').count()).toBeGreaterThan(4);
 await page.getByRole('button',{name:'Pausar',exact:true}).click();await expect(page.getByText('Explorador de clásicos',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Explorador de clásicos',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
