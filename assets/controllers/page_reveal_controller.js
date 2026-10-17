import { Controller } from '@hotwired/stimulus';

const candidates = [
    '.reveal', '[data-reveal]', '.home-hero-copy > *', '.property-showcase',
    '.property-breadcrumb', '.property-heading > *', '.property-page > .container > .property-facts',
    '.property-gallery', '.property-photo-placeholder', '.property-section-nav',
    '.property-description > .property-panel', '.property-availability',
    '.property-other-heading', '.property-other .row > div',
    '.calendar-intro > *', '.stay-property-picker > h2', '.availability-property-card',
    '.availability-journey [data-calendar-target="stage"]',
    '.legal-page-heading > *', '.legal-page-nav', '.legal-draft', '.legal-content > *',
    '.team-maintenance > *', '.site-footer .row > div', '.site-footer .border-top'
].join(', ');

// Reveal individual sections, never transform the page or the sticky layout.
// Without this controller, all content remains visible by default.
export default class extends Controller {
    connect() {
        // Turbo restores the destination scroll position after inserting its
        // body. Measure in the next rendering frame, against that position.
        this.startFrame = requestAnimationFrame(() => { this.startFrame = null; this.prepare(); });
    }

    prepare() {
        if (document.documentElement.hasAttribute('data-turbo-preview') || !window.IntersectionObserver || !Element.prototype.animate) return;
        this.listeners = new AbortController();
        this.pending = new Map();
        this.animations = new Map();
        this.motion = matchMedia('(prefers-reduced-motion: reduce)');
        const all = [...this.element.querySelectorAll(candidates)];
        const selected = new Set(all);
        const targets = all.filter(element => {
            if (element.dataset.pageRevealState === 'visible' || !element.getClientRects().length) return false;
            // An outer reveal already introduces its contents. Avoid compounded
            // opacity and competing animations on nested cards or form controls.
            for (let parent = element.parentElement; parent && parent !== this.element; parent = parent.parentElement) {
                if (selected.has(parent)) return false;
            }
            return true;
        });
        this.observer = new IntersectionObserver(entries => {
            let order = 0;
            for (const entry of entries) if (entry.isIntersecting) this.reveal(entry.target, Math.min(order++ * 100, 300));
        }, {rootMargin: '0px 0px -36px 0px', threshold: .01});

        // Read layout first, then prepare every target in one batch.
        const measured = targets.map(element => {
            const style = getComputedStyle(element), box = element.getBoundingClientRect();
            const fadeOnly = element.dataset.reveal === 'fade' || ['fixed', 'sticky'].includes(style.position)
                || element.matches('.property-showcase, .property-gallery, .property-section-nav, .site-header')
                || element.matches('a, button, input, select, textarea, [role="button"]')
                || element.querySelector('a, button, input, select, textarea, form, dialog, .stay-map, [data-calendar-target="stage"]')
                || element.matches('[data-calendar-target="stage"]');
            return {element, box, opacity: Number(style.opacity), fadeOnly,
                delay: Math.min(200, Math.max(0, parseFloat(element.style.transitionDelay || '0') * 1000))};
        });
        let entrance = 0;
        for (const item of measured) {
            if (item.box.bottom <= 0) { item.element.dataset.pageRevealState = 'visible'; continue; }
            this.pending.set(item.element, item);
            item.element.dataset.pageRevealState = 'pending';
            if (item.box.top < innerHeight - 36) this.reveal(item.element, Math.min(entrance++ * 85 + item.delay, 340));
            else this.observer.observe(item.element);
        }
        const makeInteractive = event => {
            for (const element of [...this.pending.keys(), ...this.animations.keys()]) {
                if (element.contains(event.target)) this.finish(element);
            }
        };
        // A fast click or keyboard focus reveals the control immediately;
        // animations never lock interaction or leave an invisible focus target.
        this.element.addEventListener('focusin', makeInteractive, {capture: true, signal: this.listeners.signal});
        this.element.addEventListener('pointerdown', makeInteractive, {capture: true, passive: true, signal: this.listeners.signal});
        document.addEventListener('turbo:before-cache', () => this.showAll(), {signal: this.listeners.signal});
        this.motion.addEventListener('change', () => {
            for (const element of this.animations.keys()) this.finish(element);
        }, {signal: this.listeners.signal});
    }

    reveal(element, delay = 0) {
        const item = this.pending?.get(element);
        if (!item) return;
        this.pending.delete(element);
        this.observer.unobserve(element);
        element.dataset.pageRevealState = 'revealing';
        // Keep the explicitly requested gentle fade on Windows too, where the
        // system setting disables CSS animations. Reduced motion has no travel.
        const spatial = !this.motion.matches && !item.fadeOnly;
        const frames = [{opacity: 0}, {opacity: item.opacity}];
        if (spatial) { frames[0].translate = '0 22px'; frames[1].translate = '0 0'; }
        try {
            const animation = element.animate(frames, {
                duration: this.motion.matches ? 750 : 1150,
                delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both'
            });
            this.animations.set(element, animation);
            animation.onfinish = () => this.finish(element);
        } catch {
            this.finish(element);
        }
    }

    finish(element) {
        this.pending?.delete(element);
        this.observer?.unobserve(element);
        const animation = this.animations?.get(element);
        if (animation) { animation.onfinish = null; animation.cancel(); this.animations.delete(element); }
        element.dataset.pageRevealState = 'visible';
    }

    showAll() {
        this.observer?.disconnect();
        for (const element of [...(this.pending?.keys() || []), ...(this.animations?.keys() || [])]) this.finish(element);
    }

    disconnect() {
        cancelAnimationFrame(this.startFrame);
        this.showAll();
        this.listeners?.abort();
    }
}
