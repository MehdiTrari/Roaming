// Live read-only validation of the owner-requested production team account.
// Only login/logout POSTs are allowed. No ticket, booking, payment or provider write.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const privateValues=[];
(async () => {
    const root=path.resolve(__dirname,'..');
    const credentials=JSON.parse(await fs.readFile(path.join(root,'var/private/hostinger-team-activation-20261024/team-credentials.json'),'utf8'));
    privateValues.push(credentials.password);
    const base='https://roaminglille.com';
    const browser=await chromium.launch({headless:true,channel:'chrome'});
    const anonymous=await browser.newContext();
    const team=await browser.newContext({viewport:{width:1440,height:900}});
    const errors=[];
    for(const context of [anonymous,team])await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin!==base||url.pathname.startsWith('/reservation/'))return route.abort();
        if(!['GET','HEAD'].includes(request.method())&&!['/equipe/connexion','/equipe/deconnexion'].includes(url.pathname))return route.abort();
        return route.continue();
    });
    try {
        const publicPage=await anonymous.newPage();
        publicPage.on('pageerror',error=>errors.push(error.message));
        for(const locale of ['fr','en'])for(const width of [1440,390]) {
            await publicPage.setViewportSize({width,height:900});
            const response=await publicPage.goto(base+'/?_locale='+locale);
            assert.equal(response.status(),200);
            assert.equal(await publicPage.locator('.team-maintenance').count(),1);
            assert.equal(await publicPage.locator('a[href*="/equipe/connexion"]').count(),1);
            assert.equal(await publicPage.locator('#booking-search-form').count(),0);
            assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
            assert.match(response.headers()['cache-control'],/no-store/);
        }
        const page=await team.newPage();
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+'/equipe/connexion?_locale=fr');
        await page.locator('#username').fill(credentials.email);
        await page.locator('#password').fill(credentials.password);
        await Promise.all([page.waitForURL(base+'/'),page.locator('form[action="/equipe/connexion"] button').click()]);
        await page.waitForSelector('#booking-search-form');
        assert.equal(await page.locator('.team-maintenance').count(),0);
        assert.equal(await page.locator('[data-team-report]').count(),1);
        assert.equal(await page.locator('#booking-property option:not([value=""])').count(),4);
        const tickets=await team.request.get(base+'/equipe/tickets');
        assert.equal(tickets.status(),200);
        const properties=['lambersart','roubaix','ecrin-noir-croix','l-elegante-douaisienne-4-chambres-2630'];
        for(const slug of properties) {
            const response=await team.request.get(base+'/property/'+slug);
            assert.equal(response.status(),200,'property '+slug);
            assert.ok(!(await response.text()).includes('class="team-maintenance'));
        }
        const calendarResponse=await team.request.get(base+'/api/properties/lambersart/availability?year=2026&month=11');
        assert.equal(calendarResponse.status(),200);
        const calendar=await calendarResponse.json();
        assert.equal(calendar.enabled,true);
        assert.equal(calendar.properties.length,1);
        assert.equal(calendar.properties[0].status,'fresh');
        const publicCalendar=await anonymous.request.get(base+'/api/calendar');
        assert.equal(publicCalendar.status(),503);
        assert.equal((await publicCalendar.json()).error,'site_maintenance');
        await Promise.all([page.waitForURL(base+'/'),page.locator('form[action="/equipe/deconnexion"] button').click()]);
        await page.waitForSelector('.team-maintenance');
        assert.deepEqual(errors,[]);
        const report={email:credentials.email,loginVerified:true,logoutVerified:true,
            authenticatedHomeAndFourPropertiesVerified:true,ticketsAccessible:true,
            anonymousMaintenanceFR_EN_DesktopMobile:true,anonymousAPIsBlocked:true,
            realProviderCalendarRead:{enabled:true,status:'fresh',property:'lambersart'},
            noBookingOrBusinessWritePerformed:true,browserErrors:errors};
        await fs.writeFile(path.join(root,'var/backups/hostinger-team-activation-20261024/TEAM-ACCESS-VERIFIED.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));
    } finally {await browser.close();}
})().catch(error=>{let message=error.message;for(const value of privateValues)message=message.split(value).join('[private]');console.error(message.replace(/https?:\/\/\S+/g,'[URL]'));process.exitCode=1;});
