import { Controller } from '@hotwired/stimulus';
import Collapse from 'bootstrap/js/dist/collapse';
import Dropdown from 'bootstrap/js/dist/dropdown';
import Tooltip from 'bootstrap/js/dist/tooltip';
import Toast from 'bootstrap/js/dist/toast';

// Own global listeners and Bootstrap instances for exactly one Turbo body.
export default class extends Controller {
    connect() {
        if (document.documentElement.hasAttribute('data-turbo-preview')) return;
        this.listeners = new AbortController();
        const on = (element, type, callback, options = {}) => element?.addEventListener(type, callback, {...options, signal: this.listeners.signal});
        const header = this.element.querySelector('header.sticky-top');
        const toggler = this.element.querySelector('.navbar-toggler');
        const menu = this.element.querySelector('#navbarContent');
        on(this.element.querySelector('.skip-link'), 'click', event => {
            event.preventDefault();
            const main = this.element.querySelector('#main-content');
            main?.focus({preventScroll: true}); main?.scrollIntoView({block: 'start', behavior: 'instant'});
        });
        const storedTheme = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
        const setTheme = value => document.documentElement.dataset.bsTheme = value === 'dark' ? 'dark' : 'light';
        setTheme(storedTheme());
        on(this.element.querySelector('#theme-toggle'), 'click', () => {
            const value = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('theme', value); } catch {}
            setTheme(value);
        });
        header?.classList.remove('navbar-hidden');
        on(header, 'keydown', event => {
            if (event.key !== 'Escape') return;
            const dropdown = header.querySelector('.dropdown-toggle[aria-expanded="true"]');
            if (dropdown) { event.stopPropagation(); Dropdown.getOrCreateInstance(dropdown).hide(); dropdown.focus(); }
            else if (menu.classList.contains('show')) { Collapse.getOrCreateInstance(menu, {toggle: false}).hide(); toggler.focus(); }
        });
        header?.classList.toggle('navbar-scrolled', window.scrollY > 10);
        on(window, 'scroll', () => {
            if (this.scrollFrame) return;
            this.scrollFrame = requestAnimationFrame(() => {
                this.scrollFrame = null;
                if (!header) return;
                const current = window.scrollY;
                header.classList.toggle('navbar-scrolled', current > 10);
            });
        }, {passive: true});
        this.tooltips = [...this.element.querySelectorAll('[data-bs-toggle="tooltip"]')].map(element => Tooltip.getOrCreateInstance(element));
        this.toasts = [...this.element.querySelectorAll('.toast.show')].map(element => { const toast = Toast.getOrCreateInstance(element, {delay: 5000}); toast.show(); return toast; });
        if (location.hash === '#top') {
            scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
            history.replaceState(history.state, '', location.pathname + location.search);
        }
        this.beforeCache = () => {
            header?.classList.remove('navbar-hidden');
            this.element.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(element => Dropdown.getOrCreateInstance(element).hide());
        };
        on(document, 'turbo:before-cache', this.beforeCache);
    }
    disconnect() {
        this.listeners?.abort(); cancelAnimationFrame(this.scrollFrame);
        this.tooltips?.forEach(instance => instance.dispose()); this.toasts?.forEach(instance => instance.dispose());
    }
}
