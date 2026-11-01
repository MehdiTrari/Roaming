import {Controller} from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['viewport', 'card', 'controls', 'position', 'pause'];
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
        this.paused = false; this.hovered = false; this.focused = false; this.visible = false;
        this.abort = new AbortController();
        window.addEventListener('pointerup', event => this.pointerUp(event), {signal: this.abort.signal});
        window.addEventListener('pointercancel', () => this.pointerCancel(), {signal: this.abort.signal});
        this.viewportTarget.addEventListener('click', event => {
            if (performance.now() < (this.blockClickUntil || 0)) { event.preventDefault(); event.stopImmediatePropagation(); }
        }, {capture: true, signal: this.abort.signal});
        document.addEventListener('turbo:before-cache', () => { this.stopAnimation(); this.releasePointer(); }, {signal: this.abort.signal});
        this.viewportTarget.classList.add('is-enhanced');
        this.element.querySelectorAll('.guest-review-expand').forEach(button => button.hidden = false);
        this.resize = new ResizeObserver(() => this.update()); this.resize.observe(this.viewportTarget);
        this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.schedule(); }, {threshold: .2}); this.observer.observe(this.element);
        this.reduced.addEventListener('change', () => this.update(), {signal: this.abort.signal});
        document.addEventListener('visibilitychange', () => this.schedule(), {signal: this.abort.signal});
        this.update();
    }
    disconnect() {
        this.stopAnimation(); this.releasePointer();
        clearTimeout(this.timer); cancelAnimationFrame(this.scrollFrame); clearTimeout(this.focusTimer);
        this.abort?.abort(); this.observer?.disconnect(); this.resize?.disconnect();
        if (this.hasViewportTarget) this.viewportTarget.classList.remove('is-enhanced');
    }
    update() {
        const viewport = this.viewportTarget;
        this.overflow = viewport.scrollWidth > viewport.clientWidth + 2;
        this.controlsTarget.hidden = !this.overflow;
        this.pauseTarget.hidden = this.reduced.matches;
        const step = this.cardTargets.length > 1 ? this.cardTargets[1].offsetLeft - this.cardTargets[0].offsetLeft : viewport.clientWidth;
        const first = Math.round(viewport.scrollLeft / step) + 1;
        const visible = Math.max(1, Math.round((viewport.clientWidth + 24) / step));
        this.positionTarget.textContent = `${first}–${Math.min(this.cardTargets.length, first + visible - 1)} / ${this.cardTargets.length}`;
        this.schedule();
    }
    schedule() {
        clearTimeout(this.timer);
        if (this.overflow && this.visible && !document.hidden && !this.pointer && !this.motionFrame && !this.paused && !this.hovered && !this.focused && !this.reduced.matches) this.timer = setTimeout(() => this.move(1), 6500);
    }
    move(direction) {
        const viewport = this.viewportTarget, maximum = viewport.scrollWidth - viewport.clientWidth;
        const step = this.cardTargets.length > 1 ? this.cardTargets[1].offsetLeft - this.cardTargets[0].offsetLeft : viewport.clientWidth;
        let left = viewport.scrollLeft + direction * step;
        if (direction > 0 && viewport.scrollLeft >= maximum - 2) left = 0;
        else if (direction < 0 && viewport.scrollLeft <= 2) left = maximum;
        this.glide(left);
    }
    glide(destination) {
        this.stopAnimation();
        const viewport = this.viewportTarget;
        const target = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, destination));
        if (this.reduced.matches) { viewport.scrollLeft = target; this.update(); return; }
        viewport.classList.add('is-moving');
        let position = viewport.scrollLeft, velocity = 0, previous = performance.now();
        const tick = now => {
            const elapsed = Math.min(.032, Math.max(.001, (now - previous) / 1000)); previous = now;
            const displacement = position - target, impulse = velocity + 12 * displacement, decay = Math.exp(-12 * elapsed);
            position = target + (displacement + impulse * elapsed) * decay;
            velocity = (velocity - 12 * impulse * elapsed) * decay;
            viewport.scrollLeft = position;
            if (Math.abs(position - target) < .5 && Math.abs(velocity) < 5) {
                viewport.scrollLeft = target; this.stopAnimation(); this.update(); return;
            }
            this.motionFrame = requestAnimationFrame(tick);
        };
        this.motionFrame = requestAnimationFrame(tick);
    }
    stopAnimation() { cancelAnimationFrame(this.motionFrame); this.motionFrame = null; if (this.hasViewportTarget) this.viewportTarget.classList.remove('is-moving'); }
    pointerDown(event) {
        // Touch keeps native horizontal momentum and vertical page scrolling.
        if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || !this.overflow || event.target.closest('button, input, textarea, select') || this.pointer) return;
        this.stopAnimation(); this.blockClickUntil = 0;
        this.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, start: this.viewportTarget.scrollLeft, dragging: false};
        this.schedule();
    }
    pointerMove(event) {
        const pointer = this.pointer;
        if (!pointer || pointer.id !== event.pointerId) return;
        const delta = event.clientX - pointer.x;
        if (!pointer.dragging && Math.abs(delta) > 7 && Math.abs(delta) > Math.abs(event.clientY - pointer.y) * 1.25) {
            pointer.dragging = true; this.viewportTarget.classList.add('is-dragging'); this.viewportTarget.setPointerCapture(event.pointerId);
        }
        if (!pointer.dragging) return;
        event.preventDefault();
        this.viewportTarget.scrollLeft = pointer.start - delta;
    }
    pointerUp(event) {
        const pointer = this.pointer;
        if (!pointer || pointer.id !== event.pointerId) return;
        this.blockClickUntil = pointer.dragging ? performance.now() + 450 : 0;
        this.releasePointer();
        this.schedule();
    }
    releasePointer() {
        const pointer = this.pointer; this.pointer = null;
        if (!this.hasViewportTarget) return;
        if (pointer && this.viewportTarget.hasPointerCapture(pointer.id)) this.viewportTarget.releasePointerCapture(pointer.id);
        this.viewportTarget.classList.remove('is-dragging');
    }
    pointerCancel() { if (this.pointer?.dragging) this.blockClickUntil = performance.now() + 450; this.releasePointer(); this.schedule(); }
    preventNativeDrag(event) { event.preventDefault(); }
    keyboard(event) {
        if (event.target !== this.viewportTarget) return;
        const action = {ArrowLeft: () => this.previous(), ArrowRight: () => this.next(), Home: () => this.glide(0), End: () => this.glide(this.viewportTarget.scrollWidth)}[event.key];
        if (action) { event.preventDefault(); action(); }
    }
    next() { this.move(1); }
    previous() { this.move(-1); }
    scrolled() { cancelAnimationFrame(this.scrollFrame); this.scrollFrame = requestAnimationFrame(() => this.update()); }
    togglePause() {
        this.paused = !this.paused; this.pauseTarget.setAttribute('aria-pressed', String(this.paused));
        this.pauseTarget.setAttribute('aria-label', this.paused ? this.pauseTarget.dataset.playLabel : this.pauseTarget.dataset.pauseLabel);
        this.pauseTarget.textContent = this.paused ? '▷' : 'Ⅱ'; this.schedule();
    }
    hoverStart() { this.hovered = true; this.schedule(); }
    hoverEnd() { this.hovered = false; this.schedule(); }
    focusStart() { clearTimeout(this.focusTimer); this.focused = true; this.schedule(); }
    focusEnd() { this.focusTimer = setTimeout(() => { this.focused = this.element.contains(document.activeElement); this.schedule(); }, 0); }
    expand(event) {
        const button = event.currentTarget, expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded)); button.textContent = expanded ? button.dataset.less : button.dataset.more;
        button.closest('.guest-review-card').classList.toggle('is-expanded', expanded);
    }
}
