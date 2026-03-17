/**
 * Taco Tour Calendar
 * Source of truth: Google Calendar (admin manages tours there)
 * Checkout: Shopify AJAX Cart (single generic ticket product + line item properties)
 * Customer perk: "Add to Google Calendar" link per tour
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  var activeFilter = 'all';
  var allTours = [];
  var selectedTour = null;
  var config = {};

  // ─── Load config from Liquid ────────────────────────────
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

  // ─── Google Calendar API ────────────────────────────────
  function fetchTours(year, month) {
    if (!config.googleCalendarId || !config.googleApiKey) {
      showError('Calendar not configured. Add your Google Calendar ID and API Key in the theme editor.');
      return Promise.resolve([]);
    }

    // Fetch a 3-month window around the current month for smooth navigation
    var timeMin = new Date(year, month - 1, 1).toISOString();
    var timeMax = new Date(year, month + 2, 0, 23, 59, 59).toISOString();

    var url =
      'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(config.googleCalendarId) +
      '/events?key=' + encodeURIComponent(config.googleApiKey) +
      '&timeMin=' + encodeURIComponent(timeMin) +
      '&timeMax=' + encodeURIComponent(timeMax) +
      '&singleEvents=true' +
      '&orderBy=startTime' +
      '&maxResults=100' +
      '&timeZone=' + encodeURIComponent(config.timezone || 'America/Mexico_City');

    return fetch(url)
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.error ? data.error.message : 'Calendar API error');
          });
        }
        return res.json();
      })
      .then(function (data) {
        return (data.items || []).map(parseGoogleEvent).filter(Boolean);
      })
      .catch(function (err) {
        console.error('Taco Calendar: fetch error', err);
        showError('Could not load tours. Please try again later.');
        return [];
      });
  }

  // ─── Parse Google Calendar event → tour object ──────────
  function parseGoogleEvent(event) {
    if (!event.start || event.status === 'cancelled') return null;

    var startDt = event.start.dateTime || event.start.date;
    var endDt = event.end ? (event.end.dateTime || event.end.date) : startDt;

    var startDate = new Date(startDt);
    var endDate = new Date(endDt);

    // Date string YYYY-MM-DD
    var dateStr =
      startDate.getFullYear() + '-' +
      String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(startDate.getDate()).padStart(2, '0');

    // Time string
    var timeStart = formatTime(startDate);
    var timeEnd = formatTime(endDate);
    var timeLabel = timeStart + ' - ' + timeEnd;

    // Parse title: "Tour A — Ruta Roma-Condesa" or just "Ruta Roma-Condesa"
    var title = event.summary || 'Tour';
    var tourName = title;
    var routeName = title;

    if (title.indexOf('—') > -1) {
      var parts = title.split('—');
      tourName = parts[0].trim();
      routeName = parts[1].trim();
    } else if (title.indexOf('-') > -1 && title.indexOf('- ') > -1) {
      var parts2 = title.split(' - ');
      if (parts2.length === 2) {
        tourName = parts2[0].trim();
        routeName = parts2[1].trim();
      }
    }

    // Parse description for structured data
    var desc = event.description || '';
    var parsed = parseDescription(desc);

    // Determine period from hour
    var hour = startDate.getHours();
    var period = parsed.period || (hour < 15 ? 'morning' : 'night');

    return {
      id: event.id,
      googleEventId: event.id,
      date: dateStr,
      time: timeLabel,
      startIso: startDt,
      endIso: endDt,
      period: period,
      tourName: tourName,
      routeName: routeName,
      routeType: parsed.type || 'street',
      stops: parsed.stops || [],
      capacity: parsed.capacity || 10,
      remainingSpots: Math.max(0, (parsed.capacity || 10) - (parsed.booked || 0)),
      location: event.location || '',
      description: desc
    };
  }

  // ─── Parse structured description ───────────────────────
  //
  // Expected format in Google Calendar event description:
  //
  //   type: street
  //   period: night
  //   capacity: 10
  //   booked: 3
  //   stops:
  //   Tacos Orinoco | Bistek con queso
  //   El Vilsito | Suadero nocturno
  //
  function parseDescription(text) {
    var result = { stops: [] };
    if (!text) return result;

    // Strip HTML tags (Google Calendar sometimes wraps in HTML)
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

    var lines = text.split('\n');
    var inStops = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.toLowerCase().startsWith('type:')) {
        result.type = line.split(':').slice(1).join(':').trim().toLowerCase();
        inStops = false;
      } else if (line.toLowerCase().startsWith('period:')) {
        result.period = line.split(':').slice(1).join(':').trim().toLowerCase();
        inStops = false;
      } else if (line.toLowerCase().startsWith('capacity:')) {
        result.capacity = parseInt(line.split(':')[1].trim(), 10) || 10;
        inStops = false;
      } else if (line.toLowerCase().startsWith('booked:')) {
        result.booked = parseInt(line.split(':')[1].trim(), 10) || 0;
        inStops = false;
      } else if (line.toLowerCase().startsWith('stops:')) {
        inStops = true;
      } else if (inStops && line.indexOf('|') > -1) {
        var stopParts = line.split('|');
        result.stops.push({
          name: stopParts[0].trim(),
          taco: stopParts[1] ? stopParts[1].trim() : ''
        });
      }
    }

    return result;
  }

  function formatTime(date) {
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  // ─── Shopify Cart (single product + line item properties) ─
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

    // Line item properties — these show in cart & order confirmation
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

  // ─── Google Calendar link for customers ─────────────────
  function buildGoogleCalendarUrl(tour) {
    // Format dates for Google Calendar URL: YYYYMMDDTHHMMSS
    var start = tour.startIso.replace(/[-:]/g, '').replace(/\.\d+/, '');
    var end = tour.endIso.replace(/[-:]/g, '').replace(/\.\d+/, '');

    // If timezone offset present, keep it; otherwise use local
    var dates = start + '/' + end;

    var details = 'Taco Tour: ' + tour.routeName;
    if (tour.stops.length > 0) {
      details += '\n\nStops:\n';
      tour.stops.forEach(function (s, i) {
        details += (i + 1) + '. ' + s.name;
        if (s.taco) details += ' — ' + s.taco;
        details += '\n';
      });
    }

    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(tour.tourName + ' — ' + tour.routeName),
      'dates=' + encodeURIComponent(dates),
      'details=' + encodeURIComponent(details),
      'location=' + encodeURIComponent(tour.location || tour.routeName),
      'ctz=' + encodeURIComponent(config.timezone || 'America/Mexico_City')
    ];

    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  // ─── Render Calendar ───────────────────────────────────
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

    // Filter tours for this month
    var prefix = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var filtered = allTours.filter(function (t) {
      if (!t.date.startsWith(prefix)) return false;
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

  // ─── Modal ─────────────────────────────────────────────
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

    // Price
    var priceEl = document.getElementById('modal-price');
    if (priceEl) {
      priceEl.textContent = config.ticketPriceFormatted || '$1,500 MXN';
    }

    // Stops
    var stopsHtml = '';
    if (tour.stops.length > 0) {
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

    // Qty
    var qtyInput = document.getElementById('ticket-qty');
    qtyInput.value = 1;
    qtyInput.max = Math.min(tour.remainingSpots, 10);

    updateBookButton();

    // Google Calendar link for customer
    var gcalLink = document.getElementById('modal-gcal-link');
    if (gcalLink) {
      gcalLink.href = buildGoogleCalendarUrl(tour);
    }

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

  // ─── Helpers ────────────────────────────────────────────
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

  function showError(msg) {
    var grid = document.getElementById('cal-grid');
    if (grid) {
      grid.innerHTML =
        '<div class="tt-cal__error">' +
        '<p>' + escapeHtml(msg) + '</p>' +
        '</div>';
    }
  }

  // ─── Init ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    config = loadConfig();

    // Fetch tours from Google Calendar then render
    fetchTours(currentYear, currentMonth)
      .then(function (tours) {
        allTours = tours;
        renderCalendar();
      });

    // Month navigation — refetch when changing months
    document.getElementById('cal-prev').addEventListener('click', function () {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      // Check if we already have data for this month
      var prefix = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var hasData = allTours.some(function (t) { return t.date.startsWith(prefix); });
      if (hasData) {
        renderCalendar();
      } else {
        fetchTours(currentYear, currentMonth).then(function (tours) {
          // Merge with existing tours (avoid duplicates)
          var existingIds = {};
          allTours.forEach(function (t) { existingIds[t.id] = true; });
          tours.forEach(function (t) {
            if (!existingIds[t.id]) allTours.push(t);
          });
          renderCalendar();
        });
      }
    });

    document.getElementById('cal-next').addEventListener('click', function () {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      var prefix = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var hasData = allTours.some(function (t) { return t.date.startsWith(prefix); });
      if (hasData) {
        renderCalendar();
      } else {
        fetchTours(currentYear, currentMonth).then(function (tours) {
          var existingIds = {};
          allTours.forEach(function (t) { existingIds[t.id] = true; });
          tours.forEach(function (t) {
            if (!existingIds[t.id]) allTours.push(t);
          });
          renderCalendar();
        });
      }
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

    // Book button — Shopify add to cart
    document.getElementById('modal-book-btn').addEventListener('click', function () {
      if (!selectedTour) return;
      var qty = parseInt(document.getElementById('ticket-qty').value, 10);
      addToCart(selectedTour, qty);
    });
  });
})();
