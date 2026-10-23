import { Controller } from '@hotwired/stimulus';
import Collapse from 'bootstrap/js/dist/collapse';
import Dropdown from 'bootstrap/js/dist/dropdown';
import Tooltip from 'bootstrap/js/dist/tooltip';
import Toast from 'bootstrap/js/dist/toast';
import {scrollToElement, scrollToPosition} from '../ui-motion';

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
        on(this.element, 'click', async event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target.closest('a[href]');
            if (!link || link.target || link.hasAttribute('download') || link.hasAttribute('data-bs-toggle')) return;
            const destination = new URL(link.href, location.href);
            if (destination.origin !== location.origin || destination.pathname !== location.pathname || !destination.hash || destination.hash === '#') return;
            let target;
            try { target = document.getElementById(decodeURIComponent(destination.hash.slice(1))); } catch { return; }
            if (!target) return;
            event.preventDefault();
            this.anchorScroll?.abort(); this.anchorScroll = new AbortController();
            const request = this.anchorScroll;
            if (location.hash !== destination.hash) history.pushState(history.state, '', destination);
            const arrived = await scrollToElement(target, {signal: request.signal});
            if (!arrived || request.signal.aborted || !target.isConnected) return;
            const focus = target.matches('h1,h2,h3,[tabindex],a,button') ? target : target.querySelector('h1,h2,h3') || target;
            if (!focus.hasAttribute('tabindex')) {
                focus.setAttribute('tabindex', '-1');
                focus.addEventListener('blur', () => focus.removeAttribute('tabindex'), {once: true});
            }
            focus.focus({preventScroll: true});
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
            scrollToPosition(0, {signal: this.listeners.signal});
            history.replaceState(history.state, '', location.pathname + location.search);
        }
        this.beforeCache = () => {
            this.anchorScroll?.abort();
            header?.classList.remove('navbar-hidden');
            this.element.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(element => Dropdown.getOrCreateInstance(element).hide());
        };
        on(document, 'turbo:before-cache', this.beforeCache);
    }
    disconnect() {
        this.anchorScroll?.abort();
        this.listeners?.abort(); cancelAnimationFrame(this.scrollFrame);
        this.tooltips?.forEach(instance => instance.dispose()); this.toasts?.forEach(instance => instance.dispose());
    }
}
