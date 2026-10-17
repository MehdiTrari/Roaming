// node --experimental-vm-modules tests/browser/calendar-rules.cjs
// Load the production ES modules unchanged, using Node's native module linker.
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const modules = new Map();
    const load = file => {
        file = path.resolve(file); if (!file.endsWith('.js')) file += '.js';
        if (!modules.has(file)) modules.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {identifier: file}));
        return modules.get(file);
    };
    const module = load('assets/calendar-availability.js');
    await module.link((specifier, parent) => load(path.resolve(path.dirname(parent.identifier), specifier))); await module.evaluate();
    const {CalendarAvailability, monthIndex} = module.namespace;
    const properties = [{slug: 'a', capacity: 4}, {slug: 'b', capacity: 8}];
    const date = n => { const day = new Date(); day.setUTCMonth(day.getUTCMonth() + 1, n); return day.toISOString().slice(0, 10); };
    const index = monthIndex(date(5)), stay = {arrivalDate: date(5), departureDate: date(7), guests: '2'};
    const rows = (a, b, status = 'fresh', minStay = 2) => properties.map((property, i) => ({slug: property.slug, status: i ? status : 'fresh', days: [5, 6, 7, 8].map(n => ({date: date(n), available: (i ? b : a).includes(n), minStay, price: 100}))}));
    const model = new CalendarAvailability(properties);
    const empty = new CalendarAvailability([]); assert.equal(empty.state(date(5)), 'unknown'); assert.equal(empty.issue(stay), 'empty');
    const ingest = (a, b, status, minStay) => model.ingest(index, {enabled: true, properties: rows(a, b, status, minStay)});
    ingest([], []); assert.equal(model.state(date(5)), 'closed'); assert.equal(model.issue(stay), 'refused');
    ingest([5, 6], []); assert.equal(model.state(date(5)), 'open'); assert.equal(model.issue(stay), null);
    ingest([], [], 'unverified'); assert.equal(model.state(date(5)), 'unknown'); assert.equal(model.issue(stay), 'unverified');
    ingest([5, 6], [], 'unverified'); assert.equal(model.state(date(5)), 'open'); assert.equal(model.issue(stay), null);
    ingest([5], [6]); assert.equal(model.state(date(5)), 'open'); assert.equal(model.state(date(6)), 'open'); assert.equal(model.issue(stay), 'refused', 'isolated nights on different properties are never one stay');
    assert.equal(model.canArrive(date(5), stay), false, 'an isolated night is not an arrival for a two-night minimum');
    assert.equal(model.select(date(5), {...stay, arrivalDate: '', departureDate: ''}).arrivalDate, '');
    ingest([5, 6], [5]);
    assert.equal(model.canArrive(date(5), stay), true);
    assert.equal(model.canArrive(date(5), {...stay, guests: '5'}), false, 'only an eligible property can supply all nights');
    ingest([5], [], 'fresh', 1);
    assert.equal(model.canArrive(date(5), stay), true, 'a genuine one-night minimum is respected');
    assert.equal(model.canDepart(date(6), {...stay, departureDate: ''}), true, 'an occupied day can be the checkout of a one-night stay');
    ingest([5, 6], [], 'fresh', 3);
    assert.equal(model.canArrive(date(5), stay), false, 'three-night minimum needs three consecutive nights');
    ingest([5, 6, 7], [], 'fresh', 3);
    assert.equal(model.canArrive(date(5), stay), true);
    ingest([5, 6], [5, 6]); assert.equal(model.issue({...stay, guests: '9'}), 'capacity');
    assert.equal(model.issue({...stay, guests: '5'}, [properties[0]]), 'capacity');
    ingest([5, 6], [5, 6], 'fresh', 3); assert.equal(model.issue(stay), 'tooShort');
    ingest([5, 6], [5, 6]);
    const arrival = {...stay, departureDate: ''};
    assert.equal(model.canDepart(date(7), arrival), true, 'occupied checkout night is excluded');
    assert.equal(model.checkoutOnly(date(7), arrival), true);
    assert.equal(model.checkoutOnly(date(6), arrival), false, 'the preceding available night is not checkout-only');
    assert.equal(model.canDepart(date(6), arrival), false, 'minimum nights');
    assert.equal(model.canDepart(date(8), arrival), false, 'cannot cross occupied night');
    assert.equal(model.select(date(7), arrival).departureDate, date(7));
    assert.equal(model.select(date(7), {...arrival, arrivalDate: ''}).arrivalDate, '', 'checkout cannot become an arrival');
    assert.deepEqual(model.select(date(8), arrival), arrival, 'invalid departure leaves selection intact');
    model.ingest(index, {enabled: true, properties: rows([5, 6], [5, 6]).map(row => ({...row, days: row.days.filter(day => day.date !== date(6))}))});
    assert.equal(model.canDepart(date(7), arrival), false); assert.equal(model.issue(stay), 'unverified');
    model.ingest(index, {enabled: false, properties: rows([5, 6], [5, 6])}); assert.equal(model.state(date(5)), 'unknown');
    model.clear(); assert.equal(model.issue(stay), 'unverified');
    const last = new Date(date(5) + 'T00:00:00Z'); last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const first = new Date(last); first.setUTCDate(first.getUTCDate() + 1);
    const second = new Date(first); second.setUTCDate(second.getUTCDate() + 1);
    const cross = {arrivalDate: last.toISOString().slice(0, 10), departureDate: second.toISOString().slice(0, 10), guests: '2'};
    for (const value of [last, first]) {
        const dateValue = value.toISOString().slice(0, 10);
        model.ingest(monthIndex(dateValue), {enabled: true, properties: [{slug: 'a', status: 'fresh', days: [{date: dateValue, available: true, minStay: 2, price: 100}]}]});
    }
    assert.equal(model.issue(cross, [properties[0]]), null, 'cross-month stay');
    assert.equal(model.canArrive(cross.arrivalDate, cross, [properties[0]]), true, 'arrival continuity crosses months');
    // Expiry, request deduplication and cancellation use the same production loader.
    const now = Date.now; Date.now = () => now() + 66000;
    assert.equal(model.issue(cross, [properties[0]]), 'unverified'); Date.now = now;
    const originalFetch = global.fetch, originalLocation = global.location;
    let calls = 0; global.location = {origin: 'http://local.test'};
    global.fetch = async (_, {signal}) => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); return {ok: true, json: async () => ({enabled: true, properties: rows([5, 6], [5, 6])})}; };
    try {
        model.clear(); const controller = new AbortController();
        await Promise.all([model.load(index, '/api/calendar', controller.signal), model.load(index, '/api/calendar', controller.signal)]);
        await model.load(index, '/api/calendar', controller.signal); assert.equal(calls, 1);
        const request = new AbortController(), promise = model.load(index + 1, '/api/calendar', request.signal); request.abort();
        await assert.rejects(promise, {name: 'AbortError'}); assert.equal(model.months.has(index + 1), false);
        model.clear();
        const lastNight = new Date(date(5) + 'T00:00:00Z'); lastNight.setUTCMonth(lastNight.getUTCMonth() + 1, 0);
        const lastDate = lastNight.toISOString().slice(0, 10);
        model.ingest(index, {enabled: true, properties: [{slug: 'a', status: 'fresh', days: [{date: lastDate, available: true, minStay: 2}]}]});
        assert.equal(model.canArrive(lastDate, stay, [properties[0]]), false, 'unknown required nights are not assumed free');
        let lookaheadCalls = 0;
        global.fetch = async url => {
            lookaheadCalls++;
            const endpoint = new URL(url), y = Number(endpoint.searchParams.get('year')), m = Number(endpoint.searchParams.get('month'));
            return {ok: true, json: async () => ({enabled: true, properties: [{slug: 'a', status: 'fresh', days: [{date: `${y}-${String(m).padStart(2, '0')}-01`, available: true, minStay: 2}]}]})};
        };
        await model.loadArrivalNights([index], '/api/calendar', controller.signal);
        assert.equal(model.canArrive(lastDate, stay, [properties[0]]), true, 'lookahead verifies the first night of the following month');
        await model.loadArrivalNights([index], '/api/calendar', controller.signal);
        assert.equal(lookaheadCalls, 1, 'lookahead uses the existing cache');
    } finally { global.fetch = originalFetch; global.location = originalLocation; }
    console.log('PASS shared calendar rules: global states, provider error, no mixed-property stay, capacity/minStay, checkout boundaries, unknown nights, cross-month, expiry/cache/deduplication/abort. No network.');
})().catch(error => { console.error(error); process.exitCode = 1; });
