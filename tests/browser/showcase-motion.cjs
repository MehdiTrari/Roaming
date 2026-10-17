const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.ROAMING_BROWSER_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},...(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{})});
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin!==base||url.pathname.startsWith('/api/')||url.pathname.startsWith('/reservation/')?route.abort():route.continue();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?_locale=fr');await page.waitForSelector('.property-showcase.is-ready');
  await page.locator('#featured').scrollIntoViewIfNeeded();
  const root=page.locator('.property-showcase'),slides=page.locator('.showcase-slide');
  const count=await slides.count();assert.ok(count>=3);
  const activeIndex=()=>root.evaluate(e=>[...e.querySelectorAll('.showcase-slide')].findIndex(s=>s.classList.contains('is-active')));
  const settled=()=>page.waitForFunction(()=>!document.querySelector('.property-showcase').classList.contains('is-moving'));
  const value=(index,key)=>slides.nth(index).evaluate((e,key)=>parseFloat(e.style.getPropertyValue(key)),key);
  const geometry=async()=>{
   const card=await page.locator('.showcase-slide.is-active').boundingBox();
   const media=await page.locator('.showcase-slide.is-active .showcase-card-media').boundingBox();
   const spacing=await root.evaluate(e=>e.querySelector('.showcase-slide').offsetWidth*parseFloat(getComputedStyle(e).getPropertyValue('--showcase-step'))/100);
   return {x:card.x+card.width*.8,y:media.y+Math.min(150,media.height*.5),spacing};
  };
  const first=await activeIndex(),next=(first+1)%count;
  let g=await geometry();
  await page.mouse.move(g.x,g.y);await page.mouse.down();
  await page.mouse.move(g.x-g.spacing*.45,g.y,{steps:6});
  assert.ok(Math.abs(await value(first,'--slide-offset')+.45)<.03);
  assert.ok(await value(next,'--slide-scale')>.89&&await value(next,'--slide-scale')<1);
  await page.mouse.move(g.x-g.spacing*.8,g.y,{steps:4});
  assert.ok(await value(next,'--slide-scale')>await value(first,'--slide-scale'),'incoming card grows before release');
  assert.ok(await value(next,'--slide-shade')<await value(first,'--slide-shade'));
  await page.screenshot({path:'var/showcase-mid-drag.png'});
  await page.mouse.move(g.x-g.spacing*.25,g.y,{steps:4});
  assert.ok(Math.abs(await value(first,'--slide-offset')+.25)<.03,'reverse gesture must reverse the interpolation');
  await page.waitForTimeout(150);await page.mouse.up();await settled();
  assert.equal(await activeIndex(),first,'a slow partial drag returns smoothly');
  assert.equal(await value(first,'--slide-scale'),1);
  // More than a full card spacing is possible; there is no 130px clamp.
  g=await geometry();await page.mouse.move(g.x,g.y);await page.mouse.down();
  await page.mouse.move(g.x-g.spacing*1.65,g.y,{steps:12});
  assert.ok(Math.abs(await value(first,'--slide-offset'))>1.5,'full drag must not be clamped');
  await page.waitForTimeout(150);await page.mouse.up();await settled();
  assert.equal(await activeIndex(),(first+2)%count,'long drag can cross more than one card');
  // Real clicks on the visible dimmed neighbor animate it into the middle.
  const beforeSide=await activeIndex(),sideIndex=(beforeSide+1)%count;
  const stage=await page.locator('.showcase-stage').boundingBox();
  const central=await page.locator('.showcase-slide.is-active .showcase-card-media').boundingBox();
  await page.mouse.click(stage.x+stage.width-65,central.y+central.height*.5);
  assert.equal(await activeIndex(),sideIndex);
  await page.waitForTimeout(100);
  const moving=await value(sideIndex,'--slide-offset');
  assert.ok(moving>0&&moving<.98,'clicked side card must travel through intermediate positions');
  assert.ok(await value(sideIndex,'--slide-scale')>.84&&await value(sideIndex,'--slide-scale')<1);
  await settled();assert.equal(await value(sideIndex,'--slide-offset'),0);
  // A new direction can interrupt a running animation without snapping to an endpoint.
  await page.locator('.showcase-arrow').last().click();await page.waitForTimeout(90);
  const interrupted=await value(sideIndex,'--slide-offset');
  await page.locator('.showcase-arrow').first().click();
  assert.ok(Math.abs(await value(sideIndex,'--slide-offset')-interrupted)<.15);
  await settled();assert.equal(await activeIndex(),sideIndex);
  // A short fast flick carries enough momentum to select the next card.
  g=await geometry();await page.mouse.move(g.x,g.y);await page.mouse.down();
  await page.mouse.move(g.x-g.spacing*.23,g.y,{steps:2});await page.mouse.up();await settled();
  assert.equal(await activeIndex(),(sideIndex+1)%count);
  assert.equal(new URL(page.url()).pathname,'/','drag must never trigger a property link');
  await page.locator('.showcase-picker button').last().click();await settled();
  await page.locator('.showcase-arrow').last().click();await page.waitForTimeout(100);
  assert.ok(await value(0,'--slide-offset')>0&&await value(0,'--slide-offset')<1,'wraparound also slides smoothly');
  await settled();assert.equal(await activeIndex(),0);
  // Just crossing the threshold must settle gradually in either direction.
  for (const direction of [-1,1]) {
   g=await geometry();const start=await activeIndex(),destination=(start-direction+count)%count;
   await page.mouse.move(g.x,g.y);await page.mouse.down();
   await page.mouse.move(g.x+direction*g.spacing*.52,g.y,{steps:8});
   await page.waitForTimeout(150);
   const releaseOffset=await value(destination,'--slide-offset');
   await page.mouse.up();await page.waitForTimeout(100);
   const approach=await value(destination,'--slide-offset');
   assert.ok(Math.abs(approach)<Math.abs(releaseOffset),'the approach must continue toward the center');
   assert.ok(Math.abs(approach)>.28,'the remaining distance must not disappear abruptly after a short drag');
   assert.ok(Math.abs(approach-releaseOffset)<.18,'settling must accelerate gently');
   await settled();assert.equal(await activeIndex(),destination);
   assert.equal(await value(destination,'--slide-offset'),0);
  }
  await page.locator('.showcase-picker button').first().click();await settled();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.showcase-arrow').last().click();
  assert.equal(await activeIndex(),1);
  assert.equal(await root.evaluate(e=>e.classList.contains('is-moving')),true);
  await page.waitForTimeout(100);
  assert.ok(await value(1,'--slide-offset')>.4,'Windows reduced motion must not bypass the explicitly requested slide');
  await settled();assert.equal(await value(1,'--slide-offset'),0);
  // Verify real pixel movement, not only CSS variables, with the Windows-like setting.
  for (const direction of [-1,1]) {
   const start=await activeIndex(),destination=(start+direction+count)%count;
   const stageBox=await page.locator('.showcase-stage').boundingBox();
   const centralMedia=await page.locator('.showcase-slide.is-active .showcase-card-media').boundingBox();
   const from=await slides.nth(destination).boundingBox();
   await page.mouse.click(direction<0?stageBox.x+65:stageBox.x+stageBox.width-65,centralMedia.y+centralMedia.height*.5);
   assert.equal(await activeIndex(),destination);
   await page.waitForTimeout(100);const early=await slides.nth(destination).boundingBox();
   await page.waitForTimeout(150);const middle=await slides.nth(destination).boundingBox();
   await settled();const end=await slides.nth(destination).boundingBox();
   const center=box=>box.x+box.width/2;
   assert.ok(Math.abs(center(early)-center(end))>140,'side click must visibly travel, even with reduced motion');
   assert.ok(Math.abs(center(middle)-center(end))<Math.abs(center(early)-center(end)));
   assert.ok(Math.abs(center(early)-center(from))<Math.abs(center(end)-center(from))*.5,'the first part of the slide must stay gradual');
   // Repeat a short threshold-crossing release under the same preference.
   g=await geometry();const releaseTarget=(destination-direction+count)%count;
   await page.mouse.move(g.x,g.y);await page.mouse.down();
   await page.mouse.move(g.x+direction*g.spacing*.52,g.y,{steps:8});await page.waitForTimeout(150);
   const released=await slides.nth(releaseTarget).boundingBox();
   await page.mouse.up();await page.waitForTimeout(100);
   const approach=await slides.nth(releaseTarget).boundingBox();
   await settled();const centered=await slides.nth(releaseTarget).boundingBox();
   assert.ok(Math.abs(center(approach)-center(centered))>80,'short release must keep a visible remaining travel');
   assert.ok(Math.abs(center(approach)-center(released))<80,'short release must not jump to the center');
  }
  // Native touch input, with vertical scrolling still allowed.
  const mobile=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,...(process.env.ROAMING_BROWSER_STORAGE?{storageState:process.env.ROAMING_BROWSER_STORAGE}:{})});
  await mobile.route('**/*',route=>{const url=new URL(route.request().url());return url.origin!==base||url.pathname.startsWith('/api/')?route.abort():route.continue();});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(base+'/?_locale=fr');await phone.waitForSelector('.property-showcase.is-ready');
  await phone.locator('#featured').scrollIntoViewIfNeeded();
  const oldSlug=await phone.locator('.property-showcase').getAttribute('data-active-slug');
  const touch=await mobile.newCDPSession(phone);
  const media=await phone.locator('.showcase-slide.is-active .showcase-card-media').boundingBox();
  const x=media.x+media.width*.8,y=media.y+100;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*30,y}]});
  assert.equal(await phone.locator('.property-showcase').evaluate(e=>e.classList.contains('is-dragging')),true);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>!document.querySelector('.property-showcase').classList.contains('is-moving'));
  assert.notEqual(await phone.locator('.property-showcase').getAttribute('data-active-slug'),oldSlug);
  const currentSlug=await phone.locator('.property-showcase').getAttribute('data-active-slug'),scrollBefore=await phone.evaluate(()=>scrollY);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:500}]});
  for(let i=1;i<=6;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:500-i*20}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await phone.locator('.property-showcase').getAttribute('data-active-slug'),currentSlug);
  assert.ok(await phone.evaluate(()=>scrollY)>scrollBefore,'vertical swiping must still scroll the page');
  assert.deepEqual(errors,[]);
  console.log('PASS: continuous position/scale/shading, reversible drag, long multi-card drag, animated real side click, interruption, momentum, wraparound, reduced motion, native touch and vertical scrolling. No provider calls or bookings.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
