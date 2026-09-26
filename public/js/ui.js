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

const FAMOUS_DESTINATION_HIGHLIGHTS = {
  'rome': '🏛️ The Eternal City — Renowned for ancient gladiators, Baroque fountains & timeless Roman gastronomy',
  'tokyo': '🗼 Vibrant Metropolis — Famous for historic shrines, futuristic neon skylines & culinary mastery',
  'paris': '✨ The City of Light — Celebrated for iconic landmarks, romantic boulevards & world-class art',
  'bali': '🌺 Island of the Gods — Famed for clifftop ocean temples, emerald rice terraces & sacred culture',
  'london': '👑 Historic Crown Jewel — Renowned for royal palaces, world-class theatre & storied pubs',
  'barcelona': '🎨 Catalan Masterpiece — Famous for Gaudí architecture, Mediterranean beaches & vibrant tapas',
  'kyoto': '⛩️ Ancient Imperial Capital — Celebrated for thousand-torii shrines, zen gardens & geisha districts',
  'new york': '🗽 The City That Never Sleeps — Famed for Broadway, Central Park & towering iconic skylines',
  'dubai': '✨ Oasis of Modern Wonder — Renowned for soaring skyscrapers, luxury souks & desert safaris',
  'bangkok': '🏯 City of Angels — Famous for shimmering golden temples, floating markets & street food feasts',
  'singapore': '🌿 The Garden City — Celebrated for futuristic supertrees, Marina Bay & vibrant hawker food',
  'sydney': '🌊 Harbour Marvel — Famous for the iconic Opera House, Bondi surf & sun-kissed bays',
  'amsterdam': '🚲 Venice of the North — Renowned for UNESCO canal rings, Dutch Master art & cycling culture',
  'berlin': '🇩🇪 Capital of Freedom & Art — Famous for monumental history, underground culture & sprawling parks',
  'florence': '🎨 Cradle of the Renaissance — Celebrated for Michelangelo\'s masterpieces & Tuscan delicacies',
  'zurich': '🏔️ Alpine Gateway — Renowned for crystal-clear lakes, mountain panoramas & Swiss chocolate',
  'lombok': '🏝️ Untouched Tropical Gem — Famed for turquoise bays, Mount Rinjani & white sand shores',
  'jakarta': '🌆 The Big Durian — Dynamic metropolis blending colonial heritage, modern towers & street flavours',
  'yogyakarta': '🏺 Cultural Heart of Java — Famous for ancient Borobudur temple, batik craft & royal heritage',
  'venice': '🛶 Floating City of Canals — Celebrated for historic bridges, romantic gondolas & Venetian palaces',
  'milan': '👗 Global Fashion Capital — Famous for the soaring Duomo, designer boutiques & Renaissance culture',
  'santorini': '🌅 Aegean Jewel — Renowned for whitewashed cliffside villages, blue domes & world-famous sunsets',
  'seoul': '⚡ Dynamic Trendsetter — Famous for historic palaces, K-culture, night markets & street food',
  'istanbul': '🕌 Where East Meets West — Celebrated for the Hagia Sophia, Grand Bazaar & Bosphorus views',
  'vienna': '🎶 Imperial City of Music — Renowned for opulent palaces, classical symphonies & grand coffee houses',
  'prague': '🏰 City of a Hundred Spires — Famous for Charles Bridge, fairy-tale castles & bohemian beer',
  'cairo': '🐪 Gateway to the Pharaohs — Celebrated for the Pyramids of Giza, the Nile River & ancient wonders',
  'hawaii': '🏄 Paradise of the Pacific — Famous for volcanic peaks, world-class surf & warm aloha spirit',
  'honolulu': '🏄 Paradise of the Pacific — Famous for Waikiki Beach, Diamond Head & warm aloha spirit',
  'maldives': '🏝️ Turquoise Haven — Renowned for overwater villas, vibrant coral reefs & pure tropical tranquility',
  'phuket': '🏖️ Andaman Pearl — Famous for limestone karst bays, sun-drenched beaches & vibrant nightlife',
  'cancun': '🌴 Mayan Coast Jewel — Renowned for turquoise Caribbean waters, white sand & ancient Mayan ruins',
  'cape town': '⛰️ The Mother City — Celebrated for Table Mountain, dramatic coastal drives & penguin colonies',
  'reykjavik': '🌋 Land of Fire & Ice — Famous for the Northern Lights, geothermal hot springs & dramatic glaciers',
  'switzerland': '🏔️ Alpine Wonderland — Renowned for snow-capped peaks, pristine glacial lakes & luxury trains',
  'japan': '🌸 Land of the Rising Sun — Celebrated for ancient traditions, futuristic cities & exquisite cuisine',
  'italy': '🍕 Bel Paese — World-renowned for Renaissance art, ancient history & unmatched culinary traditions'
};

function getDestinationHighlight(data) {
  if (data.tagline && data.tagline.trim()) return data.tagline;
  if (data.famousFor && data.famousFor.trim()) return data.famousFor;

  const destLower = (data.destination || '').toLowerCase().trim();

  for (const [key, desc] of Object.entries(FAMOUS_DESTINATION_HIGHLIGHTS)) {
    if (destLower.includes(key) || key.includes(destLower)) {
      return desc;
    }
  }

  const destTitle = data.destination || 'This Destination';
  const vibe = (data.travelStyle || '').toLowerCase();

  if (vibe.includes('cultur') || vibe.includes('heritage')) {
    return `🏛️ ${destTitle} — Renowned for its rich historic landmarks, iconic architecture & cultural heritage`;
  } else if (vibe.includes('culin') || vibe.includes('food')) {
    return `🍜 ${destTitle} — Celebrated for authentic regional delicacies, vibrant food markets & culinary culture`;
  } else if (vibe.includes('adventur')) {
    return `🧗 ${destTitle} — Famous for thrilling outdoor exploration, scenic trails & memorable excursions`;
  } else if (vibe.includes('relax')) {
    return `🏖️ ${destTitle} — A tranquil escape known for scenic vistas, peaceful atmosphere & unwinding in style`;
  }

  return `✨ ${destTitle} — Famous for captivating sights, distinctive local character & unforgettable travel moments`;
}

function renderItineraryView(data) {
  // Update Hero info
  document.getElementById('itinerary-title').textContent = data.destination;
  
  // Set evocative destination highlight instead of repeating personalization tags
  const metaEl = document.getElementById('itinerary-meta');
  if (metaEl) {
    metaEl.textContent = getDestinationHighlight(data);
  }

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
    if (data.currencyCode) {
      pillData.push({ icon: '💱', text: `${data.currencyCode} (${data.currencySymbol || ''})` });
    }
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
        // Convert **bold** to <strong> tags and remove remaining raw asterisks
        let cleaned = (tip || '')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*/g, '');
        li.innerHTML = cleaned;
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
