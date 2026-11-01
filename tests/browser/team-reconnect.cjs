const {chromium} = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.ROAMING_BROWSER_URL || 'http://127.0.0.1:8014';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use the isolated local team fixture.');

(async () => {
    const browser = await chromium.launch({headless: true, channel: 'chrome'});
    try {
        for (const javaScriptEnabled of [true, false]) {
            const context = await browser.newContext({javaScriptEnabled});
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                return url.origin === new URL(base).origin && !url.pathname.startsWith('/reservation/')
                    ? route.continue() : route.abort();
            });
            const page = await context.newPage();
            for (let cycle = 0; cycle < 3; cycle++) {
                await page.goto(`${base}/equipe/connexion`);
                await page.locator('#username').fill('tester@example.test');
                await page.locator('#password').fill('browser-only-password');
                const [request] = await Promise.all([
                    page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/equipe/connexion'),
                    page.locator('form[action="/equipe/connexion"] button').click(),
                ]);
                if (javaScriptEnabled) {
                    const token = new URLSearchParams(request.postData()).get('_csrf_token');
                    assert.notEqual(token, 'csrf-token', 'Login must load the CSRF script before the first submission.');
                    assert.ok((await request.allHeaders()).cookie?.includes(`csrf-token_${token}=csrf-token`));
                }
                await page.waitForURL(`${base}/`);
                await page.locator('[data-team-report]').waitFor();
                // Exercise logout from both layouts, keeping the same browser session.
                if (cycle % 2) await page.goto(`${base}/equipe/tickets`);
                await page.locator('form[action="/equipe/deconnexion"] button').click();
                await page.locator('.team-maintenance').waitFor();
            }
            await context.close();
        }
        console.log('Team reconnect passed: three login/logout cycles, both layouts, JavaScript enabled and disabled.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
