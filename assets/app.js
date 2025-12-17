import './stimulus_bootstrap.js';
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
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
                    return `
                    <a href="${item.bookingUrl}" target="_blank" class="d-flex justify-content-between align-items-center p-3 bg-light rounded text-decoration-none booking-result-item">
                        <div>
                            <span class="fw-bold text-dark">${item.name}</span>
                            <span class="text-muted small d-block">${item.city} • Max ${item.maxGuests} pers. • ${nights} nuit${nights > 1 ? 's' : ''}</span>
                        </div>
                        <div class="text-end ms-3">
                            ${price ? `<div class="fw-bold text-teal fs-5 mb-1">${price}</div>` : ''}
                            <span class="btn btn-sm text-white rounded-pill" style="background-color: var(--teal-primary);">Disponible</span>
                        </div>
                    </a>`;
                }).join('');
            }

            if (comingSoon.length > 0) {
                html += '<p class="text-muted small mt-3 mb-2">Bientôt réservable en ligne :</p>';
                html += comingSoon.map(item => {
                    const nights = item.nights ?? nightsFallback();
                    return `
                    <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded border">
                        <div>
                            <span class="fw-bold small">${item.name}</span>
                            <span class="text-muted small d-block">${item.city} • Max ${item.maxGuests} pers. • ${nights} nuit${nights > 1 ? 's' : ''}</span>
                        </div>
                        <span class="badge bg-secondary">Bientôt</span>
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
