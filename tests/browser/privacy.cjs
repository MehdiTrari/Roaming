// All calendars, quotes and booking frames are simulated. No remote bookings.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const key = 'roaming.privacy.v1';
const lifetime = 180 * 86400000;
const dates = [5, 7].map(offset => {const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);});
const stay = {slug: 'lambersart', arrivalDate: dates[0], departureDate: dates[1], guests: '2'};
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
        const page = await context.newPage(), errors = [], bookings = [], remote = [];
        let quotes = 0, delay = 0;
        context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== base) {remote.push(url.origin); return route.abort();}
            if (url.pathname.startsWith('/reservation/')) {bookings.push(url); return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Mock booking</title><p>No booking</p>'});}
            if (!url.pathname.startsWith('/api/')) return route.continue();
            if (url.pathname === '/api/availability') {
                quotes++; if (delay) await new Promise(resolve => setTimeout(resolve, delay));
                return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, ...stay, availability: [{slug: stay.slug, name: 'Lambersart', city: 'Lambersart', maxGuests: 10, status: 'available', available: true, price: 300, currency: 'EUR', nights: 2, fees: {}, detailsUrl: '/property/lambersart', bookingUrl: '/reservation/lambersart?' + new URLSearchParams(stay)}]})});
            }
            const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties: [{slug: stay.slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(year, month, 0).getDate()}, (_, i) => ({date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, available: true, minStay: 2, price: 150}))}]})});
        });
        const load = async () => {await page.goto(base + '/?' + new URLSearchParams(stay)); await page.waitForFunction(() => document.querySelector('#date-range')?._flatpickr);};
        const search = async () => {await page.locator('.booking-submit').click(); await page.waitForSelector('.booking-module-actions button');};
        const open = () => page.locator('.booking-module-actions button').click();
        const preferences = () => page.locator('.legal-footer-links [data-privacy-open]').click();
        const choice = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        await load();
        assert.equal(await page.locator('#privacy-preferences').isVisible(), false, 'no unnecessary arrival popup');
        assert.equal(await page.locator('iframe').count(), 0);
        await search(); const before = quotes;
        await open(); await page.waitForSelector('#privacy-preferences[open]');
        assert.equal(quotes, before, 'permission is requested before quote revalidation');
        assert.equal(bookings.length, 0);
        await page.keyboard.press('Escape');
        assert.equal(await choice(), null, 'closing does not grant consent');
        assert.equal(await page.locator('.booking-module-actions button').evaluate(e => e === document.activeElement), true);
        await open(); await page.locator('[data-privacy-refuse]').click();
        const refusal = await choice(); assert.equal(refusal.guestlucky, false);
        assert.equal(refusal.expiresAt - refusal.updatedAt, lifetime);
        assert.equal(bookings.length, 0);
        await load(); await search(); await open();
        await page.waitForSelector('#privacy-preferences[open]');
        await page.locator('[data-privacy-allow]').click();
        await page.waitForSelector('.guestlucky-booking-frame');
        const permission = await choice(); assert.equal(permission.guestlucky, true);
        assert.equal(permission.expiresAt - permission.updatedAt, refusal.expiresAt - refusal.updatedAt, 'same retention for both choices');
        assert.equal(await page.locator('.guestlucky-booking-frame').getAttribute('referrerpolicy'), 'no-referrer');
        assert.equal(bookings.length, 1);
        // Another tab withdrawing permission immediately removes the frame.
        const tab = await context.newPage(); await tab.goto(base + '/cookies');
        await tab.locator('.legal-content [data-privacy-open]').click(); await tab.locator('[data-privacy-refuse]').click();
        await page.waitForFunction(() => !document.querySelector('.guestlucky-booking-frame'));
        assert.equal(await page.locator('.booking-modal').count(), 0);
        await tab.close();
        await open(); await page.keyboard.press('Escape');
        const popupPromise = page.waitForEvent('popup'); await page.locator('.booking-module-actions a').click();
        const popup = await popupPromise; await popup.waitForLoadState(); await popup.close();
        assert.equal((await choice()).guestlucky, false, 'a voluntary external navigation does not permit embedding');
        // An expired or malformed stored decision never enables a frame.
        for (const value of ['invalid JSON', JSON.stringify({...permission, updatedAt: Date.now() - lifetime - 1000, expiresAt: Date.now() - 1000})]) {
            await page.evaluate(({key, value}) => localStorage.setItem(key, value), {key, value});
            await load(); await search(); await open(); await page.waitForSelector('#privacy-preferences[open]');
            await page.keyboard.press('Escape');
        }
        // Criteria changes and Turbo visits dismiss pending consent safely.
        await open(); await page.evaluate(() => {const guests = document.getElementById('guests-count'); guests.value = '3'; guests.dispatchEvent(new Event('change'));});
        assert.equal(await page.locator('#privacy-preferences').isVisible(), false);
        assert.equal(await page.locator('.booking-quote-card').count(), 0);
        await load(); await search(); await open();
        await page.evaluate(() => window.Turbo.visit('/cookies?_locale=en')); await page.waitForURL('**/cookies*');
        assert.equal(await page.locator('#privacy-preferences').isVisible(), false);
        // Withdrawal while revalidation is in flight also prevents creating a frame.
        await preferences(); await page.locator('[data-privacy-allow]').click();
        await load(); await search(); delay = 500; const pending = quotes;
        await open(); await page.waitForFunction(() => document.querySelector('.booking-quote-card').getAttribute('aria-busy') === 'true');
        const revoke = await context.newPage(); await revoke.goto(base + '/cookies'); await revoke.locator('.legal-content [data-privacy-open]').click(); await revoke.locator('[data-privacy-refuse]').click();
        await page.waitForTimeout(650); assert.equal(quotes, pending + 1); assert.equal(await page.locator('iframe').count(), 0); await revoke.close(); delay = 0;
        // Both themes and languages fit mobile and desktop; no external calls.
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 844}); await page.goto(base + '/cookies?_locale=' + locale);
            await page.evaluate(value => document.documentElement.dataset.bsTheme = value, theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.locator('.legal-content [data-privacy-open]').click();
            const dialog = await page.locator('#privacy-preferences').boundingBox();
            assert.ok(dialog.x >= 10 && dialog.y >= 10 && dialog.x + dialog.width <= width - 10 && dialog.y + dialog.height <= 834);
            const buttons = await page.locator('.privacy-actions button').evaluateAll(buttons => buttons.map(button => ({width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor})));
            assert.ok(buttons.every(button => button.height >= 44)); assert.ok(Math.abs(buttons[0].width - buttons[1].width) < 1);
            assert.equal(buttons[0].color, buttons[1].color); assert.equal(buttons[0].background, buttons[1].background);
            if (locale === 'fr' && width !== 320) await page.screenshot({path: `var/privacy-${theme}-${width}.png`});
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.legal-content [data-privacy-open]').evaluate(e => e === document.activeElement), true);
        }
        const restricted = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
        await restricted.addInitScript(() => {Storage.prototype.setItem = () => {throw new DOMException('blocked', 'SecurityError');};});
        const restrictedPage = await restricted.newPage();
        await restrictedPage.goto(base + '/cookies'); await restrictedPage.locator('.legal-content [data-privacy-open]').click(); await restrictedPage.locator('[data-privacy-allow]').click();
        await restrictedPage.locator('.legal-content [data-privacy-open]').click();
        assert.equal(await restrictedPage.locator('[data-privacy-status]').innerText(), await restrictedPage.locator('[data-privacy-status]').getAttribute('data-allowed'));
        await restricted.close();
        assert.deepEqual(remote, []); assert.deepEqual(errors, []);
        console.log('PASS privacy: default block, refusal, permission, equal retention, expiry/malformed choice, revocation across tabs and pending quotes, explicit external link, focus, Turbo, blocked storage, 12 theme/language/mobile layouts; no real provider calls.');
        await context.close();
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
