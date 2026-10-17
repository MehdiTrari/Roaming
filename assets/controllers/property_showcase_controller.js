import {Controller} from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['stage', 'slide', 'choice', 'controls', 'position'];
    static values = {animated: {type:Boolean, default:true}};
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.count = this.slideTargets.length;
        const slug = new URL(location.href).searchParams.get('slug') || this.element.dataset.activeSlug;
        let index = this.slideTargets.findIndex(slide => slide.dataset.slug === slug);
        if (index < 0) index = Math.max(0, this.slideTargets.findIndex(slide => slide.dataset.hasPhoto === 'true'));
        this.index = index;
        this.position = this.target = index;
        this.velocity = 0;
        this.render(false);
        this.element.classList.add('is-ready');
        this.controlsTarget.hidden = this.count < 2;
        this.beforeCache = () => this.finishImmediately();
        document.addEventListener('turbo:before-cache', this.beforeCache);
    }
    disconnect() {
        this.stopAnimation(); this.releasePointer();
        document.removeEventListener('turbo:before-cache', this.beforeCache);
    }
    modulo(value) { return ((value % this.count) + this.count) % this.count; }
    offset(index) {
        const distance = index - this.position;
        return distance - Math.round(distance / this.count) * this.count;
    }
    paint() {
        const fadeEdge = Math.min(2, this.count / 2);
        this.slideTargets.forEach((slide, index) => {
            const offset = this.offset(index), distance = Math.abs(offset);
            const emphasis = Math.max(0, 1 - distance);
            const opacity = Math.max(0, Math.min(1, (fadeEdge - distance) / Math.min(.65, fadeEdge * .5)));
            const active = index === this.index;
            slide.style.setProperty('--slide-offset', offset);
            slide.style.setProperty('--slide-scale', .84 + .16 * emphasis);
            slide.style.setProperty('--slide-rotate', `${-7 * Math.max(-1, Math.min(1, offset))}deg`);
            slide.style.setProperty('--slide-shade', .48 * (1 - emphasis));
            slide.style.setProperty('--slide-saturation', .65 + .35 * emphasis);
            slide.style.setProperty('--slide-shadow', .1 + .25 * emphasis);
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
        this.choiceTargets.forEach((button, index) => button.setAttribute('aria-pressed', String(index === this.index)));
        const slide = this.slideTargets[this.index];
        this.element.dataset.activeSlug = slide.dataset.slug;
        this.positionTarget.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(this.count).padStart(2, '0')} · ${slide.querySelector('h3').textContent.trim()}`;
        if (announce) this.element.dispatchEvent(new CustomEvent('showcase:change', {bubbles:true, detail:{slug:slide.dataset.slug}}));
    }
    go(index, absolute = false, velocity = this.velocity) {
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
        this.stopAnimation(); this.releasePointer();
        this.position = this.target; this.velocity = 0; this.paint();
    }
    animate() {
        this.stopAnimation();
        // This deliberate spatial navigation is explicitly animated by the page.
        // Windows' reduced-motion preference still disables decorative CSS effects,
        // but must not turn the requested carousel movement into a teleport.
        if (!this.animatedValue || Math.abs(this.target - this.position) < .0001) { this.finishImmediately(); return; }
        this.element.classList.add('is-moving');
        let previous = performance.now();
        const tick = now => {
            const elapsed = Math.min(.032, Math.max(.001, (now - previous) / 1000)); previous = now;
            // Exact critically damped spring: a soft start and a long deceleration,
            // independent of frame rate, without an overshoot at the center.
            const frequency = 8.5;
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
