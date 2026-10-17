import { stayLink, validStay } from './booking-state';
import { guestLuckyAllowed, requestGuestLuckyConsent } from './privacy';
export { parisToday } from './booking-state';
export const language = () => document.documentElement.lang.startsWith('en') ? 'en' : 'fr';
const labels = {
    fr: {
        chooseDates: 'Choisissez vos dates', chooseDeparture: 'Choisissez votre départ', dateHint: 'Sélectionnez une arrivée puis un départ.',
        noArrival: 'Arrivée impossible : pas assez de nuits consécutives pour la durée minimale.', checkingDates: 'Vérification des disponibilités…',
        loading: 'Chargement…', available: 'Disponible', unavailable: 'Indisponible', unverified: 'Non vérifié', checkoutOnly: 'Départ uniquement', candidate: 'Date candidate · séjour à vérifier',
        confirm: 'Disponibilités à confirmer', failed: 'Actualisation impossible — disponibilités à confirmer.',
        refreshed: 'Dernière lecture', choose: 'Choisissez un séjour', quote: 'Vérifier le séjour',
        contact: 'Contactez-nous', total: 'Total du séjour', book: 'Réserver chez GuestLucky', details: 'Voir le logement',
        invalid: 'Vérifiez les dates et le nombre de voyageurs.', guests: 'voyageurs max', nights: 'nuits', minimum: 'nuits min', minimumShort: 'n min',
        empty: 'Aucun logement à afficher.', pending: 'Vérification du séjour…', checked: 'Vérification terminée', past: 'Date passée', properties: 'Logements', preview: 'Devis de test uniquement · réservation désactivée',
        embed: 'Ouvrir le module de réservation', external: 'Ouvrir dans un nouvel onglet', embedTitle: 'Votre réservation chez GuestLucky', embedNote: 'Le module GuestLucky vous permet de poursuivre la réservation. Si le module ne se charge pas, ouvrez-le dans un nouvel onglet.',
        traveler: 'voyageur', travelers: 'voyageurs', retry: 'Vérifier à nouveau', capacity: 'La capacité du logement est dépassée.',
        closed: 'La réservation en ligne est momentanément fermée. Contactez-nous pour organiser votre séjour.',
        quoteNote: 'Montants retournés par GuestLucky · à revalider avant réservation',
        revalidating: 'Revalidation de votre séjour…', priceChanged: 'Le tarif a changé. Consultez ce nouveau devis avant de poursuivre.',
        closeModule: 'Fermer le module', moduleLoading: 'Ouverture du module GuestLucky…', expired: 'Ce devis a expiré. Vérifiez à nouveau votre séjour.',
        refused: 'Ce séjour est indisponible. Modifiez vos dates ou choisissez un autre logement.', tooShort: 'Le séjour est plus court que le minimum requis.',
        subtotal_nightly: 'Hébergement', cleaning_fee: 'Ménage', linen_fee: 'Linge', extra_guest_fee: 'Voyageurs supplémentaires',
        pet_fee: 'Animaux', service_fee: 'Service', discount_amount: 'Remise', tax_amount: 'Taxes'
    },
    en: {
        chooseDates: 'Choose your dates', chooseDeparture: 'Choose your departure', dateHint: 'Select your arrival, then your departure.',
        noArrival: 'Arrival unavailable: not enough consecutive nights for the minimum stay.', checkingDates: 'Checking available dates…',
        loading: 'Loading…', available: 'Available', unavailable: 'Unavailable', unverified: 'Unverified', checkoutOnly: 'Check-out only', candidate: 'Candidate date · stay to be checked',
        confirm: 'Availability to be confirmed', failed: 'Unable to refresh — availability to be confirmed.',
        refreshed: 'Last checked', choose: 'Choose a stay', quote: 'Check your stay',
        contact: 'Contact us', total: 'Stay total', book: 'Book with GuestLucky', details: 'View property',
        invalid: 'Check your dates and number of guests.', guests: 'guests maximum', nights: 'nights', minimum: 'night minimum', minimumShort: 'n min',
        empty: 'No properties to display.', pending: 'Checking your stay…', checked: 'Check complete', past: 'Past date', properties: 'Properties', preview: 'Test quote only · booking disabled',
        embed: 'Open the booking module', external: 'Open in a new tab', embedTitle: 'Your reservation with GuestLucky', embedNote: 'Continue your reservation in the GuestLucky module. If the module does not load, open it in a new tab.',
        traveler: 'guest', travelers: 'guests', retry: 'Check again', capacity: 'The property capacity has been exceeded.',
        closed: 'Online booking is temporarily closed. Contact us to arrange your stay.',
        quoteNote: 'Amounts returned by GuestLucky · checked again before booking',
        revalidating: 'Checking your stay again…', priceChanged: 'The price has changed. Review this new quote before continuing.',
        closeModule: 'Close the module', moduleLoading: 'Opening the GuestLucky module…', expired: 'This quote has expired. Please check your stay again.',
        refused: 'This stay is unavailable. Change your dates or choose another property.', tooShort: 'This stay is shorter than the required minimum.',
        subtotal_nightly: 'Accommodation', cleaning_fee: 'Cleaning', linen_fee: 'Linen', extra_guest_fee: 'Extra guests',
        pet_fee: 'Pets', service_fee: 'Service', discount_amount: 'Discount', tax_amount: 'Taxes'
    }
};
export const t = key => labels[language()][key] || key;
export const money = value => new Intl.NumberFormat(language(), {style: 'currency', currency: 'EUR'}).format(value);
export const node = (tag, text = '', className = '') => {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
};
const quotes = new WeakMap();
let quoteId = 0;
export function clearQuotes(container) {
    const state = quotes.get(container);
    if (state) { state.active = false; clearTimeout(state.timer); state.request?.abort(); state.closeModule?.(); }
    quotes.delete(container);
    container.replaceChildren();
    container.removeAttribute('aria-busy');
}
export function showBookingError(container, key = 'failed', retry) {
    clearQuotes(container);
    const box = node('div', '', 'booking-feedback');
    box.append(node('p', t(key)));
    const contact = node('a', t('contact'), 'booking-external-link'); contact.href = stayLink('/contact-us');
    box.append(contact);
    if (retry) { const button = node('button', t('retry'), 'btn btn-outline-secondary'); button.type = 'button'; button.addEventListener('click', retry); box.append(button); }
    container.append(box);
}
function localBookingUrl(item, criteria) {
    if (!item.bookingUrl || !validStay(criteria, item.maxGuests)) return null;
    const url = new URL(item.bookingUrl, location.origin);
    if (url.origin !== location.origin || url.pathname !== '/reservation/' + encodeURIComponent(item.slug)) return null;
    if (['arrivalDate', 'departureDate', 'guests'].some(key => url.searchParams.get(key) !== String(criteria[key]))) return null;
    return url.pathname + url.search;
}
function quoteSignature(item) {
    return JSON.stringify([item.price, item.currency, Object.entries(item.fees || {}).sort(([a], [b]) => a.localeCompare(b))]);
}
function showBookingModal(module, frame, item, summary, bookingUrl, open, feedback, state, current, expire) {
    state.closeModule?.();
    const listeners = new AbortController();
    const on = (element, type, callback) => element.addEventListener(type, callback, {signal: listeners.signal});
    let closed = false;
    const closeModal = (restoreFocus = false) => {
        if (closed) return;
        closed = true; listeners.abort();
        module.close(); module.replaceChildren(); module.remove();
        document.documentElement.classList.remove('booking-modal-open');
        state.closeModule = null;
        open.setAttribute('aria-expanded', 'false'); open.removeAttribute('aria-controls'); open.disabled = !current(); feedback.textContent = '';
        if (restoreFocus && open.isConnected) open.focus();
    };
    state.closeModule = closeModal;
    const header = node('header', '', 'booking-modal-header');
    const info = node('div');
    const title = node('h2', t('embedTitle')); title.id = module.id + '-title';
    info.append(title, node('p', item.name + ' · ' + summary, 'booking-modal-summary'));
    const close = node('button', '×', 'booking-modal-close'); close.type = 'button'; close.setAttribute('aria-label', t('closeModule'));
    header.append(info, close);
    module.setAttribute('aria-labelledby', title.id);
    const footer = node('footer', '', 'booking-modal-footer');
    const status = node('p', t('moduleLoading')); status.setAttribute('role', 'status');
    const fallback = node('a', t('external'), 'booking-external-link');
    fallback.href = bookingUrl; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.dataset.turbo = 'false';
    on(fallback, 'click', event => { if (!current()) { event.preventDefault(); expire(); } });
    footer.append(status, fallback);
    on(close, 'click', () => closeModal(true));
    on(module, 'cancel', event => { event.preventDefault(); closeModal(true); });
    on(module, 'close', () => closeModal(true));
    on(document, 'turbo:before-cache', () => closeModal());
    on(document, 'privacy:change', event => { if (!event.detail?.guestlucky) closeModal(true); });
    on(frame, 'load', () => { status.textContent = ''; feedback.textContent = t('embedNote'); });
    module.append(header, frame, footer); document.body.append(module);
    module.showModal(); document.documentElement.classList.add('booking-modal-open');
    open.setAttribute('aria-expanded', 'true'); open.setAttribute('aria-controls', module.id); feedback.textContent = t('moduleLoading'); close.focus();
}
export function renderQuotes(container, data, options = {}) {
    clearQuotes(container);
    const criteria = {arrivalDate: data.arrivalDate || options.criteria?.arrivalDate || '', departureDate: data.departureDate || options.criteria?.departureDate || '', guests: String(data.guests || options.criteria?.guests || ''), slug: options.criteria?.slug || ''};
    const state = {active: true, issuedAt: Date.now(), request: null}; quotes.set(container, state);
    const current = () => state.active && container.isConnected && quotes.get(container) === state && Date.now() - state.issuedAt < 60000 && (!options.isCurrent || options.isCurrent());
    const summary = node('p', '', 'booking-criteria-summary');
    if (validStay(criteria)) {
        const format = value => new Intl.DateTimeFormat(language(), {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
        summary.textContent = `${format(criteria.arrivalDate)} → ${format(criteria.departureDate)} · ${criteria.guests} ${t(Number(criteria.guests) === 1 ? 'traveler' : 'travelers')}`;
        container.append(summary);
    }
    if (!data.enabled) container.append(node('p', t('closed'), 'booking-feedback'));
    const rows = [...(data.availability || [])].sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available'));
    const hasAvailable = rows.some(item => data.enabled === true && item.status === 'available' && item.available === true && Number.isFinite(item.price));
    if (!rows.length) container.append(node('p', t('empty')));
    for (const item of rows) {
        const available = data.enabled === true && item.status === 'available' && item.available === true && Number.isFinite(item.price);
        const status = !data.enabled ? 'unverified' : available ? 'available' : item.status === 'unavailable' ? 'unavailable' : 'unverified';
        const card = node('article', '', 'booking-quote-card'); card.dataset.state = status;
        const heading = node('div', '', 'booking-quote-heading');
        if (item.image) { const image = node('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; image.width = 80; image.height = 64; heading.append(image); }
        const info = node('div'); const title = node('a', item.name, 'booking-property-title');
        title.href = stayLink(item.detailsUrl, {...criteria, slug: item.slug});
        info.append(title, node('p', `${item.city} · ${item.maxGuests} ${t('guests')}`, 'small text-muted')); heading.append(info); card.append(heading);
        card.append(node('p', t(status), 'booking-state'));
        if (status === 'unavailable' && Number(criteria.guests) > item.maxGuests) card.append(node('p', t('capacity'), 'small text-muted'));
        if (available) {
            const breakdown = node('dl', '', 'booking-breakdown');
            for (const [key, amount] of Object.entries(item.fees || {})) {
                if (!Number.isFinite(amount) || !amount) continue;
                breakdown.append(node('dt', t(key)), node('dd', (key === 'discount_amount' ? '−' : '') + money(amount)));
            }
            card.append(breakdown, node('p', t('total') + ' · ' + money(item.price), 'booking-total'), node('p', item.nights + ' ' + t('nights') + ' · ' + t('quoteNote'), 'small text-muted'));
            if (data.preview) card.append(node('p', t('preview'), 'calendar-preview-note'));
            const bookingUrl = !data.preview && localBookingUrl(item, criteria);
            if (bookingUrl) {
                const actions = node('div', '', 'booking-module-actions');
                const open = node('button', t('embed'), 'btn btn-primary text-white'); open.type = 'button'; open.setAttribute('aria-expanded', 'false'); open.setAttribute('aria-haspopup', 'dialog');
                const book = node('a', t('external'), 'booking-external-link'); book.href = bookingUrl; book.dataset.turbo = 'false'; book.target = '_blank'; book.rel = 'noopener noreferrer';
                const module = node('dialog', '', 'booking-module booking-modal'); module.id = 'booking-module-' + ++quoteId;
                const feedback = node('p', '', 'booking-module-status'); feedback.setAttribute('role', 'status');
                book.addEventListener('click', event => { if (!current()) { event.preventDefault(); expire(); } });
                open.addEventListener('click', async () => {
                    if (!current() || !container.contains(card)) { expire(); return; }
                    if (module.querySelector('iframe') || state.request) return;
                    const request = new AbortController(); state.request = request;
                    try {
                        const allowed = await requestGuestLuckyConsent({signal: request.signal, trigger: open});
                        if (!allowed || !current() || request.signal.aborted) return;
                        open.disabled = true; feedback.textContent = t('revalidating'); card.setAttribute('aria-busy', 'true');
                        const params = new URLSearchParams({...criteria, slug: item.slug});
                        const response = await fetch((options.quoteUrl || '/api/availability') + '?' + params, {signal: request.signal, cache: 'no-store'});
                        if (!response.ok) throw new Error(response.status === 422 || response.status === 409 ? 'refused' : 'failed');
                        const fresh = await response.json(); if (!current() || request.signal.aborted) return;
                        const result = fresh.availability?.find(row => row.slug === item.slug);
                        if (!fresh.enabled || fresh.preview || result?.status !== 'available' || result?.available !== true || !Number.isFinite(result.price) || !localBookingUrl(result, criteria)) {
                            renderQuotes(container, fresh, options); return;
                        }
                        if (quoteSignature(result) !== quoteSignature(item)) { renderQuotes(container, fresh, options); container.prepend(node('p', t('priceChanged'), 'booking-feedback')); return; }
                        if (!guestLuckyAllowed()) return;
                        const frame = node('iframe', '', 'guestlucky-booking-frame'); frame.title = t('embedTitle') + ' · ' + item.name;
                        // The local redirect STILL checks a fresh quote server-side.
                        frame.referrerPolicy = 'no-referrer';
                        frame.src = localBookingUrl(result, criteria);
                        showBookingModal(module, frame, item, summary.textContent, frame.src, open, feedback, state, current, expire);
                    } catch (error) {
                        if (error.name !== 'AbortError' && current()) showBookingError(container, error.message === 'refused' ? 'refused' : 'failed', options.onRefresh);
                    } finally { state.request = null; if (quotes.get(container) === state) { open.disabled = !current() || Boolean(module.querySelector('iframe')); card.removeAttribute('aria-busy'); } }
                });
                actions.append(open, book); card.append(actions, feedback);
            }
        }
        container.append(card);
    }
    const expire = () => {
        if (quotes.get(container) !== state || !state.active) return;
        state.active = false; state.request?.abort();
        container.querySelectorAll('.booking-module-actions button').forEach(button => button.disabled = true);
        container.querySelectorAll('.booking-module-actions a').forEach(link => { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); });
        const notice = node('div', '', 'booking-feedback'); notice.append(node('p', t('expired')));
        if (options.onRefresh) { const refresh = node('button', t('retry'), 'btn btn-outline-secondary'); refresh.type = 'button'; refresh.addEventListener('click', options.onRefresh); notice.append(refresh); }
        container.append(notice);
    };
    if (hasAvailable && !data.preview) state.timer = setTimeout(expire, 60000);
    if (!hasAvailable) { const contact = node('a', t('contact'), 'booking-external-link'); contact.href = stayLink('/contact-us', criteria); container.append(contact); }
}
