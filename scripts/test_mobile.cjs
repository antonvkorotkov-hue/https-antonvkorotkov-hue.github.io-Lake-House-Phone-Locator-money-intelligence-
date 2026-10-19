const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const path=req.url.split('?')[0];const file=path==='/'?'index.html':path.slice(1);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}}).listen(0,'127.0.0.1');
 const browser=await (process.env.WEBKIT?webkit:chromium).launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'America/New_York'});
 await context.addInitScript(()=>{
  window.__qaLegacyExecuted=false;
  const attack='<img src="data:image/png,invalid" onerror="window.__qaLegacyExecuted=true">';
  localStorage.setItem('lh-money-snap-v1',JSON.stringify([{id:'legacy-qa',sport:'nfl',game:attack,event:attack,eventName:attack,team:attack,market:attack,side:attack,provider:attack,note:attack,rows:[{team:attack,market:attack,note:attack}]}]));
  localStorage.setItem('lh-money-context-v1',JSON.stringify({sport:'nfl',eventName:attack,note:attack}));
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const evidenceDir=process.env.QA_SCREENSHOT_DIR||'/tmp/lake-house-qa';fs.mkdirSync(evidenceDir,{recursive:true});
 const snapshot=JSON.parse(fs.readFileSync('scoreboards.json','utf8'));
 await page.route('https://**/*',async route=>{const url=route.request().url();const sport=url.includes('/college-football/')?'college':url.includes('/nba/')?'nba':url.includes('/mlb/')?'mlb':'nfl';if(url.includes('/scoreboard'))return route.fulfill({json:{events:snapshot.sports[sport].events}});if(url.includes('/summary?')){
 const eventId=new URL(url).searchParams.get('event'),event=snapshot.sports[sport].events.find(e=>String(e.id)===eventId);
 const teams=event?.competitions?.[0]?.competitors||[];
 return route.fulfill({json:{header:{id:eventId},gameInfo:{venue:{fullName:'QA Fixture Stadium'},weather:{displayValue:'Clear',temperature:60,temperatureUnit:'F'}},boxscore:{teams:teams.map((c,i)=>({team:c.team,statistics:[{name:'totalYards',label:'Total yards',displayValue:String(122+122*i)},{name:'points',label:'Points',displayValue:String(10+10*i)}]})),players:teams.map(c=>({team:c.team,statistics:[{name:'passing',text:'Passing',labels:['C/ATT','YDS'],athletes:[{athlete:{displayName:'QA Fixture Player'},stats:['11/22','122']}]}]}))},injuries:teams.slice(0,1).map(c=>({team:c.team,injuries:[{athlete:{displayName:'QA Fixture Availability'},status:'Questionable',details:{type:'Knee'}}]})),leaders:[]}});
 }return route.fulfill({json:{events:[],markets:[]}})});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#lh-v2-event option')?.value.startsWith('e:'));
 for(const width of [375,390,430]){
 await page.setViewportSize({width,height:844});
 for(const sport of ['nfl','college','nba','mlb']){
 await page.click('[data-lh-sport="'+sport+'"]');await page.waitForFunction(()=>!document.querySelector('#lh-v2-status').textContent.includes('Refreshing'));
 assert(await page.locator('#lh-v2-event option').count()>0,sport+' events');
 for(const tab of ['games','money','scores','more']){
 await page.click('.mobile-bottom [data-screen="'+tab+'"]');
 const id={money:'trades',games:'games',scores:'scores',more:'more'}[tab];assert(await page.locator('#lh-v2-'+id).isVisible(),sport+' '+tab+' visible');
 if(tab==='games'||tab==='money')for(const market of ['winner','spread','total','team','half','props']){
 const button=page.locator('#lh-v2-'+id+' [data-lh-market="'+market+'"]');
 assert.equal(await button.count(),1,'Each supported market has a selector');await button.click();
 assert.equal(await button.getAttribute('aria-pressed'),'true',sport+' '+market+' selected');
 if(['team','half','props'].includes(market))assert.match(await page.locator('#lh-v2-'+id).innerText(),/No verified feed|unavailable|No matching/i,'Unconfigured feed is explicitly unavailable');
 }
 assert(!/NaN|undefined|Invalid Date/.test(await page.locator('#lh-v2-'+id).innerText()),'No invalid generated values');
 assert(await page.evaluate(()=>{const ids=[...document.querySelectorAll('#lh-v2 [id]')].map(x=>x.id);return ids.length===new Set(ids).size}),'Unique application control IDs');
 if(tab==='games'||tab==='money')await page.locator('#lh-v2-'+id+' [data-lh-market="winner"]').click();
 const contracts=page.locator('#lh-v2-'+id+' [data-lh-contract]');
 if(await contracts.count()){
 const values=await contracts.locator('option').evaluateAll(opts=>opts.map(o=>o.value));
 for(const value of values.slice(0,4)){await contracts.selectOption(value);assert.equal(await page.locator('#lh-v2-'+id+' [data-lh-contract]').inputValue(),value,'Exact exchange contract selection persists');}
 }
 const observations=page.locator('#lh-v2-'+id+' .lh-c-detail').first();
 if(await observations.count()){await observations.locator('summary').click();assert(await observations.locator('table').isVisible(),'Exact chart observations expand');await observations.locator('summary').click();}
 const splitTable=page.locator('#lh-v2-'+id+' .lh-split-table');
 if(await splitTable.count())assert(await splitTable.evaluate(table=>getComputedStyle(table.querySelector('thead th')).whiteSpace==='nowrap'&&getComputedStyle(table.parentElement).overflowX==='auto'),'Split headers remain legible in a locally scrollable table');
 if(width===390){if(tab==='games'||tab==='money')await page.locator('#lh-v2-'+id+' [data-lh-market="winner"]').click();await page.screenshot({path:path.join(evidenceDir,sport+'-'+tab+'-390.png'),fullPage:true});}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width+' '+sport+' '+tab);
 }
 // Exercise every scoreboard selection and assert it controls the rendered game.
 await page.setViewportSize({width:390,height:844});await page.click('.mobile-bottom [data-screen="games"]');
 for(const sport of ['nfl','college','nba','mlb']){
 await page.click('[data-lh-sport="'+sport+'"]');await page.waitForFunction(()=>!document.querySelector('#lh-v2-status').textContent.includes('Refreshing'));
 for(const event of snapshot.sports[sport].events){
 await page.selectOption('#lh-v2-event','e:'+event.id);
 const competitors=event.competitions?.[0]?.competitors||[];
 for(const team of competitors)assert((await page.locator('#lh-v2-games .lh-v2-hero').innerText()).includes(team.team.abbreviation),sport+' selected '+event.id+' correct team '+team.team.abbreviation);
 }
 }
 }
 }
 assert.deepEqual(errors,[],'No uncaught page errors');
 assert.equal(await page.evaluate(()=>window.__qaLegacyExecuted),false,'Legacy saved research never executes as HTML');
 assert.equal(await page.locator('#manualMarketBoard, #researchTools').count(),0,'Legacy controls are removed');
 // A failed direct feed must display the dated scheduled fallback.
 await page.route('https://site.api.espn.com/**',r=>r.abort());
 await page.click('[data-lh-sport="nfl"]');await page.click('#lh-v2-refresh');
 await page.waitForFunction(()=>document.querySelector('#lh-v2-status').textContent.includes('scheduled snapshot'));
 assert(await page.locator('#lh-v2-event option').count()>0,'Fallback preserves games');
 console.log('PASS: 3 iPhone widths × 4 sports × 4 screens; all 6 market selections asserted; all scoreboard matchups; no overflow/page errors; failed-feed fallback; 16 rendered screenshots in '+evidenceDir+'.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
