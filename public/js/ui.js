// ui.js - Manipulasi DOM dan Transisi View

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
  document.getElementById('itinerary-meta').textContent = `${data.days} Hari • ${data.travelStyle} • ${data.budget} • ${data.groupType || ''}`;

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

  // Render Tabs
  const tabsContainer = document.getElementById('day-tabs');
  tabsContainer.innerHTML = '';
  
  data.generatedDays.forEach((day, index) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = `Hari ${day.dayNumber}`;
    btn.onclick = () => {
      // Set active tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Render list untuk hari ini
      renderDayPlaces(day.dayNumber);
    };
    tabsContainer.appendChild(btn);
  });

  // Render hari pertama secara default
  if (data.generatedDays.length > 0) {
    renderDayPlaces(data.generatedDays[0].dayNumber);
  }
}

function renderDayPlaces(dayNumber) {
  const data = window.currentItineraryData;
  const listContainer = document.getElementById('itinerary-list');
  listContainer.innerHTML = '';

  const dayData = data.generatedDays.find(d => d.dayNumber === dayNumber);
  if (!dayData) return;

  dayData.places.forEach((place, index) => {
    // Buat kartu tempat
    const card = document.createElement('div');
    card.className = 'place-card';
    card.dataset.id = place.id;
    card.style.animationDelay = `${index * 0.06}s`;

    const cost = typeof place.estimatedCost === 'number' ? place.estimatedCost : 0;

    card.innerHTML = `
      <div class="drag-handle">☰</div>
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(place.name)}</h3>
          <span class="card-category" data-category="${escapeHtml(place.category)}">${escapeHtml(place.category)}</span>
        </div>
        <p class="card-desc">${escapeHtml(place.description)}</p>
        <div class="card-meta">
          <span>⏱️ ${place.durationMinutes} menit</span>
          <span>💰 IDR ${cost.toLocaleString('id-ID')}</span>
        </div>
        ${place.planBName ? `
        <div class="card-planb">
          <strong>☂️ Plan B:</strong> ${escapeHtml(place.planBName)}
        </div>` : ''}
      </div>
    `;
    listContainer.appendChild(card);

    // Tambahkan divider transportasi jika bukan item terakhir
    if (index < dayData.places.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'transport-divider';
      divider.innerHTML = `
        <span class="line"></span>
        <span>🚗 ~20 min</span>
        <span class="line"></span>
      `;
      listContainer.appendChild(divider);
    }
  });

  // Update Day Stats
  renderDayStats(dayData);

  // Re-inisialisasi Drag & Drop setiap kali me-render ulang list
  if (window.initSortable) {
    window.initSortable(listContainer, dayNumber);
  }
}

function renderDayStats(dayData) {
  const statsContainer = document.getElementById('day-stats');
  if (!statsContainer) return;

  const totalPlaces = dayData.places.length;
  const totalDuration = dayData.places.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
  const totalCost = dayData.places.reduce((sum, p) => sum + (typeof p.estimatedCost === 'number' ? p.estimatedCost : 0), 0);
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  statsContainer.innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${totalPlaces}</div>
      <div class="stat-label">Destinasi</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${hours}j ${mins}m</div>
      <div class="stat-label">Durasi</div>
    </div>
    <div class="stat-item" style="grid-column: span 2;">
      <div class="stat-value">IDR ${totalCost.toLocaleString('id-ID')}</div>
      <div class="stat-label">Estimasi Biaya</div>
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
