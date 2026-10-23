import { Controller } from '@hotwired/stimulus';

let currentHighlight;

// A body-level backdrop with real openings: no cloned button, elevated
// ancestors, altered navigation styles or duplicate form submissions.
export default class extends Controller {
    static targets = ['button'];
    static values = {
        active: {type: Boolean, default: false},
        selector: String,
        pulse: {type: Boolean, default: true},
        exclude: {type: String, default: 'nav'},
        blur: {type: Number, default: 5},
        opacity: {type: Number, default: .56},
        scale: {type: Number, default: 1.06},
        duration: {type: Number, default: 1800}
    };

    connect() {
        this.connected = true;
        this.lifecycle = new AbortController();
        const options = {signal: this.lifecycle.signal};
        document.addEventListener('turbo:before-cache', () => { this.deactivate(); this.clearExit(); }, options);
        document.addEventListener('turbo:before-render', () => { this.deactivate(); this.clearExit(); }, options);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.deactivate();
        }, options);
        if (this.activeValue) this.start();
    }

    disconnect() {
        this.connected = false;
        this.lifecycle?.abort();
        this.deactivate();
        this.clearExit();
    }

    activeValueChanged(active) {
        if (!this.connected) return;
        if (active) this.start(); else this.stop();
    }

    // Public JS methods, also usable with Stimulus data-action attributes.
    activate() { this.activeValue = true; this.start(); }
    deactivate() { this.activeValue = false; this.stop(); }
    toggle(event) {
        if (typeof event.detail?.pulse === 'boolean') this.pulseValue = event.detail.pulse;
        if (event.detail?.active === true) this.activate(); else this.deactivate();
    }

    pulseValueChanged() {
        if (this.overlay) this.animateButton?.();
    }

    start() {
        if (!this.connected || this.overlay || document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.clearExit();
        try {
            this.button = this.hasButtonTarget ? this.buttonTarget : document.querySelector(this.selectorValue);
            // Validate the optional exclusion selector before creating effects.
            document.querySelectorAll(this.excludeValue);
        } catch { this.deactivate(); return; }
        if (!this.button || this.button.disabled || !this.button.getClientRects().length
            || !CSS.supports('clip-path', 'path(evenodd, "M0 0H1V1H0Z")')) {
            this.deactivate(); return;
        }
        currentHighlight?.deactivate();
        currentHighlight = this;
        this.lastPath = '';
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-highlight-overlay';
        this.overlay.setAttribute('aria-hidden', 'true');
        this.overlay.style.setProperty('--tutorial-highlight-blur', `${Math.max(0, this.blurValue)}px`);
        this.overlay.style.setProperty('--tutorial-highlight-opacity', Math.min(.85, Math.max(0, this.opacityValue)));
        // First measure and clip, then insert: never flash a full-screen veil.
        this.updateGeometry();
        document.body.append(this.overlay);
        this.overlayEntrance = this.overlay.animate([{opacity: 0}, {opacity: 1}], {
            duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 240,
            easing: 'cubic-bezier(.22, 1, .36, 1)'
        });

        const style = getComputedStyle(this.button);
        const baseScale = style.scale === 'none' ? '1' : style.scale;
        const scales = baseScale.split(/\s+/).map(Number);
        const enlarged = scales.map(value => value * Math.min(1.12, Math.max(1, this.scaleValue))).join(' ');
        const filter = style.filter === 'none' ? '' : `${style.filter} `;
        this.motion = matchMedia('(prefers-reduced-motion: reduce)');
        this.animateButton = () => {
            this.pulse?.cancel();
            this.pulse = null;
            if (!this.pulseValue) return;
            // Keep the requested gentle pulse under the Windows accessibility
            // setting too, with a slower cycle and less change in brightness.
            this.pulse = this.button.animate?.([
                {scale: baseScale, filter: `${filter}brightness(1)`},
                {scale: enlarged, filter: `${filter}brightness(${this.motion.matches ? 1.06 : 1.15})`},
                {scale: baseScale, filter: `${filter}brightness(1)`}
            ], {duration: Math.max(600, this.durationValue, this.motion.matches ? 2600 : 0), iterations: Infinity, easing: 'ease-in-out'});
            if (this.button.matches(':hover')) this.pulse?.pause();
        };
        this.animateButton();
        this.interactions = new AbortController();
        const options = {signal: this.interactions.signal};
        this.motion.addEventListener('change', this.animateButton, options);
        // A stable target on hover makes the real button easy to click.
        this.button.addEventListener('pointerenter', () => this.pulse?.pause(), options);
        this.button.addEventListener('pointerleave', () => this.pulse?.play(), options);
        this.button.addEventListener('click', () => this.deactivate(), {...options, capture: true});
        this.element.addEventListener('submit', () => this.deactivate(), {...options, capture: true});
        const follow = () => {
            if (!this.button.isConnected || this.button.disabled || !this.button.getClientRects().length) {
                this.deactivate(); return;
            }
            // Includes the actual pulse bounds, scroll, sticky navigation,
            // expanded menus, resize, orientation and ancestor transforms.
            this.updateGeometry();
            this.frame = requestAnimationFrame(follow);
        };
        this.frame = requestAnimationFrame(follow);
        this.dispatch('activated');
    }

    updateGeometry() {
        const width = innerWidth, height = innerHeight;
        const preserved = [...document.querySelectorAll(this.excludeValue)];
        // When the whole search module is preserved, a second hole for its
        // button is redundant and would erase the module's rounded corners.
        const elements = preserved.some(element => element.contains(this.button)) ? preserved : [this.button, ...preserved];
        let holes = [...new Set(elements)].flatMap(element => {
            const box = element.getBoundingClientRect();
            if (!box.width || !box.height || box.bottom <= 0 || box.top >= height || box.right <= 0 || box.left >= width
                || getComputedStyle(element).visibility === 'hidden') return [];
            const style = getComputedStyle(element);
            const scaleX = box.width / (element.offsetWidth || box.width);
            const scaleY = box.height / (element.offsetHeight || box.height);
            const radius = value => value.endsWith('%') ? parseFloat(value) / 100 * Math.min(box.width, box.height) : parseFloat(value) * Math.min(scaleX, scaleY);
            // Include the final device pixel of a fractional nav border. This
            // avoids a dim seam from clip-path antialiasing on mobile.
            const pixelRatio = devicePixelRatio || 1;
            const lower = value => element === this.button ? value : Math.floor(value * pixelRatio) / pixelRatio;
            const upper = value => element === this.button ? value : Math.ceil(value * pixelRatio) / pixelRatio;
            return [{x: lower(box.left), y: lower(box.top), right: upper(box.right), bottom: upper(box.bottom),
                radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(value => Math.max(0, Math.min(radius(value) || 0, box.width / 2, box.height / 2)))}];
        });
        // A sticky header can cover the top of the search module on scroll.
        // Trim that already-excluded strip instead of opening a full-width
        // rectangle down the sides of the otherwise narrower search module.
        for (const upper of holes) for (const lower of holes) {
            if (upper === lower || upper.x > lower.x || upper.right < lower.right
                || upper.y > Math.max(0, lower.y) || upper.bottom <= lower.y || upper.bottom >= lower.bottom) continue;
            const covered = upper.bottom - lower.y;
            lower.y = upper.bottom;
            lower.radii[0] = Math.max(0, lower.radii[0] - covered);
            lower.radii[1] = Math.max(0, lower.radii[1] - covered);
        }
        // Even-odd paths would shade overlapping holes again. Unite remaining
        // intersecting exclusions, including expanded dropdown menus.
        for (let first = 0; first < holes.length; first++) {
            for (let second = first + 1; second < holes.length; second++) {
                const a = holes[first], b = holes[second];
                if (a.x >= b.right || b.x >= a.right || a.y >= b.bottom || b.y >= a.bottom) continue;
                holes[first] = {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom), radii: [0, 0, 0, 0]};
                holes.splice(second, 1);
                first = -1;
                break;
            }
        }
        const roundedPath = ({x, y, right, bottom, radii: [tl, tr, br, bl]}) =>
            `M${x + tl} ${y}H${right - tr}A${tr} ${tr} 0 0 1 ${right} ${y + tr}V${bottom - br}A${br} ${br} 0 0 1 ${right - br} ${bottom}H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${bottom - bl}V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}Z`;
        const path = `M0 0H${width}V${height}H0Z${holes.map(roundedPath).join('')}`;
        if (path !== this.lastPath) {
            this.overlay.style.clipPath = `path(evenodd, "${path}")`;
            this.lastPath = path;
        }
    }

    clearExit() {
        this.exitAnimation?.cancel(); this.exitOverlay?.remove();
        this.exitAnimation = this.exitOverlay = null;
    }

    stop() {
        const wasActive = Boolean(this.overlay);
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this.interactions?.abort();
        this.pulse?.cancel();
        this.pulse = null;
        const opacity = this.overlay ? getComputedStyle(this.overlay).opacity : '1';
        this.overlayEntrance?.cancel();
        if (this.overlay) {
            this.clearExit();
            const overlay = this.overlay;
            overlay.classList.replace('tutorial-highlight-overlay', 'tutorial-highlight-exit');
            this.exitOverlay = overlay;
            this.exitAnimation = overlay.animate([{opacity}, {opacity: 0}], {
                duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 140, easing: 'ease-out'
            });
            this.exitAnimation.onfinish = () => this.clearExit();
        }
        this.overlay = null;
        this.button = null;
        if (currentHighlight === this) currentHighlight = null;
        if (wasActive) this.dispatch('deactivated');
    }
}
