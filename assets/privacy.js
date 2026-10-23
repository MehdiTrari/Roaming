const storageKey = 'roaming.privacy.v1';
const mapStorageKey = 'roaming.maps.v1';
const lifetime = 180 * 24 * 60 * 60 * 1000;
const memoryChoices = {};
// Map display is a preference for a service without advertising trackers.
// Preserve older refusals; GuestLucky still requires its own explicit consent.
const choiceVersion = service => service === 'maps' ? 3 : 1;
let dismiss = () => {};

function readChoice(service = 'guestlucky') {
    let choice = memoryChoices[service];
    if (!choice) {
        try { choice = JSON.parse(localStorage.getItem(service === 'maps' ? mapStorageKey : storageKey) || 'null'); }
        catch { choice = null; }
    }
    const now = Date.now();
    const validVersion = service === 'maps' ? [1, 2, 3].includes(choice?.version) : choice?.version === 1;
    return validVersion && typeof choice[service] === 'boolean'
        && Number.isFinite(choice.updatedAt) && choice.updatedAt <= now
        && Number.isFinite(choice.expiresAt) && choice.expiresAt > now
        && choice.expiresAt <= choice.updatedAt + lifetime ? choice : null;
}

export const guestLuckyAllowed = () => readChoice()?.guestlucky === true;
export const mapsAllowed = () => readChoice('maps')?.maps !== false;
export const enableMaps = () => storeChoice(true, 'maps');
const notifyChoice = () => document.dispatchEvent(new CustomEvent('privacy:change', {detail: {guestlucky: guestLuckyAllowed(), maps: mapsAllowed()}}));

function storeChoice(allowed, service = 'guestlucky') {
    const updatedAt = Date.now();
    const choice = {version: choiceVersion(service), [service]: allowed, updatedAt, expiresAt: updatedAt + lifetime};
    try { localStorage.setItem(service === 'maps' ? mapStorageKey : storageKey, JSON.stringify(choice)); delete memoryChoices[service]; }
    catch { memoryChoices[service] = choice; }
    notifyChoice();
}

function openPreferences(trigger, signal) {
    dismiss();
    const dialog = document.getElementById('privacy-preferences');
    if (!dialog || signal?.aborted) return Promise.resolve(false);
    return new Promise(resolve => {
        const listeners = new AbortController();
        const on = (element, type, callback) => element?.addEventListener(type, callback, {signal: listeners.signal});
        let settled = false;
        const finish = allowed => {
            if (settled) return;
            settled = true; listeners.abort(); signal?.removeEventListener('abort', aborted);
            if (dialog.open) dialog.close();
            dismiss = () => {};
            if (trigger?.isConnected) trigger.focus({preventScroll: true});
            resolve(allowed);
        };
        const aborted = () => finish(false);
        dismiss = aborted;
        signal?.addEventListener('abort', aborted, {once: true});
        const status = dialog.querySelector('[data-privacy-status]');
        status.textContent = guestLuckyAllowed() ? status.dataset.allowed : status.dataset.refused;
        const guestChoice = dialog.querySelector('[data-privacy-service="guestlucky"]');
        const mapChoice = dialog.querySelector('[data-privacy-service="maps"]');
        guestChoice.checked = guestLuckyAllowed(); mapChoice.checked = mapsAllowed();
        on(dialog.querySelector('[data-privacy-allow]'), 'click', () => { storeChoice(true); storeChoice(true, 'maps'); finish(true); });
        on(dialog.querySelector('[data-privacy-refuse]'), 'click', () => { storeChoice(false); storeChoice(false, 'maps'); finish(false); });
        on(dialog.querySelector('[data-privacy-save]'), 'click', () => {
            // Saving only a map preference must not renew booking consent.
            if (guestChoice.checked !== guestLuckyAllowed()) storeChoice(guestChoice.checked);
            if (mapChoice.checked !== mapsAllowed()) storeChoice(mapChoice.checked, 'maps');
            finish(guestChoice.checked);
        });
        on(dialog.querySelector('[data-privacy-close]'), 'click', aborted);
        on(dialog, 'cancel', event => { event.preventDefault(); finish(false); });
        on(dialog, 'close', aborted);
        on(dialog, 'click', event => {
            const box = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) finish(false);
        });
        on(window, 'storage', event => {
            if (event.key === storageKey || event.key === null) finish(guestLuckyAllowed());
            else if (event.key === mapStorageKey) mapChoice.checked = mapsAllowed();
        });
        dialog.showModal();
        // Give refusal and permission equal visibility; never preselect permission.
        dialog.querySelector('[data-privacy-close]').focus({preventScroll: true});
    });
}

export function requestGuestLuckyConsent({signal, trigger} = {}) {
    if (signal?.aborted) return Promise.resolve(false);
    return guestLuckyAllowed() ? Promise.resolve(true) : openPreferences(trigger, signal);
}

// Delegation belongs to the document, which Turbo keeps between visits.
// Register once: a late turbo:load must not dismiss a preference dialog
// that the visitor already opened just after the first page loaded.
document.addEventListener('click', event => {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        const trigger = event.target.closest('[data-privacy-open]');
        if (!trigger || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (!document.getElementById('privacy-preferences')) return;
        event.preventDefault(); openPreferences(trigger);
});
window.addEventListener('storage', event => {
        if (![storageKey, mapStorageKey, null].includes(event.key)) return;
        if (event.key === mapStorageKey || event.key === null) delete memoryChoices.maps;
        if (event.key === storageKey || event.key === null) delete memoryChoices.guestlucky;
        notifyChoice();
});
document.addEventListener('turbo:before-cache', () => dismiss());
