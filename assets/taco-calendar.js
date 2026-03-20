/**
 * Taco Tour Calendar
 * Source of truth: Shopify Metaobjects (admin manages tours there)
 * Checkout: Shopify AJAX Cart (single generic ticket product + line item properties)
 */

(function () {
  'use strict';

  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  var activeFilter = 'all';
  var allTours = [];
  var selectedTour = null;
  var config = {};

  function loadConfig() {
    var el = document.getElementById('taco-calendar-config');
    if (!el) return {};
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.error('Taco Calendar: invalid config', e);
      return {};
    }
  }

  // ─── Shopify Cart ─────────────────────────────────────
  function addToCart(tour, quantity) {
    if (!config.ticketVariantId) {
      alert('Checkout not configured. Please contact us to book.');
      return;
    }

    var btn = document.getElementById('modal-book-btn');
    if (btn) {
      btn.textContent = 'Adding...';
      btn.disabled = true;
    }

    var properties = {
      'Tour': tour.tourName,
      'Route': tour.routeName,
      'Date': tour.date,
      'Time': tour.time
    };
    if (tour.location) {
      properties['Meeting Point'] = tour.location;
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          id: config.ticketVariantId,
          quantity: quantity,
          properties: properties
        }]
      })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.description || 'Could not add to cart');
          });
        }
        return res.json();
      })
      .then(function () {
        refreshCartCount();
        if (btn) btn.textContent = 'Added! Redirecting...';
        window.location.href = '/cart';
      })
      .catch(function (err) {
        if (btn) {
          btn.textContent = 'Add to Cart';
          btn.disabled = false;
        }
        alert(err.message || 'Could not add to cart. Please try again.');
      });
  }

  function refreshCartCount() {
    fetch('/cart.js')
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        document.querySelectorAll(
          '.cart-count-bubble span, [data-cart-count], .cart-count'
        ).forEach(function (el) {
          el.textContent = cart.item_count;
        });
      })
      .catch(function () {});
  }

  // ─── Render Calendar ─────────────────────────────────
  function renderCalendar() {
    var grid = document.getElementById('cal-grid');
    var list = document.getElementById('cal-list');
    var title = document.getElementById('cal-month-title');
    if (!grid || !title) return;

    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    title.textContent = monthNames[currentMonth] + ' ' + currentYear;

    var prefix = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var filtered = allTours.filter(function (t) {
      if (!t.date || !t.date.startsWith(prefix)) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'morning') return t.period === 'morning';
      if (activeFilter === 'night') return t.period === 'night';
      if (activeFilter === 'street') return t.routeType === 'street';
      if (activeFilter === 'premium') return t.routeType === 'premium';
      return true;
    });

    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    var html = '';

    for (var e = 0; e < firstDay; e++) {
      html += '<div class="tt-cal__day tt-cal__day--empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr =
        currentYear + '-' +
        String(currentMonth + 1).padStart(2, '0') + '-' +
        String(d).padStart(2, '0');
      var dateObj = new Date(currentYear, currentMonth, d);
      var isPast = dateObj < today;
      var isToday = dateObj.getTime() === today.getTime();

      var dayTours = filtered.filter(function (t) { return t.date === dateStr; });

      var dayClass = 'tt-cal__day';
      if (isPast) dayClass += ' tt-cal__day--past';
      if (isToday) dayClass += ' tt-cal__day--today';
      if (dayTours.length > 0) dayClass += ' tt-cal__day--has-tours';

      html += '<div class="' + dayClass + '">';
      html += '<div class="tt-cal__day-number">' + d + '</div>';

      if (dayTours.length > 0 && !isPast) {
        html += '<div class="tt-cal__day-tours">';
        dayTours.forEach(function (tour) {
          var soldOut = tour.remainingSpots <= 0;
          var low = !soldOut && tour.remainingSpots <= 3;
          var chipClass = 'tt-cal__tour-chip';
          if (soldOut) chipClass += ' tt-cal__tour-chip--sold-out';
          else if (low) chipClass += ' tt-cal__tour-chip--low';

          html += '<button class="' + chipClass + '" data-tour-id="' + escapeAttr(tour.id) + '"';
          if (soldOut) html += ' disabled';
          html += '>';
          html += '<span class="tt-cal__tour-name">' + escapeHtml(tour.tourName) + '</span>';
          if (soldOut) {
            html += '<span class="tt-cal__tour-spots">Sold Out</span>';
          } else {
            html += '<span class="tt-cal__tour-spots">' + tour.remainingSpots + ' left</span>';
          }
          html += '</button>';
        });
        html += '</div>';
      }

      html += '</div>';
    }

    grid.innerHTML = html;

    // Build mobile list
    var listHtml = '';
    var toursByDate = {};
    filtered.forEach(function (t) {
      if (!toursByDate[t.date]) toursByDate[t.date] = [];
      toursByDate[t.date].push(t);
    });

    Object.keys(toursByDate).sort().forEach(function (date) {
      var dObj = new Date(date + 'T12:00:00');
      if (dObj < today) return;

      var dayName = dObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });

      listHtml += '<div class="tt-cal__list-day">';
      listHtml += '<div class="tt-cal__list-date">' + dayName + '</div>';
      listHtml += '<div class="tt-cal__list-tours">';

      toursByDate[date].forEach(function (tour) {
        var soldOut = tour.remainingSpots <= 0;
        var low = !soldOut && tour.remainingSpots <= 3;

        listHtml += '<button class="tt-cal__list-card';
        if (soldOut) listHtml += ' tt-cal__list-card--sold-out';
        listHtml += '" data-tour-id="' + escapeAttr(tour.id) + '"';
        if (soldOut) listHtml += ' disabled';
        listHtml += '>';
        listHtml += '<div class="tt-cal__list-card-top">';
        listHtml += '<strong>' + escapeHtml(tour.tourName) + '</strong>';
        listHtml += '<span class="tt-cal__list-card-time">' + escapeHtml(tour.time) + '</span>';
        listHtml += '</div>';
        listHtml += '<div class="tt-cal__list-card-bottom">';
        listHtml += '<span class="tt-cal__list-card-route">' + escapeHtml(tour.routeName) + '</span>';
        if (soldOut) {
          listHtml += '<span class="tt-cal__list-card-spots tt-cal__list-card-spots--sold-out">Sold Out</span>';
        } else {
          listHtml += '<span class="tt-cal__list-card-spots';
          if (low) listHtml += ' tt-cal__list-card-spots--low';
          listHtml += '">' + tour.remainingSpots + ' spots left</span>';
        }
        listHtml += '</div>';
        listHtml += '</button>';
      });

      listHtml += '</div></div>';
    });

    if (list) {
      list.innerHTML = listHtml ||
        '<p class="tt-cal__empty">No tours available this month.</p>';
    }

    // Attach click handlers
    document.querySelectorAll('[data-tour-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = this.getAttribute('data-tour-id');
        var tour = allTours.find(function (t) { return t.id === tid; });
        if (tour) openModal(tour);
      });
    });
  }

  // ─── Modal ───────────────────────────────────────────
  function openModal(tour) {
    selectedTour = tour;
    var modal = document.getElementById('tour-modal');
    if (!modal) return;

    var badgeEl = document.getElementById('modal-badge');
    badgeEl.textContent =
      tour.routeType === 'premium' ? 'Premium Experience' : 'Street Tacos';
    badgeEl.className = 'tt-modal__badge tt-modal__badge--' + tour.routeType;

    document.getElementById('modal-title').textContent =
      tour.tourName + ' — ' + tour.routeName;

    var dateObj = new Date(tour.date + 'T12:00:00');
    document.getElementById('modal-date').textContent =
      dateObj.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    document.getElementById('modal-time').textContent = tour.time;
    document.getElementById('modal-route').textContent =
      tour.location || tour.routeName;
    document.getElementById('modal-spots').textContent =
      tour.remainingSpots + ' of ' + tour.capacity + ' spots available';

    var priceEl = document.getElementById('modal-price');
    if (priceEl) {
      priceEl.textContent = config.ticketPriceFormatted || '$1,500 MXN';
    }

    // Stops
    var stopsHtml = '';
    if (tour.stops && tour.stops.length > 0) {
      stopsHtml = '<div class="tt-modal__stops-title">Tour Stops</div>';
      tour.stops.forEach(function (stop, i) {
        stopsHtml +=
          '<div class="tt-modal__stop">' +
          '<div class="tt-modal__stop-number">' + (i + 1) + '</div>' +
          '<div class="tt-modal__stop-info">' +
          '<div class="tt-modal__stop-name">' + escapeHtml(stop.name) + '</div>' +
          '<div class="tt-modal__stop-taco">' + escapeHtml(stop.taco) + '</div>' +
          '</div></div>';
      });
    }
    document.getElementById('modal-stops').innerHTML = stopsHtml;

    var qtyInput = document.getElementById('ticket-qty');
    qtyInput.value = 1;
    qtyInput.max = Math.min(tour.remainingSpots, 10);

    updateBookButton();

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('tt-modal--open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var modal = document.getElementById('tour-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('tt-modal--open');
    document.body.style.overflow = '';
    selectedTour = null;
  }

  function updateBookButton() {
    var btn = document.getElementById('modal-book-btn');
    var qty = parseInt(document.getElementById('ticket-qty').value, 10);
    if (!selectedTour) return;

    var price = parseFloat(config.ticketPrice) || 1500;
    var total = (qty * price).toLocaleString('en-US', {
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });

    btn.textContent =
      'Add ' + qty + (qty === 1 ? ' Ticket' : ' Tickets') +
      ' — $' + total + ' MXN';
    btn.disabled = false;
  }

  // ─── Helpers ──────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ─── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    config = loadConfig();
    allTours = config.tours || [];
    renderCalendar();

    // Month navigation
    document.getElementById('cal-prev').addEventListener('click', function () {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });

    document.getElementById('cal-next').addEventListener('click', function () {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });

    // Filters
    document.querySelectorAll('.tt-cal__filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelector('.tt-cal__filter--active').classList.remove('tt-cal__filter--active');
        this.classList.add('tt-cal__filter--active');
        activeFilter = this.getAttribute('data-filter');
        renderCalendar();
      });
    });

    // Modal close
    document.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    // Qty controls
    document.getElementById('qty-minus').addEventListener('click', function () {
      var input = document.getElementById('ticket-qty');
      var val = parseInt(input.value, 10);
      if (val > 1) { input.value = val - 1; updateBookButton(); }
    });

    document.getElementById('qty-plus').addEventListener('click', function () {
      var input = document.getElementById('ticket-qty');
      var val = parseInt(input.value, 10);
      var max = parseInt(input.max, 10) || 10;
      if (val < max) { input.value = val + 1; updateBookButton(); }
    });

    document.getElementById('ticket-qty').addEventListener('change', function () {
      var max = parseInt(this.max, 10) || 10;
      var val = parseInt(this.value, 10);
      if (isNaN(val) || val < 1) this.value = 1;
      if (val > max) this.value = max;
      updateBookButton();
    });

    // Book button
    document.getElementById('modal-book-btn').addEventListener('click', function () {
      if (!selectedTour) return;
      var qty = parseInt(document.getElementById('ticket-qty').value, 10);
      addToCart(selectedTour, qty);
    });
  });
})();
