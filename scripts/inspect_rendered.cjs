/* Render committed real source snapshots in WebKit; not a live-feed or physical-device certification. */
const {webkit}=require('playwright'),fs=require('node:fs'),http=require('node:http');
(async()=>{
 const snapshots=JSON.parse(fs.readFileSync('scoreboards.json','utf8')),out=process.env.QA_REAL_DIR||'/tmp/lakehouse-real-render';fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const file=req.url.split('?')[0].slice(1)||'index.html';try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}}).listen(0,'127.0.0.1');
 const browser=await webkit.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'America/New_York'}),errors=[],images=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{const url=route.request().url();const sport=url.includes('/college-football/')?'college':url.includes('/nba/')?'nba':url.includes('/mlb/')?'mlb':'nfl';
 if(new URL(url).hostname==='site.api.espn.com'&&url.includes('/scoreboard'))return route.fulfill({json:{events:snapshots.sports[sport].events}});
 if(new URL(url).hostname==='site.api.espn.com'&&url.includes('/summary?')){const id=new URL(url).searchParams.get('event');const report=snapshots.reports?.[sport+':'+id]?.report;return report?route.fulfill({json:report}):route.fulfill({status:503,json:{error:'No saved report for render inspection'}})}
 try{const r=await fetch(url,{signal:AbortSignal.timeout(6000)});images.push({url,status:r.status});return route.fulfill({status:r.status,body:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')||'image/png'})}catch(e){images.push({url,error:e.message});return route.abort()}
 });
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#lh-v2-event option')?.value.startsWith('e:'));
 for(const sport of ['nfl','college','nba','mlb']){
 await page.click('[data-lh-sport="'+sport+'"]');await page.waitForFunction(()=>!document.querySelector('#lh-v2-status').textContent.includes('Refreshing'));
 const event=snapshots.sports[sport].events.find(e=>snapshots.reports?.[sport+':'+e.id]);if(event)await page.selectOption('#lh-v2-event','e:'+event.id);await page.waitForTimeout(300);
 for(const tab of ['games','money','scores','more']){await page.click('[data-screen="'+tab+'"]');await page.waitForTimeout(200);await page.screenshot({path:out+'/'+sport+'-'+tab+'.png',fullPage:true});}
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log(JSON.stringify({screenshots:16,directory:out,uncaughtErrors:errors,realSourceReportCount:Object.keys(snapshots.reports||{}).length,logoResponses:images},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
