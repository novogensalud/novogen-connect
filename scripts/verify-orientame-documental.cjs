// Isolated browser test of authored code; never uses the user's Chrome profile or cookies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const runtime=fs.readFileSync(path.join(__dirname,'../lib/experience-runtime.js'),'utf8').replace('export function initializeExperience','function initializeExperience');
const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CONNECT · prueba documental</title><body><div id="root"><a href="#/orientame">Abrir ORIÉNTAME</a></div><script>${runtime}\ninitializeExperience({slug:'novogen',channels:{website_url:'https://www.novogensalud.cl/'},terms:null,assistantAvailable:true});</script></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for(const width of [320,390]) {
   const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();const errors=[];const forbidden=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.openai\.com|\/api\/contact|\/api\/orientame\b/.test(r.url()))forbidden.push(r.url());});
   await page.route('https://novogen-connect.vercel.app/__ori_test',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
   await page.goto('https://novogen-connect.vercel.app/__ori_test');
   if(await page.getByRole('link',{name:'Abrir ORIÉNTAME',exact:true}).count()!==1)throw Error(JSON.stringify({url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1500),errors}));
   await page.getByRole('link',{name:'Abrir ORIÉNTAME',exact:true}).click();
   const modal=page.getByRole('dialog',{name:'ORIÉNTAME',exact:true});await modal.waitFor();
   assert.equal(await modal.locator('input[type="email"]').count(),0);
   const frame=page.frameLocator('iframe[title="ORIÉNTAME · orientación documental de NOVOGEN"]');
   await frame.getByRole('textbox',{name:'Tu pregunta',exact:true}).fill('¿Dónde se encuentra NOVOGEN?');
   await frame.getByRole('button',{name:'Consultar',exact:true}).click();
   try{await frame.getByText('NOVOGEN se encuentra en Trizano 443, Box 6, Temuco, Chile.',{exact:true}).waitFor({timeout:20000});}
   catch(error){throw Error(JSON.stringify({frameText:await frame.locator('body').innerText(),errors,cause:error.message}));}
   await frame.getByRole('link',{name:'Fuente: Contacto institucional NOVOGEN — copia para revisión',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(__dirname,`../../../outputs/connect-orientame-${width}.png`)});
   await page.getByRole('button',{name:'Cerrar ORIÉNTAME',exact:true}).click();assert.equal(await modal.isVisible(),false);
   console.log(`PASS CONNECT ${width}px: iframe real, respuesta, fuente, sin datos de contacto, sin IA, cierre y sin desbordamiento`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
