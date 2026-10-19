/* Read-only production WebKit check: no mocked upstream or application responses. */
const {webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const base=process.env.LHP_LIVE_URL||'https://antonvkorotkov-hue.github.io/https-antonvkorotkov-hue.github.io-Lake-House-Phone-Locator-money-intelligence-/';
 const browser=await webkit.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'America/New_York'});const page=await context.newPage(),errors=[],failures=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push({url:r.url(),reason:r.failure()?.errorText}));
 try{
 await page.goto(base+'?release=20261019-phase2.1',{waitUntil:'domcontentloaded',timeout:60000});
 assert.equal(await page.locator('meta[name="lake-house-release"]').getAttribute('content'),'2026-10-19-phase2.1');
 for(const sport of ['nfl','college','nba','mlb']){
 await page.locator('[data-lh-sport="'+sport+'"]').click();
 await page.waitForFunction(()=>document.querySelector('#lh-v2-event option')?.value.startsWith('e:')&&!document.querySelector('#lh-v2-status')?.textContent.includes('Refreshing'),{},{timeout:60000});
 await page.waitForFunction(()=>{const p=document.querySelector('#lh-v2-games .lh-i-panel');return p&&!p.textContent.includes('or loading')},{},{timeout:30000});
 for(const tab of ['games','money','scores','more']){
 await page.locator('.mobile-bottom [data-screen="'+tab+'"]').click();const panel=page.locator('#lh-v2-'+(tab==='money'?'trades':tab));assert(await panel.isVisible());
 if(tab==='games'||tab==='money')for(const market of ['winner','spread','total','team','half','props']){const b=panel.locator('[data-lh-market="'+market+'"]');await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');}
 if(tab==='games'||tab==='scores'){assert(await panel.locator('.lh-i-panel').isVisible());const paragraphs=panel.locator('.lh-i-panel > p');if(await paragraphs.count()>=2){const line=await paragraphs.nth(1).innerText();if(line.includes('—'))assert(!/ · (?:0:00|0\.0)$/.test(line),'Pregame clock placeholder hidden');}}
 assert(!/NaN|undefined|Invalid Date/.test(await panel.innerText()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 checks.push({sport,eventOptions:await page.locator('#lh-v2-event option').count(),status:await page.locator('#lh-v2-status').innerText(),intelligence:(await page.locator('#lh-v2-games .lh-i-panel').innerText()).slice(0,300)});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({base,realNetwork:true,checks,requestFailures:failures,uncaughtErrors:errors},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
