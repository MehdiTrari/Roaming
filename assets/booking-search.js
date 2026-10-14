import flatpickr from 'flatpickr';
import { French } from 'flatpickr/dist/l10n/fr.js';
import { language, t, renderQuotes, clearQuotes, showBookingError } from './booking-ui';
import { readStay, writeStay, validStay, realDate, parisToday, bookingHorizon } from './booking-state';
import {CalendarAvailability} from './calendar-availability';

let cleanup = () => {};
function initialize() {
    cleanup();
    if (document.documentElement.hasAttribute('data-turbo-preview')) return;
    const form = document.getElementById('booking-search-form');
    if (!form) return;
    const listeners = new AbortController();
    const on = (element, type, callback, options = {}) => element?.addEventListener(type, callback, {...options, signal: listeners.signal});
    const arrival = document.getElementById('arrival-date'), departure = document.getElementById('departure-date');
    const guests = document.getElementById('guests-count'), property = document.getElementById('booking-property');
    const results = document.getElementById('results-list'), status = document.getElementById('booking-search-status');
    const submit = form.querySelector('[type="submit"]');
    const panel = document.getElementById('date-panel'), toggle = document.getElementById('date-toggle');
    const display = document.getElementById('date-display-text'), dateButton = document.getElementById('date-display');
    const guestsButton = document.getElementById('guests-display'), guestsPanel = document.getElementById('guests-panel');
    const guestsToggle = document.getElementById('guests-toggle'), currentGuests = document.getElementById('guests-current');
    const propertyButton = document.getElementById('property-display'), propertyPanel = document.getElementById('property-panel');
    const propertyToggle = document.getElementById('property-toggle');
    const panels = [[panel, dateButton], [guestsPanel, guestsButton], [propertyPanel, propertyButton]];
    const saved = readStay();
    property.value = Array.from(property.options).some(option => option.value === saved.slug) ? saved.slug : '';
    guests.value = Array.from(guests.options).some(option => option.value === saved.guests) ? saved.guests : '1';
    let pending, calendarRequest, picker;
    const published = form.dataset.availabilityEnabled === 'true';
    const availability = new CalendarAvailability(Array.from(property.options).filter(option => option.value).map(option => ({slug: option.value, capacity: Number(option.dataset.capacity)})));
    const activeProperties = () => availability.properties.filter(item => !property.value || item.slug === property.value);
    const calendarUrl = () => property.value ? property.selectedOptions[0].dataset.calendarUrl : form.dataset.calendarUrl;
    const calendarStatus = document.getElementById('date-availability-status');
    const clearButton = document.getElementById('date-cancel'), applyButton = document.getElementById('date-apply');
    const criteria = () => ({arrivalDate: arrival.value, departureDate: departure.value, guests: guests.value, slug: property.value});
    const capacity = () => Number(property.selectedOptions[0].dataset.capacity || guests.options[guests.options.length - 1].value);
    const positionPanel = (element, button) => {
        if (!element.open) return;
        const viewport = window.visualViewport;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const offsetX = viewport?.offsetLeft || 0, offsetY = viewport?.offsetTop || 0;
        const small = width < 768, gap = 12;
        const header = document.querySelector('header.sticky-top')?.getBoundingClientRect();
        const topLimit = offsetY + (small ? gap : Math.max(gap, (header?.bottom || 0) + gap));
        element.style.maxHeight = `${Math.max(44, offsetY + height - gap - topLimit)}px`;
        let rect = button.getBoundingClientRect();
        // Keep desktop surfaces below their field; make room by scrolling the page.
        if (!small) {
            const needed = rect.bottom + gap + element.getBoundingClientRect().height - (offsetY + height - gap);
            const scroll = Math.max(0, Math.min(needed, rect.top - topLimit));
            if (scroll > 1) { window.scrollBy({top: scroll, behavior: 'instant'}); rect = button.getBoundingClientRect(); }
            element.style.maxHeight = `${Math.max(44, offsetY + height - gap - rect.bottom - gap)}px`;
        }
        const box = element.getBoundingClientRect();
        let top = rect.bottom + gap;
        if (small) top = offsetY + height - gap - box.height;
        element.style.top = `${top}px`;
        element.style.left = `${small ? offsetX + (width - box.width) / 2 : Math.max(offsetX + gap, Math.min(rect.left, offsetX + width - box.width - gap))}px`;
    };
    const setPanel = (element, button, open) => {
        if (open === element.open) return;
        if (open) {
            element.classList.remove('d-none'); element.showModal(); positionPanel(element, button);
        } else {
            element.close(); element.classList.add('d-none'); button.focus({preventScroll: true});
        }
        button.setAttribute('aria-expanded', String(open));
    };
    for (const [element, button] of panels) {
        on(element, 'cancel', event => { event.preventDefault(); setPanel(element, button, false); });
        on(element, 'click', event => {
            const rect = element.getBoundingClientRect();
            if (event.target === element && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setPanel(element, button, false);
        });
        element.querySelectorAll('[data-search-dismiss]').forEach(close => on(close, 'click', () => setPanel(element, button, false)));
    }
    const reposition = () => panels.forEach(([element, button]) => positionPanel(element, button));
    on(window, 'resize', reposition); on(window, 'scroll', reposition);
    on(window.visualViewport, 'resize', reposition); on(window.visualViewport, 'scroll', reposition);
    const busy = value => { submit.disabled = value; form.setAttribute('aria-busy', String(value)); results.setAttribute('aria-busy', String(value)); };
    const syncGuests = () => {
        document.getElementById('guests-display-text').textContent = `${guests.value} ${t(Number(guests.value) === 1 ? 'traveler' : 'travelers')}`;
        currentGuests.value = guests.value;
        document.getElementById('guests-decrease').disabled = Number(guests.value) <= 1;
        document.getElementById('guests-increase').disabled = Number(guests.value) >= capacity();
    };
    const syncProperty = () => {
        document.getElementById('property-display-text').textContent = property.selectedOptions[0].textContent;
        propertyPanel.querySelectorAll('[data-property-option]').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.propertyOption === property.value)));
    };
    const changed = () => {
        pending?.abort(); pending = null; clearQuotes(results); busy(false); writeStay(criteria()); syncGuests(); syncProperty();
        status.textContent = Number(guests.value) > capacity() ? `${t('capacity')} (${capacity()} ${t('guests')})` : '';
        document.getElementById('booking-results').classList.add('d-none');
        refreshCalendar();
    };
    const formatDates = dates => { display.textContent = dates.map(date => date.toLocaleDateString(language())).join(' → ') || t('choose'); };
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const disabledDate = value => {
        const date = dateKey(value), stay = criteria();
        if (!published || calendarRequest) return true;
        if (date === stay.departureDate && !availability.issue(stay, activeProperties())) return false;
        if (stay.arrivalDate && !stay.departureDate && date > stay.arrivalDate) return availability.state(date, activeProperties()) !== 'open' && !availability.canDepart(date, stay, activeProperties());
        return availability.state(date, activeProperties()) !== 'open';
    };
    const refreshCalendar = () => {
        clearButton.disabled = !arrival.value && !departure.value;
        const issue = availability.issue(criteria(), activeProperties());
        applyButton.disabled = !published || Boolean(calendarRequest) || !validStay(criteria(), capacity()) || Boolean(issue);
        if (!calendarRequest) calendarStatus.textContent = !published ? t('closed') : !availability.properties.length ? t('empty') : issue && arrival.value && departure.value ? t(issue) : t('dateHint');
        if (published && !calendarRequest && arrival.value && !departure.value) {
            const minimums = activeProperties().filter(property => Number(guests.value) <= property.capacity).map(property => availability.day(property.slug, arrival.value)).filter(day => day?.available).map(day => day.minStay);
            if (minimums.length) calendarStatus.textContent += ` · ${Math.min(...minimums)} ${t('minimum')}`;
        }
        document.getElementById('date-calendar-contact').hidden = published && !issue;
        if (picker) {
            const selected = [arrival.value, departure.value].filter(realDate);
            if (JSON.stringify(picker.selectedDates.map(dateKey)) !== JSON.stringify(selected)) {
                picker.set('disable', []); picker.setDate(selected, false); picker.set('disable', [disabledDate]);
            } else picker.redraw();
        }
        if (panel.open) positionPanel(panel, dateButton);
    };
    const loadCalendar = async () => {
        if (!published || !availability.properties.length || !picker || !panel.open) { refreshCalendar(); return; }
        calendarRequest?.abort(); const request = new AbortController(); calendarRequest = request;
        calendarStatus.textContent = t('loading'); calendarStatus.dataset.state = 'loading'; refreshCalendar();
        const index = picker.currentYear * 12 + picker.currentMonth;
        try {
            await Promise.all([index, index + 1].map(month => availability.load(month, calendarUrl(), request.signal)));
            if (request.signal.aborted) return;
            if (availability.issue(criteria(), activeProperties())) clearQuotes(results);
            calendarStatus.dataset.state = [index, index + 1].every(month => activeProperties().every(property => availability.months.get(month)?.rows.some(row => row.slug === property.slug && row.status === 'fresh'))) ? 'fresh' : 'unverified';
        } catch (error) {
            if (error.name === 'AbortError') return;
            availability.clear(); calendarStatus.dataset.state = 'unverified';
        } finally {
            if (calendarRequest === request) {
                calendarRequest = null; refreshCalendar();
                if ([index, index + 1].some(month => availability.months.get(month)?.enabled === false)) { calendarStatus.textContent = t('closed'); applyButton.disabled = true; document.getElementById('date-calendar-contact').hidden = false; }
                else if (calendarStatus.dataset.state === 'unverified') { calendarStatus.textContent = t('failed'); document.getElementById('date-calendar-contact').hidden = false; }
            }
        }
    };
    const monthChanged = () => { pending?.abort(); pending = null; clearQuotes(results); busy(false); loadCalendar(); };
    const calendarTimer = setInterval(() => { if (!document.hidden && panel.open) loadCalendar(); }, 60000);
    on(document, 'visibilitychange', () => { if (!document.hidden && panel.open) loadCalendar(); });
    picker = flatpickr(document.getElementById('date-range'), {
        mode: 'range', inline: true, minDate: parisToday(), maxDate: bookingHorizon(), dateFormat: 'Y-m-d',
        locale: language() === 'fr' ? French : 'default', appendTo: document.getElementById('date-calendar'),
        disable: [disabledDate], onMonthChange: monthChanged, onYearChange: monthChanged,
        onDayCreate(_, __, instance, element) {
            const date = dateKey(element.dateObj), state = availability.state(date, activeProperties());
            element.dataset.date = date;
            if (date < parisToday()) return;
            element.classList.add('stay-' + state);
            const checkout = availability.checkoutOnly(date, criteria(), activeProperties());
            const description = t(checkout ? 'checkoutOnly' : state === 'open' ? 'candidate' : state === 'closed' ? 'unavailable' : 'unverified');
            element.setAttribute('aria-label', `${date}, ${description}`); element.title = element.getAttribute('aria-label');
            if (state === 'unknown') element.dataset.hint = '?';
            if (checkout) { element.classList.add('stay-checkout-only'); element.dataset.hint = t('checkoutOnly'); }
        },
        onChange(dates, _, instance) {
            let selected = dates.map(date => instance.formatDate(date, 'Y-m-d'));
            if (selected.length === 1 && availability.state(selected[0], activeProperties()) !== 'open') selected = [arrival.value, departure.value].filter(Boolean);
            if (selected.length === 2) {
                if (!arrival.value) {
                    if (availability.issue({...criteria(), arrivalDate: selected[0], departureDate: selected[1]}, activeProperties())) selected = [];
                } else {
                    const candidate = selected[0] < arrival.value ? selected[0] : selected[1];
                    const stay = availability.select(candidate, criteria(), activeProperties());
                    selected = [stay.arrivalDate, stay.departureDate].filter(Boolean);
                }
                instance.setDate(selected, false);
            }
            arrival.value = selected[0] || ''; departure.value = selected[1] || '';
            formatDates(selected.map(date => new Date(date + 'T12:00:00'))); changed();
        }
    });
    const dates = [saved.arrivalDate, saved.departureDate].filter(value => realDate(value) && value >= parisToday() && value <= bookingHorizon());
    arrival.value = dates[0] || ''; departure.value = dates[1] || ''; formatDates(dates.map(date => new Date(date + 'T12:00:00'))); syncGuests(); syncProperty(); refreshCalendar();
    if (dates[0]) picker.jumpToDate(dates[0], false);
    const selectCalendarDay = event => {
        const element = event.target.closest('.flatpickr-day');
        if (!element || (event.type === 'keydown' && !['Enter', ' '].includes(event.key))) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (disabledDate(element.dateObj)) return;
        const date = dateKey(element.dateObj), previous = criteria();
        const selected = availability.select(date, previous, activeProperties());
        arrival.value = selected.arrivalDate; departure.value = selected.departureDate;
        formatDates([arrival.value, departure.value].filter(Boolean).map(value => new Date(value + 'T12:00:00'))); changed();
        picker.daysContainer.querySelector(`[data-date="${date}"]`)?.focus({preventScroll: true});
        if (previous.arrivalDate && !previous.departureDate && date > previous.arrivalDate && !selected.departureDate) calendarStatus.textContent = t(availability.issue({...previous, departureDate: date}, activeProperties()) || 'invalid');
    };
    on(picker.calendarContainer, 'click', selectCalendarDay, {capture: true});
    on(picker.calendarContainer, 'keydown', selectCalendarDay, {capture: true});
    if ((saved.arrivalDate || saved.departureDate) && !validStay(criteria(), capacity())) status.textContent = t('invalid');
    const togglePanel = (element, button) => { panels.filter(([other]) => other !== element).forEach(([other, trigger]) => setPanel(other, trigger, false)); setPanel(element, button, !element.open); };
    on(dateButton, 'click', () => { togglePanel(panel, dateButton); if (panel.open) loadCalendar(); });
    on(document.getElementById('date-apply'), 'click', () => { if (validStay(criteria())) { setPanel(panel, dateButton, false); dateButton.focus(); } });
    on(clearButton, 'click', () => { const month = new Date(picker.currentYear, picker.currentMonth, 1); picker.clear(); picker.jumpToDate(month, false); setPanel(panel, dateButton, false); dateButton.focus(); });
    on(document, 'click', event => { if (!toggle.contains(event.target)) setPanel(panel, dateButton, false); if (!guestsToggle.contains(event.target)) setPanel(guestsPanel, guestsButton, false); if (!propertyToggle.contains(event.target)) setPanel(propertyPanel, propertyButton, false); });
    on(guestsButton, 'click', () => togglePanel(guestsPanel, guestsButton));
    on(propertyButton, 'click', () => { togglePanel(propertyPanel, propertyButton); if (propertyPanel.open) propertyPanel.querySelector('[aria-pressed="true"]').focus({preventScroll: true}); });
    on(propertyPanel, 'click', event => {
        const option = event.target.closest('[data-property-option]');
        if (!option) return;
        if (property.value !== option.dataset.propertyOption) { property.value = option.dataset.propertyOption; property.dispatchEvent(new Event('change', {bubbles: true})); }
        setPanel(propertyPanel, propertyButton, false);
    });
    on(propertyPanel, 'keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const options = Array.from(propertyPanel.querySelectorAll('[data-property-option]'));
        const current = options.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[index].focus();
    });
    on(form, 'keydown', event => {
        if (event.key !== 'Escape') return;
        panels.forEach(([element, button]) => setPanel(element, button, false));
    });
    const adjustGuests = amount => { guests.value = String(Math.max(1, Math.min(capacity(), Number(guests.value) + amount))); changed(); };
    on(document.getElementById('guests-decrease'), 'click', () => adjustGuests(-1));
    on(document.getElementById('guests-increase'), 'click', () => adjustGuests(1));
    on(guests, 'change', changed); on(property, 'change', () => { calendarRequest?.abort(); calendarRequest = null; availability.clear(); arrival.value = departure.value = ''; picker.clear(); changed(); if (panel.open) loadCalendar(); });
    const search = async event => {
        event?.preventDefault();
        if (pending) return;
        clearQuotes(results); document.getElementById('booking-results').classList.remove('d-none');
        const stay = criteria();
        if (!validStay(stay, capacity())) {
            const overCapacity = Number(stay.guests) > capacity(); status.textContent = t(overCapacity ? 'capacity' : 'invalid');
            (overCapacity ? guestsButton : dateButton).focus(); return;
        }
        writeStay(stay); const signature = JSON.stringify(stay);
        const request = new AbortController(); pending = request; busy(true); status.textContent = t('pending');
        try {
            if (!published) { status.textContent = ''; renderQuotes(results, {enabled: false, availability: []}, {criteria: stay}); return; }
            await availability.loadStay(stay, calendarUrl(), request.signal);
            if (request.signal.aborted) return;
            const issue = availability.issue(stay, activeProperties());
            if (issue) { status.textContent = ''; showBookingError(results, issue, search); return; }
            const params = new URLSearchParams(stay); if (!stay.slug) params.delete('slug');
            const response = await fetch('/api/availability?' + params, {signal: request.signal, cache: 'no-store'});
            if (!response.ok) throw new Error(response.status === 400 ? 'invalid' : response.status === 422 ? 'refused' : 'failed');
            const data = await response.json();
            if (!request.signal.aborted && signature === JSON.stringify(criteria())) {
                renderQuotes(results, data, {criteria: stay, isCurrent: () => signature === JSON.stringify(criteria()), onRefresh: search}); status.textContent = '';
            }
        } catch (error) {
            if (error.name !== 'AbortError' && !request.signal.aborted) { status.textContent = ''; showBookingError(results, ['invalid', 'refused'].includes(error.message) ? error.message : 'failed', search); }
        } finally { if (pending === request) { pending = null; busy(false); } }
    };
    on(form, 'submit', search);
    cleanup = () => { panels.forEach(([element, button]) => setPanel(element, button, false)); clearInterval(calendarTimer); listeners.abort(); pending?.abort(); calendarRequest?.abort(); clearQuotes(results); busy(false); picker.destroy(); cleanup = () => {}; };
}
document.addEventListener('DOMContentLoaded', initialize);
document.addEventListener('turbo:load', initialize);
document.addEventListener('turbo:before-cache', () => { cleanup(); document.getElementById('booking-results')?.classList.add('d-none'); });
