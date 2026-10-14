const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8014';
(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const anonymous = await browser.newContext();
    const team = await browser.newContext();
    const errors = [];
    for (const context of [anonymous, team]) {
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== new URL(base).origin || url.pathname.startsWith('/reservation/')) return route.abort();
            return route.continue();
        });
    }
    try {
        const publicPage = await anonymous.newPage();
        publicPage.on('pageerror', error => errors.push(error.message));
        for (const locale of ['fr', 'en']) for (const width of [1440, 390, 320]) {
            await publicPage.setViewportSize({width, height: 900});
            const response = await publicPage.goto(`${base}/?_locale=${locale}`);
            assert.equal(response.status(), 200);
            assert.equal(response.headers()['x-robots-tag'], undefined);
            assert.equal(await publicPage.locator('html').getAttribute('lang'), locale);
            assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.equal(await publicPage.locator('[data-team-report]').count(), 0);
        }
        const page = await team.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/equipe/connexion?_locale=fr`);
        await page.locator('#username').fill('tester@example.test'); await page.locator('#password').fill('browser-only-password');
        await Promise.all([page.waitForURL(`${base}/`), page.locator('button[type="submit"], form button').click()]);
        assert.equal(await page.locator('[data-team-report]').count(), 1);
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 900});
            await page.locator('[data-team-report]').click();
            await page.waitForSelector('[data-team-dialog][open]');
            const box = await page.locator('[data-team-dialog]').boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= width);
            assert.equal(await page.locator('[name="test_ticket[screen]"]').inputValue(), `${width}x900`);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('[data-team-report]').evaluate(e => e === document.activeElement), true);
        }
        await page.locator('[data-team-report]').click(); await page.waitForSelector('[data-team-dialog][open]');
        await page.locator('[name="test_ticket[title]"]').fill('Browser feedback');
        await page.locator('[name="test_ticket[description]"]').fill('The modal works at 320px.');
        await Promise.all([page.waitForURL(/\/equipe\/tickets\/\d+$/), page.locator('[data-team-dialog] button[type="submit"]').click()]);
        assert.match(await page.locator('h1').innerText(), /Browser feedback/);
        assert.equal(await page.locator('select[name="status"]').count(), 0);
        const publicResponse = await publicPage.goto(`${base}/`);
        assert.equal(publicResponse.headers()['x-robots-tag'], undefined);
        assert.equal(await publicPage.locator('[data-team-report]').count(), 0);
        await Promise.all([page.waitForURL(`${base}/`), page.locator('form[action="/equipe/deconnexion"] button').click()]);
        assert.equal(await page.locator('[data-team-report]').count(), 0);
        assert.deepEqual(errors, []);
        console.log('Team browser checks passed: FR/EN, 320/390/1440px, separate sessions, login, dialog, ticket, logout.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
