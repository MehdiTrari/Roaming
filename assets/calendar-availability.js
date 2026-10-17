import {validStay, realDate, parisToday, bookingHorizon} from './booking-state';

export const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
export const nightsBetween = (arrival, departure) => Math.round((Date.parse(departure) - Date.parse(arrival)) / 86400000);
export const addNights = (date, nights) => {
    const departure = new Date(date + 'T00:00:00Z');
    departure.setUTCDate(departure.getUTCDate() + nights);
    return departure.toISOString().slice(0, 10);
};
export function stayNights(arrival, departure) {
    const dates = [];
    if (!realDate(arrival) || !realDate(departure) || departure <= arrival) return dates;
    for (const cursor = new Date(arrival + 'T00:00:00Z'); cursor.toISOString().slice(0, 10) < departure; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
    return dates;
}

// Shared selection/validation over GuestLucky nights; never infer supplier restrictions.
export class CalendarAvailability {
    constructor(properties) { this.properties = properties; this.months = new Map(); this.pending = new Map(); }
    clear() { this.months.clear(); }
    ingest(index, payload) {
        this.months.set(index, {enabled: payload.enabled === true, rows: payload.properties || [], readAt: Date.now()});
    }
    day(slug, date) {
        const month = this.months.get(monthIndex(date));
        const row = month?.rows.find(item => item.slug === slug);
        if (!month?.enabled || Date.now() - month.readAt > 65000 || row?.status !== 'fresh') return null;
        return row.days?.find(day => day.date === date) || null;
    }
    state(date, properties = this.properties) {
        const days = properties.map(property => this.day(property.slug, date));
        if (days.some(day => day?.available === true)) return 'open';
        return days.length && days.every(day => day?.available === false) ? 'closed' : 'unknown';
    }
    propertyIssue(stay, property, strict) {
        if (Number(stay.guests) > property.capacity) return 'capacity';
        const arrival = this.day(property.slug, stay.arrivalDate);
        if (arrival && nightsBetween(stay.arrivalDate, stay.departureDate) < arrival.minStay) return 'tooShort';
        const dates = stayNights(stay.arrivalDate, stay.departureDate);
        if (dates.some(date => this.day(property.slug, date)?.available === false)) return 'refused';
        if (dates.some(date => !this.day(property.slug, date) && (strict || this.months.has(monthIndex(date))))) return 'unverified';
        return null;
    }
    issue(stay, properties = this.properties, strict = true) {
        if (!properties.length) return 'empty';
        if (properties.every(property => Number(stay.guests) > property.capacity)) return 'capacity';
        if (!stay.arrivalDate || !stay.departureDate) return null;
        if (!validStay(stay, Math.max(...properties.map(property => property.capacity)))) return 'invalid';
        const issues = properties.map(property => this.propertyIssue(stay, property, strict));
        if (issues.includes(null)) return null;
        if (issues.includes('unverified')) return 'unverified';
        if (issues.filter(issue => issue !== 'capacity').every(issue => issue === 'tooShort')) return 'tooShort';
        return 'refused';
    }
    canDepart(date, stay, properties = this.properties) {
        return Boolean(stay.arrivalDate && !stay.departureDate && date > stay.arrivalDate && !this.issue({...stay, departureDate: date}, properties));
    }
    canArrive(date, stay, properties = this.properties) {
        if (!realDate(date) || date < parisToday()) return false;
        return properties.some(property => {
            const day = this.day(property.slug, date);
            if (!day?.available || !Number.isInteger(day.minStay) || day.minStay < 1) return false;
            const candidate = {...stay, arrivalDate: date, departureDate: addNights(date, day.minStay)};
            // All nights must belong to the SAME eligible property. Checkout
            // is excluded: a new guest may arrive on the departure day.
            return !this.issue(candidate, [property]);
        });
    }
    select(date, stay, properties = this.properties) {
        if (this.canDepart(date, stay, properties)) return {...stay, departureDate: date};
        if (stay.arrivalDate && !stay.departureDate && date > stay.arrivalDate) return stay;
        if (!this.canArrive(date, stay, properties)) return stay;
        return {...stay, arrivalDate: date, departureDate: ''};
    }
    checkoutOnly(date, stay, properties = this.properties) {
        return this.canDepart(date, stay, properties) && !this.canArrive(date, stay, properties);
    }
    async load(index, url, signal) {
        const key = `${url}:${index}`;
        const cached = this.months.get(index);
        if (cached?.key === key && cached.enabled && cached.rows.every(row => row.status === 'fresh') && Date.now() - cached.readAt < 60000) return cached;
        const pending = this.pending.get(key);
        if (pending && !pending.signal.aborted) return pending.promise;
        const promise = (async () => {
            const endpoint = new URL(url, location.origin);
            endpoint.searchParams.set('year', Math.floor(index / 12)); endpoint.searchParams.set('month', index % 12 + 1);
            const response = await fetch(endpoint, {signal, cache: 'no-store'});
            if (!response.ok) throw new Error('calendar');
            const payload = await response.json();
            if (signal.aborted) return;
            this.ingest(index, payload); this.months.get(index).key = key;
            return this.months.get(index);
        })();
        this.pending.set(key, {signal, promise});
        try { return await promise; } finally { if (this.pending.get(key)?.promise === promise) this.pending.delete(key); }
    }
    async loadStay(stay, url, signal) {
        const indexes = [...new Set(stayNights(stay.arrivalDate, stay.departureDate).map(monthIndex))];
        return Promise.all(indexes.map(index => this.load(index, url, signal)));
    }
    async loadArrivalNights(indexes, url, signal) {
        // Read beyond the visible months when a minimum stay crosses their
        // edge. Never mark a valid month-end arrival unavailable just because
        // its remaining nights have not been displayed yet.
        const needed = new Set();
        for (const index of indexes) for (const row of this.months.get(index)?.rows || []) {
            if (row.status !== 'fresh') continue;
            for (const day of row.days || []) {
                if (!day.available || day.date < parisToday() || !Number.isInteger(day.minStay) || day.minStay < 1) continue;
                const departure = addNights(day.date, day.minStay);
                if (departure > bookingHorizon()) continue;
                for (const date of stayNights(day.date, departure)) if (!indexes.includes(monthIndex(date))) needed.add(monthIndex(date));
            }
        }
        return Promise.all([...needed].map(index => this.load(index, url, signal)));
    }
}
