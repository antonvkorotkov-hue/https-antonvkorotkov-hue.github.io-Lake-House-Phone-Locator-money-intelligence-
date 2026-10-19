const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const http=require('node:http');
(async()=>{
 const server=http.createServer((req,res)=>{const path=req.url.split('?')[0];const file=path==='/'?'index.html':path.slice(1);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}}).listen(0,'127.0.0.1');
 const browser=await (process.env.WEBKIT?webkit:chromium).launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const snapshot=JSON.parse(fs.readFileSync('scoreboards.json','utf8'));
 await page.route('https://**/*',async route=>{const url=route.request().url();const sport=url.includes('/college-football/')?'college':url.includes('/nba/')?'nba':url.includes('/mlb/')?'mlb':'nfl';if(url.includes('/scoreboard'))return route.fulfill({json:{events:snapshot.sports[sport].events}});if(url.includes('/summary?'))return route.fulfill({json:{boxscore:{teams:[]},leaders:[]}});return route.fulfill({json:{events:[],markets:[]}})});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#lh-v2-event option')?.value.startsWith('e:'));
 for(const width of [375,390,430]){
 await page.setViewportSize({width,height:844});
 for(const sport of ['nfl','college','nba','mlb']){
 await page.click('[data-lh-sport="'+sport+'"]');await page.waitForFunction(()=>!document.querySelector('#lh-v2-status').textContent.includes('Refreshing'));
 assert(await page.locator('#lh-v2-event option').count()>0,sport+' events');
 for(const tab of ['games','money','scores','more']){
 await page.click('.mobile-bottom [data-screen="'+tab+'"]');
 const id={money:'trades',games:'games',scores:'scores',more:'more'}[tab];assert(await page.locator('#lh-v2-'+id).isVisible(),sport+' '+tab+' visible');
 if(tab==='games'||tab==='money')for(const market of ['winner','spread','total','team','half','props']){if(await page.locator('#lh-v2-'+id+' [data-lh-market="'+market+'"]').count())await page.locator('#lh-v2-'+id+' [data-lh-market="'+market+'"]').click();}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width+' '+sport+' '+tab);
 }
 }
 }
 assert.deepEqual(errors,[],'No uncaught page errors');
 // A failed direct feed must display the dated scheduled fallback.
 await page.route('https://site.api.espn.com/**',r=>r.abort());
 await page.click('[data-lh-sport="nfl"]');await page.click('#lh-v2-refresh');
 await page.waitForFunction(()=>document.querySelector('#lh-v2-status').textContent.includes('scheduled snapshot'));
 assert(await page.locator('#lh-v2-event option').count()>0,'Fallback preserves games');
 console.log('PASS: 3 iPhone widths × 4 sports × 4 screens; 6 markets; no overflow/page errors; failed-feed fallback.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
