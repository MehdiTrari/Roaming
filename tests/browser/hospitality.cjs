// Local visual/interaction regression. Every provider read is mocked; no writes.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const screenshots = process.env.ROAMING_BROWSER_SCREENSHOTS;
const origin = new URL(base).origin;

(async () => {
    const browser = await chromium.launch({headless:true, channel:'chrome'});
    const context = await browser.newContext({reducedMotion:'reduce', ...(process.env.ROAMING_BROWSER_STORAGE ? {storageState:process.env.ROAMING_BROWSER_STORAGE} : {})});
    const page = await context.newPage();
    const errors = [], writes = [], contrast = [];
    let catalogue = [], layouts = 0, mockedReads = 0;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (route.request().method() !== 'GET') { writes.push(url.pathname); return route.abort(); }
        if (url.pathname === '/api/calendar' || /^\/api\/properties\/[^/]+\/availability$/.test(url.pathname)) {
            mockedReads++;
            const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
            return route.fulfill({contentType:'application/json', body:JSON.stringify({enabled:true, properties:catalogue.map(property => ({...property, status:'fresh', fetchedAt:new Date().toISOString(), days:Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()}, (_,i) => ({date:`${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`, available:true, minStay:2, price:100}))}))})});
        }
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/reservation/')) return route.abort();
        return route.continue();
    });
    const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label);
    const scrollSettled = () => page.evaluate(() => new Promise(resolve => {
        let previous=scrollY,stable=0;const started=performance.now();
        const frame=()=>{stable=Math.abs(scrollY-previous)<.5?stable+1:0;previous=scrollY;if(performance.now()-started>1600||stable>5&&performance.now()-started>180)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);
    }));
    const traceScroll = action => page.evaluate(async ({link,slug}) => {
        const positions=[scrollY],started=performance.now();let previous=scrollY,stable=0;
        if(link)document.querySelector(link).click();else document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true}));
        await new Promise(resolve=>{const frame=()=>{positions.push(scrollY);stable=Math.abs(scrollY-previous)<.5?stable+1:0;previous=scrollY;if(performance.now()-started>2000||stable>6&&performance.now()-started>220)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
        return positions;
    },action);
    const intermediateScroll = positions => {
        const first=positions[0],last=positions[positions.length-1];
        return positions.some(value=>Math.abs(value-first)>1&&Math.abs(value-last)>1);
    };
    const smoothAnchor = async (link,target) => {
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        const positions=await traceScroll({link});
        assert.ok(intermediateScroll(positions),`anchor travels through intermediate scroll positions: ${JSON.stringify(positions)}`);
        const geometry=await page.locator(target).evaluate(element=>({top:element.getBoundingClientRect().top,header:document.querySelector('header.sticky-top').getBoundingClientRect().bottom}));
        assert.ok(geometry.top>=geometry.header-1&&geometry.top<=geometry.header+130,`anchor clears sticky header: ${JSON.stringify(geometry)}`);
    };
    const capture = async name => {
        if (!screenshots) return;
        fs.mkdirSync(screenshots, {recursive:true});
        await page.addStyleTag({content:'.sf-toolbar,.sf-minitoolbar{display:none!important}'});
        await page.screenshot({path:path.join(screenshots,name+'.png')});
    };
    const contrastSamples = () => page.evaluate(() => {
        const rgb = value => (value.match(/[\d.]+/g) || []).slice(0,3).map(Number);
        const luminance = color => rgb(color).map(v => v/255).map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((total,v,i) => total+v*[.2126,.7152,.0722][i],0);
        const ratio = (a,b) => {const [light,dark]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (light+.05)/(dark+.05);};
        const background = element => {for(let e=element;e;e=e.parentElement){const color=getComputedStyle(e).backgroundColor;if(color!=='rgba(0, 0, 0, 0)' && color!=='transparent')return color;}return 'rgb(255,255,255)';};
        const primary = document.querySelector('.header-booking-cta'), body = document.querySelector('.home-hero .lead');
        const probe = document.createElement('span');probe.style.backgroundColor='var(--roaming-accent)';document.body.append(probe);
        const result = {theme:document.documentElement.dataset.bsTheme, primaryText:ratio(getComputedStyle(primary).color,background(primary)), mutedText:ratio(getComputedStyle(body).color,background(body)), focusAccent:ratio(getComputedStyle(probe).backgroundColor,background(document.body))};
        probe.remove();return result;
    });
    try {
        for (const locale of ['fr','en']) for (const theme of ['light','dark']) for (const width of [1440,768,390,320]) {
            await page.setViewportSize({width,height:900});
            await page.goto(base+'/?_locale='+locale);
            await page.evaluate(value => localStorage.setItem('theme',value),theme);await page.reload();
            await page.waitForFunction(() => !!document.querySelector('#date-range')?._flatpickr);
            assert.equal(await page.locator('html').getAttribute('lang'),locale);
            assert.equal(await page.locator('html').getAttribute('data-bs-theme'),theme);
            assert.equal(await page.locator('h1').count(),1);
            catalogue = await page.locator('#booking-property option:not([value=""])').evaluateAll(options => options.map(option => ({slug:option.value,capacity:Number(option.dataset.capacity)})));
            await page.waitForSelector('.property-showcase.is-ready');
            const cards = page.locator('.property-showcase [data-showcase-card]');
            assert.ok(catalogue.length>0);assert.equal(await cards.count(),catalogue.length,'every active stay belongs to the carousel');
            assert.equal(await cards.evaluateAll(items=>items.filter(item=>!item.inert).length),1,'only the central stay exposes its links');
            await noOverflow(`${locale}/${theme}/${width}: home`);
            if (width===1440) {
                const sample = await contrastSamples();contrast.push(sample);
                assert.ok(sample.primaryText>=4.5,`${theme}: primary button text contrast`);
                assert.ok(sample.mutedText>=4.5,`${theme}: lead text contrast`);
                assert.ok(sample.focusAccent>=3,`${theme}: focus accent against page background`);
            }
            await capture(`home-${locale}-${theme}-${width}`);
            // Collection keeps the same guided booking flow without navigation.
            const book = page.locator('.showcase-slide.is-active .showcase-book'), slug = await book.getAttribute('data-showcase-slug');
            await book.click();
            await page.waitForFunction(expected => document.querySelector('#date-panel').open && document.querySelector('#booking-property').value===expected,slug);
            assert.equal(await page.locator('#booking-guide').isVisible(),true);
            assert.equal(await page.locator('[data-guide-step="2"]').getAttribute('aria-current'),'step');
            assert.equal(new URL(page.url()).pathname,'/');
            await noOverflow(`${locale}/${theme}/${width}: guided dates`);
            await page.keyboard.press('Escape');await page.locator('#date-panel').waitFor({state:'hidden'});
            layouts++;
        }
        // Inspect the actual photographed stay rather than assuming a fixture slug.
        await page.setViewportSize({width:1440,height:1000});
        await page.goto(base+'/?_locale=fr');
        await page.waitForFunction(() => !!document.querySelector('#date-range')?._flatpickr);
        await page.waitForSelector('.property-showcase.is-ready');
        const photographed = page.locator('.showcase-slide').filter({has:page.locator('img')}).first();
        const href = await photographed.locator('.showcase-card-media').getAttribute('href');
        assert.ok(href,'local catalogue contains a photographed stay');
        for (const image of await page.locator('.showcase-slide.is-active img').all()) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate(element => element.decode().catch(() => {}));
            assert.equal(await image.evaluate(element => element.naturalWidth>0),true,'catalogue photo loads');
        }
        for (const book of await page.locator('.showcase-slide .showcase-book').all()) {
            const slug = await book.getAttribute('data-showcase-slug');
            await page.locator(`.showcase-slide[data-slug="${slug}"]`).evaluate(slide=>{
                const index=[...slide.parentElement.children].indexOf(slide);
                slide.closest('.property-showcase').querySelector(`.showcase-picker button[data-index="${index}"]`).click();
            });
            await page.waitForFunction(()=>!document.querySelector('.property-showcase').classList.contains('is-moving'));
            await book.click();
            await page.waitForFunction(expected => document.querySelector('#date-panel').open && document.querySelector('#booking-property').value===expected,slug);
            assert.equal(await page.locator('#booking-guide').isVisible(),true,'every card opens the guide, including stays awaiting photos');
            assert.equal(new URL(page.url()).pathname,'/','guide keeps the visitor on the homepage');
            await page.keyboard.press('Escape');await page.locator('#date-panel').waitFor({state:'hidden'});
        }
        // Normal-motion anchors and pending guide cancellation are separate from
        // the responsive matrix so reduced-motion users keep their own behavior.
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.goto(base+'/?_locale=fr');
        await page.waitForFunction(()=>!!document.querySelector('#date-range')?._flatpickr);
        await smoothAnchor('.home-discover-link','#featured');
        const guideSlug=catalogue[0].slug;
        const searchPositions=await traceScroll({slug:guideSlug});
        await page.locator('#date-panel').waitFor({state:'visible'});await scrollSettled();
        assert.ok(intermediateScroll(searchPositions),`booking guide scrolls through intermediate positions: ${JSON.stringify(searchPositions)}`);
        const searchPlacement=await page.locator('.booking-bar').evaluate(bar=>({top:bar.getBoundingClientRect().top,header:document.querySelector('header.sticky-top').getBoundingClientRect().bottom}));
        assert.ok(searchPlacement.top>=searchPlacement.header-1,'guided search remains below the sticky header');
        assert.equal(await page.locator('#date-panel').evaluate(panel=>panel.contains(document.activeElement)),true,'dates own focus after guided scroll');
        await page.keyboard.press('Escape');await page.locator('#date-panel').waitFor({state:'hidden'});
        await smoothAnchor('.home-discover-link','#featured');
        await page.evaluate(slug=>document.dispatchEvent(new CustomEvent('booking:guide',{detail:{slug},cancelable:true})),guideSlug);
        await page.keyboard.press('Escape');await page.waitForTimeout(1300);
        assert.equal(await page.locator('dialog[open]').count(),0,'Escape cancels a guide while scrolling towards search');
        assert.equal(await page.locator('#booking-guide').isVisible(),false);
        await page.locator('#property-display').click();await page.locator('#property-panel').waitFor({state:'visible'});
        await page.locator(`[data-property-option="${guideSlug}"]`).click();
        await page.keyboard.press('Escape');await page.waitForTimeout(700);
        assert.equal(await page.locator('dialog[open]').count(),0,'Escape cancels a pending property-to-dates transition');
        await page.evaluate(()=>{document.querySelector('#date-display').click();document.querySelector('#guests-display').click();document.querySelector('#property-display').click();});
        await page.waitForTimeout(700);
        assert.equal(await page.locator('dialog[open]').count(),1,'rapid changes leave one modal');
        assert.equal(await page.locator('#property-panel').evaluate(panel=>panel.open&&panel.contains(document.activeElement)),true,'last requested panel owns focus');
        await page.keyboard.press('Escape');await page.locator('#property-panel').waitFor({state:'hidden'});
        await page.goto(new URL(href,base).href);await page.locator('#propertyGallery').waitFor();
        const peeks = page.locator('.property-gallery-peeks button');
        assert.ok(await peeks.count()>0,'desktop gallery includes photo previews');
        await peeks.first().click();
        await page.waitForFunction(() => document.querySelector('#propertyGallery .carousel-item:nth-child(2)').classList.contains('active'));
        assert.equal(await page.locator('.property-gallery-thumbs [data-bs-slide-to="1"]').getAttribute('aria-current'),'true');
        await page.locator('.property-gallery-thumbs [data-bs-slide-to="0"]').click();
        await page.waitForFunction(() => document.querySelector('#propertyGallery .carousel-item:first-child').classList.contains('active'));
        await page.locator('#propertyGallery').focus();await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('#propertyGallery .carousel-item:nth-child(2)').classList.contains('active'));
        await noOverflow('desktop property mosaic');await capture('property-mosaic');
        await smoothAnchor('.property-section-nav a[href$="#property-amenities"]','#property-amenities');
        for (const width of [390,320]) {
            await page.setViewportSize({width,height:900});await noOverflow('mobile property gallery');
        }
        for (const url of ['/contact-us','/about-us','/disponibilites']) {
            const response=await page.goto(base+url+'?_locale=en');assert.equal(response.status(),200);
            assert.equal(await page.locator('html').getAttribute('lang'),'en');await noOverflow(url+' mobile dark');
            assert.equal(await page.locator('h1').count(),1);
        }
        // The map is a primary explorer surface, with room alongside the carousel.
        await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/disponibilites?_locale=fr');
        const mapGeometry=await page.locator('.availability-explorer-layout').evaluate(layout=>({map:layout.querySelector('.stay-map').getBoundingClientRect().width,carousel:layout.querySelector('.property-showcase').getBoundingClientRect().width,surface:layout.querySelector('.stay-map-surface').getBoundingClientRect().height}));
        assert.ok(mapGeometry.map>mapGeometry.carousel&&mapGeometry.surface>=480,`desktop map has a generous share: ${JSON.stringify(mapGeometry)}`);
        await page.setViewportSize({width:320,height:900});await noOverflow('mobile enlarged map');
        assert.ok((await page.locator('.availability-explorer-layout .stay-map-surface').boundingBox()).height>=330,'mobile map remains useful');
        assert.deepEqual(writes,[],'no form or booking writes');assert.deepEqual(errors,[]);
        console.log(JSON.stringify({result:'PASS hospitality',layouts,mockedReads,contrast,mapGeometry,checks:'FR/EN light/dark responsive carousel and all-stay booking guide; smooth anchors and search scroll, pending Escape and rapid panels; mosaic navigation; enlarged availability map; no JS errors or writes'}));
    } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
