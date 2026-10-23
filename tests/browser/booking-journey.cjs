// Run against the local application: node tests/browser/booking-journey.cjs
// Uses the already installed Playwright and Chrome; no provider traffic or bookings.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/guestlucky/catalogue.json'), 'utf8')).properties;
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const [year, month] = today.split('-').map(Number);
const date = day => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const stay = {arrivalDate: date(5), departureDate: date(7), guests: '2'};
const query = extra => new URLSearchParams({...stay, ...extra}).toString();
const target = name => `[data-calendar-target="${name}"]`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
    const page = await context.newPage();
    const errors = [], calls = [], bookings = [];
    let mode = 'mixed', calendarMode = 'open', delay = 0, price = 442, occupied = true;
    page.on('pageerror', error => errors.push(error.message));
    // Intercept at context level to cover iframes AND fallback popups.
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith('/reservation/')) {
            bookings.push(url);
            return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Mock booking module</title><p>Simulation locale uniquement</p>'});
        }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        calls.push(url);
        const selected = url.searchParams.get('slug');
        const quote = url.pathname === '/api/availability' || url.pathname === '/api/test/availability';
        const capturedMode = mode, capturedPrice = price;
        if (quote) {
            if (delay) await sleep(delay);
            if (capturedMode === '422' || capturedMode === '500') return route.fulfill({status: Number(capturedMode), contentType: 'application/json', body: '{"error":"simulated"}'});
            const properties = capturedMode === 'empty' ? [] : catalogue.filter(p => !selected || selected === p.slug);
            const availability = properties.map((p, i) => {
                const status = capturedMode === 'unverified' ? 'unverified' : capturedMode === 'refused' || Number(url.searchParams.get('guests')) > p.capacity ? 'unavailable' : capturedMode === 'mixed' && !selected ? ['available', 'unavailable', 'unverified'][i] : 'available';
                return {slug: p.slug, name: p.name, city: p.city, maxGuests: p.capacity, image: null, status, available: status === 'available',
                    price: status === 'available' ? capturedPrice : null, nights: 2, currency: 'EUR', fees: status === 'available' ? {subtotal_nightly: 352, cleaning_fee: 90, linen_fee: 0, discount_amount: 0} : {},
                    detailsUrl: '/property/' + p.slug, bookingUrl: '/reservation/' + p.slug + '?' + new URLSearchParams({arrivalDate: url.searchParams.get('arrivalDate'), departureDate: url.searchParams.get('departureDate'), guests: url.searchParams.get('guests')})};
            });
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: capturedMode !== 'closed', preview: url.pathname.includes('/test/'), arrivalDate: url.searchParams.get('arrivalDate'), departureDate: url.searchParams.get('departureDate'), guests: Number(url.searchParams.get('guests')), availability})});
        }
        if (calendarMode === '500') return route.fulfill({status: 500, contentType: 'application/json', body: '{}'});
        const y = Number(url.searchParams.get('year')), m = Number(url.searchParams.get('month'));
        const properties = catalogue.map(p => ({slug: p.slug, status: calendarMode === 'unverified' ? 'unverified' : 'fresh', fetchedAt: new Date().toISOString(),
            days: calendarMode === 'unverified' ? [] : Array.from({length: new Date(y, m, 0).getDate()}, (_, i) => {
                const value = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return {date: value, available: !(occupied && value === date(7)), price: 119, minStay: 2};
            }).filter(day => day.date !== date(9))}));
        return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: calendarMode !== 'closed', properties})});
    });
    const search = async () => {
        await page.locator('#booking-search-form [type="submit"]').click();
        await page.waitForFunction(() => document.querySelector('#booking-search-form').getAttribute('aria-busy') === 'false');
    };
    const calendar = async (url = '/disponibilites?' + query({slug: catalogue[0].slug})) => {
        await page.goto(base + url); await page.locator('.stay-calendar').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-calendar-target="status"]').dataset.state !== 'loading');
    };
    const quoteCalendar = async () => { await page.locator(target('submit')).click(); await page.waitForSelector('.booking-quote-card'); };
    try {
        await page.goto(base + '/?' + query());
        assert.equal(await page.locator('#arrival-date').inputValue(), stay.arrivalDate);
        await search();
        assert.equal(await page.locator('.booking-quote-card').count(), 3);
        assert.equal(await page.locator('#booking-results').isVisible(), true);
        assert.deepEqual(await page.locator('.booking-quote-card').evaluateAll(cards => cards.map(c => c.dataset.state)), ['available', 'unavailable', 'unverified']);
        assert.equal(await page.locator('.booking-breakdown dt').count(), 2);
        assert.match(await page.locator('.booking-total').innerText(), /442/);
        assert.equal(bookings.length, 0); // No iframe or redirect until explicitly requested.
        const quoteCalls = () => calls.filter(url => /\/api\/(test\/)?availability$/.test(url.pathname)).length;
        const before = quoteCalls();
        await page.locator('.booking-module-actions button').click();
        await page.locator('#privacy-preferences [data-privacy-allow]').click();
        await page.waitForSelector('.guestlucky-booking-frame');
        assert.equal(await page.locator('dialog.booking-modal[open]').count(), 1);
        assert.equal(await page.locator('.booking-quote-card dialog, .booking-quote-card iframe').count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.className), 'booking-modal-close');
        await page.evaluate(() => document.querySelector('#booking-property').focus());
        assert.equal(await page.evaluate(() => document.activeElement.className), 'booking-modal-close', 'background controls are inert while the modal is open');
        assert.equal(quoteCalls(), before + 1);
        assert.equal(bookings.length, 1);
        for (const [key, value] of Object.entries(stay)) assert.equal(bookings[0].searchParams.get(key), value);
        await page.locator('.booking-modal-close').click();
        assert.equal(await page.locator('iframe.guestlucky-booking-frame').count(), 0);
        assert.equal(await page.locator('dialog.booking-modal').count(), 0);
        assert.equal(await page.locator('.booking-module-actions button').evaluate(button => button === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('booking-modal-open')), false);
        const popupPromise = page.waitForEvent('popup');
        await page.locator('.booking-module-actions a').click();
        const popup = await popupPromise; await popup.waitForLoadState();
        assert.equal(new URL(popup.url()).pathname, '/reservation/' + catalogue[0].slug); await popup.close();
        await page.locator('.booking-module-actions button').click();
        await page.waitForSelector('.guestlucky-booking-frame');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.booking-modal'));
        assert.equal(await page.locator('.booking-module-actions button').evaluate(button => button === document.activeElement), true);
        await page.locator('.booking-module-actions button').click();
        await page.waitForSelector('.guestlucky-booking-frame');
        await page.locator('#booking-property').selectOption(catalogue[2].slug, {force: true});
        assert.equal(await page.locator('.booking-quote-card, iframe.guestlucky-booking-frame').count(), 0);
        assert.equal(await page.locator('.booking-modal').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('booking-modal-open')), false);
        assert.equal(new URL(page.url()).searchParams.get('slug'), catalogue[2].slug);
        // A changed price requires review and another explicit click.
        assert.equal(await page.locator('#arrival-date').inputValue(), '');
        assert.equal(await page.locator('#departure-date').inputValue(), '');
        mode = 'available'; await page.goto(base + '/?' + query({slug: catalogue[2].slug})); await search(); price = 455;
        await page.locator('.booking-module-actions button').click();
        await page.waitForFunction(() => document.querySelector('.booking-total')?.textContent.includes('455'));
        assert.equal(await page.locator('iframe.guestlucky-booking-frame').count(), 0);
        assert.match(await page.locator('.booking-feedback').first().innerText(), /tarif a changé/);
        price = 442;
        // Cancel delayed quotes and preflight checks when travelers change.
        delay = 400; const requestBefore = quoteCalls();
        await page.locator('#booking-search-form [type="submit"]').click();
        await page.waitForFunction(() => document.querySelector('#booking-search-form').getAttribute('aria-busy') === 'true');
        assert.equal(await page.locator('#booking-results').isVisible(), false, 'No empty results card while checking a stay');
        assert.equal(await page.locator('.booking-progress-fill').evaluate(element => getComputedStyle(element).animationName), 'booking-progress-stripes');
        const pendingPercent = parseInt(await page.locator('.booking-progress-percent').innerText(), 10);
        assert.ok(pendingPercent >= 0 && pendingPercent < 100);
        await page.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await page.locator('.booking-progress-fill').evaluate(element => getComputedStyle(element).animationName), 'none');
        await page.emulateMedia({reducedMotion: 'no-preference'});
        await page.evaluate(() => { const input = document.getElementById('guests-count'); input.value = '3'; input.dispatchEvent(new Event('change')); });
        await sleep(500); assert.equal(await page.locator('.booking-quote-card').count(), 0); assert.equal(quoteCalls(), requestBefore + 1);
        assert.equal(await page.locator('#booking-search-status.is-loading').count(), 0);
        delay = 0; await search();
        assert.equal(await page.locator('.booking-progress-percent').innerText(), '100%');
        delay = 400;
        await page.locator('.booking-module-actions button').click();
        await page.evaluate(() => { const input = document.getElementById('guests-count'); input.value = '2'; input.dispatchEvent(new Event('change')); });
        await sleep(500); assert.equal(await page.locator('.guestlucky-booking-frame').count(), 0); delay = 0;
        // Retired quotes cannot be reopened, including just before their timer fires.
        await search(); const retiredCalls = quoteCalls(), retiredBookings = bookings.length;
        await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 61000; });
        await page.locator('.booking-module-actions button').click();
        assert.equal(quoteCalls(), retiredCalls); assert.equal(bookings.length, retiredBookings);
        assert.match(await page.locator('.booking-feedback').innerText(), /expiré/);
        assert.equal(await page.locator('.booking-module-actions a').getAttribute('href'), null);
        // Criteria propagate through actual Turbo catalogue/property/global calendar links.
        await page.goto(base + '/?' + query()); await search();
        await page.locator('.booking-property-title').first().click();
        await page.waitForSelector('.property-page');
        assert.equal(new URL(page.url()).searchParams.get('arrivalDate'), stay.arrivalDate);
        await page.locator('#availability').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        assert.equal(await page.locator(target('departure')).inputValue(), stay.departureDate);
        assert.equal(await page.locator('.stay-month').count(), 2);
        assert.equal(await page.locator('.property-date-popover').isVisible(), false);
        await quoteCalendar();
        await page.locator('.booking-module-actions button').click(); await page.waitForSelector('dialog.booking-modal[open]');
        const modulePopupPromise = page.waitForEvent('popup');
        await page.locator('.booking-modal-footer a').click();
        const modulePopup = await modulePopupPromise; await modulePopup.waitForLoadState();
        assert.equal(new URL(modulePopup.url()).pathname, '/reservation/' + catalogue[0].slug); await modulePopup.close();
        await page.evaluate(() => document.dispatchEvent(new Event('turbo:before-cache')));
        assert.equal(await page.locator('.booking-modal, .guestlucky-booking-frame').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('booking-modal-open')), false);
        await page.locator('.property-breadcrumb a').nth(1).click(); await page.waitForSelector('#featured');
        assert.equal(await page.locator('#arrival-date').inputValue(), stay.arrivalDate);
        const calendarLink = page.locator('a[href^="/disponibilites"]').first();
        await page.goto(await calendarLink.getAttribute('href').then(href => base + href));
        await page.locator('[data-availability-explorer-target="select"]').selectOption(catalogue[0].slug);
        await page.locator('.availability-property-card [data-booking-slug="' + catalogue[0].slug + '"]').click();
        await page.locator('.stay-calendar').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        assert.equal(await page.locator(target('arrival')).inputValue(), stay.arrivalDate);
        // Two-month navigation, minimum stay, occupied departure excluded, unknown nights.
        await page.locator('.stay-clear').click();
        await page.locator(`[data-date="${date(5)}"]`).click();
        assert.equal(await page.locator(`[data-date="${date(6)}"]`).isDisabled(), true);
        assert.equal(await page.locator(`[data-date="${date(7)}"]`).isDisabled(), false);
        assert.equal(await page.locator(`[data-date="${date(8)}"]`).isDisabled(), true);
        assert.equal(await page.locator(`[data-date="${date(9)}"]`).isDisabled(), true);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.date), date(7));
        await page.locator(`[data-date="${date(7)}"]`).click();
        await page.waitForSelector('.booking-quote-card');
        assert.equal(await page.locator(target('departure')).inputValue(), date(7));
        await page.locator(target('next')).click();
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        assert.equal(await page.locator('.booking-quote-card').count(), 0);
        await page.locator(target('previous')).click();
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        await page.locator(target('departure')).fill(date(6));
        assert.equal(await page.locator(target('submit')).isDisabled(), true);
        assert.match(await page.locator(target('feedback')).innerText(), /minimum/);
        await page.locator(target('departure')).fill(date(8));
        assert.match(await page.locator(target('feedback')).innerText(), /indisponible/);
        await page.locator(target('departure')).fill(date(7)); await quoteCalendar();
        await page.locator(target('arrival')).fill(date(9)); await page.locator(target('departure')).fill(date(11));
        assert.equal(await page.locator(target('submit')).isDisabled(), true);
        assert.match(await page.locator(target('feedback')).innerText(), /Non vérifié/);
        await page.locator(target('arrival')).fill(date(5)); await page.locator(target('departure')).fill(date(7)); await quoteCalendar();
        await page.locator(target('guests')).fill('10');
        await page.locator('.availability-change-property').click();
        await page.waitForSelector('.stay-property-picker:not([hidden])');
        await page.locator('[data-availability-explorer-target="select"]').selectOption(catalogue[2].slug);
        await page.locator(`[data-booking-slug="${catalogue[2].slug}"]`).click();
        await page.waitForFunction(() => !document.querySelector('[data-calendar-target="fields"]').disabled);
        assert.equal(await page.locator(target('arrival')).inputValue(), '');
        assert.equal(await page.locator(target('departure')).inputValue(), '');
        await page.locator(target('arrival')).fill(stay.arrivalDate);
        await page.locator(target('departure')).fill(stay.departureDate);
        assert.equal(await page.locator('.booking-quote-card').count(), 0);
        assert.equal(await page.locator(target('submit')).isDisabled(), true);
        assert.match(await page.locator(target('feedback')).innerText(), /capacité/);
        assert.equal(await page.locator(target('arrival')).inputValue(), stay.arrivalDate);
        await page.locator(target('guests')).fill('2'); await quoteCalendar();
        await page.locator(target('arrival')).fill(date(8));
        assert.equal(await page.locator(target('departure')).inputValue(), '');
        assert.equal(await page.locator('.booking-quote-card').count(), 0);
        // Supplier refusal, outage, unverified and closed publication (even with a misleading available row).
        for (mode of ['refused', '422', '500', 'unverified', 'closed', 'empty']) {
            await page.goto(base + '/?' + query()); await search();
            assert.equal(await page.locator('.booking-module-actions, .guestlucky-booking-frame').count(), 0, mode);
            assert.ok(await page.locator('#results-list a[href^="/contact-us"]').count() > 0, mode);
            if (mode === 'closed') { assert.equal(await page.locator('.booking-total').count(), 0); assert.match(await page.locator('#results-list').innerText(), /réservation en ligne.*fermée/); }
            if (mode === 'unverified') {
                assert.match(await page.locator('#results-list .booking-state').first().innerText(), /Vérification temporairement impossible/);
                assert.match(await page.locator('.booking-verification-error').innerText(), /ne signifie pas que le logement est indisponible/);
                const beforeRetry = calls.filter(url => url.pathname === '/api/availability').length;
                mode = 'available';
                await page.locator('.booking-verification-error button').click();
                await page.waitForSelector('#results-list .booking-total');
                assert.equal(calls.filter(url => url.pathname === '/api/availability').length, beforeRetry + 1, 'retry performs one fresh check');
                assert.equal(await page.locator('.booking-verification-error').count(), 0, 'successful retry clears the failure');
            }
        }
        // A successful quote cannot survive a refusal or closed publication on revalidation.
        for (const refusal of ['422', 'unverified', 'closed']) {
            mode = 'available'; await page.goto(base + '/?' + query({slug: catalogue[0].slug})); await search();
            mode = refusal; const beforeBooking = bookings.length;
            await page.locator('.booking-module-actions button').click();
            await page.waitForFunction(() => !document.querySelector('.booking-module-actions'));
            assert.equal(await page.locator('.guestlucky-booking-frame').count(), 0); assert.equal(bookings.length, beforeBooking);
        }
        mode = 'available';
        for (calendarMode of ['closed', 'unverified', '500']) {
            await calendar();
            assert.equal(await page.locator(target('submit')).isDisabled(), true);
            assert.equal(await page.locator('.booking-module-actions').count(), 0);
            if (calendarMode === 'closed') assert.equal(await page.locator(target('notice')).isVisible(), true);
        }
        calendarMode = 'open'; await calendar('/test-disponibilites?' + query({slug: catalogue[0].slug}));
        await quoteCalendar(); assert.equal(await page.locator('.booking-module-actions').count(), 0);
        // Frontend date and capacity validation avoids unnecessary quote requests.
        await page.goto(base + '/?' + query({slug: catalogue[2].slug, guests: '10'})); const invalidBefore = quoteCalls();
        await search(); assert.equal(quoteCalls(), invalidBefore); assert.match(await page.locator('#booking-search-status').innerText(), /capacité/);
        assert.equal(await page.locator('#booking-results').isVisible(), false, 'Invalid criteria must not display an empty results card');
        await page.goto(base + '/?' + query({arrivalDate: date(7), departureDate: date(5)})); await search();
        assert.equal(quoteCalls(), invalidBefore);
        // Responsive layouts, FR/EN, both themes, quote and module controls.
        let layouts = 0;
        for (const locale of ['fr', 'en']) {
            await page.goto(base + '/change-locale/' + locale);
            for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
                await page.setViewportSize({width, height: 950});
                await page.evaluate(value => localStorage.setItem('theme', value), theme);
                await page.goto(base + '/?' + query()); await search(); await page.evaluate(() => document.fonts.ready);
                assert.equal(await page.locator('html').getAttribute('lang'), locale);
                assert.equal(await page.locator('html').getAttribute('data-bs-theme'), theme);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `search ${locale}/${theme}/${width}`);
                await page.locator('#date-display').click();
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `picker ${locale}/${theme}/${width}`);
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('#date-display').getAttribute('aria-expanded'), 'false');
                await calendar(); await quoteCalendar();
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `calendar ${locale}/${theme}/${width}`);
                assert.equal(await page.locator('.stay-month').count(), 2);
                assert.equal(await page.locator('.booking-module-actions button').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(15, 118, 110)');
                await page.locator('.booking-module-actions button').click(); await page.waitForSelector('.guestlucky-booking-frame');
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `iframe ${locale}/${theme}/${width}`);
                const bounds = await page.locator('.booking-modal').boundingBox();
                assert.ok(bounds.width >= width * .85 && bounds.width <= width, `modal width ${width}`);
                assert.ok(bounds.height >= 950 * .9 && bounds.y >= 0 && bounds.y + bounds.height <= 951, `modal height ${width}`);
                const frameBounds = await page.locator('.guestlucky-booking-frame').boundingBox();
                assert.ok(frameBounds.height >= 950 * .65 && frameBounds.width <= width, `usable iframe ${width}`);
                assert.equal(await page.locator('.booking-modal').evaluate(dialog => dialog.matches(':modal')), true);
                if (width === 320) {
                    await page.setViewportSize({width, height: 568});
                    const compact = await page.locator('.booking-modal').boundingBox();
                    assert.ok(compact.y >= 0 && compact.y + compact.height <= 569);
                    assert.ok((await page.locator('.guestlucky-booking-frame').boundingBox()).height >= 280, 'usable module on a short mobile screen');
                }
                if (process.env.ROAMING_BROWSER_SCREENSHOTS === '1') await page.screenshot({path: path.join(__dirname, `../../var/phase3-${locale}-${theme}-${width}.png`), fullPage: false});
                await page.locator('.booking-modal-close').click();
                assert.equal(await page.evaluate(() => document.documentElement.classList.contains('booking-modal-open')), false);
                layouts++;
            }
        }
        assert.deepEqual(errors, []);
        assert.ok(calls.every(url => url.origin === base));
        console.log(`PASS: booking journey mocks, stale quotes/cancellation, fresh preflight, prices, 422/outage/unverified/closed/preview, capacity/minimum/occupied departure, month/keyboard/Turbo navigation; ${layouts} FR/EN light/dark layouts at 1440/390/320. No real provider requests or bookings.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
