// Lot A only: real local UI, no GuestLucky traffic or mutations.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const catalogue = require('../../config/guestlucky/catalogue.json').properties;
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin && (url.pathname === '/api/calendar' || /^\/api\/properties\/[^/]+\/availability$/.test(url.pathname))) {
            const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
            const properties = catalogue.map(property => ({slug: property.slug, status: 'fresh', fetchedAt: new Date().toISOString(), days: Array.from({length: new Date(year, month, 0).getDate()}, (_, i) => ({date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, available: true, minStay: 2, price: 100}))}));
            return route.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, properties})});
        }
        if (url.origin !== new URL(base).origin || /\/api\/|\/reservation\//.test(url.pathname) || route.request().method() !== 'GET') {
            requests.push(url.pathname); return route.abort();
        }
        return route.continue();
    });
    const bounded = async selector => {
        const box = await page.locator(selector).boundingBox(), size = page.viewportSize();
        assert.ok(box && box.x >= 10 && box.y >= 10 && box.x + box.width <= size.width - 10 && box.y + box.height <= size.height - 10, `${selector}: ${JSON.stringify(box)} in ${JSON.stringify(size)}`);
        assert.equal(await page.locator(selector).evaluate(e => e.scrollWidth > e.clientWidth + 1), false, 'no internal horizontal clipping');
    };
    try {
        let layouts = 0;
        for (const locale of ['fr', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await page.goto(base + '/?_locale=' + locale);
            await page.evaluate(value => localStorage.setItem('theme', value), theme);
            await page.reload();
            await page.waitForFunction(() => !!document.querySelector('#date-range')._flatpickr);
            assert.equal(await page.locator('html').getAttribute('lang'), locale);
            assert.equal(await page.locator('html').getAttribute('data-bs-theme'), theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.locator('#date-display').scrollIntoViewIfNeeded();
            const before = await page.locator('.booking-bar').boundingBox();
            await page.locator('#date-display').click(); await bounded('#date-panel');
            if (width >= 768) {
                const trigger = await page.locator('#date-display').boundingBox(), calendar = await page.locator('#date-panel').boundingBox();
                assert.ok(calendar.y >= trigger.y + trigger.height + 10, 'desktop calendar opens below the field');
            }
            const after = await page.locator('.booking-bar').boundingBox();
            assert.equal(after.height, before.height, 'opening must not change layout');
            assert.equal(await page.locator('#date-panel').evaluate(e => e.contains(document.activeElement)), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#date-display').getAttribute('aria-expanded'), 'false');
            assert.equal(await page.locator('#date-display').evaluate(e => e === document.activeElement), true);
            await page.locator('#date-display').click();
            await page.mouse.click(2, 2);
            assert.equal(await page.locator('#date-panel').isVisible(), false);
            assert.equal(await page.locator('#date-display').evaluate(e => e === document.activeElement), true);
            await page.locator('#date-display').click();
            await page.waitForFunction(() => document.querySelector('#date-availability-status').dataset.state === 'fresh');
            await page.evaluate(() => {
                const picker = document.querySelector('#date-range')._flatpickr;
                const start = new Date(); start.setDate(start.getDate() + 3);
                const end = new Date(start); end.setDate(end.getDate() + 2);
                picker.setDate([start, end], true);
            });
            assert.equal(await page.locator('.flatpickr-day.startRange').count(), 1);
            assert.equal(await page.locator('.flatpickr-day.endRange').count(), 1);
            await page.locator('#date-apply').click();
            assert.equal(await page.locator('#date-panel').isVisible(), false);
            assert.equal(await page.locator('#date-display').evaluate(e => e === document.activeElement), true);
            await page.locator('#guests-display').click(); await bounded('#guests-panel');
            await page.locator('#guests-increase').click();
            assert.equal(await page.locator('#guests-count').inputValue(), '2');
            await page.locator('#guests-panel .panel-actions button').click();
            assert.equal(await page.locator('#guests-display').evaluate(e => e === document.activeElement), true);
            await page.locator('#property-display').click(); await bounded('#property-panel');
            assert.equal(await page.locator('[data-property-option]').count(), catalogue.length + 1);
            assert.equal(await page.locator('#property-panel').evaluate(e => getComputedStyle(e).backgroundColor), theme === 'dark' ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)');
            const lastSlug = await page.locator('[data-property-option]').last().getAttribute('data-property-option');
            await page.keyboard.press('End'); await page.keyboard.press('Enter');
            assert.equal(await page.locator('#booking-property').inputValue(), lastSlug);
            assert.equal(await page.locator('#arrival-date').inputValue(), '', 'changing property clears old dates');
            assert.equal(await page.locator('#property-display').evaluate(e => e === document.activeElement), true);
            await page.locator('#property-display').click(); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
            assert.equal(await page.locator('#booking-property').inputValue(), '');
            await page.locator('#property-display').click(); await page.keyboard.press('Escape');
            assert.equal(await page.locator('#property-display').evaluate(e => e === document.activeElement), true);
            // Resize and scroll while open, including the short 320px viewport.
            await page.locator('#date-display').click();
            await page.evaluate(() => window.scrollBy(0, -100));
            await page.waitForTimeout(100); await bounded('#date-panel');
            await page.setViewportSize({width, height: 500}); await page.waitForTimeout(100); await bounded('#date-panel');
            await page.keyboard.press('Escape');
            await page.setViewportSize({width, height: width === 320 ? 568 : 900});
            await page.evaluate(() => scrollTo(0, 0));
            if (width < 1200) await page.locator('.navbar-toggler').click();
            const controls = page.locator('.header-controls');
            for (const selector of ['#theme-toggle', '.header-language', '.header-booking-cta']) {
                const box = await controls.locator(selector).boundingBox(); assert.equal(box.height, 44, selector);
            }
            const geometry = await controls.boundingBox();
            await page.locator('#theme-toggle').click();
            assert.equal((await controls.boundingBox()).height, geometry.height);
            assert.equal(await page.locator('html').getAttribute('data-bs-theme'), theme === 'light' ? 'dark' : 'light');
            const toggle = page.locator('.navbar .dropdown-toggle');
            await toggle.click(); assert.equal(await page.locator('.property-nav-menu .dropdown-item').count(), 3);
            assert.equal(await page.locator('.property-nav-menu').evaluate(e => getComputedStyle(e).backgroundColor), theme === 'light' ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)', 'menu card follows the toggled theme');
            await page.mouse.click(2, 2); assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'outside click closes the existing dropdown');
            await toggle.click();
            await toggle.focus(); await page.keyboard.press('ArrowDown');
            assert.equal(await page.locator('.property-nav-menu .dropdown-item').first().evaluate(e => e === document.activeElement), true);
            await page.keyboard.press('Escape'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            assert.equal(await toggle.evaluate(e => e === document.activeElement), true);
            // Simulate a growing catalogue only in the DOM; never alter local records.
            await page.locator('.property-nav-menu').evaluate(menu => {
                for (let i = 0; i < 20; i++) { const item = menu.firstElementChild.cloneNode(true); item.querySelector('a').textContent = 'Logement au titre très long / A property with a very long title '.repeat(3); menu.append(item); }
            });
            await toggle.click();
            assert.equal(await page.locator('.property-nav-menu').evaluate(e => e.scrollHeight > e.clientHeight && e.scrollWidth <= e.clientWidth + 1), true);
            await page.keyboard.press('Escape');
            if (width < 1200) await page.keyboard.press('Escape');
            await page.locator('#date-display').click();
            // Cached Turbo page must never retain an open top-layer dialog.
            await page.evaluate(() => window.Turbo.visit('/contact-us?_locale=' + document.documentElement.lang));
            await page.waitForURL('**/contact-us*'); await page.waitForSelector('h1');
            await page.goBack(); await page.waitForSelector('#date-display');
            await page.waitForFunction(() => !!document.querySelector('#date-range')._flatpickr && !document.documentElement.hasAttribute('data-turbo-preview'));
            assert.equal(await page.locator('dialog[open]').count(), 0);
            await page.locator('#guests-display').click(); await bounded('#guests-panel'); await page.keyboard.press('Escape');
            layouts++;
        }
        assert.deepEqual(requests, [], 'lot A must cause no availability/provider requests');
        assert.deepEqual(errors, []);
        console.log(`PASS home/header: ${layouts} FR/EN × light/dark × 1440/768/390/320 layouts; popovers, focus, resize/scroll, keyboard, long menu, Turbo; zero provider requests.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
