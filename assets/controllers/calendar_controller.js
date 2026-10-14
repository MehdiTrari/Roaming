import { Controller } from '@hotwired/stimulus';
import { node, t, language, money, renderQuotes, clearQuotes, showBookingError, parisToday } from '../booking-ui';
import { readStay, writeStay, validStay, realDate } from '../booking-state';
import {CalendarAvailability} from '../calendar-availability';

export default class extends Controller {
    static targets = ['previous', 'next', 'status', 'board', 'fields', 'arrival', 'departure', 'guests', 'quote', 'notice', 'content', 'propertyButton', 'summary', 'selection', 'propertyName', 'submit', 'feedback', 'clear', 'stage', 'popover', 'dateTrigger', 'dateHint', 'applyDates', 'monthLabel'];
    static values = { url: String, quoteUrl: String, picker: Boolean, compact: Boolean, published: Boolean };
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        const [year, month] = parisToday().split('-').map(Number);
        this.base = year * 12 + month - 1; this.current = this.base;
        this.days = new Map(); this.months = [];
        this.availability = new CalendarAvailability(this.propertyButtonTargets.map(button => ({slug: button.dataset.slug, capacity: Number(button.dataset.capacity)})));
        const saved = readStay();
        this.selected = this.propertyButtonTargets.find(button => button.dataset.slug === saved.slug) || (this.pickerValue ? null : this.propertyButtonTargets[0]);
        this.selectProperty();
        this.arrivalTarget.value = realDate(saved.arrivalDate) ? saved.arrivalDate : '';
        this.departureTarget.value = realDate(saved.departureDate) ? saved.departureDate : '';
        this.guestsTarget.value = /^\d+$/.test(saved.guests) ? saved.guests : '2';
        this.focusArrivalMonth(); this.changed();
        this.arrivalTarget.min = parisToday();
        this.departureTarget.max = new Date(Date.UTC(year, month + 11, 1)).toISOString().slice(0, 10);
        this.arrivalTarget.max = new Date(Date.UTC(year, month + 11, 0)).toISOString().slice(0, 10);
        this.onVisibility = () => { if (!document.hidden && this.visible) this.load(); };
        this.onBeforeCache = () => {
            if (this.compactValue) this.closeDates(true);
            this.request?.abort(); this.quoteRequest?.abort(); this.days.clear(); this.availability.clear(); this.months = [];
            this.statusTarget.textContent = t('loading'); this.statusTarget.dataset.state = 'loading';
            this.fieldsTarget.disabled = true; this.invalidateQuote(); this.render();
        };
        document.addEventListener('visibilitychange', this.onVisibility);
        document.addEventListener('turbo:before-cache', this.onBeforeCache);
        if (this.compactValue) {
            this.popoverListeners = new AbortController();
            const reposition = () => this.positionDates();
            for (const [element, type] of [[window, 'resize'], [window, 'scroll'], [window.visualViewport, 'resize'], [window.visualViewport, 'scroll']]) element?.addEventListener(type, reposition, {signal: this.popoverListeners.signal});
            if (!this.publishedValue) { this.enabled = false; this.noticeTarget.hidden = false; this.contentTarget.hidden = true; }
        }
        this.observer = new IntersectionObserver(entries => {
            const wasVisible = this.visible; this.visible = entries[0].isIntersecting;
            if (this.visible && !wasVisible) this.load();
        });
        this.observer.observe(this.element);
        this.timer = setInterval(() => { if (this.visible && !document.hidden) this.load(); }, 60000);
        this.render();
        if (this.pickerValue) (this.selected ? this.propertyNameTarget : this.element.querySelector('#availability-choice-title'))?.focus({preventScroll: true});
    }
    disconnect() {
        if (this.compactValue) { this.closeDates(true); this.popoverListeners?.abort(); }
        clearInterval(this.timer); this.observer?.disconnect();
        document.removeEventListener('visibilitychange', this.onVisibility);
        document.removeEventListener('turbo:before-cache', this.onBeforeCache);
        this.request?.abort(); this.invalidateQuote();
    }
    selectProperty(event) {
        if (event && event.currentTarget === this.selected) return;
        if (event) this.selected = event.currentTarget;
        if (!this.selected) return;
        this.slug = this.selected.dataset.slug;
        this.propertyNameTarget.textContent = this.selected.dataset.name;
        this.propertyButtonTargets.forEach(button => button.setAttribute('aria-pressed', String(button === this.selected)));
        this.guestsTarget.max = this.selected.dataset.capacity;
        this.current = this.base; this.days.clear(); this.months = []; this.fieldsTarget.disabled = true;
        this.availability.clear();
        if (event) { this.arrivalTarget.value = this.departureTarget.value = ''; this.changed(); this.load(); }
    }
    previous() { if (this.current > this.base) { this.current--; this.navigate(); } }
    next() { if (this.current < this.base + 10) { this.current++; this.navigate(); } }
    today() { this.current = this.base; this.navigate(); }
    navigate() {
        this.invalidateQuote(); this.months = []; this.fieldsTarget.disabled = true;
        this.render(); this.load();
    }
    invalidateQuote() { this.quoteRequest?.abort(); this.quoteRequest = null; clearQuotes(this.quoteTarget); }
    criteria() { return {slug: this.slug, arrivalDate: this.arrivalTarget.value, departureDate: this.departureTarget.value, guests: this.guestsTarget.value}; }
    focusArrivalMonth() {
        if (!realDate(this.arrivalTarget.value)) return;
        const [year, month] = this.arrivalTarget.value.split('-').map(Number);
        this.current = Math.max(this.base, Math.min(this.base + 10, year * 12 + month - 1));
    }
    clearDates() { this.arrivalTarget.value = this.departureTarget.value = ''; this.editingPart = 'arrival'; this.changed(); (this.compactValue ? this.dateTriggerTargets[0] : this.arrivalTarget).focus(); }
    selectionCriteria() { return this.compactValue && this.popoverTarget.open && this.editingPart !== 'complete' ? {...this.criteria(), arrivalDate: this.editingPart === 'arrival' ? '' : this.arrivalTarget.value, departureDate: ''} : this.criteria(); }
    openDates(event) {
        event.preventDefault();
        this.dateTrigger = event.currentTarget;
        this.editingPart = this.dateTrigger.dataset.datePart === 'departure' && this.arrivalTarget.value ? 'departure' : 'arrival';
        this.dateTriggerTargets.forEach(button => button.setAttribute('aria-expanded', String(button === this.dateTrigger)));
        if (!this.popoverTarget.open) this.popoverTarget.showModal();
        this.render(); this.positionDates(); this.load();
        const anchor = this.dateTrigger.dataset.datePart === 'departure' ? this.departureTarget.value : this.arrivalTarget.value;
        (this.boardTarget.querySelector(`[data-date="${anchor}"]:not(:disabled)`) || this.boardTarget.querySelector('button:not(:disabled)') || this.popoverTarget.querySelector('button'))?.focus({preventScroll: true});
    }
    closeDates() {
        if (!this.hasPopoverTarget || !this.popoverTarget.open) return;
        this.popoverTarget.close(); this.editingPart = 'complete';
        this.dateTriggerTargets.forEach(button => button.setAttribute('aria-expanded', 'false'));
        if (!this.contentTarget.hidden && this.dateTrigger?.isConnected) this.dateTrigger.focus({preventScroll: true});
    }
    cancelDates(event) { event.preventDefault(); this.closeDates(); }
    outsideDates(event) {
        if (event.target !== this.popoverTarget) return;
        const box = this.popoverTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.closeDates();
    }
    positionDates() {
        if (!this.hasPopoverTarget || !this.popoverTarget.open || !this.dateTrigger) return;
        const viewport = window.visualViewport, width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const offsetX = viewport?.offsetLeft || 0, offsetY = viewport?.offsetTop || 0, gap = 12;
        const small = width < 768, topLimit = offsetY + (small ? gap : Math.max(gap, (document.querySelector('header.sticky-top')?.getBoundingClientRect().bottom || 0) + gap));
        this.popoverTarget.style.maxWidth = `${width - 24}px`; this.popoverTarget.style.maxHeight = `${Math.max(44, offsetY + height - gap - topLimit)}px`;
        const field = this.dateTrigger.getBoundingClientRect(), box = this.popoverTarget.getBoundingClientRect();
        let top = small ? offsetY + height - gap - box.height : field.bottom + gap;
        if (!small && top + box.height > offsetY + height - gap) top = field.top - gap - box.height >= topLimit ? field.top - gap - box.height : topLimit;
        this.popoverTarget.style.top = `${Math.max(topLimit, Math.min(top, offsetY + height - gap - box.height))}px`;
        this.popoverTarget.style.left = `${small ? offsetX + (width - box.width) / 2 : Math.max(offsetX + gap, Math.min(field.left, offsetX + width - box.width - gap))}px`;
    }
    changed(event) {
        this.invalidateQuote();
        if (event?.target === this.arrivalTarget && this.departureTarget.value <= this.arrivalTarget.value) this.departureTarget.value = '';
        const date = new Date((realDate(this.arrivalTarget.value) ? this.arrivalTarget.value : parisToday()) + 'T00:00:00Z');
        if (this.arrivalTarget.value) date.setUTCDate(date.getUTCDate() + 1);
        this.departureTarget.min = date.toISOString().slice(0, 10);
        writeStay(this.criteria());
        if (event?.target === this.arrivalTarget && realDate(this.arrivalTarget.value) && this.arrivalTarget.value >= parisToday() && this.arrivalTarget.value <= this.arrivalTarget.max) {
            const previousMonth = this.current; this.focusArrivalMonth();
            if (previousMonth !== this.current) { this.navigate(); return; }
        }
        this.render();
    }
    async load() {
        if (!this.selected || (this.compactValue && !this.publishedValue) || document.documentElement.hasAttribute('data-turbo-preview')) return;
        const key = this.slug + ':' + this.current;
        if (this.loadedKey === key && this.months.length && Date.now() - this.loadedAt < 60000) return;
        if (this.request && !this.request.signal.aborted && this.loadingKey === key) return;
        this.request?.abort(); const request = new AbortController(); this.request = request; this.loadingKey = key;
        this.statusTarget.textContent = t('loading'); this.statusTarget.dataset.state = 'loading';
        this.boardTarget.setAttribute('aria-busy', 'true');
        try {
            const months = await Promise.all([this.current, this.current + 1].map(async index => {
                const data = await this.availability.load(index, this.selected.dataset.url || this.urlValue, request.signal);
                return {index, enabled: data?.enabled, row: data?.rows.find(row => row.slug === this.slug)};
            }));
            if (request.signal.aborted) return;
            this.months = months; this.enabled = months.every(month => month.enabled);
            this.noticeTarget.hidden = this.enabled; this.contentTarget.hidden = !this.enabled;
            if (this.compactValue && !this.enabled) this.closeDates(true);
            const fresh = this.enabled && months.every(month => month.row?.status === 'fresh');
            if (fresh) { this.loadedKey = key; this.loadedAt = Date.now(); }
            this.fieldsTarget.disabled = !fresh;
            let availabilityChanged = false;
            for (const month of months) {
                const prefix = Math.floor(month.index / 12) + '-' + String(month.index % 12 + 1).padStart(2, '0');
                const before = Array.from(this.days.values()).filter(day => day.date.startsWith(prefix)).map(({date, available, price, minStay}) => ({date, available, price, minStay}));
                const after = (month.row?.days || []).map(({date, available, price, minStay}) => ({date, available, price, minStay}));
                if (JSON.stringify(before) !== JSON.stringify(after)) availabilityChanged = true;
                for (const date of this.days.keys()) if (date.startsWith(prefix)) this.days.delete(date);
                if (month.row?.status === 'fresh') for (const day of month.row.days) this.days.set(day.date, {...day, readAt: Date.now()});
            }
            const oldest = months.map(month => month.row?.fetchedAt).filter(Boolean).sort()[0];
            this.statusTarget.textContent = !this.enabled ? t('confirm') : fresh ? t('refreshed') + ': ' + new Date(oldest).toLocaleTimeString(language()) : t('failed');
            this.statusTarget.dataset.state = fresh ? 'fresh' : 'unverified';
            if (!fresh || availabilityChanged) this.invalidateQuote(); this.render();
        } catch (error) {
            if (error.name === 'AbortError') return;
            this.days.clear(); this.availability.clear(); this.months = []; this.fieldsTarget.disabled = true; this.invalidateQuote();
            this.statusTarget.textContent = t('failed'); this.statusTarget.dataset.state = 'unverified'; this.render();
        } finally { if (this.request === request) { this.request = null; this.boardTarget.removeAttribute('aria-busy'); } }
    }
    selectionIssue() {
        return this.availability.issue(this.criteria(), this.activeProperties(), false);
    }
    activeProperties() { return this.availability.properties.filter(property => property.slug === this.slug); }
    canDepart(date) {
        return this.availability.canDepart(date, this.selectionCriteria(), this.activeProperties());
    }
    previewRange(event) {
        this.clearRangePreview();
        const button = event.target.closest('button[data-date]'), stay = this.selectionCriteria();
        if (!button || button.disabled || !stay.arrivalDate || stay.departureDate || !this.canDepart(button.dataset.date)) return;
        for (const day of this.boardTarget.querySelectorAll('[data-date]')) {
            if (day.dataset.date > stay.arrivalDate && day.dataset.date < button.dataset.date) day.classList.add('stay-preview-range');
        }
        button.classList.add('stay-preview-end');
    }
    clearRangePreview() {
        this.boardTarget.querySelectorAll('.stay-preview-range, .stay-preview-end').forEach(day => day.classList.remove('stay-preview-range', 'stay-preview-end'));
    }
    selectDate(event) {
        const button = event.target.closest('button[data-date]');
        if (!button || button.disabled) return;
        const date = button.dataset.date;
        const selection = this.availability.select(date, this.selectionCriteria(), this.activeProperties());
        this.arrivalTarget.value = selection.arrivalDate; this.departureTarget.value = selection.departureDate;
        if (this.compactValue) this.editingPart = selection.departureDate ? 'complete' : 'departure';
        this.changed();
        this.boardTarget.querySelector('[data-date="' + date + '"]')?.focus({preventScroll: true});
        if (this.departureTarget.value && !this.compactValue) this.quote();
    }
    keyboard(event) {
        const offset = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[event.key];
        if (!offset || !event.target.dataset.date) return;
        event.preventDefault(); const date = new Date(event.target.dataset.date + 'T00:00:00Z');
        for (let i = 0; i < 62; i++) {
            date.setUTCDate(date.getUTCDate() + offset);
            const button = this.boardTarget.querySelector('[data-date="' + date.toISOString().slice(0, 10) + '"]');
            if (!button) break;
            if (!button.disabled) { button.focus({preventScroll: true}); break; }
        }
    }
    async quote(event) {
        event?.preventDefault();
        if (this.quoteRequest || this.fieldsTarget.disabled || !this.element.querySelector('form').reportValidity()) return;
        const issue = this.selectionIssue();
        if (issue || !validStay(this.criteria(), Number(this.guestsTarget.max))) { this.feedbackTarget.textContent = t(issue || 'invalid'); return; }
        this.invalidateQuote(); const request = new AbortController(); this.quoteRequest = request;
        this.quoteTarget.textContent = t('pending'); this.quoteTarget.setAttribute('aria-busy', 'true'); this.submitTarget.disabled = true;
        const stay = this.criteria(), signature = JSON.stringify(stay), params = new URLSearchParams(stay);
        try {
            await this.availability.loadStay(stay, this.selected.dataset.url || this.urlValue, request.signal);
            if (request.signal.aborted) return;
            const verifiedIssue = this.availability.issue(stay, this.activeProperties());
            if (verifiedIssue) { this.feedbackTarget.textContent = t(verifiedIssue); return; }
            const response = await fetch(this.quoteUrlValue + '?' + params, {signal: request.signal, cache: 'no-store'});
            if (!response.ok) throw new Error(response.status === 400 ? 'invalid' : response.status === 422 ? 'refused' : 'failed');
            const data = await response.json();
            if (!request.signal.aborted && signature === JSON.stringify(this.criteria())) renderQuotes(this.quoteTarget, data, {criteria: stay, quoteUrl: this.quoteUrlValue, isCurrent: () => signature === JSON.stringify(this.criteria()), onRefresh: () => this.quote()});
        } catch (error) {
            if (error.name !== 'AbortError' && !request.signal.aborted) showBookingError(this.quoteTarget, ['invalid', 'refused'].includes(error.message) ? error.message : 'failed', () => this.quote());
        } finally { if (this.quoteRequest === request) { this.quoteRequest = null; this.quoteTarget.removeAttribute('aria-busy'); this.render(); } }
    }
    dayButton(index, number) {
        const date = Math.floor(index / 12) + '-' + String(index % 12 + 1).padStart(2, '0') + '-' + String(number).padStart(2, '0');
        const month = this.months.find(month => month.index === index);
        const day = month?.row?.status === 'fresh' ? this.availability.day(this.slug, date) : null;
        const state = !day ? 'unknown' : day.available ? 'open' : 'closed', past = date < parisToday();
        const arrival = this.arrivalTarget.value, departure = this.departureTarget.value;
        const selecting = this.selectionCriteria();
        const choosingDeparture = selecting.arrivalDate && !selecting.departureDate && date > selecting.arrivalDate;
        const checkoutOnly = !past && this.availability.checkoutOnly(date, selecting, this.activeProperties());
        const button = node('button', '', 'stay-day stay-' + (past ? 'past' : state));
        button.type = 'button'; button.dataset.date = date;
        button.disabled = !this.enabled || past || state === 'unknown' || (choosingDeparture ? !this.canDepart(date) : state === 'closed');
        if (this.compactValue && this.editingPart === 'complete' && date === departure && this.enabled && !past && state !== 'unknown') button.disabled = false;
        button.append(node('span', String(number), 'stay-day-number'));
        if (!past && day?.available) button.append(node('small', new Intl.NumberFormat(language(), {style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2}).format(day.price), 'stay-night-price'));
        if (!past && state === 'unknown') button.append(node('small', '?'));
        if (checkoutOnly) { button.classList.add('stay-checkout-only'); button.append(node('small', '↗', 'stay-checkout-mark')); }
        const description = t(checkoutOnly ? 'checkoutOnly' : past ? 'past' : state === 'open' ? 'available' : state === 'closed' ? 'unavailable' : 'unverified');
        button.setAttribute('aria-label', date + ', ' + description + (day?.available ? ', ' + money(day.price) + ', ' + day.minStay + ' ' + t('minimum') : ''));
        button.title = button.getAttribute('aria-label');
        if (checkoutOnly) button.dataset.hint = t('checkoutOnly');
        if (date === parisToday()) button.classList.add('stay-today');
        const selected = arrival && date >= arrival && date <= (departure || arrival);
        button.setAttribute('aria-pressed', String(Boolean(selected)));
        if (selected) button.classList.add('stay-selected');
        if (selected && date === arrival) button.classList.add('stay-arrival', 'stay-boundary');
        if (selected && date === departure) button.classList.add('stay-departure', 'stay-boundary');
        return button;
    }
    render() {
        this.clearTarget.disabled = !this.arrivalTarget.value && !this.departureTarget.value;
        const issue = this.selectionIssue();
        this.feedbackTarget.textContent = issue ? t(issue) + (issue === 'capacity' ? ` (${this.guestsTarget.max} ${t('guests')})` : issue === 'tooShort' ? ` (${this.days.get(this.arrivalTarget.value)?.minStay} ${t('minimum')})` : '') : '';
        this.submitTarget.disabled = this.fieldsTarget.disabled || Boolean(this.quoteRequest) || Boolean(issue) || !validStay(this.criteria(), Number(this.guestsTarget.max));
        this.guestsTarget.disabled = this.fieldsTarget.disabled;
        this.previousTarget.disabled = this.current <= this.base; this.nextTarget.disabled = this.current >= this.base + 10;
        const arrival = this.arrivalTarget.value, departure = this.departureTarget.value;
        const nights = arrival && departure ? Math.round((Date.parse(departure) - Date.parse(arrival)) / 86400000) : 0;
        this.summaryTarget.textContent = nights > 0 ? nights + ' ' + t('nights') : t(arrival ? 'chooseDeparture' : 'chooseDates');
        const formatDate = value => new Intl.DateTimeFormat(language(), {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
        this.selectionTarget.textContent = realDate(arrival) ? formatDate(arrival) + (realDate(departure) ? ' – ' + formatDate(departure) : '') : t('dateHint');
        if (arrival && !departure && this.days.has(arrival)) this.selectionTarget.textContent += ' · ' + this.days.get(arrival).minStay + ' ' + t('minimum');
        this.boardTarget.replaceChildren();
        for (const index of [this.current, this.current + 1]) {
            const year = Math.floor(index / 12), month = index % 12;
            const section = node('section', '', 'stay-month');
            const title = new Intl.DateTimeFormat(language(), {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(Date.UTC(year, month, 1)));
            if (this.compactValue) this.monthLabelTarget.textContent = title;
            section.setAttribute('aria-label', title); section.append(node('h3', title));
            const grid = node('div', '', 'stay-month-grid');
            for (let d = 0; d < 7; d++) grid.append(node('span', new Intl.DateTimeFormat(language(), {weekday: 'short', timeZone: 'UTC'}).format(new Date(Date.UTC(2024, 0, 1 + d))), 'stay-weekday'));
            const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
            for (let i = 0; i < offset; i++) grid.append(node('span'));
            for (let day = 1; day <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); day++) grid.append(this.dayButton(index, day));
            section.append(grid); this.boardTarget.append(section);
        }
        if (this.compactValue) {
            for (const button of this.dateTriggerTargets) button.querySelector('[data-date-label]').textContent = realDate(button.dataset.datePart === 'arrival' ? arrival : departure) ? formatDate(button.dataset.datePart === 'arrival' ? arrival : departure) : t('chooseDates');
            this.dateHintTarget.textContent = this.statusTarget.dataset.state === 'unverified' ? t('failed') : this.selectionTarget.textContent;
            this.applyDatesTarget.disabled = Boolean(issue) || !validStay(this.criteria(), Number(this.guestsTarget.max)) || this.fieldsTarget.disabled;
            this.positionDates();
        }
    }
}
