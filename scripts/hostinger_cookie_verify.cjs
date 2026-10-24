// Live first-visit notice and team preview checks; booking traffic is simulated.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const assert = require('node:assert/strict');
const secrets = [];
(async () => {
    const root = path.resolve(__dirname, '..'), base = 'https://roaminglille.com';
    const privateDirectory = path.join(root, 'var/private/hostinger-cookie-verification');
    await fs.mkdir(privateDirectory, {recursive: true});
    const sessionFile = path.join(privateDirectory, 'session.json');
    const credentials = JSON.parse(await fs.readFile(path.join(root, 'var/private/hostinger-team-activation-20261024/team-credentials.json'), 'utf8'));
    secrets.push(credentials.password);
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base || url.pathname.startsWith('/reservation/')) return route.abort();
        if (!['GET', 'HEAD'].includes(request.method()) && !['/equipe/connexion', '/equipe/deconnexion'].includes(url.pathname)) return route.abort();
        return route.continue();
    });
    try {
        const page = await context.newPage();
        await page.goto(base + '/');
        assert.equal(await page.locator('.team-maintenance').count(), 1);
        await page.waitForSelector('#cookie-banner:not([hidden])');
        assert.equal(await page.locator('dialog[open]').count(), 0);
        await page.locator('[data-cookie-allow]').click();
        assert.equal(await page.locator('#cookie-banner').isVisible(), false);
        await page.goto(base + '/equipe/connexion');
        await page.locator('#username').fill(credentials.email);
        await page.locator('#password').fill(credentials.password);
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/connexion"] button').click()]);
        await page.waitForSelector('#booking-search-form');
        assert.equal(await page.locator('#cookie-banner').isVisible(), false, 'the first-visit choice survives team login');
        // The regression suite gets only the authenticated session, with fresh consent state.
        const state = await context.storageState(); state.origins = [];
        await fs.writeFile(sessionFile, JSON.stringify(state), {mode: 0o600});
        const child = await promisify(execFile)(process.execPath, [path.join(root, 'tests/browser/privacy.cjs')], {
            cwd: root, timeout: 180000, env: {...process.env, ROAMING_BROWSER_URL: base, ROAMING_BROWSER_STORAGE: sessionFile},
        });
        console.log(child.stdout.trim());
        await page.goto(base + '/');
        await Promise.all([page.waitForURL(base + '/'), page.locator('form[action="/equipe/deconnexion"] button').click()]);
        await page.waitForSelector('.team-maintenance');
        const api = await context.request.get(base + '/api/calendar');
        assert.equal(api.status(), 503); assert.equal((await api.json()).error, 'site_maintenance');
        const report = {liveCookieBannerVerified: true, firstVisitChoiceSurvivesLogin: true, consentAndMockBookingRegressionPassed: true,
            maintenanceStillActive: true, anonymousApisBlocked: true, noRealBookingOrBusinessWrite: true};
        await fs.writeFile(path.join(root, 'var/backups/hostinger-cookies-20261024/COOKIE-BANNER-VERIFIED.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report));
    } finally {await fs.rm(sessionFile, {force: true}); await browser.close();}
})().catch(error => {let message = error.message; for (const secret of secrets) message = message.split(secret).join('[private]'); console.error(message.replace(/https?:\/\/\S+/g, '[URL]')); process.exitCode = 1;});
