// Local motion checks. Remote resources, APIs and booking navigations are mocked/blocked.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const context = await browser.newContext(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {});
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
            if (url.pathname.startsWith('/api/')) return route.fulfill({contentType: 'application/json', body: '{"enabled":false,"properties":[],"availability":[]}'});
            return route.continue();
        });
        await context.addInitScript(() => {
            window.__revealRecords = []; window.__holdReveals = true;
            const animate = Element.prototype.animate;
            Element.prototype.animate = function(frames, timing) {
                const animation = animate.call(this, frames, timing);
                if (this.dataset.pageRevealState === 'revealing') {
                    window.__revealRecords.push({element: this, frames, timing, animation});
                    if (window.__holdReveals) animation.pause();
                }
                return animation;
            };
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.emulateMedia({reducedMotion: 'no-preference'});
        const ready = () => page.waitForFunction(() => document.querySelector('[data-page-reveal-state]'));
        const release = () => page.evaluate(() => {
            window.__holdReveals = false;
            for (const {animation, element} of window.__revealRecords) if (element.dataset.pageRevealState === 'revealing') animation.play();
        });
        await page.goto(base + '/?_locale=fr'); await ready();
        const sample = await page.locator('#home-heading').evaluate(element => {
            const record = window.__revealRecords.find(record => record.element === element);
            const output = {duration: record.timing.duration, samples: []};
            for (const time of [0, record.timing.delay + record.timing.duration / 2, record.timing.delay + record.timing.duration]) {
                record.animation.currentTime = time;
                output.samples.push({opacity: Number(getComputedStyle(element).opacity), translate: getComputedStyle(element).translate, height: document.documentElement.scrollHeight});
            }
            record.animation.currentTime = 400;
            return output;
        });
        assert.ok(sample.duration >= 1000, 'entrance has the requested slow easing');
        assert.equal(sample.samples[0].opacity, 0);
        assert.ok(sample.samples[1].opacity > 0 && sample.samples[1].opacity < 1);
        assert.equal(sample.samples[2].opacity, 1);
        assert.match(sample.samples[0].translate, /22px/);
        assert.equal(sample.samples[0].height, sample.samples[2].height, 'reveal does not move page layout');
        assert.equal(await page.locator('#amenities .reveal').first().getAttribute('data-page-reveal-state'), 'pending');
        assert.equal(await page.locator('#amenities .reveal').first().evaluate(e => getComputedStyle(e).opacity), '0');
        assert.equal(await page.evaluate(() => window.__revealRecords.filter(record => record.element.contains(document.querySelector('.booking-bar'))).every(record => record.frames.every(frame => !frame.translate))), true, 'booking bar only fades');
        assert.equal(await page.locator('header.sticky-top').evaluate(element => window.__revealRecords.find(record => record.element === element).frames.every(frame => !frame.translate)), true);
        await page.screenshot({path: 'var/page-reveal-entrance.png'});
        await release(); await page.waitForFunction(() => document.querySelector('#home-heading').dataset.pageRevealState === 'visible');
        const card = page.locator('#amenities .reveal-group .reveal').first();
        await card.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
        await page.waitForFunction(() => document.querySelector('#amenities .reveal-group .reveal').dataset.pageRevealState === 'revealing');
        const count = await card.evaluate(element => window.__revealRecords.filter(record => record.element === element).length);
        await page.waitForFunction(() => document.querySelector('#amenities .reveal-group .reveal').dataset.pageRevealState === 'visible');
        await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
        await card.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
        assert.equal(await card.evaluate(element => window.__revealRecords.filter(record => record.element === element).length), count, 'scrolling back does not restart already seen content');
        // Navigation replays new content, clears the old page and preserves history scroll.
        const previousBody = await page.evaluateHandle(() => document.body);
        await page.evaluate(() => window.Turbo.visit('/about-us?_locale=fr'));
        await page.waitForURL('**/about-us*'); await page.waitForFunction(() => document.querySelector('h1')?.closest('[data-page-reveal-state]'));
        assert.equal(await previousBody.evaluate(body => body.querySelectorAll('[data-page-reveal-state="pending"], [data-page-reveal-state="revealing"]').length), 0);
        assert.ok(await page.locator('h1').evaluate(element => window.__revealRecords.some(record => record.element.contains(element))), 'new page content receives an entrance');
        await page.goBack(); await page.waitForURL(url => url.pathname === '/');
        assert.equal(await page.locator('#amenities .reveal-group .reveal').first().getAttribute('data-page-reveal-state'), 'visible', 'restored content stays visible');
        // Controls remain usable even while their visual entrance is paused.
        await page.goto(base + '/?_locale=fr'); await ready();
        await page.locator('#property-display').click();
        assert.equal(await page.locator('#property-panel').isVisible(), true);
        assert.equal(await page.locator('#property-display').evaluate(button => button.closest('.reveal').dataset.pageRevealState), 'visible');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.locator('#contact input[type="email"]').focus();
        assert.equal(await page.locator('#contact input[type="email"]').evaluate(input => getComputedStyle(input.closest('.reveal')).opacity), '1', 'focus reveals a pending form immediately');
        // Revealing a button on pointerdown must not move it out from under
        // the pointer before mouseup, which would swallow the first click.
        await page.goto(base + '/cookies?_locale=fr'); await ready();
        await page.locator('.legal-content [data-privacy-open]').click();
        await page.waitForSelector('#privacy-preferences[open]');
        assert.equal(await page.locator('.legal-content [data-privacy-open]').evaluate(button => window.__revealRecords.find(record => record.element === button).frames.every(frame => !frame.translate)), true);
        await page.keyboard.press('Escape');
        // Sticky booking and independent carousel animation are not translated.
        await page.goto(base + '/property/lambersart?_locale=fr'); await ready();
        await page.locator('#availability').evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
        await page.waitForFunction(() => window.__revealRecords.some(record => record.element.id === 'availability'));
        assert.equal(await page.locator('#availability').evaluate(element => window.__revealRecords.find(record => record.element === element).frames.every(frame => !frame.translate)), true);
        // System reduced motion keeps the requested fade, with zero movement.
        await page.emulateMedia({reducedMotion: 'reduce'}); await page.goto(base + '/?_locale=fr'); await ready();
        assert.equal(await page.locator('#home-heading').evaluate(element => {
            const record = window.__revealRecords.find(record => record.element === element);
            return record.timing.duration >= 600 && record.frames.every(frame => !frame.translate);
        }), true);
        await page.emulateMedia({media: 'print'});
        assert.equal(await page.locator('#amenities .reveal').first().evaluate(element => getComputedStyle(element).opacity), '1');
        await page.emulateMedia({media: 'screen', reducedMotion: 'no-preference'});
        // Each page/theme/viewport keeps its normal width and live content.
        for (const path of ['/', '/about-us', '/contact-us', '/disponibilites', '/property/lambersart', '/mentions-legales']) for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 900}); await page.goto(base + path + '?_locale=' + (width === 390 ? 'en' : 'fr')); await ready();
            await page.evaluate(value => document.documentElement.dataset.bsTheme = value, width === 390 ? 'dark' : 'light');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path + ' width ' + width);
            await release();
            await page.evaluate(() => document.dispatchEvent(new Event('turbo:before-cache')));
            assert.equal(await page.locator('[data-page-reveal-state="pending"], [data-page-reveal-state="revealing"]').count(), 0);
        }
        const fallback = await browser.newContext({javaScriptEnabled: false, ...(process.env.ROAMING_BROWSER_STORAGE ? {storageState: process.env.ROAMING_BROWSER_STORAGE} : {})});
        await fallback.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        const fallbackPage = await fallback.newPage(); await fallbackPage.goto(base + '/?_locale=fr');
        assert.equal(await fallbackPage.locator('#amenities .reveal').first().evaluate(element => getComputedStyle(element).opacity), '1');
        await fallback.close();
        assert.deepEqual(errors, []);
        console.log('PASS page reveal: real fade/translate interpolation, staggered entry and scrolling once, Turbo cleanup/history, interactive forms, sticky booking, reduced motion, print, 18 page/mobile/theme layouts and no-JS fallback. Provider calls blocked.');
        await context.close();
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
