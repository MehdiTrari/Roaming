import {node, t} from './booking-ui';

// The intermediate percentage is an estimate; only a finished request reaches 100.
export class SearchProgress {
    constructor(status) { this.status = status; }
    start() {
        this.cancel();
        this.value = 0;
        this.status.classList.add('is-loading');
        this.label = node('span', t('pending'));
        this.percent = node('span', '0%', 'booking-progress-percent');
        this.percent.setAttribute('aria-hidden', 'true');
        this.track = node('span', '', 'booking-progress-track');
        this.track.setAttribute('aria-hidden', 'true');
        this.fill = node('span', '', 'booking-progress-fill');
        this.track.append(this.fill);
        this.status.replaceChildren(this.label, this.percent, this.track);
        this.interval = setInterval(() => this.update(this.value + Math.max(.12, (94 - this.value) * .065)), 160);
    }
    update(value) {
        this.value = Math.max(this.value, Math.min(value, 94));
        this.paint();
    }
    paint() {
        this.percent.textContent = `${Math.floor(this.value)}%`;
        this.fill.style.width = `${this.value}%`;
    }
    finish() {
        clearInterval(this.interval);
        this.value = 100;
        this.paint();
        this.label.textContent = t('checked');
        this.status.classList.add('is-complete');
        this.timeout = setTimeout(() => { this.cancel(); this.status.textContent = ''; }, 800);
    }
    cancel() {
        clearInterval(this.interval); clearTimeout(this.timeout);
        this.status.classList.remove('is-loading', 'is-complete');
    }
}
