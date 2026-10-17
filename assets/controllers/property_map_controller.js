import {Controller} from '@hotwired/stimulus';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?map-worker';
import {enableMaps, mapsAllowed} from '../privacy';

export default class extends Controller {
    static targets = ['canvas', 'placeholder', 'activate', 'overview', 'error', 'city', 'name', 'address', 'directions'];
    static values = {properties: Array, selected: String};

    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.listeners = new AbortController();
        this.element.dataset.mapReady = 'false'; this.element.dataset.mapLoaded = 'false';
        this.explorer = this.element.closest('.availability-explorer');
        this.properties = this.propertiesValue.filter(item => typeof item.slug === 'string');
        this.selected = this.properties.find(item => item.slug === (this.explorer?.dataset.explorerSlug || this.selectedValue)) || this.properties[0];
        this.renderAddress();
        this.explorer?.addEventListener('property:focus', event => this.focus(event.detail.slug), {signal: this.listeners.signal});
        document.addEventListener('privacy:change', () => { if (!mapsAllowed()) this.deactivate(); else if (this.visible) this.activate(); }, {signal: this.listeners.signal});
        document.addEventListener('turbo:before-cache', () => this.deactivate(), {signal: this.listeners.signal});
        this.observer = new IntersectionObserver(entries => {
            this.visible = entries[0].isIntersecting;
            if (this.visible && mapsAllowed()) this.activate();
        }, {rootMargin: '100px'});
        this.observer.observe(this.element);
        this.resize = new ResizeObserver(() => {
            const size = `${this.canvasTarget.offsetWidth}:${this.canvasTarget.offsetHeight}`;
            if (this.map && this.canvasTarget.offsetWidth && size !== this.canvasSize) this.map.resize();
            this.canvasSize = size;
        });
        this.resize.observe(this.canvasTarget);
    }
    located(item) { return item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude); }
    renderAddress() {
        if (!this.selected) return;
        this.cityTarget.textContent = this.selected.city;
        this.nameTarget.textContent = this.selected.name;
        this.addressTarget.textContent = this.selected.address || this.selected.city;
        this.directionsTarget.hidden = !this.selected.directionsUrl;
        if (this.selected.directionsUrl) this.directionsTarget.href = this.selected.directionsUrl;
        else this.directionsTarget.removeAttribute('href');
        this.element.dataset.mapSelectedSlug = this.selected.slug;
        this.markers?.forEach((marker, slug) => {
            const icon = marker.getElement();
            icon?.classList.toggle('is-selected', slug === this.selected.slug);
            icon?.setAttribute('aria-pressed', String(slug === this.selected.slug));
            if (icon) icon.style.zIndex = slug === this.selected.slug ? '10' : '1';
        });
    }
    allow() { enableMaps(); this.activate(); }
    async activate() {
        if (this.map || this.activating || !mapsAllowed() || !this.canvasTarget.offsetWidth) return;
        const located = this.properties.filter(item => this.located(item));
        if (!located.length) { this.activateTarget.disabled = true; this.errorTarget.hidden = false; return; }
        const generation = this.generation = (this.generation || 0) + 1;
        this.activating = true;
        this.activateTarget.disabled = true;
        let library;
        try { library = await import('maplibre-gl'); }
        catch {
            if (this.generation === generation) { this.activating = false; this.activateTarget.disabled = false; this.errorTarget.hidden = false; }
            return;
        }
        if (this.generation !== generation || !this.element.isConnected || !mapsAllowed()) return;
        library.setWorkerUrl(mapWorkerUrl);
        this.activating = false;
        this.activateTarget.disabled = false;
        this.placeholderTarget.hidden = true;
        this.canvasSize = `${this.canvasTarget.offsetWidth}:${this.canvasTarget.offsetHeight}`;
        const english = document.documentElement.lang.startsWith('en');
        const initial = this.located(this.selected) ? this.selected : located[0];
        try {
            this.map = new library.Map({
                container: this.canvasTarget, style: 'https://tiles.openfreemap.org/styles/liberty', center: [initial.longitude, initial.latitude], zoom: 14,
                minZoom: 5, maxZoom: 19, scrollZoom: true, dragRotate: false, pitchWithRotate: false,
                attributionControl: false, trackResize: false, renderWorldCopies: false,
                transformRequest: url => ({url, referrerPolicy: 'origin'}),
                locale: {'NavigationControl.ZoomIn': english ? 'Zoom in' : 'Agrandir', 'NavigationControl.ZoomOut': english ? 'Zoom out' : 'Réduire'}
            });
        } catch {
            this.canvasTarget.replaceChildren(); this.placeholderTarget.hidden = false; this.errorTarget.hidden = false;
            return;
        }
        const map = this.map;
        map.addControl(new library.NavigationControl({showCompass: false}), 'top-right');
        map.addControl(new library.AttributionControl({compact: false}), 'bottom-right');
        map.getCanvas().setAttribute('aria-label', this.canvasTarget.getAttribute('aria-label'));
        map.on('error', () => { if (this.map === map) this.errorTarget.hidden = false; });
        map.on('idle', () => {
            if (this.map !== map) return;
            this.element.dataset.mapLoaded = String(map.isStyleLoaded() && map.areTilesLoaded());
        });
        this.markers = new Map();
        located.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'stay-map-marker';
            button.title = item.name; button.setAttribute('aria-label', item.name);
            button.innerHTML = `<span class="stay-map-pin"><span>${index + 1}</span></span>`;
            const marker = new library.Marker({element: button, anchor: 'bottom'}).setLngLat([item.longitude, item.latitude]).addTo(map);
            const select = () => {
                if (this.explorer) this.element.dispatchEvent(new CustomEvent('map:select', {bubbles: true, detail: {slug: item.slug}}));
                else this.focus(item.slug);
            };
            button.addEventListener('click', select);
            button.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) event.stopPropagation(); });
            this.markers.set(item.slug, marker);
        });
        const updatePosition = () => {
            if (this.map !== map) return;
            const center = map.getCenter();
            this.element.dataset.mapLatitude = center.lat.toFixed(6); this.element.dataset.mapLongitude = center.lng.toFixed(6);
            this.element.dataset.mapZoom = map.getZoom().toFixed(3);
        };
        map.on('movestart', () => { this.element.dataset.mapMoving = 'true'; this.element.dataset.mapLoaded = 'false'; });
        map.on('move', updatePosition);
        map.on('moveend', () => { this.element.dataset.mapMoving = 'false'; updatePosition(); });
        this.overviewTarget.hidden = located.length < 2;
        this.element.dataset.mapReady = 'true'; this.element.dataset.mapMoving = 'false';
        this.element.dataset.mapStyle = 'liberty';
        if (!this.located(this.selected)) this.overview(false);
        updatePosition(); this.renderAddress();
    }
    focus(slug) {
        const property = this.properties.find(item => item.slug === slug);
        if (!property) return;
        this.selected = property; this.renderAddress();
        if (!mapsAllowed()) { this.deactivate(); return; }
        if (!this.map) { if (this.visible) this.activate(); return; }
        if (this.located(property)) {
            // Explicit navigation keeps the same smooth travel on Windows.
            // Stop at the current centre so a new choice can interrupt a flight.
            this.map.stop();
            this.map.flyTo({center: [property.longitude, property.latitude], zoom: 14, duration: 1650, essential: true});
        } else this.overview();
    }
    overview(animate = true) {
        const points = this.properties.filter(item => this.located(item)).map(item => [item.longitude, item.latitude]);
        if (!this.map || !points.length) return;
        this.map.stop();
        const bounds = points.reduce((bounds, point) => [[Math.min(bounds[0][0], point[0]), Math.min(bounds[0][1], point[1])], [Math.max(bounds[1][0], point[0]), Math.max(bounds[1][1], point[1])]], [points[0], points[0]]);
        this.map.fitBounds(bounds, {padding: 48, maxZoom: 14, duration: animate === false ? 0 : 1400, essential: true});
    }
    deactivate() {
        this.generation = (this.generation || 0) + 1; this.activating = false;
        this.map?.stop(); this.markers?.forEach(marker => marker.remove()); this.map?.remove(); this.map = null; this.markers?.clear();
        if (!this.hasPlaceholderTarget) return;
        this.placeholderTarget.hidden = false; this.overviewTarget.hidden = true; this.errorTarget.hidden = true;
        this.activateTarget.disabled = false;
        this.element.dataset.mapLoaded = 'false';
        this.element.dataset.mapReady = 'false'; this.element.dataset.mapMoving = 'false';
    }
    disconnect() {
        this.listeners?.abort(); this.observer?.disconnect(); this.resize?.disconnect(); this.deactivate();
    }
}
