// Checks the real GuestLucky snapshot and an isolated interaction fixture.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8000';
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const fixture = fs.readFileSync('var/review-carousel-qa.html', 'utf8');
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (route.request().resourceType() === 'image' && url.hostname === 's3.eu-west-3.amazonaws.com' && url.pathname.startsWith('/guestluckybucket/listings/')) return route.continue();
            if (url.origin !== base || route.request().method() !== 'GET') return route.abort();
            if (url.pathname === '/__review-ui-qa__') return route.fulfill({contentType: 'text/html', body: fixture});
            if (url.pathname.startsWith('/api/')) return route.fulfill({status: 503, contentType: 'application/json', body: '{}'});
            return route.continue();
        });
        await page.goto(base + '/', {waitUntil: 'domcontentloaded'});
        if (await page.locator('[data-cookie-refuse]').isVisible()) await page.locator('[data-cookie-refuse]').click();
        const section = page.locator('#guest-reviews');
        const snapshot = JSON.parse(fs.readFileSync('var/guestlucky/reviews.json', 'utf8'));
        assert.equal(snapshot.version, 2);
        assert(snapshot.reviews.length > 0, 'run the GuestLucky review sync before checking the live homepage');
        assert.equal(await page.locator('.guest-review-card').count(), snapshot.reviews.length);
        assert.equal(await page.locator('.guest-review-brand-booking').count(), snapshot.reviews.filter(review => review.channel === 'booking').length);
        assert.equal(await page.locator('.guest-review-brand-airbnb').count(), snapshot.reviews.filter(review => review.channel === 'airbnb').length);
        assert.equal(await page.locator('.guest-review-source-card').count(), 0);
        assert((await section.locator('.guest-review-text').allTextContents()).includes(snapshot.reviews[0].text));
        assert.equal(await page.locator('.guest-review-avatar, .guest-reviews-disclosure').count(), 0);
        assert.equal(await page.locator('.guest-review-property img').count(), snapshot.reviews.length);
        const profiles = JSON.parse(fs.readFileSync('config/review_profiles.json', 'utf8')).profiles;
        const names = await page.locator('.guest-review-author h3').allTextContents();
        for (const profile of profiles) assert(names.includes(profile.author), 'verified public author appears: ' + profile.author);
        assert.equal(await page.locator('.guest-review-profile-photo').count(), profiles.length);
        await page.locator('.guest-review-profile-photo').evaluateAll(async images => {
            for (const image of images) {
                image.loading = 'eager'; await image.decode();
                if (!image.naturalWidth || new URL(image.src).origin !== location.origin) throw new Error('Avatar must decode from a local asset');
            }
        });
        await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
        const realViewport = page.locator('.guest-reviews-viewport');
        const image = page.locator('.guest-review-property img').nth(1);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(el => el.decode());
        const box = await image.boundingBox(), originalUrl = page.url();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 330, box.y + box.height / 2, {steps: 18});
        const releasePosition = await realViewport.evaluate(el => el.scrollLeft);
        await page.mouse.up(); await page.waitForTimeout(1100);
        assert(Math.abs(await realViewport.evaluate(el => el.scrollLeft) - releasePosition) < 2, 'releasing a drag keeps the exact position without snapping');
        assert(await realViewport.evaluate(el => el.scrollLeft > 100), 'dragging a property image slides the reviews');
        assert.equal(page.url(), originalUrl, 'a drag must not activate the property link');
        await realViewport.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(1100);
        assert(await realViewport.evaluate(el => el.scrollLeft < 2), 'keyboard Home returns to the first review');
        await page.evaluate(() => document.activeElement.blur());
        assert(await image.evaluate(el => el.getBoundingClientRect().width <= 104), 'cover stays a thumbnail inside its card');
        await section.screenshot({path: 'var/reviews-guestlucky-desktop.png'});
        await page.setViewportSize({width: 390, height: 1000});
        await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
        await section.screenshot({path: 'var/reviews-guestlucky-mobile.png'});
        await page.setViewportSize({width: 1440, height: 1000});
        await page.goto(base + '/__review-ui-qa__', {waitUntil: 'domcontentloaded'});
        await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
        assert.equal(await page.locator('.guest-review-card').count(), 7);
        assert.equal(await page.locator('#guest-reviews script, #guest-reviews iframe').count(), 0);
        const viewport = page.locator('.guest-reviews-viewport');
        await page.mouse.move(0, 0);
        await page.waitForTimeout(7200);
        assert(await viewport.evaluate(el => el.scrollLeft > 0), 'automatic scrolling while visible');
        await page.locator('[data-action="guest-reviews#togglePause"]').click();
        assert.equal(await page.locator('[data-guest-reviews-target="pause"]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-action="guest-reviews#next"]').click();
        await page.waitForTimeout(400);
        await page.locator('[data-action="guest-reviews#previous"]').click();
        await page.waitForTimeout(400);
        const long = page.locator('.guest-review-card.has-long-review');
        await long.locator('.guest-review-expand').click();
        assert.equal(await long.locator('.guest-review-expand').getAttribute('aria-expanded'), 'true');
        await long.locator('.guest-review-expand').click();
        await viewport.evaluate(el => el.scrollLeft = 0);
        for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({width, height: 1000});
            await page.evaluate(value => document.documentElement.setAttribute('data-bs-theme', value), theme);
            await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (theme === 'light' && [1440, 390].includes(width)) await section.screenshot({path: `var/reviews-qa-${width}.png`});
        }
        await page.emulateMedia({reducedMotion: 'reduce'});
        await page.waitForTimeout(100);
        assert(await page.locator('[data-guest-reviews-target="pause"]').isHidden());
        assert.deepEqual(errors, []);
        console.log('PASS reviews: real GuestLucky reviews on homepage; isolated carousel fixture, controls, 8 responsive/theme layouts, reduced motion.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
