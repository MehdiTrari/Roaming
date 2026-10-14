const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
const production = process.env.ROAMING_PROD_BROWSER_URL || 'http://127.0.0.1:8001';

(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext({viewport: {width: 1440, height: 950}, hasTouch: true});
    const page = await context.newPage();
    const errors = [], pairs = [];
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (![base, production].includes(url.origin) || url.pathname.startsWith('/reservation/')) return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({contentType: 'application/json', body: '{"enabled":false,"properties":[],"availability":[]}'});
        if (route.request().method() === 'POST') return route.abort();
        return route.continue();
    });
    page.on('pageerror', error => errors.push({url: page.url(), message: error.message, stack: error.stack}));
    const fresh = () => page.waitForFunction(() => !document.documentElement.hasAttribute('data-turbo-preview') && !document.documentElement.hasAttribute('aria-busy'));
    try {
        const firstResponse = await page.goto(base + '/?_locale=fr&guests=2&arrivalDate=2026-11-05&departureDate=2026-11-07');
        assert.ok(!(await firstResponse.text()).includes('class="sf-toolbar-value sf-toolbar-ajax-request-counter"'), 'loading toolbar must not imitate the live AJAX counter');
        await page.waitForSelector('.sf-toolbar-block-ajax .sf-toolbar-ajax-request-counter', {state: 'attached'});
        await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
        await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
        const cdp = await context.newCDPSession(page);
        const listeners = async () => (await cdp.send('Runtime.evaluate', {expression: '(getEventListeners(window).scroll || []).length', includeCommandLineAPI: true, returnByValue: true})).result.value;
        const initialListeners = await listeners();
        for (let i = 0; i < 4; i++) {
            await page.locator('.navbar a[href^="/about-us"]').click(); await page.waitForSelector('#why-choose');
            await fresh();
            assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
            await page.locator('.navbar-brand').click(); await page.waitForSelector('#featured');
            await fresh();
        }
        assert.ok(await listeners() <= initialListeners, 'Turbo must not accumulate scroll listeners');
        await page.locator('#theme-toggle').click(); assert.equal(await page.locator('html').getAttribute('data-bs-theme'), 'dark');
        await page.locator('.navbar a[href^="/about-us"]').click(); await page.waitForSelector('#why-choose');
        await page.goBack(); await page.waitForSelector('#featured'); await fresh();
        await page.locator('#theme-toggle').click(); assert.equal(await page.locator('html').getAttribute('data-bs-theme'), 'light', 'cached Turbo theme toggle must still work');
        assert.equal(new URL(page.url()).searchParams.get('guests'), '2');
        await page.locator('.navbar a[href^="/change-locale/en"]').click(); await page.waitForFunction(() => document.documentElement.lang === 'en');
        await fresh();
        assert.equal(new URL(page.url()).searchParams.get('guests'), '2');
        const sitemap = await page.request.get(base + '/sitemap.xml');
        assert.equal(sitemap.status(), 200);
        const xml = await sitemap.text(); assert.equal((xml.match(/<loc>/g) || []).length, 14); assert.equal((xml.match(/hreflang="en"/g) || []).length, 14);
        assert.ok(!xml.includes('/property/wazemmes') && !xml.includes('test-disponibilites'));
        // Real local photos: responsive sources, deferred cards and existing gallery controls.
        for (const width of [320, 1440]) {
            await page.setViewportSize({width, height: 950});
            for (const slug of ['lambersart', 'roubaix']) {
                await page.goto(base + '/property/' + slug);
                const active = index => page.waitForFunction(i => document.querySelectorAll('#propertyGallery .carousel-item')[i].classList.contains('active'), index);
                await page.locator('#propertyGallery').focus(); await page.keyboard.press('ArrowRight'); await active(1);
                await page.locator('.property-gallery-thumbs button').nth(2).click(); await active(2);
                await page.locator('#propertyGallery > .carousel-control-prev').click(); await active(1);
                if (width === 320) {
                    await page.dispatchEvent('#propertyGallery', 'pointerdown', {pointerType: 'touch', clientX: 260});
                    await page.dispatchEvent('#propertyGallery', 'pointerup', {pointerType: 'touch', clientX: 60}); await active(2);
                }
                await page.waitForFunction(() => { const image = document.querySelector('#propertyGallery .carousel-item.active img'); return image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith('.webp'); });
            }
            await page.goto(base + '/');
            for (const card of await page.locator('.catalogue-card .carousel-item.active img').all()) {
                await card.scrollIntoViewIfNeeded();
                await card.evaluate(image => image.decode());
                assert.ok(await card.evaluate(image => image.naturalWidth > 0 && image.currentSrc.endsWith('.webp')));
            }
        }
        await page.setViewportSize({width: 1440, height: 950});
        // Measure representative text/control contrasts on actual computed colors.
        for (const theme of ['light', 'dark']) for (const url of ['/', '/about-us', '/contact-us']) {
            await page.evaluate(value => localStorage.setItem('theme', value), theme); await page.goto(base + url);
            const measured = await page.evaluate(() => {
                const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
                const luminance = color => color.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                return [...document.querySelectorAll('.btn-primary, .bg-dark .text-teal, #contact .form-label')].filter(element => element.getBoundingClientRect().width && element.getBoundingClientRect().height).map(element => {
                    const style = getComputedStyle(element); const color = rgb(style.color); let ancestor = element, background;
                    while (ancestor) { const candidate = rgb(getComputedStyle(ancestor).backgroundColor); if (candidate[3] !== 0) { background = candidate; break; } ancestor = ancestor.parentElement; }
                    background ||= [255, 255, 255];
                    const a = luminance(color), b = luminance(background);
                    return {text: element.textContent.trim().slice(0, 70), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05)};
                });
            });
            measured.forEach(pair => { assert.ok(pair.ratio >= 4.5, `${url}/${theme}: ${pair.text} contrast ${pair.ratio}`); pairs.push({theme, url, ...pair}); });
        }
        await page.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await page.locator('.btn-primary').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
        // Real local prod kernel: no debug toolbar, genuine custom 404 and active/archived routes.
        for (const url of ['/', '/property/lambersart', '/property/roubaix', '/property/ecrin-noir-croix', '/contact-us', '/about-us', '/disponibilites', '/missing-page', '/property/wazemmes', '/test-disponibilites', '/.env.local']) {
            const response = await page.goto(production + url); const missing = ['/missing-page', '/property/wazemmes', '/test-disponibilites', '/.env.local'].includes(url);
            assert.equal(response.status(), missing ? 404 : 200, url); assert.equal(await page.locator('h1').count(), 1, url);
            assert.equal(await page.locator('[id^="sfToolbar"]').count(), 0); assert.equal(response.headers()['x-debug-token'], undefined);
            const html = await page.content(); assert.ok(!html.includes('DATABASE_URL') && !html.includes('APP_SECRET') && !html.includes('GUESTLUCKY_BOOKING_KEY'));
            if (missing) { assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow'); assert.equal(await page.locator('.catalogue-card').count(), 3); }
        }
        await page.setViewportSize({width: 320, height: 950}); await page.goto(production + '/missing-page');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const noJs = await browser.newContext({javaScriptEnabled: false});
        const staticPage = await noJs.newPage(); await staticPage.goto(base + '/contact-us');
        assert.equal(await staticPage.locator('.contact-form').evaluate(element => getComputedStyle(element.closest('.reveal')).opacity), '1'); await noJs.close();
        fs.writeFileSync(path.join(__dirname, '../../var/audit-interactions.json'), JSON.stringify({pairs, initialListeners, errors}, null, 2));
        assert.deepEqual(errors, []);
        console.log(`PASS: keyboard skip link, Turbo/listener cleanup/history/theme/locale criteria, sitemap, responsive/lazy images, galleries/keyboard/simulated touch at 320/1440, ${pairs.length} contrast pairs >=4.5, reduced motion, no-JS contact; 11 local prod routes including real 404/archive/diagnostic/secrets paths. No provider traffic or valid form submissions.`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
