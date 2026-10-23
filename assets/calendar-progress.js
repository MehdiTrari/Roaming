import {t} from './booking-ui';

// As with the search progress, intermediate values are estimated. Only a
// successful, current calendar read can complete the bar at 100%.
export class CalendarProgress {
    constructor(surface) {
        this.loader = surface.querySelector('.calendar-fetch-loader');
        this.fill = this.loader.querySelector('[data-calendar-progress-fill]');
        this.percent = this.loader.querySelector('[data-calendar-progress-percent]');
        this.label = this.loader.querySelector('strong');
        this.loadingLabel = this.label.textContent;
    }
    start() {
        this.cancel();
        this.active = true;
        this.startedAt = performance.now();
        this.value = 0;
        this.label.textContent = this.loadingLabel;
        this.paint();
        this.interval = setInterval(() => this.update(this.value + Math.max(.12, (94 - this.value) * .065)), 160);
    }
    update(value) {
        if (!this.active) return;
        this.value = Math.max(this.value, Math.min(value, 94));
        this.paint();
    }
    paint() {
        this.percent.textContent = `${Math.floor(this.value)}%`;
        this.fill.style.width = `${this.value}%`;
        this.loader.setAttribute('aria-valuenow', Math.floor(this.value));
    }
    finish() {
        if (!this.active) return Promise.resolve();
        clearInterval(this.interval);
        this.value = 100;
        this.paint();
        this.label.textContent = t('checked');
        // Cached reads need no artificial delay. Otherwise keep the completed
        // bar visible briefly before revealing the dates in the same space.
        if (performance.now() - this.startedAt < 50) return Promise.resolve();
        return new Promise(resolve => {
            this.complete = resolve;
            this.timeout = setTimeout(() => { this.complete = null; resolve(); }, 360);
        });
    }
    cancel() {
        clearInterval(this.interval);
        clearTimeout(this.timeout);
        this.active = false;
        this.complete?.();
        this.complete = null;
    }
}
