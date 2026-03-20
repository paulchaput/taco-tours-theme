/**
 * Taco Tour Calendar — Gym-class style
 * Monthly view → click day → zoom to day schedule → book
 */

(function () {
  'use strict';

  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  var allTours = [];
  var selectedTour = null;
  var config = {};

  function loadConfig() {
    var el = document.getElementById('taco-calendar-config');
    if (!el) return {};
    try { return JSON.parse(el.textContent); }
    catch (e) { return {}; }
  }

  // ─── Render monthly grid ─────────────────────────────
  function renderMonth() {
    var grid = document.getElementById('cal-grid');
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

    // Count tours per day
    var toursByDay = {};
    allTours.forEach(function (t) {
      if (t.date && t.date.startsWith(prefix)) {
        if (!toursByDay[t.date]) toursByDay[t.date] = [];
        toursByDay[t.date].push(t);
      }
    });

    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var html = '';

    for (var e = 0; e < firstDay; e++) {
      html += '<div class="tt-cal__day tt-cal__day--empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = prefix + '-' + String(d).padStart(2, '0');
      var dateObj = new Date(currentYear, currentMonth, d);
      var isPast = dateObj < today;
      var isToday = dateObj.getTime() === today.getTime();
      var dayTours = toursByDay[dateStr] || [];
      var hasTours = dayTours.length > 0 && !isPast;

      var cls = 'tt-cal__day';
      if (isPast) cls += ' tt-cal__day--past';
      if (isToday) cls += ' tt-cal__day--today';
      if (hasTours) cls += ' tt-cal__day--has-tours';

      html += '<div class="' + cls + '"' + (hasTours ? ' data-date="' + dateStr + '" role="button" tabindex="0"' : '') + '>';
      html += '<div class="tt-cal__day-number">' + d + '</div>';

      if (hasTours) {
        var count = dayTours.length;
        var allSoldOut = dayTours.every(function (t) { return t.remainingSpots <= 0; });
        var hasLow = dayTours.some(function (t) { return t.remainingSpots > 0 && t.remainingSpots <= 3; });

        html += '<div class="tt-cal__day-indicator">';
        // Dots for each tour
        for (var i = 0; i < Math.min(count, 4); i++) {
          var dotCls = 'tt-cal__dot';
          if (allSoldOut) dotCls += ' tt-cal__dot--sold-out';
          else if (hasLow) dotCls += ' tt-cal__dot--low';
          html += '<span class="' + dotCls + '"></span>';
        }
        html += '</div>';
        html += '<div class="tt-cal__day-count">' + count + (count === 1 ? ' tour' : ' tours') + '</div>';
      }

      html += '</div>';
    }

    grid.innerHTML = html;

    // Click handlers for days with tours
    grid.querySelectorAll('[data-date]').forEach(function (el) {
      el.addEventListener('click', function () {
        showDay(this.getAttribute('data-date'));
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showDay(this.getAttribute('data-date'));
        }
      });
    });
  }

  // ─── Show day zoom view ──────────────────────────────
  function showDay(dateStr) {
    var monthView = document.getElementById('cal-month-view');
    var dayView = document.getElementById('cal-day-view');
    var dayTitle = document.getElementById('day-title');
    var dayList = document.getElementById('day-list');

    var dateObj = new Date(dateStr + 'T12:00:00');
    dayTitle.textContent = dateObj.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    var dayTours = allTours.filter(function (t) { return t.date === dateStr; });

    var html = '';
    dayTours.forEach(function (tour) {
      var soldOut = tour.remainingSpots <= 0;
      var low = !soldOut && tour.remainingSpots <= 3;

      html += '<div class="tt-day__card' + (soldOut ? ' tt-day__card--sold-out' : '') + '">';

      // Time column
      html += '<div class="tt-day__time">';
      html += '<span class="tt-day__time-start">' + esc(tour.startTime) + '</span>';
      html += '<span class="tt-day__time-end">' + esc(tour.endTime) + '</span>';
      html += '</div>';

      // Info column
      html += '<div class="tt-day__info">';
      html += '<div class="tt-day__name">' + esc(tour.tourName) + '</div>';
      html += '<div class="tt-day__route">' + esc(tour.routeName) + '</div>';
      html += '<div class="tt-day__meta">';
      var badge = tour.routeType === 'premium' ? 'Premium' : 'Street Tacos';
      html += '<span class="tt-day__badge tt-day__badge--' + tour.routeType + '">' + badge + '</span>';
      if (tour.stops && tour.stops.length > 0) {
        html += '<span class="tt-day__stops-count">' + tour.stops.length + ' stops</span>';
      }
      html += '</div>';
      html += '</div>';

      // Action column
      html += '<div class="tt-day__action">';
      if (soldOut) {
        html += '<span class="tt-day__sold-out">Sold Out</span>';
      } else {
        html += '<div class="tt-day__spots' + (low ? ' tt-day__spots--low' : '') + '">';
        html += tour.remainingSpots + '/' + tour.capacity;
        html += '</div>';
        html += '<button class="tt-day__book-btn" data-tour-id="' + escAttr(tour.id) + '">Book</button>';
      }
      html += '</div>';

      html += '</div>';
    });

    dayList.innerHTML = html;

    // Transition
    monthView.style.display = 'none';
    dayView.style.display = 'block';

    // Book button handlers
    dayView.querySelectorAll('[data-tour-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = this.getAttribute('data-tour-id');
        var tour = allTours.find(function (t) { return t.id === tid; });
        if (tour) openModal(tour);
      });
    });
  }

  function showMonth() {
    document.getElementById('cal-month-view').style.display = 'block';
    document.getElementById('cal-day-view').style.display = 'none';
  }

  // ─── Modal ───────────────────────────────────────────
  function openModal(tour) {
    selectedTour = tour;
    var modal = document.getElementById('tour-modal');
    if (!modal) return;

    var badgeEl = document.getElementById('modal-badge');
    badgeEl.textContent = tour.routeType === 'premium' ? 'Premium Experience' : 'Street Tacos';
    badgeEl.className = 'tt-modal__badge tt-modal__badge--' + tour.routeType;

    document.getElementById('modal-title').textContent = tour.tourName + ' — ' + tour.routeName;
    document.getElementById('modal-time').textContent = tour.time;
    document.getElementById('modal-route').textContent = tour.location || tour.routeName;
    document.getElementById('modal-spots').textContent = tour.remainingSpots + ' of ' + tour.capacity + ' spots available';

    var priceEl = document.getElementById('modal-price');
    if (priceEl) priceEl.textContent = config.ticketPriceFormatted || '$1,500 MXN';

    // Stops
    var stopsHtml = '';
    if (tour.stops && tour.stops.length > 0) {
      stopsHtml = '<div class="tt-modal__stops-title">Tour Stops</div>';
      tour.stops.forEach(function (stop, i) {
        stopsHtml +=
          '<div class="tt-modal__stop">' +
          '<div class="tt-modal__stop-number">' + (i + 1) + '</div>' +
          '<div class="tt-modal__stop-info">' +
          '<div class="tt-modal__stop-name">' + esc(stop.name) + '</div>' +
          '<div class="tt-modal__stop-taco">' + esc(stop.taco) + '</div>' +
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
    var total = (qty * price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    btn.textContent = 'Add ' + qty + (qty === 1 ? ' Ticket' : ' Tickets') + ' — $' + total + ' MXN';
    btn.disabled = false;
  }

  // ─── Cart ────────────────────────────────────────────
  function addToCart(tour, quantity) {
    if (!config.ticketVariantId) {
      alert('Checkout not configured. Please contact us to book.');
      return;
    }
    var btn = document.getElementById('modal-book-btn');
    if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }

    var properties = {
      'Tour': tour.tourName,
      'Route': tour.routeName,
      'Date': tour.date,
      'Time': tour.time
    };
    if (tour.location) properties['Meeting Point'] = tour.location;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: config.ticketVariantId, quantity: quantity, properties: properties }] })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.description || 'Could not add to cart'); });
        return res.json();
      })
      .then(function () {
        if (btn) btn.textContent = 'Added! Redirecting...';
        window.location.href = '/cart';
      })
      .catch(function (err) {
        if (btn) { btn.textContent = 'Add to Cart'; btn.disabled = false; }
        alert(err.message || 'Could not add to cart.');
      });
  }

  // ─── Helpers ─────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
  function escAttr(str) {
    return str ? String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
  }

  // ─── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    config = loadConfig();
    allTours = config.tours || [];
    renderMonth();

    document.getElementById('cal-prev').addEventListener('click', function () {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      showMonth();
      renderMonth();
    });

    document.getElementById('cal-next').addEventListener('click', function () {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      showMonth();
      renderMonth();
    });

    document.getElementById('cal-back').addEventListener('click', showMonth);

    // Modal
    document.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

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
    document.getElementById('modal-book-btn').addEventListener('click', function () {
      if (!selectedTour) return;
      addToCart(selectedTour, parseInt(document.getElementById('ticket-qty').value, 10));
    });
  });
})();
