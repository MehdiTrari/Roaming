import { Controller } from '@hotwired/stimulus';
import { readStay, stayLink } from '../booking-state';

export default class extends Controller {
    connect() {
        const update = link => {
            if (link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, location.href);
            const languageLink = url.pathname.match(/^\/change-locale\/(fr|en)$/);
            if (url.origin === location.origin && (languageLink || /^\/property\//.test(url.pathname) || ['/', '/about-us', '/disponibilites', '/contact-us'].includes(url.pathname))) {
                const criteria = readStay();
                if (link.hasAttribute('data-booking-clear-dates')) criteria.arrivalDate = criteria.departureDate = '';
                if (link.hasAttribute('data-booking-reset-property')) criteria.slug = '';
                else if (link.dataset.bookingSlug) criteria.slug = link.dataset.bookingSlug;
                link.href = stayLink(link.href, criteria);
                const locale = languageLink?.[1] || new URL(location.href).searchParams.get('_locale');
                if (['fr', 'en'].includes(locale)) { const destination = new URL(link.href); destination.searchParams.set('_locale', locale); link.href = destination.pathname + destination.search + destination.hash; }
            }
        };
        this.syncLinks = () => this.element.querySelectorAll('a[href]').forEach(update);
        this.onClick = event => {
            const link = event.target.closest('a[href]');
            if (link) update(link);
        };
        this.element.addEventListener('click', this.onClick, true);
        document.addEventListener('booking:criteria-change', this.syncLinks);
        this.syncLinks();
    }
    disconnect() { this.element.removeEventListener('click', this.onClick, true); document.removeEventListener('booking:criteria-change', this.syncLinks); }
}
