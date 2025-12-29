import './bootstrap.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import 'flatpickr/dist/flatpickr.min.css';
import flatpickr from 'flatpickr';
import { French } from 'flatpickr/dist/l10n/fr.js';
import './styles/app.css';

// Theme toggle functionality
(function() {
    const getStoredTheme = () => localStorage.getItem('theme');
    const setStoredTheme = (theme) => localStorage.setItem('theme', theme);

    const getPreferredTheme = () => {
        const storedTheme = getStoredTheme();
        if (storedTheme) {
            return storedTheme;
        }
        // Default to dark when no preference was saved
        return 'dark';
    };

    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-bs-theme', theme);
    };

    // Set theme on page load
    setTheme(getPreferredTheme());

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const storedTheme = getStoredTheme();
        if (!storedTheme) {
            setTheme(getPreferredTheme());
        }
    });

    // Toggle button handler - use turbo:load for Turbo navigation compatibility
    const initThemeToggle = () => {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn && !toggleBtn.hasAttribute('data-theme-initialized')) {
            toggleBtn.setAttribute('data-theme-initialized', 'true');
            toggleBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-bs-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                setStoredTheme(newTheme);
                setTheme(newTheme);
            });
        }
    };

    // Support both initial load and Turbo navigation
    document.addEventListener('DOMContentLoaded', initThemeToggle);
    document.addEventListener('turbo:load', initThemeToggle);
})();

// Initialize Bootstrap Tooltips
import * as bootstrap from 'bootstrap';

const initTooltips = () => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
};

document.addEventListener('DOMContentLoaded', initTooltips);
document.addEventListener('turbo:load', initTooltips);

// Scroll Reveal Animation
const initScrollReveal = () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal, .reveal-group').forEach(el => {
        observer.observe(el);
    });
};

document.addEventListener('DOMContentLoaded', initScrollReveal);
document.addEventListener('turbo:load', initScrollReveal);

// Navbar Hide on Scroll
const initNavbarScroll = () => {
    const header = document.querySelector('header.sticky-top');
    if (!header || header.hasAttribute('data-scroll-initialized')) return;
    
    header.setAttribute('data-scroll-initialized', 'true');
    
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    const updateNavbar = () => {
        const currentScrollY = window.scrollY;
        
        // Add shadow when scrolled
        if (currentScrollY > 10) {
            header.classList.add('navbar-scrolled');
        } else {
            header.classList.remove('navbar-scrolled');
        }
        
        // Hide/show navbar based on scroll direction
        if (currentScrollY > 100) {
            if (currentScrollY > lastScrollY) {
                // Scrolling down - hide navbar
                header.classList.add('navbar-hidden');
            } else {
                // Scrolling up - show navbar
                header.classList.remove('navbar-hidden');
            }
        } else {
            // At top - always show
            header.classList.remove('navbar-hidden');
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
    };
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }, { passive: true });
};

document.addEventListener('DOMContentLoaded', initNavbarScroll);
document.addEventListener('turbo:load', initNavbarScroll);

// Booking Search Functionality
const initBookingSearch = () => {
    const form = document.getElementById('booking-search-form');
    if (!form || form.hasAttribute('data-booking-initialized')) return;
    
    form.setAttribute('data-booking-initialized', 'true');
    
    const arrivalInput = document.getElementById('arrival-date');
    const departureInput = document.getElementById('departure-date');
    const dateRangeInput = document.getElementById('date-range');

    // Date panel interactions
    const dateToggle = document.getElementById('date-toggle');
    const datePanel = document.getElementById('date-panel');
    const dateCalendar = document.getElementById('date-calendar');
    const dateDisplay = document.getElementById('date-display');
    const dateApply = document.getElementById('date-apply');
    const dateCancel = document.getElementById('date-cancel');

    const formatDisplayDate = (value) => {
        if (!value) return '';
        const [year, month, day] = value.split('-');
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const formatYmd = (d) => {
        return d.getFullYear() + '-' + 
               String(d.getMonth() + 1).padStart(2, '0') + '-' + 
               String(d.getDate()).padStart(2, '0');
    };

    const updateDateDisplay = () => {
        const start = arrivalInput?.value;
        const end = departureInput?.value;
        const titleEl = dateDisplay.querySelector('.selector-title');
        const subEl = dateDisplay.querySelector('.selector-sub');

        if (start && end) {
            titleEl.textContent = `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`;
            subEl.textContent = 'Dates flexibles bienvenues';
        } else {
            titleEl.textContent = 'Choisir des dates';
            subEl.textContent = 'Clique pour sélectionner';
        }
    };

    const datePicker = dateRangeInput ? flatpickr(dateRangeInput, {
        mode: 'range',
        inline: true,
        minDate: 'today',
        dateFormat: 'Y-m-d',
        locale: French,
        appendTo: dateCalendar || datePanel,
        onChange(selectedDates) {
            if (selectedDates.length === 2 && arrivalInput && departureInput) {
                const [start, end] = selectedDates;
                arrivalInput.value = formatYmd(start);
                departureInput.value = formatYmd(end);
                updateDateDisplay();
            }
        },
        onReady(_, __, instance) {
            if (instance?.calendarContainer && dateCalendar) {
                instance.calendarContainer.classList.add('w-100');
            }
        },
    }) : null;

    const closeDatePanel = () => {
        datePanel.classList.add('d-none');
        dateToggle.dataset.open = 'false';
    };

    const openDatePanel = () => {
        datePanel.classList.remove('d-none');
        dateToggle.dataset.open = 'true';
    };

    dateToggle?.addEventListener('click', (e) => {
        if (e.target.closest('.selector-panel')) return;
        const isOpen = dateToggle.dataset.open === 'true';
        if (isOpen) {
            closeDatePanel();
        } else {
            openDatePanel();
        }
    });

    dateApply?.addEventListener('click', () => {
        if (!arrivalInput?.value || !departureInput?.value) {
            alert('Sélectionnez une arrivée et un départ.');
            return;
        }
        updateDateDisplay();
        closeDatePanel();
    });

    dateCancel?.addEventListener('click', () => {
        arrivalInput.value = '';
        departureInput.value = '';
        datePicker?.clear();
        updateDateDisplay();
        closeDatePanel();
    });

    // Guests panel interactions
    const guestsToggle = document.getElementById('guests-toggle');
    const guestsPanel = document.getElementById('guests-panel');
    const guestsDisplay = document.getElementById('guests-display');
    const guestsSelect = document.getElementById('guests-count');
    const guestsCurrent = document.getElementById('guests-current');
    const guestsDec = document.getElementById('guests-decrease');
    const guestsInc = document.getElementById('guests-increase');

    const updateGuestsDisplay = () => {
        const count = parseInt(guestsSelect.value, 10) || 1;
        if (guestsCurrent) guestsCurrent.value = count;
        const titleEl = guestsDisplay.querySelector('.selector-title');
        const subEl = guestsDisplay.querySelector('.selector-sub');
        titleEl.textContent = `${count} ${count > 1 ? 'voyageurs' : 'voyageur'}`;
        subEl.textContent = 'Clique pour ajuster';
    };

    const closeGuestsPanel = () => {
        guestsPanel.classList.add('d-none');
        guestsToggle.dataset.open = 'false';
    };

    const openGuestsPanel = () => {
        guestsPanel.classList.remove('d-none');
        guestsToggle.dataset.open = 'true';
    };

    guestsToggle?.addEventListener('click', (e) => {
        if (e.target.closest('.selector-panel')) return;
        const isOpen = guestsToggle.dataset.open === 'true';
        if (isOpen) {
            closeGuestsPanel();
        } else {
            openGuestsPanel();
        }
    });

    guestsDec?.addEventListener('click', () => {
        const val = Math.max(1, parseInt(guestsSelect.value, 10) - 1);
        guestsSelect.value = val;
        updateGuestsDisplay();
    });

    guestsInc?.addEventListener('click', () => {
        const val = Math.min(10, parseInt(guestsSelect.value, 10) + 1);
        guestsSelect.value = val;
        updateGuestsDisplay();
    });

    const closeOnOutsideClick = (event) => {
        if (!dateToggle.contains(event.target)) {
            closeDatePanel();
        }
        if (!guestsToggle.contains(event.target)) {
            closeGuestsPanel();
        }
    };

    document.addEventListener('click', closeOnOutsideClick);

    updateDateDisplay();
    updateGuestsDisplay();
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const arrivalDate = document.getElementById('arrival-date').value;
        const departureDate = document.getElementById('departure-date').value;
        const guests = parseInt(document.getElementById('guests-count').value);
        
        if (!arrivalDate || !departureDate) {
            alert('Veuillez sélectionner les dates d\'arrivée et de départ.');
            return;
        }
        const resultsContainer = document.getElementById('booking-results');
        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '<p class="text-muted small">Recherche en cours...</p>';
        resultsContainer.classList.remove('d-none');

        try {
            const params = new URLSearchParams({ arrivalDate, departureDate, guests });
            const response = await fetch(`/api/availability?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Erreur de requête');
            }
            const data = await response.json();

            const available = data.availability?.filter(item => item.available && item.bookingUrl) ?? [];
            const comingSoon = data.availability?.filter(item => !item.bookingUrl) ?? [];

            const nightsFallback = () => {
                const a = new Date(arrivalDate);
                const d = new Date(departureDate);
                return Math.max(1, Math.round((d - a) / (1000 * 60 * 60 * 24)));
            };

            let html = '';

            if (available.length === 0) {
                html += '<p class="text-muted small mb-2">Aucun logement disponible pour ces dates. Essayez d\'autres dates ou <a href="#contact" class="text-teal fw-semibold text-decoration-none">contactez-nous</a>.</p>';
            }

            if (available.length > 0) {
                html += available.map(item => {
                    const nights = item.nights ?? nightsFallback();
                    const price = item.price ? `${item.price} ${item.currency || '€'}` : '';
                    const imageUrl = item.image || '/images/placeholder.jpg';
                    const detailsUrl = `/property/${item.slug}`;
                    return `
                    <div class="d-flex align-items-stretch p-3 bg-light rounded booking-result-item gap-3">
                        <a href="${detailsUrl}" class="flex-shrink-0">
                            <img src="${imageUrl}" alt="${item.name}" class="rounded" style="width: 80px; height: 80px; object-fit: cover;">
                        </a>
                        <div class="flex-grow-1 d-flex flex-column justify-content-center">
                            <a href="${detailsUrl}" class="fw-bold text-dark text-decoration-none hover-teal">${item.name}</a>
                            <span class="text-muted small">${item.city} • Max ${item.maxGuests} pers. • ${nights} nuit${nights > 1 ? 's' : ''}</span>
                            <a href="${detailsUrl}" class="text-teal small text-decoration-none mt-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="me-1" viewBox="0 0 16 16">
                                    <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
                                </svg>
                                Voir les détails
                            </a>
                        </div>
                        <div class="text-end d-flex flex-column justify-content-center align-items-end">
                            ${price ? `<div class="fw-bold text-teal fs-5 mb-1">${price}</div>` : ''}
                            <a href="${item.bookingUrl}" target="_blank" class="btn btn-sm text-white rounded-pill" style="background-color: var(--teal-primary);">Disponible</a>
                        </div>
                    </div>`;
                }).join('');
            }

            if (comingSoon.length > 0) {
                html += '<p class="text-muted small mt-3 mb-2">Bientôt réservable en ligne :</p>';
                html += comingSoon.map(item => {
                    const nights = item.nights ?? nightsFallback();
                    const imageUrl = item.image || '/images/placeholder.jpg';
                    const detailsUrl = `/property/${item.slug}`;
                    return `
                    <div class="d-flex align-items-stretch p-2 bg-light rounded border gap-3">
                        <a href="${detailsUrl}" class="flex-shrink-0">
                            <img src="${imageUrl}" alt="${item.name}" class="rounded" style="width: 60px; height: 60px; object-fit: cover; opacity: 0.7;">
                        </a>
                        <div class="flex-grow-1 d-flex flex-column justify-content-center">
                            <a href="${detailsUrl}" class="fw-bold small text-dark text-decoration-none">${item.name}</a>
                            <span class="text-muted small">${item.city} • Max ${item.maxGuests} pers. • ${nights} nuit${nights > 1 ? 's' : ''}</span>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="badge bg-secondary">Bientôt</span>
                        </div>
                    </div>`;
                }).join('');
            }

            resultsList.innerHTML = html;
        } catch (err) {
            resultsList.innerHTML = '<p class="text-danger small">Une erreur est survenue lors de la vérification des disponibilités.</p>';
        }
    });
};

document.addEventListener('DOMContentLoaded', initBookingSearch);
document.addEventListener('turbo:load', initBookingSearch);

console.log('Roaming Lille - AssetMapper loaded 🏠');
