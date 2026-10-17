import {Controller} from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['carousel', 'select'];
    connect() {
        this.focus(this.element.dataset.explorerSlug || this.selectTarget.value);
    }
    focus(slug) {
        if (![...this.selectTarget.options].some(option => option.value === slug)) return;
        this.selectTarget.value = slug;
        this.element.dataset.explorerSlug = slug;
        this.element.dispatchEvent(new CustomEvent('property:focus', {detail: {slug}}));
    }
    changed(event) { this.focus(event.detail.slug); }
    selected() { this.select(this.selectTarget.value); }
    mapSelected(event) { this.select(event.detail.slug); }
    select(slug) {
        const carousel = this.application.getControllerForElementAndIdentifier(this.carouselTarget, 'property-showcase');
        const index = [...this.carouselTarget.querySelectorAll('[data-property-showcase-target="slide"]')].findIndex(slide => slide.dataset.slug === slug);
        if (index < 0) return;
        if (carousel) carousel.go(index);
        else { this.carouselTarget.dataset.activeSlug = slug; this.focus(slug); }
    }
}
