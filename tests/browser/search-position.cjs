// Real local search UI. Calendar responses are simulated; no provider calls or bookings.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';

(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    let delayedLogo, releaseDelayedLogo;
    let heldLogoRequests = 0;
    try {
        const context = await browser.newContext({viewport: {width: 1900, height: 900},
            ...(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {})});
        let properties = [];
        const blocked = [], errors = [];
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (route.request().resourceType() === 'image' && url.protocol === 'https:'
                && ['s3.eu-west-3.amazonaws.com', 'guestluckybucket.s3.eu-west-3.amazonaws.com'].includes(url.hostname)) {
                return route.abort(); // Real galleries are verified separately; layout checks stay offline.
            }
            if (delayedLogo && url.origin === new URL(base).origin && url.pathname === '/images/logo-footer-black.png') {
                heldLogoRequests++;
                return delayedLogo.then(() => route.continue());
            }
            if (url.origin !== new URL(base).origin || url.pathname.startsWith('/reservation/') || route.request().method() !== 'GET') {
                blocked.push(url.pathname); return route.abort();
            }
            if (url.pathname === '/api/calendar' || /^\/api\/properties\/[^/]+\/availability$/.test(url.pathname)) {
                const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
                const slug = url.pathname.match(/^\/api\/properties\/([^/]+)\/availability$/)?.[1];
                return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true,
                    properties: properties.filter(property => !slug || property.slug === slug).map(property => ({
                        ...property, status: 'fresh', fetchedAt: new Date().toISOString(),
                        days: Array.from({length: new Date(year, month, 0).getDate()}, (_, index) => ({
                            date: `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
                            available: true, minStay: 2, price: 100
                        }))
                    }))})});
            }
            if (url.pathname.startsWith('/api/')) { blocked.push(url.pathname); return route.abort(); }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        const fresh = () => page.waitForFunction(() => document.querySelector('#date-range')?._flatpickr);
        const settled = () => page.waitForFunction(() => [...document.querySelectorAll('.home-search-popover[open]')]
            .every(panel => !panel.classList.contains('is-positioning') && !panel.getAnimations().some(animation => animation.playState === 'running')));
        await page.goto(base + '/?_locale=fr'); await fresh();
        properties = await page.locator('#booking-property option:not([value=""])').evaluateAll(options => options.map(option => ({
            slug: option.value, capacity: Number(option.dataset.capacity)
        })));
        assert.ok(properties.length > 0, 'the local catalogue is available');
        const dates = await page.evaluate(() => {
            const arrival = new Date(); arrival.setDate(arrival.getDate() + 3);
            const departure = new Date(arrival); departure.setDate(departure.getDate() + 2);
            return [arrival, departure].map(date => new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(date));
        });
        const fields = [
            {button: '#property-display', panel: '#property-panel'},
            {button: '#date-display', panel: '#date-panel'},
            {button: '#guests-display', panel: '#guests-panel'}
        ];
        let cases = 0;
        for (const reducedMotion of ['no-preference', 'reduce']) for (const saved of [false, true]) {
            for (const {button, panel} of fields) {
                await page.emulateMedia({reducedMotion});
                const criteria = saved ? {arrivalDate: dates[0], departureDate: dates[1], guests: '2', slug: properties[0].slug} : {};
                const url = new URL('/?_locale=fr', base);
                for (const [key, value] of Object.entries(criteria)) url.searchParams.set(key, value);
                await page.goto(url.href); await fresh();
                // Match the reported case: a visible search bar near the bottom of a large desktop viewport.
                await page.evaluate(() => {
                    const bar = document.querySelector('.booking-bar');
                    window.scrollTo({top: scrollY + bar.getBoundingClientRect().top - 665, behavior: 'instant'});
                });
                await page.waitForTimeout(80);
                const before = await page.locator('.booking-bar').boundingBox();
                await page.evaluate(() => {
                    window.searchPositionFrames = [];
                    window.searchPositionTracking = true;
                    const track = () => {
                        const box = document.querySelector('.booking-bar').getBoundingClientRect();
                        window.searchPositionFrames.push({time: performance.now(), scroll: scrollY, top: box.top,
                            header: document.querySelector('header.sticky-top').getBoundingClientRect().bottom});
                        if (window.searchPositionTracking) requestAnimationFrame(track);
                    };
                    track();
                });
                await page.locator(button).click();
                await page.waitForSelector(panel + '[open]');
                await settled();
                const frames = await page.evaluate(() => { window.searchPositionTracking = false; return window.searchPositionFrames; });
                const after = await page.locator('.booking-bar').boundingBox();
                const geometry = await page.evaluate(selector => {
                    const panel = document.querySelector(selector).getBoundingClientRect();
                    return {header: document.querySelector('header.sticky-top').getBoundingClientRect().bottom,
                        gap: parseFloat(getComputedStyle(document.querySelector('.booking-bar')).scrollMarginTop),
                        panel: {x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom},
                        width: innerWidth, height: innerHeight};
                }, panel);
                const label = JSON.stringify({button, reducedMotion, saved, before, after});
                assert.ok(Math.abs(after.y - geometry.header - geometry.gap) < 4, 'search bar sits below the header with a comfortable gap: ' + label);
                assert.ok(geometry.panel.y >= after.y + after.height + 8, 'desktop panel opens below the entire module');
                assert.ok(after.y >= geometry.header + 10, 'the full form stays clear of the sticky header: ' + label);
                assert.ok(after.y + after.height <= geometry.height - 8, 'the form including guide stays inside the viewport: ' + label);
                for (let index = 1; index < frames.length; index++) {
                    const elapsed = frames[index].time - frames[index - 1].time;
                    const jump = Math.abs(frames[index].scroll - frames[index - 1].scroll);
                    if (elapsed <= 35) assert.ok(jump <= 120, 'no native focus/scroll-anchoring jump: ' + JSON.stringify({button, reducedMotion, saved, jump, elapsed}));
                    assert.ok(frames[index].top >= frames[index].header + 8, 'the form never crosses behind the header: ' + label);
                }
                assert.ok(geometry.panel.x >= 10 && geometry.panel.y >= geometry.header + 8
                    && geometry.panel.right <= geometry.width - 10 && geometry.panel.bottom <= geometry.height - 10,
                'the adaptive popover stays in the usable viewport: ' + JSON.stringify(geometry));
                assert.equal(await page.locator('dialog[open]').count(), 1);
                assert.equal(await page.locator(panel).evaluate(element => element.contains(document.activeElement)), true);
                if (saved) {
                    assert.equal(await page.locator('#arrival-date').inputValue(), dates[0]);
                    assert.equal(await page.locator('#departure-date').inputValue(), dates[1]);
                    assert.equal(await page.locator('#guests-count').inputValue(), '2');
                }
                if (!saved && reducedMotion === 'no-preference' && button === '#property-display') {
                    await page.screenshot({path: 'var/search-position-top-1900.png'});
                }
                await page.keyboard.press('Escape');
                await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
                assert.equal(await page.locator(button).evaluate(element => element === document.activeElement), true);
                cases++;
            }
        }
        // A form already at the intended height stays in place.
        await page.emulateMedia({reducedMotion: 'no-preference'});
        for (const {button, panel} of fields) {
            await page.goto(base + '/?_locale=fr'); await fresh();
            await page.evaluate(() => {
                const bar = document.querySelector('.booking-bar');
                const top = document.querySelector('header.sticky-top').offsetHeight
                    + parseFloat(getComputedStyle(bar).scrollMarginTop);
                window.scrollTo({top: scrollY + bar.getBoundingClientRect().top - top, behavior: 'instant'});
            });
            const before = await page.evaluate(() => scrollY);
            await page.locator(button).click(); await page.waitForSelector(panel + '[open]'); await settled();
            const after = await page.locator('.booking-bar').boundingBox();
            const header = await page.locator('header.sticky-top').boundingBox();
            assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2, button + ' leaves an already comfortable form in place');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
            cases++;
        }
        // Every opening makes room again after a deliberate scroll, while
        // advancing to dates keeps the already aligned form stable.
        for (const reducedMotion of ['no-preference', 'reduce']) {
            await page.emulateMedia({reducedMotion});
            await page.goto(base + '/?_locale=fr'); await fresh();
            await page.evaluate(() => {
                const bar = document.querySelector('.booking-bar');
                window.scrollTo({top: scrollY + bar.getBoundingClientRect().top - 425, behavior: 'instant'});
            });
            const before = await page.evaluate(() => scrollY);
            await page.locator('#property-display').click(); await settled();
            const aligned = await page.evaluate(() => scrollY);
            assert.ok(aligned > before + 200, 'a lower form moves toward the top');
            await page.locator('#property-panel [data-property-option]').first().click();
            await page.waitForSelector('#date-panel[open]'); await settled();
            assert.ok(Math.abs(await page.evaluate(() => scrollY) - aligned) < 2, 'advancing from property to dates does not scroll');
            assert.equal(await page.locator('#date-panel').evaluate(element => element.scrollHeight > element.clientHeight + 2), false,
                'the guided desktop calendar and its actions fit without internal scrolling');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
            await page.evaluate(() => {
                const bar = document.querySelector('.booking-bar');
                window.scrollTo({top: scrollY + bar.getBoundingClientRect().top - 665, behavior: 'instant'});
            });
            const low = await page.evaluate(() => scrollY);
            await page.locator('#guests-display').click(); await settled();
            assert.ok(await page.evaluate(() => scrollY) > low + 400, 'reopening a lower form makes room again');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
            cases++;
        }
        // Short desktops and mobile sheets stay within the screen too.
        for (const [width, height] of [[1440, 650], [768, 900], [390, 844], [320, 568]]) {
            await page.setViewportSize({width, height});
            for (const {button, panel} of fields) {
                const query = new URLSearchParams({_locale: 'fr', ...(button === '#date-display'
                    ? {arrivalDate: dates[0], departureDate: dates[1], guests: '2'} : {})});
                await page.goto(base + '/?' + query); await fresh();
                await page.locator(button).scrollIntoViewIfNeeded();
                await page.locator(button).click(); await page.waitForSelector(panel + '[open]'); await settled();
                const box = await page.locator(panel).boundingBox();
                assert.ok(box.x >= 10 && box.y >= 10 && box.x + box.width <= width - 10 && box.y + box.height <= height - 10,
                    'menu stays inside a short/mobile viewport: ' + JSON.stringify({width, height, button, box}));
                assert.equal(await page.locator(panel).evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
                if (button === '#date-display') {
                    await page.locator('#date-panel .flatpickr-next-month').click();
                    await settled();
                    await page.locator('#date-cancel').click();
                } else await page.keyboard.press('Escape');
                await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
                assert.equal(await page.locator(button).evaluate(element => element === document.activeElement), true);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                cases++;
            }
        }
        // Interact before a slow image completes: the initial turbo:load must
        // preserve the live picker, its values and the already open calendar.
        await page.setViewportSize({width: 1900, height: 900});
        delayedLogo = new Promise(resolve => { releaseDelayedLogo = resolve; });
        const lateQuery = new URLSearchParams({_locale: 'fr', slug: properties[0].slug,
            arrivalDate: dates[0], departureDate: dates[1], guests: '2'});
        await page.goto(base + '/?' + lateQuery, {waitUntil: 'domcontentloaded'}); await fresh();
        await page.evaluate(() => {
            window.pickerBeforeLateLoad = document.querySelector('#date-range')._flatpickr;
            document.addEventListener('turbo:load', () => { window.lateTurboLoaded = true; }, {once: true});
        });
        await page.locator('#date-display').click(); await page.waitForSelector('#date-panel[open]'); await settled();
        assert.ok(heldLogoRequests > 0, 'a real image delays the initial page load');
        releaseDelayedLogo(); delayedLogo = null;
        await page.waitForFunction(() => window.lateTurboLoaded);
        assert.equal(await page.locator('#date-panel').evaluate(element => element.open), true);
        assert.equal(await page.evaluate(() => window.pickerBeforeLateLoad === document.querySelector('#date-range')._flatpickr), true);
        assert.equal(await page.locator('#arrival-date').inputValue(), dates[0]);
        assert.equal(await page.locator('#departure-date').inputValue(), dates[1]);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.home-search-popover[open]'));
        cases++;
        assert.deepEqual(blocked, [], 'no booking, quote or external provider requests');
        assert.deepEqual(errors, []);
        console.log(`PASS search placement: ${cases} cases; all fields, saved stay, normal/reduced motion, top alignment, repeated openings, stable guide steps, short/mobile viewports, calendar navigation, focus and delayed initial Turbo load; mocked calendars only.`);
    } finally { releaseDelayedLogo?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
