// Read-only browser checks against an authenticated local workspace with at least one ticket.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
(async () => {
    const browser = await chromium.launch({headless:true, channel:'chrome'});
    try {
        const context = await browser.newContext({storageState:process.env.ROAMING_BROWSER_STORAGE});
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error=>errors.push(error.message));
        await page.goto(base+'/equipe/tickets');
        await page.waitForFunction(()=>document.querySelector('[data-controller="ticket-manager"]')?.hasAttribute('data-ready'));
        const count = await page.locator('.ticket-card').count(); assert.ok(count > 0);
        const origin = await page.evaluate(()=>performance.timeOrigin);
        const refreshed = () => page.waitForFunction(()=>!document.querySelector('[data-ticket-manager-target="results"]').hasAttribute('aria-busy'));
        const filter = async (name,value) => {
            const input=page.locator(`input[name="${name}[]"][value="${value}"]`);
            await input.evaluate(element=>element.closest('details').open=true);
            await input.check(); await refreshed();
        };
        await filter('status','new'); await filter('status','resolved'); await filter('category','display');
        assert.equal(await page.locator('.ticket-active-chip').count(),3);
        assert.ok(await page.locator('.ticket-card').count()>0);
        assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
        await page.locator('.ticket-active-chip').first().click(); await refreshed();
        assert.equal(await page.locator('.ticket-active-chip').count(),2);
        await page.goBack();
        await page.waitForFunction(()=>document.querySelectorAll('.ticket-active-chip').length===3);
        await refreshed();
        await page.locator('[name="q"]').fill('nothing-matches-49381');
        await page.waitForSelector('.ticket-empty');
        await page.locator('[data-action="ticket-manager#reset"]').click(); await refreshed();
        assert.equal(await page.locator('.ticket-active-chip').count(),0);
        assert.equal(await page.locator('.ticket-card').count(),count);
        // A failed refresh preserves the previous list and can be retried.
        await page.route('**/*', async route=>{
            const url=new URL(route.request().url());
            if(url.pathname==='/equipe/tickets'&&url.searchParams.get('_fragment')==='1'&&url.searchParams.get('q')==='simulate-failure') return route.fulfill({status:500,body:'simulated'});
            if(url.pathname==='/equipe/tickets'&&url.searchParams.get('_fragment')==='1'&&url.searchParams.get('q')==='simulate-stale') {
                await new Promise(resolve=>setTimeout(resolve,500));
                return route.fulfill({status:200,body:'<div class="stale-response">Stale response</div>'}).catch(()=>{});
            }
            return route.continue();
        });
        await page.locator('[name="q"]').fill('simulate-failure');
        await page.waitForSelector('.ticket-filter-error:not([hidden])');
        assert.equal(await page.locator('.ticket-card').count(),count);
        await page.locator('[data-action="ticket-manager#reset"]').click(); await refreshed();
        await page.locator('[name="q"]').fill('simulate-stale');
        await page.waitForRequest(request=>request.url().includes('simulate-stale'));
        await page.locator('[data-action="ticket-manager#reset"]').click(); await refreshed();
        await page.waitForTimeout(550);
        assert.equal(await page.locator('.stale-response').count(),0);
        assert.equal(await page.locator('.ticket-card').count(),count);
        const noJs=await browser.newContext({javaScriptEnabled:false,storageState:process.env.ROAMING_BROWSER_STORAGE});
        const noJsPage=await noJs.newPage();
        const noJsResponse=await noJsPage.goto(base+'/equipe/tickets?status[0]=new&status[1]=resolved&category[0]=display');
        assert.equal(noJsResponse.status(),200); assert.ok(await noJsPage.locator('.ticket-card').count()>0);
        await noJs.close();
        for(const locale of ['fr','en']) for(const theme of ['light','dark']) for(const width of [1440,390,320]) {
            await page.setViewportSize({width,height:1000});
            await page.goto(base+'/equipe/tickets?_locale='+locale);
            await page.evaluate(t=>document.documentElement.setAttribute('data-bs-theme',t),theme);
            await page.locator('details').first().locator('summary').click();
            const box=await page.locator('.ticket-filter-options').first().boundingBox();
            assert.ok(box.x>=0&&box.x+box.width<=width);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('details[open]').count(),0);
        }
        await page.setViewportSize({width:1440,height:1050});
        await page.goto(base+'/equipe/tickets?_locale=fr');
        await page.screenshot({path:'var/ticket-manager-preview.png',fullPage:true});
        assert.deepEqual(errors,[]);
        console.log('PASS: live combined filters, chips/history, search, reset, failure/retry, stale requests, no-JS fallback, 12 FR/EN light/dark desktop/mobile layouts; no tickets modified.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
