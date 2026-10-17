// All calendar, quote, and booking requests are intercepted; no provider writes.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = today.split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const target = name => `[data-calendar-target="${name}"]`;
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return {promise, resolve}; };
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let gate = deferred(), quoteCalls = 0;
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base || route.request().method() !== 'GET') return route.abort();
        if (url.pathname.startsWith('/reservation/')) return route.fulfill({contentType: 'text/html', body: '<p>Mock booking module</p>'});
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/availability') {
            quoteCalls++; await gate.promise;
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, availability: [{slug: 'lambersart', name: 'Appartement Lille Lambersart', city: 'Lambersart', maxGuests: 10, status: 'available', available: true, price: 4948, nights: 22, currency: 'EUR', fees: {subtotal_nightly: 4858, cleaning_fee: 90, linen_fee: 20, extra_guest_fee: 20, pet_fee: 10, service_fee: 10, discount_amount: 10, tax_amount: 15}, detailsUrl: '/property/lambersart', bookingUrl: '/reservation/lambersart?' + url.searchParams}]})});
        }
        const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties: [{slug: 'lambersart', status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(y, m, 0).getDate()}, (_, i) => ({date: new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10), available: true, price: 100, minStay: 2}))}]})});
    });
    try {
        let layouts = 0;
        for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [1200, 650], [992, 700], [768, 900], [390, 844], [320, 568]]) {
            await page.setViewportSize({width, height});
            for (const kind of ['property', 'availability']) {
                const query = new URLSearchParams({_locale: theme === 'light' ? 'fr' : 'en', slug: 'lambersart', arrivalDate: date(1), departureDate: date(23), guests: '4'});
                await page.goto(base + (kind === 'property' ? '/property/lambersart?' : '/disponibilites?') + query);
                await page.evaluate(value => { localStorage.setItem('theme', value); document.documentElement.dataset.bsTheme = value; }, theme);
                await page.locator('[data-controller="calendar"]').scrollIntoViewIfNeeded();
                await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh');
                const clear = page.locator(target('clear')), submit = page.locator(target('submit'));
                const c = await clear.boundingBox(), s = await submit.boundingBox();
                assert.ok(c.x + c.width <= s.x + 1 && Math.abs(c.y - s.y) < 1, 'clear is immediately left of verify in both layouts');
                assert.equal(await clear.isEnabled(), true); assert.equal(await submit.isEnabled(), true);
                assert.equal(await page.locator('.stay-actions').count(), 1);
                const before = await page.evaluate(() => ({height: document.documentElement.scrollHeight, y: scrollY}));
                gate = deferred(); await submit.click();
                await page.locator(target('progress') + '.is-loading').waitFor();
                const percent = await page.locator(target('progress') + ' .booking-progress-percent').innerText();
                assert.ok(Number.parseInt(percent) < 100, 'pending verification uses the same percentage animation as home');
                assert.equal(await submit.isDisabled(), true);
                gate.resolve(); await page.waitForSelector('.booking-quote-card');
                assert.equal(await page.locator(target('progress') + ' .booking-progress-percent').innerText(), '100%');
                assert.equal(await submit.isEnabled(), true, 'verification can be repeated after the quote completes');
                const order = await page.locator('.stay-actions').evaluate(actions => Boolean(actions.compareDocumentPosition(document.querySelector('[data-calendar-target="quote"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
                assert.equal(order, true, 'actions precede the quote in the reading order');
                if (kind === 'property' && width >= 992) {
                    const after = await page.evaluate(() => {
                        const aside = document.querySelector('.property-availability'), panel = document.querySelector('.property-booking-compact');
                        return {height: document.documentElement.scrollHeight, y: scrollY, asideHeight: aside.getBoundingClientRect().height, view: innerHeight, scrollable: panel.scrollHeight > panel.clientHeight};
                    });
                    assert.ok(after.asideHeight <= height - 119, 'expanded panel stays within the viewport');
                    assert.equal(after.height, before.height, 'quote expansion does not lengthen the whole page');
                    assert.ok(after.scrollable, 'long quotes scroll inside the right panel');
                    const panel = page.locator('.property-booking-compact');
                    await panel.hover(); const pageY = await page.evaluate(() => scrollY);
                    await page.mouse.wheel(0, 2000);
                    await page.waitForFunction(() => document.querySelector('.property-booking-compact').scrollTop > 0);
                    assert.equal(await page.evaluate(() => scrollY), pageY, 'reading the quote does not scroll the page');
                    const actions = await page.locator('.stay-actions').boundingBox();
                    assert.ok(actions.y >= 0 && actions.y + actions.height <= height, 'sticky actions stay reachable during internal scrolling');
                    if (width === 1200 && theme === 'light') await page.screenshot({path: 'var/property-booking-panel-desktop.png'});
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                if (width === 390 && kind === 'property' && theme === 'dark') await page.screenshot({path: 'var/property-booking-panel-mobile.png'});
                await clear.click();
                assert.equal(await page.locator(target('arrival')).inputValue(), '');
                assert.equal(await page.locator('.booking-quote-card').count(), 0);
                assert.equal(await page.locator(target('progress')).innerText(), '');
                layouts++;
            }
        }
        // A criterion change cancels the progress and cannot restore an old quote.
        await page.goto(base + '/property/lambersart?' + new URLSearchParams({slug: 'lambersart', arrivalDate: date(1), departureDate: date(23), guests: '4'}));
        await page.locator('[data-controller="calendar"]').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state === 'fresh');
        gate = deferred(); const previousCalls = quoteCalls;
        await page.locator(target('submit')).click();
        await page.waitForFunction(() => !!document.querySelector('.booking-search-status.is-loading'));
        await page.locator(target('clear')).click(); gate.resolve();
        assert.equal(await page.locator('.booking-search-status.is-loading, .booking-quote-card').count(), 0);
        assert.ok(quoteCalls >= previousCalls);
        assert.deepEqual(errors, []);
        console.log(`PASS booking panel: ${layouts} property/availability FR/EN light/dark layouts (320–1440px), clear/verify placement, shared progress/completion/cancellation, bounded panel, internal scrolling and sticky actions, no page expansion. Provider responses mocked.`);
    } finally { gate.resolve(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
