// One cancellable scroll shared by anchors and the guided search. No timers or dependencies.
let cancelScroll;
export function scrollToPosition(top, {signal, duration, gentle = false} = {}) {
    cancelScroll?.();
    return new Promise(resolve => {
        const from = scrollY;
        const destination = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
        if (signal?.aborted) { resolve(false); return; }
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced && !gentle || Math.abs(destination - from) < 2) {
            window.scrollTo({top: destination, behavior: 'instant'}); resolve(true); return;
        }
        const listeners = new AbortController();
        const length = reduced ? 220 : duration ?? Math.min(800, Math.max(320, Math.abs(destination - from) * .32));
        let frame, start;
        const finish = complete => {
            cancelAnimationFrame(frame); listeners.abort();
            signal?.removeEventListener('abort', interrupted);
            if (cancelScroll === interrupted) cancelScroll = null;
            resolve(complete);
        };
        const interrupted = () => finish(false);
        cancelScroll = interrupted;
        signal?.addEventListener('abort', interrupted, {once: true});
        for (const type of ['wheel', 'touchstart', 'pointerdown']) window.addEventListener(type, interrupted, {passive: true, once: true, signal: listeners.signal});
        window.addEventListener('resize', interrupted, {once: true, signal: listeners.signal});
        window.visualViewport?.addEventListener('resize', interrupted, {once: true, signal: listeners.signal});
        window.addEventListener('keydown', event => {
            if (['Escape', 'Tab', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) interrupted();
        }, {signal: listeners.signal});
        const tick = now => {
            start ??= now;
            const progress = Math.min(1, (now - start) / length);
            // Quintic ease-in-out starts and finishes without a jolt.
            const eased = progress < .5 ? 16 * progress ** 5 : 1 - (-2 * progress + 2) ** 5 / 2;
            window.scrollTo({top: from + (destination - from) * eased, behavior: 'instant'});
            if (progress < 1) frame = requestAnimationFrame(tick); else finish(true);
        };
        frame = requestAnimationFrame(tick);
    });
}

export function scrollToElement(element, options = {}) {
    const header = document.querySelector('header.sticky-top');
    const offset = (header?.offsetHeight || 0) + (options.gap ?? 20);
    const box = element.getBoundingClientRect();
    const available = innerHeight - offset - (options.gap ?? 20);
    const inset = options.block === 'center' ? Math.max(0, (available - box.height) / 2) : 0;
    return scrollToPosition(scrollY + box.top - offset - inset, options);
}

export function animateSearchSurface(element, opening, current) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const folded = {opacity: 0, transform: 'perspective(1000px) rotateX(-5deg) translateY(-8px) scale(.985)', clipPath: 'inset(0 0 10% 0 round 16px)'};
    const expanded = {opacity: 1, transform: 'perspective(1000px) rotateX(0) translateY(0) scale(1)', clipPath: 'inset(0 round 16px)'};
    const frames = reduced ? [{opacity: current?.opacity ?? (opening ? 0 : 1)}, {opacity: opening ? 1 : 0}] : opening ? [current || folded, expanded] : [current || expanded, {...folded, transform: 'translateY(-4px) scale(.99)'}];
    return element.animate?.(frames, {duration: reduced ? 100 : opening ? 300 : 150, easing: opening ? 'cubic-bezier(.22, 1, .36, 1)' : 'ease-out', fill: 'none'});
}
