import flatpickr from 'flatpickr';
import { French } from 'flatpickr/dist/l10n/fr.js';
import { language, t, renderQuotes, clearQuotes, showBookingError } from './booking-ui';
import { readStay, writeStay, validStay, realDate, parisToday, bookingHorizon } from './booking-state';
import {CalendarAvailability} from './calendar-availability';
import {SearchProgress} from './search-progress';
import {CalendarProgress} from './calendar-progress';
import {animateSearchSurface, scrollToElement, scrollToPosition} from './ui-motion';

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
    const progress = new SearchProgress(status);
    const submit = form.querySelector('[type="submit"]');
    const panel = document.getElementById('date-panel'), toggle = document.getElementById('date-toggle');
    const display = document.getElementById('date-display-text'), dateButton = document.getElementById('date-display');
    const guestsButton = document.getElementById('guests-display'), guestsPanel = document.getElementById('guests-panel');
    const guestsToggle = document.getElementById('guests-toggle'), currentGuests = document.getElementById('guests-current');
    const propertyButton = document.getElementById('property-display'), propertyPanel = document.getElementById('property-panel');
    const propertyToggle = document.getElementById('property-toggle');
    const panels = [[panel, dateButton], [guestsPanel, guestsButton], [propertyPanel, propertyButton]];
    const guide = document.getElementById('booking-guide');
    const panelAnimations = new Map(), closingPanels = new Set();
    let guideAnimation, positionFrame, roomRequest;
    let guideStep = 0, guideRequest, guideOrigin;
    let initialPlacementChecked = false;
    const setSpotlight = step => form.dispatchEvent(new CustomEvent('tutorial-highlight:toggle', {detail: {active: step > 0, pulse: step === 4}}));
    const saved = readStay();
    property.value = Array.from(property.options).some(option => option.value === saved.slug) ? saved.slug : '';
    guests.value = Array.from(guests.options).some(option => option.value === saved.guests) ? saved.guests : '1';
    let pending, calendarRequest, picker;
    const published = form.dataset.availabilityEnabled === 'true';
    const availability = new CalendarAvailability(Array.from(property.options).filter(option => option.value).map(option => ({slug: option.value, capacity: Number(option.dataset.capacity)})));
    const activeProperties = () => availability.properties.filter(item => !property.value || item.slug === property.value);
    const calendarUrl = () => property.value ? property.selectedOptions[0].dataset.calendarUrl : form.dataset.calendarUrl;
    const calendarStatus = document.getElementById('date-availability-status');
    const calendarSurface = document.getElementById('date-calendar-surface');
    const calendarProgress = new CalendarProgress(calendarSurface);
    const clearButton = document.getElementById('date-cancel'), applyButton = document.getElementById('date-apply');
    const criteria = () => ({arrivalDate: arrival.value, departureDate: departure.value, guests: guests.value, slug: property.value});
    const capacity = () => Number(property.selectedOptions[0].dataset.capacity || guests.options[guests.options.length - 1].value);
    const positionPanel = (element, button, preparing = false) => {
        if (!element.open && !preparing || closingPanels.has(element)) return;
        const viewport = window.visualViewport;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const offsetX = viewport?.offsetLeft || 0, offsetY = viewport?.offsetTop || 0;
        const small = width < 768, gap = 12;
        const header = document.querySelector('header.sticky-top')?.getBoundingClientRect();
        const topLimit = offsetY + (small ? gap : Math.max(gap, (header?.bottom || 0) + gap));
        element.style.maxHeight = `${Math.max(44, offsetY + height - gap - topLimit)}px`;
        const rect = button.getBoundingClientRect();
        const bottomLimit = offsetY + height - gap;
        const bar = form.closest('.booking-bar').getBoundingClientRect();
        // Desktop panels always unfold below the complete, centered module.
        const belowAnchor = Math.max(rect.bottom, bar.bottom);
        const below = Math.max(0, bottomLimit - belowAnchor - gap);
        if (!small) element.style.maxHeight = `${Math.max(44, Math.min(bottomLimit - topLimit, below))}px`;
        const box = {width: element.offsetWidth, height: element.offsetHeight};
        const top = small ? bottomLimit - box.height : belowAnchor + gap;
        element.dataset.placement = small ? 'sheet' : 'below';
        element.style.transformOrigin = 'center top';
        element.style.top = `${Math.max(topLimit, Math.min(top, bottomLimit - box.height))}px`;
        element.style.left = `${small ? offsetX + (width - box.width) / 2 : Math.max(offsetX + gap, Math.min(rect.left, offsetX + width - box.width - gap))}px`;
    };
    const keepSearchVisible = async button => {
        // Only the first opening may move the page, never subsequent steps.
        if (initialPlacementChecked) return;
        initialPlacementChecked = true;
        roomRequest?.abort();
        const request = new AbortController(); roomRequest = request;
        // Let the guide unfold before measuring. Its extra height must never
        // cause native focus scrolling or a second jump to the page header.
        await guideAnimation?.finished.catch(() => {});
        if (request.signal.aborted || listeners.signal.aborted) return;
        const header = document.querySelector('header.sticky-top');
        const top = (header?.getBoundingClientRect().bottom || 0) + 16;
        const bottom = (window.visualViewport?.height || innerHeight) + (window.visualViewport?.offsetTop || 0) - 16;
        const bar = form.closest('.booking-bar').getBoundingClientRect();
        const box = bar.height <= bottom - top ? bar : button.getBoundingClientRect();
        const delta = box.top + box.height / 2 - (top + bottom) / 2;
        // Leave an already comfortable position alone, including slightly
        // below the midpoint. Only a low form needs more room underneath.
        if (delta > (bottom - top) * .1) await scrollToPosition(scrollY + delta, {signal: request.signal, gentle: true});
        if (roomRequest === request) roomRequest = null;
    };
    const finishPanelClose = (element, button, restoreFocus = true) => {
        panelAnimations.get(element)?.cancel(); panelAnimations.delete(element); closingPanels.delete(element);
        if (element === panel) calendarProgress.cancel();
        element.close(); element.classList.add('d-none'); element.style.pointerEvents = '';
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus && button.isConnected) button.focus({preventScroll: true});
    };
    const setPanel = (element, button, open, immediate = false) => {
        if (open && element.open && !closingPanels.has(element)) return;
        if (!open && (!element.open || closingPanels.has(element)) && !immediate) return;
        const style = element.open ? getComputedStyle(element) : null;
        const current = style ? {opacity: style.opacity, transform: style.transform, clipPath: style.clipPath} : null;
        panelAnimations.get(element)?.cancel(); panelAnimations.delete(element);
        if (open) {
            roomRequest?.abort();
            // A step change has exactly one live modal and one focus destination.
            panels.filter(([other]) => other !== element && other.open).forEach(([other, trigger]) => finishPanelClose(other, trigger, false));
            closingPanels.delete(element); element.style.pointerEvents = '';
            element.classList.remove('d-none');
            if (!element.open) {
                // Position the hidden surface BEFORE native showModal autofocus.
                // Otherwise the browser scrolls to its unpositioned contents.
                const previousScroll = {top: scrollY, left: scrollX};
                element.style.visibility = 'hidden'; element.style.display = 'block';
                positionPanel(element, button, true);
                element.showModal();
                if (scrollY !== previousScroll.top || scrollX !== previousScroll.left) window.scrollTo({...previousScroll, behavior: 'instant'});
                element.style.display = ''; element.style.visibility = '';
                element.querySelector('button, input, select, [tabindex="0"]')?.focus({preventScroll: true});
            }
            positionPanel(element, button, true);
            keepSearchVisible(button);
            const animation = animateSearchSurface(element, true, current);
            if (animation) {
                panelAnimations.set(element, animation);
                animation.onfinish = () => { if (panelAnimations.get(element) === animation) panelAnimations.delete(element); };
            }
        } else {
            roomRequest?.abort();
            button.setAttribute('aria-expanded', 'false');
            if (immediate) { finishPanelClose(element, button, false); return; }
            closingPanels.add(element); element.style.pointerEvents = 'none';
            const animation = animateSearchSurface(element, false, current);
            if (animation) {
                panelAnimations.set(element, animation);
                animation.onfinish = () => { if (panelAnimations.get(element) === animation && closingPanels.has(element)) finishPanelClose(element, button); };
            }
            else finishPanelClose(element, button);
        }
        button.setAttribute('aria-expanded', String(open));
    };
    const setGuideStep = step => {
        const entering = step > 0 && guide.hidden;
        guideStep = step;
        guide.hidden = !step;
        guideAnimation?.cancel();
        document.getElementById('booking-guide-property').textContent = property.selectedOptions[0].textContent;
        guide.querySelectorAll('[data-guide-step]').forEach(item => {
            const number = Number(item.dataset.guideStep);
            if (number === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
            item.classList.toggle('is-done', Boolean(step) && number < step);
        });
        propertyToggle.classList.toggle('is-guide-current', step === 1);
        toggle.classList.toggle('is-guide-current', step === 2);
        guestsToggle.classList.toggle('is-guide-current', step === 3);
        submit.classList.toggle('is-guide-current', step === 4);
        setSpotlight(step);
        propertyPanel.classList.toggle('is-guided', step === 1);
        panel.classList.toggle('is-guided', step === 2);
        guestsPanel.classList.toggle('is-guided', step === 3);
        document.querySelectorAll('[data-guide-hint]').forEach(hint => { hint.hidden = !step; });
        if (entering) {
            const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            guideAnimation = guide.animate(reduced ? [{opacity: 0}, {opacity: 1}] : [
                {height: '0px', opacity: 0, overflow: 'hidden', paddingBlock: '0px', marginBlock: '0px'},
                {height: `${guide.getBoundingClientRect().height}px`, opacity: 1, overflow: 'hidden'}
            ], {duration: reduced ? 100 : 300, easing: 'cubic-bezier(.22, 1, .36, 1)'});
        }
    };
    const stopGuide = () => { guideRequest?.abort(); guideRequest = null; setGuideStep(0); };
    const scrollToSearch = async signal => {
        initialPlacementChecked = true;
        await guideAnimation?.finished.catch(() => {});
        if (signal.aborted) return false;
        return scrollToElement(form.closest('.booking-bar'), {gap: 18, signal, block: 'center', gentle: true});
    };
    const showSearchStep = () => {
        panels.filter(([element]) => closingPanels.has(element)).forEach(([element, button]) => finishPanelClose(element, button, false));
        setGuideStep(4);
        submit.focus({preventScroll: true});
    };
    for (const [element, button] of panels) {
        on(element, 'cancel', event => { event.preventDefault(); stopGuide(); setPanel(element, button, false); });
        on(element, 'click', event => {
            const rect = element.getBoundingClientRect();
            if (event.target === element && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
                const guestsConfirmed = guideStep === 3 && element === guestsPanel && validStay(criteria(), capacity());
                setPanel(element, button, false);
                if (guestsConfirmed) { event.stopPropagation(); showSearchStep(); } else stopGuide();
            }
        });
        element.querySelectorAll('[data-search-dismiss]').forEach(close => on(close, 'click', event => {
            setPanel(element, button, false);
            if (guideStep === 3 && element === guestsPanel && validStay(criteria(), capacity())) {
                event.stopPropagation(); showSearchStep();
            } else if (guideStep) stopGuide();
        }));
    }
    const reposition = () => {
        if (positionFrame) return;
        positionFrame = requestAnimationFrame(() => { positionFrame = null; panels.forEach(([element, button]) => positionPanel(element, button)); });
    };
    const panelResize = new ResizeObserver(reposition);
    panelResize.observe(form.closest('.booking-bar'));
    panels.forEach(([element]) => panelResize.observe(element));
    on(window, 'resize', reposition); on(window, 'scroll', reposition);
    on(window.visualViewport, 'resize', reposition); on(window.visualViewport, 'scroll', reposition);
    const interruptRoom = () => { roomRequest?.abort(); if (guideRequest) stopGuide(); };
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'resize']) on(window, type, interruptRoom, {passive: true});
    on(window.visualViewport, 'resize', interruptRoom);
    on(document, 'keydown', event => { if (['Tab', 'Escape', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) interruptRoom(); });
    const busy = (value, complete = false) => {
        submit.disabled = value;
        form.setAttribute('aria-busy', String(value));
        results.setAttribute('aria-busy', String(value));
        if (value) progress.start();
        else if (complete) progress.finish();
        else progress.cancel();
    };
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
        if (stay.arrivalDate && !stay.departureDate && date > stay.arrivalDate) return !availability.canDepart(date, stay, activeProperties());
        return !availability.canArrive(date, stay, activeProperties());
    };
    const renderRange = (hoverDate = '') => {
        if (!picker?.daysContainer) return;
        const stay = criteria();
        const preview = published && !calendarRequest && availability.canDepart(hoverDate, stay, activeProperties());
        const end = preview ? hoverDate : stay.departureDate;
        for (const day of picker.daysContainer.querySelectorAll('.flatpickr-day')) {
            const date = day.dataset.date;
            // Flatpickr treats every disabled checkout as a blocked NIGHT and
            // marks later dates notAllowed. Our availability rules distinguish
            // checkout eligibility from the nights actually occupied.
            day.classList.remove('notAllowed');
            day.classList.toggle('selected', Boolean(date && (date === stay.arrivalDate || date === stay.departureDate)));
            day.classList.toggle('startRange', Boolean(stay.arrivalDate && date === stay.arrivalDate));
            day.classList.toggle('endRange', Boolean(end && date === end));
            day.classList.toggle('inRange', Boolean(stay.arrivalDate && end && date > stay.arrivalDate && date < end));
        }
    };
    const refreshCalendar = () => {
        const checking = Boolean(calendarRequest);
        calendarSurface.classList.toggle('is-checking', checking);
        calendarSurface.setAttribute('aria-busy', String(checking));
        panel.classList.toggle('is-calendar-loading', checking);
        calendarStatus.classList.toggle('visually-hidden', checking);
        clearButton.disabled = !arrival.value && !departure.value;
        const issue = availability.issue(criteria(), activeProperties());
        applyButton.disabled = !published || Boolean(calendarRequest) || !validStay(criteria(), capacity()) || Boolean(issue);
        if (!calendarRequest) calendarStatus.textContent = !published ? t('closed') : !availability.properties.length ? t('empty') : issue && arrival.value && departure.value ? t(issue) : '';
        if (published && !calendarRequest && arrival.value && !departure.value) {
            const minimums = activeProperties().filter(property => Number(guests.value) <= property.capacity).map(property => availability.day(property.slug, arrival.value)).filter(day => day?.available).map(day => day.minStay);
            if (minimums.length) calendarStatus.textContent = `${t('chooseDeparture')} · ${Math.min(...minimums)} ${t('minimum')}`;
        }
        document.getElementById('date-calendar-contact').hidden = checking || published && !issue;
        if (picker) {
            const selected = [arrival.value, departure.value].filter(realDate);
            if (JSON.stringify(picker.selectedDates.map(dateKey)) !== JSON.stringify(selected)) {
                picker.set('disable', []); picker.setDate(selected, false); picker.set('disable', [disabledDate]);
            } else picker.redraw();
            renderRange();
            picker.daysContainer.inert = checking;
            if (panel.open) calendarSurface.style.setProperty('--calendar-loader-top', `${Math.max(0, picker.daysContainer.getBoundingClientRect().top - calendarSurface.getBoundingClientRect().top)}px`);
        }
        if (panel.open) positionPanel(panel, dateButton);
    };
    const loadCalendar = async () => {
        if (!published || !availability.properties.length || !picker || !panel.open) { refreshCalendar(); return; }
        calendarRequest?.abort(); const request = new AbortController(); calendarRequest = request;
        calendarProgress.start();
        calendarStatus.textContent = t('checkingDates'); calendarStatus.dataset.state = 'loading'; refreshCalendar();
        const index = picker.currentYear * 12 + picker.currentMonth;
        try {
            await Promise.all([index, index + 1].map(month => availability.load(month, calendarUrl(), request.signal)));
            if (calendarRequest === request) calendarProgress.update(72);
            await availability.loadArrivalNights([index, index + 1], calendarUrl(), request.signal);
            if (request.signal.aborted) return;
            if (availability.issue(criteria(), activeProperties())) clearQuotes(results);
            calendarStatus.dataset.state = [index, index + 1].every(month => activeProperties().every(property => availability.months.get(month)?.rows.some(row => row.slug === property.slug && row.status === 'fresh'))) ? 'fresh' : 'unverified';
        } catch (error) {
            if (error.name === 'AbortError') return;
            availability.clear(); calendarStatus.dataset.state = 'unverified';
        } finally {
            if (calendarRequest === request && !request.signal.aborted && calendarStatus.dataset.state === 'fresh') await calendarProgress.finish();
            if (calendarRequest === request) {
                calendarProgress.cancel();
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
        onKeyDown() {
            // Native arrow navigation also invokes Flatpickr's range hover.
            // Restore the supplier-aware preview after it has moved focus.
            renderRange(document.activeElement?.closest('.flatpickr-day')?.dataset.date);
        },
        onDayCreate(_, __, instance, element) {
            const date = dateKey(element.dateObj), state = availability.state(date, activeProperties());
            element.dataset.date = date;
            if (date < parisToday()) return;
            element.classList.add('stay-' + state);
            const checkout = availability.checkoutOnly(date, criteria(), activeProperties());
            const noArrival = state === 'open' && !availability.canArrive(date, criteria(), activeProperties());
            if (noArrival) element.classList.add('stay-no-arrival');
            const description = t(checkout ? 'checkoutOnly' : noArrival ? 'noArrival' : state === 'open' ? 'candidate' : state === 'closed' ? 'unavailable' : 'unverified');
            element.setAttribute('aria-label', `${date}, ${description}`); element.title = element.getAttribute('aria-label');
            if (state === 'unknown') element.dataset.hint = '?';
            if (checkout) { element.classList.add('stay-checkout-only'); element.dataset.hint = t('checkoutOnly'); }
        },
        onChange(dates, _, instance) {
            let selected = dates.map(date => instance.formatDate(date, 'Y-m-d'));
            if (selected.length === 1 && !availability.canArrive(selected[0], criteria(), activeProperties())) selected = [arrival.value, departure.value].filter(Boolean);
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
    on(picker.calendarContainer, 'mouseover', event => {
        if (!picker.daysContainer.contains(event.target)) return;
        event.stopImmediatePropagation();
        renderRange(event.target.closest('.flatpickr-day')?.dataset.date);
    }, {capture: true});
    on(picker.daysContainer, 'focusin', event => renderRange(event.target.closest('.flatpickr-day')?.dataset.date));
    on(picker.daysContainer, 'mouseleave', () => renderRange());
    if ((saved.arrivalDate || saved.departureDate) && !validStay(criteria(), capacity())) status.textContent = t('invalid');
    const togglePanel = (element, button) => { panels.filter(([other]) => other !== element).forEach(([other, trigger]) => setPanel(other, trigger, false)); setPanel(element, button, !element.open); };
    on(dateButton, 'click', () => { if (guideStep) setGuideStep(2); togglePanel(panel, dateButton); if (panel.open) loadCalendar(); });
    on(document.getElementById('date-apply'), 'click', event => {
        if (!validStay(criteria(), capacity())) return;
        setPanel(panel, dateButton, false);
        if (guideStep) { event.stopPropagation(); setGuideStep(3); setPanel(guestsPanel, guestsButton, true); }
        else dateButton.focus();
    });
    on(clearButton, 'click', () => { const month = new Date(picker.currentYear, picker.currentMonth, 1); picker.clear(); picker.jumpToDate(month, false); setPanel(panel, dateButton, false); dateButton.focus(); });
    on(document, 'click', event => { if (guideStep === 4 && !submit.contains(event.target)) stopGuide(); if (!toggle.contains(event.target)) setPanel(panel, dateButton, false); if (!guestsToggle.contains(event.target)) setPanel(guestsPanel, guestsButton, false); if (!propertyToggle.contains(event.target)) setPanel(propertyPanel, propertyButton, false); });
    on(document, 'focusin', event => { if (guideStep === 4 && !submit.contains(event.target)) stopGuide(); });
    on(guestsButton, 'click', () => { if (guideStep) setGuideStep(3); togglePanel(guestsPanel, guestsButton); });
    on(propertyButton, 'click', () => {
        stopGuide();
        // Reveal the guide before positioning the popover: its heading adds
        // height to the bar, especially when the fields stack on mobile.
        if (!propertyPanel.open) setGuideStep(1);
        togglePanel(propertyPanel, propertyButton);
        if (propertyPanel.open) propertyPanel.querySelector('[aria-pressed="true"]').focus({preventScroll: true});
    });
    on(propertyPanel, 'click', event => {
        const option = event.target.closest('[data-property-option]');
        if (!option) return;
        event.stopPropagation();
        if (property.value !== option.dataset.propertyOption) {
            property.value = option.dataset.propertyOption;
            // Dates come before guests in the guide. A smaller property must
            // remain bookable when the previous search had more travelers.
            guests.value = String(Math.max(1, Math.min(Number(guests.value) || 1, capacity())));
            property.dispatchEvent(new Event('change', {bubbles: true}));
        }
        setPanel(propertyPanel, propertyButton, false);
        // Selecting even the current option (including all properties) is an
        // explicit confirmation. Advance without sending a quote request.
        setGuideStep(2);
        setPanel(panel, dateButton, true); loadCalendar();
    });
    on(propertyPanel, 'keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const options = Array.from(propertyPanel.querySelectorAll('[data-property-option]'));
        const current = options.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[index].focus();
    });
    on(document, 'keydown', event => {
        if (event.key !== 'Escape' || !guideStep && !panels.some(([element]) => element.open)) return;
        const pendingGuide = guideRequest && !panels.some(([element]) => element.open);
        stopGuide();
        panels.forEach(([element, button]) => setPanel(element, button, false));
        if (pendingGuide && guideOrigin?.isConnected) guideOrigin.focus({preventScroll: true});
    });
    const adjustGuests = amount => { guests.value = String(Math.max(1, Math.min(capacity(), Number(guests.value) + amount))); changed(); };
    on(document.getElementById('guests-decrease'), 'click', () => adjustGuests(-1));
    on(document.getElementById('guests-increase'), 'click', () => adjustGuests(1));
    on(guests, 'change', changed); on(property, 'change', () => { stopGuide(); calendarRequest?.abort(); calendarRequest = null; availability.clear(); arrival.value = departure.value = ''; picker.clear(); changed(); if (panel.open) loadCalendar(); });
    on(document.getElementById('booking-guide-close'), 'click', () => { stopGuide(); panels.forEach(([element, button]) => setPanel(element, button, false)); });
    on(document, 'booking:guide', async event => {
        const slug = event.detail?.slug;
        if (!slug || !Array.from(property.options).some(option => option.value === slug)) return;
        event.preventDefault();
        stopGuide(); panels.forEach(([element, button]) => setPanel(element, button, false));
        guideOrigin = document.activeElement;
        property.value = slug;
        guests.value = String(Math.min(Number(guests.value) || 1, capacity()));
        property.dispatchEvent(new Event('change', {bubbles:true}));
        const request = new AbortController(); guideRequest = request; setGuideStep(2);
        const arrived = await scrollToSearch(request.signal);
        if (request.signal.aborted || !arrived) { if (guideRequest === request) stopGuide(); return; }
        if (guideRequest === request) guideRequest = null;
        setPanel(panel, dateButton, true); loadCalendar();
    });
    const search = async event => {
        event?.preventDefault();
        if (pending) return;
        stopGuide();
        progress.cancel();
        clearQuotes(results); document.getElementById('booking-results').classList.add('d-none');
        const stay = criteria();
        if (!validStay(stay, capacity())) {
            const overCapacity = Number(stay.guests) > capacity(); status.textContent = t(overCapacity ? 'capacity' : 'invalid');
            (overCapacity ? guestsButton : dateButton).focus(); return;
        }
        writeStay(stay); const signature = JSON.stringify(stay);
        const request = new AbortController(); pending = request; busy(true);
        let complete = false;
        try {
            if (!published) { status.textContent = ''; renderQuotes(results, {enabled: false, availability: []}, {criteria: stay}); return; }
            await availability.loadStay(stay, calendarUrl(), request.signal);
            if (request.signal.aborted) return;
            progress.update(58);
            const issue = availability.issue(stay, activeProperties());
            if (issue) { status.textContent = ''; showBookingError(results, issue, search); return; }
            const params = new URLSearchParams(stay); if (!stay.slug) params.delete('slug');
            const response = await fetch('/api/availability?' + params, {signal: request.signal, cache: 'no-store'});
            if (!response.ok) throw new Error(response.status === 400 ? 'invalid' : response.status === 422 ? 'refused' : 'failed');
            const data = await response.json();
            if (!request.signal.aborted && signature === JSON.stringify(criteria())) {
                renderQuotes(results, data, {criteria: stay, isCurrent: () => signature === JSON.stringify(criteria()), onRefresh: search}); complete = true;
            }
        } catch (error) {
            if (error.name !== 'AbortError' && !request.signal.aborted) { status.textContent = ''; showBookingError(results, ['invalid', 'refused'].includes(error.message) ? error.message : 'failed', search); }
        } finally {
            if (pending === request) {
                pending = null; busy(false, complete);
                document.getElementById('booking-results').classList.toggle('d-none', !results.hasChildNodes());
            }
        }
    };
    on(form, 'submit', search);
    cleanup = () => { stopGuide(); roomRequest?.abort(); guideAnimation?.cancel(); panelResize.disconnect(); cancelAnimationFrame(positionFrame); panels.forEach(([element, button]) => setPanel(element, button, false, true)); clearInterval(calendarTimer); listeners.abort(); pending?.abort(); pending = null; calendarRequest?.abort(); calendarRequest = null; clearQuotes(results); busy(false); status.textContent = ''; picker.destroy(); cleanup = () => {}; };
}
document.addEventListener('DOMContentLoaded', initialize);
document.addEventListener('turbo:load', initialize);
document.addEventListener('turbo:before-cache', () => { cleanup(); document.getElementById('booking-results')?.classList.add('d-none'); });
