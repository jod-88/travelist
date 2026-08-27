// ui.js - DOM Manipulation and View Transitions

// Card accent color palette for variation
const CARD_COLORS = [
  '#6C63FF', // Indigo
  '#FF7E59', // Coral
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

function switchView(viewId) {
  const views = document.querySelectorAll('.view');
  views.forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const target = document.getElementById(viewId);
  target.classList.remove('hidden');
  target.classList.add('active');

  // Scroll to top when switching views
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderItineraryView(data) {
  // Update Hero info
  document.getElementById('itinerary-title').textContent = data.destination;
  document.getElementById('itinerary-meta').textContent = `${data.days} Days • ${data.travelStyle} • ${data.budget}`;

  // Render Hero Pill Badges
  const pillsContainer = document.getElementById('hero-pills');
  if (pillsContainer) {
    pillsContainer.innerHTML = '';
    const pillData = [
      { icon: '📅', text: `${data.days} Days` },
      { icon: '🎯', text: data.travelStyle },
      { icon: '💰', text: data.budget },
      { icon: '👥', text: data.groupType || 'Solo' }
    ];
    pillData.forEach(pill => {
      const el = document.createElement('span');
      el.className = 'hero-pill';
      el.textContent = `${pill.icon} ${pill.text}`;
      pillsContainer.appendChild(el);
    });
  }

  // Update Packing List
  const packingListEl = document.getElementById('packing-list');
  packingListEl.innerHTML = '';
  if (data.packingList && data.packingList.length > 0) {
    data.packingList.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      packingListEl.appendChild(li);
    });
  }

  // Update Travel Tips
  const tipsEl = document.getElementById('travel-tips');
  if (tipsEl) {
    tipsEl.innerHTML = '';
    if (data.travelTips && data.travelTips.length > 0) {
      const ul = document.createElement('ul');
      data.travelTips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        ul.appendChild(li);
      });
      tipsEl.appendChild(ul);
    } else {
      tipsEl.innerHTML = '<p>No travel tips available for this destination.</p>';
    }
  }

  // Render Tabs
  const tabsContainer = document.getElementById('day-tabs');
  tabsContainer.innerHTML = '';
  
  data.generatedDays.forEach((day, index) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = `Day ${day.dayNumber}`;
    btn.onclick = () => {
      // Set active tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Render places for this day
      renderDayPlaces(day.dayNumber);
    };
    tabsContainer.appendChild(btn);
  });

  // Render first day by default
  if (data.generatedDays.length > 0) {
    renderDayPlaces(data.generatedDays[0].dayNumber);
  }
}

/**
 * Helper to format costs according to destination currency
 */
function formatCurrency(amount, currencyCode, currencySymbol) {
  const num = typeof amount === 'number' ? amount : 0;
  if (num === 0) return 'Free';

  const symbol = currencySymbol || '$';
  
  // Format depending on currency symbol position & decimal needs
  if (currencyCode === 'IDR' || symbol === 'Rp') {
    return `${symbol} ${num.toLocaleString('id-ID')}`;
  } else if (currencyCode === 'JPY' || symbol === '¥') {
    return `${symbol}${num.toLocaleString('ja-JP')}`;
  } else if (currencyCode === 'EUR' || symbol === '€') {
    return `${symbol}${num.toLocaleString('de-DE')}`;
  } else if (currencyCode === 'GBP' || symbol === '£') {
    return `${symbol}${num.toLocaleString('en-GB')}`;
  } else {
    return `${symbol}${num.toLocaleString('en-US')}`;
  }
}

function renderDayPlaces(dayNumber) {
  const data = window.currentItineraryData;
  const listContainer = document.getElementById('itinerary-list');
  listContainer.innerHTML = '';

  const dayData = data.generatedDays.find(d => d.dayNumber === dayNumber);
  if (!dayData) return;

  const symbol = data.currencySymbol || 'Rp';
  const code = data.currencyCode || 'IDR';

  dayData.places.forEach((place, index) => {
    // Create place card
    const card = document.createElement('div');
    card.className = 'place-card';
    card.dataset.id = place.id;
    card.style.animationDelay = `${index * 0.06}s`;

    // Apply accent color variation
    const accentColor = CARD_COLORS[index % CARD_COLORS.length];
    card.style.setProperty('--card-accent', accentColor);

    const formattedCost = formatCurrency(place.estimatedCost, code, symbol);

    card.innerHTML = `
      <div class="drag-handle">☰</div>
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(place.name)}</h3>
          <span class="card-category" data-category="${escapeHtml(place.category)}">${escapeHtml(place.category)}</span>
        </div>
        <p class="card-desc">${escapeHtml(place.description)}</p>
        <div class="card-meta">
          <span>⏱️ ${place.durationMinutes} min</span>
          <span>💰 ${formattedCost}</span>
        </div>
        ${place.planBName ? `
        <div class="card-planb">
          <strong>☂️ Plan B:</strong> ${escapeHtml(place.planBName)}
        </div>` : ''}
      </div>
    `;
    listContainer.appendChild(card);

    // Add transport divider if not the last item
    if (index < dayData.places.length - 1) {
      const travelTime = place.travelTimeToNext || getVariedTravelTime(index);
      const divider = document.createElement('div');
      divider.className = 'transport-divider';
      divider.innerHTML = `
        <span class="line"></span>
        <span>🚗 ~${travelTime} min</span>
        <span class="line"></span>
      `;
      listContainer.appendChild(divider);
    }
  });

  // Update Day Stats
  renderDayStats(dayData);

  // Re-initialize Drag & Drop
  if (window.initSortable) {
    window.initSortable(listContainer, dayNumber);
  }
}

/**
 * Generate varied travel times when not provided by AI.
 * Returns a realistic-looking travel time based on index variation.
 */
function getVariedTravelTime(index) {
  const times = [15, 25, 10, 35, 20, 30, 12, 40, 18, 28];
  return times[index % times.length];
}

function renderDayStats(dayData) {
  const statsContainer = document.getElementById('day-stats');
  if (!statsContainer) return;

  const data = window.currentItineraryData || {};
  const symbol = data.currencySymbol || 'Rp';
  const code = data.currencyCode || 'IDR';

  const totalPlaces = dayData.places.length;
  const totalDuration = dayData.places.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
  const totalCost = dayData.places.reduce((sum, p) => sum + (typeof p.estimatedCost === 'number' ? p.estimatedCost : 0), 0);
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  const formattedTotalCost = formatCurrency(totalCost, code, symbol);

  statsContainer.innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${totalPlaces}</div>
      <div class="stat-label">Destinations</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${hours}h ${mins}m</div>
      <div class="stat-label">Duration</div>
    </div>
    <div class="stat-item" style="grid-column: span 2;">
      <div class="stat-value">${formattedTotalCost}</div>
      <div class="stat-label">Est. Cost</div>
    </div>
  `;
}

// Utility: Escape HTML to prevent XSS in rendered content
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
