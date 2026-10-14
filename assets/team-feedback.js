const queryKeys = ['_locale', 'slug', 'year', 'month', 'arrivalDate', 'departureDate', 'guests'];
let pending = null;
document.addEventListener('click', async (event) => {
    const close = event.target.closest('[data-team-close]');
    if (close) { close.closest('dialog').close(); return; }
    const link = event.target.closest('[data-team-report]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const dialog = document.querySelector('[data-team-dialog]');
    if (!dialog?.showModal) return;
    event.preventDefault();
    pending?.abort();
    const request = new AbortController(); pending = request;
    link.setAttribute('aria-busy', 'true');
    try {
        const url = new URL(link.href); url.searchParams.set('embed', '1');
        const response = await fetch(url, {signal: request.signal, credentials: 'same-origin', cache: 'no-store'});
        if (!response.ok || response.redirected) { window.location.assign(link.href); return; }
        const markup = await response.text();
        if (!dialog.isConnected) return;
        dialog.querySelector('[data-team-form]').innerHTML = markup;
        const page = new URL(window.location.href);
        const safe = new URLSearchParams();
        for (const key of queryKeys) if (page.searchParams.has(key)) safe.set(key, page.searchParams.get(key));
        dialog.querySelector('[name="test_ticket[page]"]').value = page.pathname + (safe.size ? `?${safe}` : '');
        dialog.querySelector('[name="test_ticket[screen]"]').value = `${Math.min(window.innerWidth, 99999)}x${Math.min(window.innerHeight, 99999)}`;
        dialog.showModal();
        dialog.querySelector('input:not([type="hidden"])')?.focus();
        dialog.addEventListener('close', () => { if (link.isConnected) link.focus(); }, {once: true});
    } catch (error) {
        if (error.name !== 'AbortError') window.location.assign(link.href);
    } finally { link.removeAttribute('aria-busy'); }
});
document.addEventListener('turbo:before-cache', () => {
    pending?.abort();
    const dialog = document.querySelector('[data-team-dialog]');
    if (dialog?.open) dialog.close();
    if (dialog) dialog.querySelector('[data-team-form]').replaceChildren();
});
