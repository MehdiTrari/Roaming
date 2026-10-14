export function parisToday() {
    return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
}

export const stayKeys = ['arrivalDate', 'departureDate', 'guests', 'slug'];
export function readStay() {
    const params = new URL(location.href).searchParams;
    return Object.fromEntries(stayKeys.map(key => [key, params.get(key) || '']));
}
export function writeStay(criteria) {
    const url = new URL(location.href);
    for (const key of stayKeys) {
        if (criteria[key]) url.searchParams.set(key, criteria[key]); else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
    document.dispatchEvent(new CustomEvent('booking:criteria-change'));
}
export function stayLink(href, criteria = readStay()) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) return href;
    for (const key of stayKeys) {
        if (criteria[key]) url.searchParams.set(key, criteria[key]); else url.searchParams.delete(key);
    }
    const match = url.pathname.match(/^\/property\/([^/]+)$/);
    if (match) url.searchParams.set('slug', decodeURIComponent(match[1]));
    return url.pathname + url.search + url.hash;
}
export function bookingHorizon() {
    const [year, month] = parisToday().split('-').map(Number);
    return new Date(Date.UTC(year, month + 11, 1)).toISOString().slice(0, 10);
}
export function realDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validStay(criteria, capacity = 20) {
    const {arrivalDate: arrival, departureDate: departure, guests} = criteria;
    return realDate(arrival) && realDate(departure) && arrival >= parisToday() && departure > arrival && departure <= bookingHorizon()
        && /^\d+$/.test(String(guests)) && Number(guests) >= 1 && Number(guests) <= Math.min(20, capacity);
}
