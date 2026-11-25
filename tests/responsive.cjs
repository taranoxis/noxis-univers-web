const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 fs.mkdirSync('qa-screenshots',{recursive:true});
 const sizes=[[360,640],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080]];
 const routes=['','ai-friends/','noxis-tv/','books/','create/','ai-tools/',"projects/questions-to-the-universe/noxis-constellation-web.html","archives/","archives/nyxin/","archives/nyxer/","archives/ar-in/","archives/aren/","archives/ar-on/","projects/nyxer-trader/","projects/music-to-video/","projects/creative-prototypes/","projects/sound-lab/","projects/noxis-bbq/"];
 const failures=[];
 try {
 for(const [width,height] of sizes){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<=1024,isMobile:width<=1024});
 for(const route of routes){
 const name=(route.replace(/[^a-zA-Z0-9-]+/g,'-')||'home')+'-'+width+'x'+height;
 try{
 const response=await page.goto('http://127.0.0.1:8765/'+route,{waitUntil:'domcontentloaded'});
 assert(response.ok(),'HTTP '+response.status());
 await page.screenshot({path:'qa-screenshots/'+name+'.png',timeout:15000});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 assert(!overflow,'Horizontal overflow');
 if(width<=1024 && !route){
 const nav=page.locator('.world .noxis-mobile-nav');
 assert(await nav.isVisible(),'Mobile navigation hidden');
 for(const [label,selector] of [['Choose your path','#universe'],['GENESIS','#genesisScreen'],['NOXIS Entities','#gallery']]){
 await nav.getByRole('button',{name:label,exact:true}).click();
 assert(await page.locator(selector).evaluate(el=>el.classList.contains('open')),'Portal did not open: '+label);
 await page.reload({waitUntil:'domcontentloaded'});
 }
 }
 if(width<=1024 && route==='create/'){
 await page.locator('.create-mobile-grid button').first().click();
 assert(await page.locator('#panel').evaluate(el=>el.classList.contains('open')),'Create panel did not open');
 }
 if(route.includes('questions-to-the-universe')){
 assert(await page.locator('#homeBack').isVisible(),'Back link hidden');
 assert(await page.locator('#playBtn').count() || await page.locator('audio').count(),'Audio player missing');
 }
 console.log('PASS',name);
 }catch(e){failures.push(name+': '+e.message);console.error('FAIL',name,e.message);}
 }
 await page.close();
 }
 }finally{await browser.close();}
 if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
