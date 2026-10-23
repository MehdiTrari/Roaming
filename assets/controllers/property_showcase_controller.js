import {Controller} from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['stage', 'slide', 'choice', 'controls', 'position'];
    static values = {animated: {type:Boolean, default:true}};
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.count = this.slideTargets.length;
        if (!this.count) return;
        this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.motionChanged = () => this.paint();
        this.motionPreference.addEventListener('change', this.motionChanged);
        const slug = new URL(location.href).searchParams.get('slug') || this.element.dataset.activeSlug;
        let index = this.slideTargets.findIndex(slide => slide.dataset.slug === slug);
        if (index < 0) index = Math.max(0, this.slideTargets.findIndex(slide => slide.dataset.hasPhoto === 'true'));
        this.index = index;
        this.position = this.target = index;
        this.velocity = 0;
        this.render(false);
        this.element.classList.add('is-ready');
        this.controlsTarget.hidden = this.count < 2;
        this.revealChoice(false);
        this.railObserver = new ResizeObserver(() => this.revealChoice(false));
        const rail = this.choiceTargets[this.index]?.parentElement;
        if (rail) this.railObserver.observe(rail);
        this.beforeCache = () => this.finishImmediately();
        document.addEventListener('turbo:before-cache', this.beforeCache);
    }
    disconnect() {
        this.stopAnimation(); this.releasePointer();
        this.motionPreference?.removeEventListener('change', this.motionChanged);
        this.railObserver?.disconnect();
        document.removeEventListener('turbo:before-cache', this.beforeCache);
    }
    modulo(value) { return ((value % this.count) + this.count) % this.count; }
    offset(index) {
        const distance = index - this.position;
        return distance - Math.round(distance / this.count) * this.count;
    }
    paint() {
        if (!this.count) return;
        const fadeEdge = Math.min(2, this.count / 2);
        const reducedMotion = this.motionPreference?.matches;
        this.slideTargets.forEach((slide, index) => {
            const offset = this.offset(index), distance = Math.abs(offset);
            const emphasis = Math.max(0, 1 - distance);
            const opacity = Math.max(0, Math.min(1, (fadeEdge - distance) / Math.min(.65, fadeEdge * .5)));
            const active = index === this.index;
            slide.style.setProperty('--slide-offset', offset);
            slide.style.setProperty('--slide-scale', reducedMotion ? 1 : .88 + .12 * emphasis);
            slide.style.setProperty('--slide-rotate', `${reducedMotion ? 0 : -3 * Math.max(-1, Math.min(1, offset))}deg`);
            slide.style.setProperty('--slide-shade', (reducedMotion ? .12 : .25) * (1 - emphasis));
            slide.style.setProperty('--slide-saturation', reducedMotion ? 1 : .85 + .15 * emphasis);
            slide.style.setProperty('--slide-shadow', .08 + .12 * emphasis);
            slide.style.setProperty('--slide-opacity', opacity);
            slide.style.zIndex = String(100 - Math.round(distance * 20));
            slide.classList.toggle('is-active', active);
            slide.classList.toggle('is-distant', opacity < .05);
            slide.setAttribute('aria-hidden', String(opacity < .1));
            slide.querySelector('[data-showcase-card]').inert = !active;
            slide.querySelector('.showcase-side-select').hidden = active || opacity < .1;
        });
    }
    render(announce = true) {
        this.paint();
        this.choiceTargets.forEach((button, index) => {
            const selected = index === this.index;
            button.setAttribute('aria-pressed', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        const slide = this.slideTargets[this.index];
        this.element.dataset.activeSlug = slide.dataset.slug;
        this.positionTarget.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(this.count).padStart(2, '0')} · ${slide.querySelector('h3').textContent.trim()}`;
        this.revealChoice(announce);
        if (announce) this.element.dispatchEvent(new CustomEvent('showcase:change', {bubbles:true, detail:{slug:slide.dataset.slug}}));
    }
    revealChoice(animate = true) {
        const choice = this.choiceTargets[this.index], picker = choice?.parentElement;
        if (!picker || picker.scrollWidth <= picker.clientWidth) return;
        // Scroll only the chip rail: scrollIntoView would move the whole page.
        const chip = choice.getBoundingClientRect(), rail = picker.getBoundingClientRect();
        if (chip.left >= rail.left + 8 && chip.right <= rail.right - 8) return;
        picker.scrollTo({left: picker.scrollLeft + chip.left - rail.left - (rail.width - chip.width) / 2,
            behavior: animate && !this.motionPreference?.matches ? 'smooth' : 'instant'});
    }
    go(index, absolute = false, velocity = this.velocity) {
        if (this.count < 2) return;
        const target = absolute ? index : this.position + this.offset(this.modulo(index));
        this.releasePointer(); this.stopAnimation();
        this.target = target; this.index = this.modulo(Math.round(target));
        // Momentum selects the destination, but the final approach stays gentle,
        // including when a tiny flick has only just crossed the selection threshold.
        const speedLimit = Math.min(1.8, Math.abs(target - this.position) * 2.2);
        this.velocity = Math.max(-speedLimit, Math.min(speedLimit, velocity));
        this.render(); this.animate();
    }
    previous() { this.go(this.target - 1, true); }
    next() { this.go(this.target + 1, true); }
    selectSide(event) { this.go(Number(event.currentTarget.dataset.index)); }
    selectChoice(event) { this.go(Number(event.currentTarget.dataset.index)); }
    keyboard(event) {
        if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        const action = {ArrowLeft: () => this.previous(), ArrowRight: () => this.next(), Home: () => this.go(0), End: () => this.go(this.count - 1)}[event.key];
        if (!action || this.count < 2) return;
        event.preventDefault(); action();
        this.choiceTargets[this.index].focus({preventScroll:true});
    }
    pointerDown(event) {
        if (event.button !== 0 || !event.isPrimary || this.count < 2 || this.pointer) return;
        this.stopAnimation();
        const step = parseFloat(getComputedStyle(this.element).getPropertyValue('--showcase-step')) / 100;
        this.pointer = {id:event.pointerId, x:event.clientX, y:event.clientY, origin:this.position,
            spacing:this.slideTargets[0].offsetWidth * step, dragging:false,
            samples:[{position:this.position, time:performance.now()}]};
        this.blockClickUntil = 0;
    }
    pointerMove(event) {
        if (!this.pointer || this.pointer.id !== event.pointerId) return;
        const delta = event.clientX - this.pointer.x, vertical = event.clientY - this.pointer.y;
        if (!this.pointer.dragging && Math.abs(delta) > 7 && Math.abs(delta) > Math.abs(vertical) * 1.25) {
            this.pointer.dragging = true; this.stageTarget.setPointerCapture(event.pointerId); this.element.classList.add('is-dragging');
        }
        if (this.pointer.dragging) {
            this.position = this.pointer.origin - delta / this.pointer.spacing;
            const now = performance.now();
            this.pointer.samples.push({position:this.position, time:now});
            this.pointer.samples = this.pointer.samples.filter(sample => now - sample.time <= 110);
            this.paint();
        }
    }
    pointerUp(event) {
        if (!this.pointer || this.pointer.id !== event.pointerId) return;
        const {dragging, samples} = this.pointer;
        this.blockClickUntil = dragging ? performance.now() + 450 : 0;
        if (!dragging) { this.releasePointer(); this.animate(); return; }
        const now = performance.now();
        const first = samples.find(sample => now - sample.time <= 110);
        const velocity = first && now - first.time > 8 ? Math.max(-4.5, Math.min(4.5, (this.position - first.position) / ((now - first.time) / 1000))) : 0;
        const projection = Math.max(-.65, Math.min(.65, velocity * .16));
        this.go(Math.round(this.position + projection), true, velocity);
    }
    pointerCancel() { this.releasePointer(); this.animate(); }
    preventNativeDrag(event) { event.preventDefault(); }
    releasePointer() {
        const pointer = this.pointer; this.pointer = null;
        if (pointer && this.hasStageTarget && this.stageTarget.hasPointerCapture(pointer.id)) this.stageTarget.releasePointerCapture(pointer.id);
        this.element.classList.remove('is-dragging');
    }
    stopAnimation() { cancelAnimationFrame(this.frame); this.frame = null; this.element.classList.remove('is-moving'); }
    finishImmediately() {
        if (!this.count) return;
        this.stopAnimation(); this.releasePointer();
        this.position = this.target; this.velocity = 0; this.paint();
    }
    animate() {
        this.stopAnimation();
        // Explicit spatial navigation stays legible with reduced motion: a shorter
        // gentle glide, with perspective and decorative scaling disabled in paint().
        if (!this.animatedValue || Math.abs(this.target - this.position) < .0001) { this.finishImmediately(); return; }
        this.element.classList.add('is-moving');
        let previous = performance.now();
        const tick = now => {
            const elapsed = Math.min(.032, Math.max(.001, (now - previous) / 1000)); previous = now;
            // Exact critically damped spring: a soft start and a long deceleration,
            // independent of frame rate, without an overshoot at the center.
            const frequency = this.motionPreference?.matches ? 12 : 8.5;
            const displacement = this.position - this.target;
            const impulse = this.velocity + frequency * displacement;
            const decay = Math.exp(-frequency * elapsed);
            this.position = this.target + (displacement + impulse * elapsed) * decay;
            this.velocity = (this.velocity - frequency * impulse * elapsed) * decay;
            this.paint();
            if (Math.abs(this.target - this.position) < .0006 && Math.abs(this.velocity) < .008) { this.finishImmediately(); return; }
            this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
    }
    preventDraggedClick(event) { if (performance.now() < (this.blockClickUntil || 0)) { event.preventDefault(); event.stopImmediatePropagation(); } }
    book(event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const guide = new CustomEvent('booking:guide', {detail:{slug:event.currentTarget.dataset.showcaseSlug}, cancelable:true});
        if (!document.dispatchEvent(guide)) { event.preventDefault(); event.stopPropagation(); }
    }
}
