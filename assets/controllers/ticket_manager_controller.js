import {Controller} from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['form', 'results', 'active', 'error'];
    static values = {error: String};
    connect() {
        this.element.setAttribute('data-ready', '');
        this.refreshChips();
        this.onPopstate = () => { this.restoreFilters(); this.load(new URL(location.href), false); };
        this.onOutside = event => {
            this.element.querySelectorAll('details[open]').forEach(details => { if (!details.contains(event.target)) details.open = false; });
        };
        this.onKey = event => { if (event.key === 'Escape') this.element.querySelectorAll('details[open]').forEach(details => { details.open = false; details.querySelector('summary').focus(); }); };
        window.addEventListener('popstate', this.onPopstate);
        document.addEventListener('click', this.onOutside);
        this.element.addEventListener('keydown', this.onKey);
    }
    disconnect() {
        this.element.removeAttribute('data-ready');
        clearTimeout(this.timer); this.request?.abort();
        window.removeEventListener('popstate', this.onPopstate);
        document.removeEventListener('click', this.onOutside);
        this.element.removeEventListener('keydown', this.onKey);
    }
    search() {
        clearTimeout(this.timer);
        // Invalidate any previous response immediately, including during the debounce.
        this.request?.abort();
        this.timer = setTimeout(() => this.apply(), 240);
    }
    change(event) { if (event.target.name !== 'q') this.apply(); }
    submit(event) { event.preventDefault(); this.apply(); }
    reset() {
        this.formTarget.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
        this.formTarget.elements.q.value = '';
        this.formTarget.elements.sort.value = 'newest';
        this.apply();
    }
    apply() {
        clearTimeout(this.timer);
        const url = new URL(this.formTarget.action);
        for (const [key, value] of new FormData(this.formTarget)) { if (value !== '') url.searchParams.append(key, value); }
        this.refreshChips();
        this.load(url);
    }
    restoreFilters() {
        const params = new URL(location.href).searchParams;
        this.formTarget.elements.q.value = params.get('q') || '';
        this.formTarget.elements.sort.value = params.get('sort') || 'newest';
        this.formTarget.querySelectorAll('input[type="checkbox"]').forEach(input => {
            const key = input.name.replace('[]', '');
            input.checked = [...params].some(([name, value]) => name.replace(/\[\d*\]$/, '') === key && value === input.value);
        });
        this.refreshChips();
    }
    refreshChips() {
        this.activeTarget.replaceChildren();
        const selected = [...this.formTarget.querySelectorAll('input[type="checkbox"]:checked')];
        for (const input of selected) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'ticket-active-chip';
            const text = input.closest('label').textContent.trim();
            button.textContent = `${text} ×`;
            button.addEventListener('click', () => { input.checked = false; this.apply(); this.formTarget.querySelector(`[name="${input.name}"]`)?.closest('details').querySelector('summary').focus(); });
            this.activeTarget.append(button);
        }
        this.element.querySelectorAll('[data-filter-count]').forEach(count => {
            const amount = selected.filter(input => input.name === `${count.dataset.filterCount}[]`).length;
            count.textContent = String(amount); count.hidden = amount === 0;
        });
    }
    paginate(event) {
        const link = event.target.closest('a[data-ticket-page]');
        if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault(); this.load(new URL(link.href), true, true);
    }
    async load(url, updateHistory = true, focusResults = false) {
        this.request?.abort();
        const request = new AbortController(); this.request = request;
        this.resultsTarget.setAttribute('aria-busy', 'true');
        this.errorTarget.hidden = true;
        const endpoint = new URL(url); endpoint.searchParams.set('_fragment', '1');
        try {
            const response = await fetch(endpoint, {signal: request.signal, cache: 'no-store', headers: {'X-Requested-With': 'XMLHttpRequest'}});
            if (response.redirected) { window.location.assign(response.url); return; }
            if (!response.ok) throw new Error('Failed to filter tickets');
            const html = await response.text();
            if (request.signal.aborted) return;
            this.resultsTarget.innerHTML = html;
            if (updateHistory) history.pushState({}, '', url);
            if (focusResults) { const heading = this.resultsTarget.querySelector('h2'); heading.tabIndex = -1; heading.focus(); }
        } catch (error) {
            if (error.name !== 'AbortError') { this.errorTarget.textContent = this.errorValue; this.errorTarget.hidden = false; }
        } finally {
            if (this.request === request) { this.resultsTarget.removeAttribute('aria-busy'); this.request = null; }
        }
    }
}
