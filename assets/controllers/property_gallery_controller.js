import { Controller } from '@hotwired/stimulus';
import Carousel from 'bootstrap/js/dist/carousel';

// Initialize the existing Bootstrap gallery on each Turbo visit, including touch.
export default class extends Controller {
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.carousel = Carousel.getOrCreateInstance(this.element, { interval: false, ride: false, keyboard: true, touch: true });
        this.onSlide = () => {
            const rail = this.element.querySelector('.property-gallery-thumbs');
            const active = rail?.querySelector('[aria-current="true"]');
            if (!active) return;
            rail.scrollTo({ left: active.offsetLeft - rail.offsetLeft - (rail.clientWidth - active.clientWidth) / 2, behavior: 'instant' });
        };
        this.element.addEventListener('slid.bs.carousel', this.onSlide);
    }

    disconnect() {
        this.element.removeEventListener('slid.bs.carousel', this.onSlide);
        this.carousel?.dispose();
    }
}
