/**
 * Taco Tour Calendar — Dynamic booking calendar
 * Integrates with Shopify AJAX Cart API
 * Tours are stored as Shopify products in a collection
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let activeFilter = 'all';
  let tours = [];
  let selectedTour = null;

  // ─── Mock Data (replace with Shopify Storefront API) ───
  function generateMockTours(year, month) {
    const routes = [
      {
        name: 'Ruta Roma-Condesa',
        type: 'street',
        stops: [
          { name: 'Tacos Orinoco', taco: 'Bistek con queso' },
          { name: 'El Vilsito', taco: 'Suadero nocturno' },
          { name: 'Taquería Los Cocuyos', taco: 'Cabeza y lengua' },
          { name: 'El Huequito', taco: 'Pastor original' },
        ],
      },
      {
        name: 'Ruta Centro Histórico',
        type: 'street',
        stops: [
          { name: 'Taquería Arandas', taco: 'Carnitas michoacanas' },
          { name: 'Los Cochinitos', taco: 'Cochinita pibil' },
          { name: 'El Fogoncito', taco: 'Pastor al carbón' },
          { name: 'Taquería El Califa', taco: 'Bistec premium' },
        ],
      },
      {
        name: 'Ruta Premium Polanco',
        type: 'premium',
        stops: [
          { name: 'Pujol Taquería', taco: 'Mole madre taco' },
          { name: 'Quintonil Street', taco: 'Huitlacoche quesadilla' },
          { name: 'Eno Polanco', taco: 'Wagyu pastor' },
          { name: 'Máximo Bistrot', taco: 'Cochinita artesanal' },
        ],
      },
      {
        name: 'Ruta Nocturna Coyoacán',
        type: 'street',
        stops: [
          { name: 'Super Tacos Chupacabras', taco: 'Chuleta ahumada' },
          { name: 'El Jarocho Corner', taco: 'Arrachera con nopales' },
          { name: 'Mercado Coyoacán', taco: 'Barbacoa de hoyo' },
          { name: 'Tacos Don Juan', taco: 'Campechano nocturno' },
        ],
      },
    ];

    const times = [
      { label: '12:00 PM - 3:30 PM', period: 'morning' },
      { label: '5:00 PM - 8:30 PM', period: 'night' },
      { label: '7:00 PM - 10:30 PM', period: 'night' },
    ];

    var mockTours = [];
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var dow = date.getDay();
      var isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

      if (isPast) continue;

      // Weekends: 2-3 tours, weekdays: 0-1 tours
      var numTours = 0;
      if (dow === 0 || dow === 6) {
        numTours = 2 + Math.floor(Math.random() * 2);
      } else if (dow === 3 || dow === 5) {
        numTours = 1 + Math.floor(Math.random() * 2);
      } else if (Math.random() > 0.6) {
        numTours = 1;
      }

      for (var t = 0; t < numTours; t++) {
        var route = routes[(d + t) % routes.length];
        var time = times[t % times.length];
        var capacity = 10;
        var booked = Math.floor(Math.random() * 10);
        var remaining = capacity - booked;

        var tourLetter = String.fromCharCode(65 + t);
        var dateStr =
          year +
          '-' +
          String(month + 1).padStart(2, '0') +
          '-' +
          String(d).padStart(2, '0');

        mockTours.push({
          id: 'tour-' + dateStr + '-' + tourLetter,
          date: dateStr,
          time: time.label,
          period: time.period,
          tourName: 'Tour ' + tourLetter,
          routeName: route.name,
          routeType: route.type,
          stops: route.stops,
          capacity: capacity,
          remainingSpots: remaining,
          shopifyProductId: null,
          shopifyVariantId: null,
        });
      }
    }

    return mockTours;
  }

  // ─── Shopify Integration ───────────────────────────────
  // When you have real products, replace generateMockTours with this:
  //
  // async function fetchToursFromShopify() {
  //   const res = await fetch('/collections/taco-tours/products.json');
  //   const data = await res.json();
  //   return data.products.map(product => {
  //     // Parse tour data from product metafields or tags
  //     const tags = product.tags.split(', ');
  //     const dateParts = tags.find(t => t.startsWith('date:')).split(':')[1];
  //     const timePart = tags.find(t => t.startsWith('time:')).split(':').slice(1).join(':');
  //     const routePart = tags.find(t => t.startsWith('route:')).split(':')[1];
  //     const tourName = tags.find(t => t.startsWith('tour:')).split(':')[1];
  //     const type = tags.find(t => t.startsWith('type:')).split(':')[1];
  //     const period = tags.find(t => t.startsWith('period:')).split(':')[1];
  //     const variant = product.variants[0];
  //     return {
  //       id: product.id,
  //       date: dateParts,
  //       time: timePart,
  //       period: period,
  //       tourName: tourName,
  //       routeName: routePart,
  //       routeType: type,
  //       stops: [], // load from metafields
  //       capacity: variant.inventory_quantity + (variant.inventory_quantity - variant.inventory_quantity),
  //       remainingSpots: variant.inventory_quantity,
  //       shopifyProductId: product.id,
  //       shopifyVariantId: variant.id,
  //     };
  //   });
  // }

  async function addToCart(variantId, quantity) {
    try {
      var res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: quantity }],
        }),
      });
      if (!res.ok) throw new Error('Failed to add to cart');
      window.location.href = '/cart';
    } catch (err) {
      alert(
        'Could not add to cart. Please try again or contact us for assistance.'
      );
    }
  }

  // ─── Render Calendar ───────────────────────────────────
  function renderCalendar() {
    var grid = document.getElementById('cal-grid');
    var list = document.getElementById('cal-list');
    var title = document.getElementById('cal-month-title');
    if (!grid || !title) return;

    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    title.textContent = monthNames[currentMonth] + ' ' + currentYear;

    tours = generateMockTours(currentYear, currentMonth);

    var filtered = tours.filter(function (t) {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'morning') return t.period === 'morning';
      if (activeFilter === 'night') return t.period === 'night';
      if (activeFilter === 'street') return t.routeType === 'street';
      if (activeFilter === 'premium') return t.routeType === 'premium';
      return true;
    });

    // Build grid
    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var html = '';

    // Empty cells before first day
    for (var e = 0; e < firstDay; e++) {
      html += '<div class="tt-cal__day tt-cal__day--empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr =
        currentYear +
        '-' +
        String(currentMonth + 1).padStart(2, '0') +
        '-' +
        String(d).padStart(2, '0');
      var dateObj = new Date(currentYear, currentMonth, d);
      var isPast = dateObj < today;
      var isToday = dateObj.getTime() === today.getTime();

      var dayTours = filtered.filter(function (t) {
        return t.date === dateStr;
      });

      var dayClass = 'tt-cal__day';
      if (isPast) dayClass += ' tt-cal__day--past';
      if (isToday) dayClass += ' tt-cal__day--today';
      if (dayTours.length > 0) dayClass += ' tt-cal__day--has-tours';

      html += '<div class="' + dayClass + '">';
      html += '<div class="tt-cal__day-number">' + d + '</div>';

      if (dayTours.length > 0 && !isPast) {
        html += '<div class="tt-cal__day-tours">';
        dayTours.forEach(function (tour) {
          var spotClass = 'tt-cal__tour-chip';
          if (tour.remainingSpots === 0) spotClass += ' tt-cal__tour-chip--sold-out';
          else if (tour.remainingSpots <= 3) spotClass += ' tt-cal__tour-chip--low';

          html += '<button class="' + spotClass + '" data-tour-id="' + tour.id + '"';
          if (tour.remainingSpots === 0) html += ' disabled';
          html += '>';
          html += '<span class="tt-cal__tour-name">' + tour.tourName + '</span>';
          if (tour.remainingSpots === 0) {
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

    var sortedDates = Object.keys(toursByDate).sort();
    sortedDates.forEach(function (date) {
      var dateObj = new Date(date + 'T12:00:00');
      if (dateObj < today) return;

      var dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      listHtml += '<div class="tt-cal__list-day">';
      listHtml += '<div class="tt-cal__list-date">' + dayName + '</div>';
      listHtml += '<div class="tt-cal__list-tours">';

      toursByDate[date].forEach(function (tour) {
        var soldOut = tour.remainingSpots === 0;
        var low = tour.remainingSpots <= 3 && !soldOut;

        listHtml += '<button class="tt-cal__list-card' + (soldOut ? ' tt-cal__list-card--sold-out' : '') + '" data-tour-id="' + tour.id + '"' + (soldOut ? ' disabled' : '') + '>';
        listHtml += '<div class="tt-cal__list-card-top">';
        listHtml += '<strong>' + tour.tourName + '</strong>';
        listHtml += '<span class="tt-cal__list-card-time">' + tour.time + '</span>';
        listHtml += '</div>';
        listHtml += '<div class="tt-cal__list-card-bottom">';
        listHtml += '<span class="tt-cal__list-card-route">' + tour.routeName + '</span>';
        if (soldOut) {
          listHtml += '<span class="tt-cal__list-card-spots tt-cal__list-card-spots--sold-out">Sold Out</span>';
        } else {
          listHtml += '<span class="tt-cal__list-card-spots' + (low ? ' tt-cal__list-card-spots--low' : '') + '">' + tour.remainingSpots + ' spots left</span>';
        }
        listHtml += '</div>';
        listHtml += '</button>';
      });

      listHtml += '</div></div>';
    });

    if (list) list.innerHTML = listHtml || '<p class="tt-cal__empty">No tours available this month with the selected filter.</p>';

    // Attach click handlers
    document.querySelectorAll('[data-tour-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tourId = this.getAttribute('data-tour-id');
        var tour = tours.find(function (t) { return t.id === tourId; });
        if (tour) openModal(tour);
      });
    });
  }

  // ─── Modal ─────────────────────────────────────────────
  function openModal(tour) {
    selectedTour = tour;
    var modal = document.getElementById('tour-modal');
    if (!modal) return;

    document.getElementById('modal-badge').textContent =
      tour.routeType === 'premium' ? 'Premium Experience' : 'Street Tacos';
    document.getElementById('modal-badge').className =
      'tt-modal__badge tt-modal__badge--' + tour.routeType;
    document.getElementById('modal-title').textContent =
      tour.tourName + ' — ' + tour.routeName;

    var dateObj = new Date(tour.date + 'T12:00:00');
    document.getElementById('modal-date').textContent =
      dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('modal-time').textContent = tour.time;
    document.getElementById('modal-route').textContent = tour.routeName;
    document.getElementById('modal-spots').textContent =
      tour.remainingSpots + ' of ' + tour.capacity + ' spots available';

    // Render stops
    var stopsHtml = '<div class="tt-modal__stops-title">Tour Stops</div>';
    tour.stops.forEach(function (stop, i) {
      stopsHtml +=
        '<div class="tt-modal__stop">' +
        '<div class="tt-modal__stop-number">' + (i + 1) + '</div>' +
        '<div class="tt-modal__stop-info">' +
        '<div class="tt-modal__stop-name">' + stop.name + '</div>' +
        '<div class="tt-modal__stop-taco">' + stop.taco + '</div>' +
        '</div></div>';
    });
    document.getElementById('modal-stops').innerHTML = stopsHtml;

    // Reset qty
    var qtyInput = document.getElementById('ticket-qty');
    qtyInput.value = 1;
    qtyInput.max = tour.remainingSpots;

    // Update book button
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

    if (selectedTour.shopifyVariantId) {
      btn.textContent = 'Add ' + qty + (qty === 1 ? ' Ticket' : ' Tickets') + ' to Cart';
    } else {
      btn.textContent = 'Book ' + qty + (qty === 1 ? ' Ticket' : ' Tickets') + ' — $' + (qty * 1500).toLocaleString() + ' MXN';
    }
  }

  // ─── Init ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    renderCalendar();

    // Month nav
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
      if (val < 1) this.value = 1;
      if (val > max) this.value = max;
      updateBookButton();
    });

    // Book button
    document.getElementById('modal-book-btn').addEventListener('click', function () {
      if (!selectedTour) return;
      var qty = parseInt(document.getElementById('ticket-qty').value, 10);

      if (selectedTour.shopifyVariantId) {
        this.textContent = 'Adding...';
        this.disabled = true;
        addToCart(selectedTour.shopifyVariantId, qty);
      } else {
        // Mock: show confirmation
        alert('Booking confirmed! ' + qty + ' ticket(s) for ' + selectedTour.tourName + ' on ' + selectedTour.date + '.\n\nConnect Shopify products to enable real checkout.');
        closeModal();
      }
    });
  });
})();
