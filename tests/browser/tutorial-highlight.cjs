// Real browser compositor and reusable-controller checks. No external/API writes.
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
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/?_locale=fr');
        for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({width, height: 1000});
            await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
            await page.goto(base + '/?_locale=fr');
            await page.waitForFunction(() => document.querySelector('header.sticky-top').dataset.pageRevealState === 'visible');
            // A transformed parent reproduces the stacking context problem.
            await page.evaluate(() => {
                const fixture = document.createElement('div');
                fixture.id = 'highlight-fixture';
                fixture.style.cssText = 'position:fixed;right:36px;bottom:80px;transform:translateZ(0);z-index:100';
                fixture.innerHTML = '<button id="highlight-button" class="btn btn-primary rounded-pill px-4 py-3 fw-bold" data-tutorial-highlight-target="button">Rechercher</button>';
                document.body.append(fixture);
            });
            const fixture = page.locator('#highlight-fixture'), button = page.locator('#highlight-button');
            const originalClass = await button.getAttribute('class');
            const originalStyle = await button.getAttribute('style');
            const originalHeader = await page.locator('header.sticky-top').getAttribute('class');
            await page.locator('header.sticky-top').evaluate(async header => {
                await document.fonts.ready;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                await Promise.allSettled(header.getAnimations({subtree: true}).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished));
            });
            const before = await page.locator('header.sticky-top').screenshot({animations: 'disabled'});
            await fixture.evaluate(element => {
                element.dataset.controller = 'tutorial-highlight';
                element.setAttribute('data-tutorial-highlight-exclude-value', 'header.sticky-top, header.sticky-top .dropdown-menu.show');
                element.setAttribute('data-action', 'tutorial-highlight:toggle->tutorial-highlight#toggle');
                element.setAttribute('data-tutorial-highlight-active-value', 'true');
            });
            await page.waitForSelector('.tutorial-highlight-overlay');
            const after = await page.locator('header.sticky-top').screenshot({animations: 'disabled'});
            assert.ok(before.equals(after), `${width}/${theme}: navigation rendering is pixel-identical with the blur active`);
            assert.equal(await page.locator('header.sticky-top').getAttribute('class'), originalHeader);
            assert.equal(await button.getAttribute('class'), originalClass, 'no new button styles/classes');
            assert.equal(await button.getAttribute('style'), originalStyle, 'no inline button restyling');
            assert.equal(await button.count(), 1, 'no cloned control');
            assert.equal(await page.locator('.tutorial-highlight-overlay').evaluate(element => element.parentElement === document.body), true);
            const exclusions = await page.evaluate(() => {
                const overlay = document.querySelector('.tutorial-highlight-overlay');
                const source = getComputedStyle(overlay).clipPath.match(/"([^"]+)"/)[1];
                const path = new Path2D(source), ctx = document.createElement('canvas').getContext('2d');
                const shaded = (x, y) => ctx.isPointInPath(path, x, y, 'evenodd');
                const header = document.querySelector('header.sticky-top').getBoundingClientRect();
                const button = document.getElementById('highlight-button').getBoundingClientRect();
                return {nav: shaded(header.left + header.width / 2, header.top + header.height / 2),
                    button: shaded(button.x + button.width / 2, button.y + button.height / 2),
                    rest: shaded(innerWidth / 2, innerHeight / 2)};
            });
            assert.deepEqual(exclusions, {nav: false, button: false, rest: true});
            await page.mouse.move(0, 0);
            await page.waitForFunction(() => document.getElementById('highlight-button').getAnimations().some(animation => animation.playState === 'running'));
            // The navigation remains interactive, even though the backdrop's
            // stacking level is above the header. Check touch-menu expansion.
            if (width === 390) {
                await page.locator('.navbar-toggler').click();
                await page.waitForSelector('#navbarContent.show');
                await page.locator('.navbar-toggler').click();
                await page.waitForSelector('#navbarContent:not(.show):not(.collapsing)', {state: 'attached'});
                assert.equal(await page.locator('.tutorial-highlight-overlay').count(), 1);
            }
            await page.screenshot({path: `var/tutorial-highlight-${width}-${theme}.png`});
            const target = await button.boundingBox();
            await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
            await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
            assert.equal(await page.locator('.tutorial-highlight-overlay').count(), 0, 'real click cleans up');
            assert.equal(await button.evaluate(element => element.getAnimations().filter(animation => animation.effect.getTiming().iterations === Infinity).length), 0);
            assert.equal(await button.getAttribute('style'), originalStyle);

            for (const dismissal of ['advance', 'escape', 'cache', 'disconnect', 'disabled']) {
                await fixture.evaluate(element => element.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {detail: {active: true}})));
                await page.waitForSelector('.tutorial-highlight-overlay');
                if (dismissal === 'advance') await fixture.evaluate(element => element.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {detail: {active: false}})));
                if (dismissal === 'escape') await page.keyboard.press('Escape');
                if (dismissal === 'cache') await page.evaluate(() => document.dispatchEvent(new Event('turbo:before-cache')));
                if (dismissal === 'disconnect') await fixture.evaluate(element => element.removeAttribute('data-controller'));
                if (dismissal === 'disabled') await button.evaluate(element => element.disabled = true);
                await page.waitForSelector('.tutorial-highlight-overlay', {state: 'detached'});
                assert.equal(await button.evaluate(element => element.getAnimations().filter(animation => animation.effect.getTiming().iterations === Infinity).length), 0, dismissal);
                if (dismissal === 'disconnect') await fixture.evaluate(element => element.dataset.controller = 'tutorial-highlight');
                if (dismissal === 'disabled') await button.evaluate(element => element.disabled = false);
            }
            // Missing/invalid selectors must never leave an unusable veil.
            await fixture.evaluate(element => {
                element.querySelector('button').removeAttribute('data-tutorial-highlight-target');
                element.setAttribute('data-tutorial-highlight-selector-value', '#missing-button');
            });
            await fixture.evaluate(element => element.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {detail: {active: true}})));
            assert.equal(await page.locator('.tutorial-highlight-overlay').count(), 0);
            await fixture.evaluate(element => element.setAttribute('data-tutorial-highlight-selector-value', '#highlight-button'));
            await fixture.evaluate(element => element.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {detail: {active: true}})));
            await page.waitForSelector('.tutorial-highlight-overlay');
            await fixture.evaluate(element => element.remove());
            await page.waitForSelector('.tutorial-highlight-overlay', {state: 'detached'});
        }
        assert.deepEqual(errors, []);
        console.log('PASS: real blur compositor, pixel-identical navigation, genuine button in a transformed ancestor, light/dark desktop/mobile, clickable mobile menu, target/selector activation, click/step/Escape/Turbo/disconnect/disabled cleanup. No provider writes.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
