// app.js - Main Controller

// ===========================
// POPULAR DESTINATIONS for predictive text
// ===========================
const POPULAR_DESTINATIONS = [
  "Bali", "Tokyo", "Paris", "London", "New York", "Rome", "Barcelona",
  "Dubai", "Bangkok", "Singapore", "Seoul", "Istanbul", "Sydney",
  "Amsterdam", "Prague", "Vienna", "Lisbon", "Berlin", "Madrid",
  "Kyoto", "Osaka", "Santorini", "Maldives", "Phuket", "Hanoi",
  "Ho Chi Minh City", "Kuala Lumpur", "Jakarta", "Yogyakarta",
  "Ubud", "Seminyak", "Nusa Penida", "Lombok", "Labuan Bajo",
  "Bandung", "Malang", "Surabaya", "Makassar", "Manado",
  "Raja Ampat", "Lake Toba", "Bromo", "Borobudur",
  "Chiang Mai", "Siem Reap", "Luang Prabang",
  "Cancun", "Havana", "Rio de Janeiro", "Buenos Aires", "Lima",
  "Cape Town", "Marrakech", "Cairo", "Petra", "Zanzibar",
  "Reykjavik", "Oslo", "Stockholm", "Helsinki", "Copenhagen",
  "Florence", "Venice", "Milan", "Naples", "Amalfi",
  "Zurich", "Interlaken", "Lucerne",
  "Edinburgh", "Dublin", "Bruges",
  "Hong Kong", "Taipei", "Shanghai", "Beijing",
  "Mumbai", "Jaipur", "Goa", "Kerala",
  "Hawaii", "Fiji", "Bora Bora", "Tahiti"
];

// ===========================
// BACKGROUND SLIDESHOW
// ===========================
function initBackgroundSlideshow() {
  const slides = document.querySelectorAll('.bg-slide');
  if (slides.length === 0) return;

  let currentSlide = 0;
  
  setInterval(() => {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }, 6000); // Change every 6 seconds
}

// ===========================
// PREDICTIVE TEXT
// ===========================
function initPredictiveText() {
  const input = document.getElementById('destination');
  const suggestionEl = document.getElementById('destination-suggestion');
  const errorEl = document.getElementById('destination-error');

  if (!input || !suggestionEl) return;

  input.addEventListener('input', () => {
    const value = input.value.trim().toLowerCase();
    
    // Hide error when user types
    if (errorEl) {
      errorEl.classList.add('hidden');
    }

    if (value.length < 2) {
      suggestionEl.classList.add('hidden');
      return;
    }

    // Find closest match
    const match = findClosestMatch(value);
    
    if (match && match.toLowerCase() !== value) {
      suggestionEl.innerHTML = `<span class="suggestion-label">Did you mean </span><span class="suggestion-value">${match}</span><span class="suggestion-label">?</span>`;
      suggestionEl.classList.remove('hidden');
      
      // Click to apply suggestion
      suggestionEl.onclick = () => {
        input.value = match;
        suggestionEl.classList.add('hidden');
        input.focus();
      };
    } else {
      suggestionEl.classList.add('hidden');
    }
  });

  // Hide suggestion on blur (with delay for click)
  input.addEventListener('blur', () => {
    setTimeout(() => {
      suggestionEl.classList.add('hidden');
    }, 200);
  });
}

function findClosestMatch(input) {
  // Exact prefix match first
  const prefixMatch = POPULAR_DESTINATIONS.find(d => 
    d.toLowerCase().startsWith(input)
  );
  if (prefixMatch) return prefixMatch;

  // Fuzzy match: contains
  const containsMatch = POPULAR_DESTINATIONS.find(d => 
    d.toLowerCase().includes(input)
  );
  if (containsMatch) return containsMatch;

  // Consonant/initials matching (e.g. "tky" → "Tokyo", "prs" → "Paris")
  const consonantMatch = POPULAR_DESTINATIONS.find(d => {
    const dLower = d.toLowerCase().replace(/\s+/g, '');
    const consonants = dLower.replace(/[aeiou]/g, '');
    return consonants.startsWith(input) || dLower.startsWith(input);
  });
  if (consonantMatch) return consonantMatch;

  // Levenshtein-like: find closest with small edit distance
  let bestMatch = null;
  let bestDistance = Infinity;
  const maxDist = input.length <= 3 ? 2 : 3;

  for (const dest of POPULAR_DESTINATIONS) {
    // Compare against truncated destination name
    const destLower = dest.toLowerCase();
    const truncated = destLower.substring(0, input.length);
    const dist = levenshteinDistance(input, truncated);
    if (dist < bestDistance && dist <= maxDist) {
      bestDistance = dist;
      bestMatch = dest;
    }
    // Also try full name comparison for short inputs
    if (input.length >= 3) {
      const fullDist = levenshteinDistance(input, destLower);
      if (fullDist < bestDistance && fullDist <= maxDist) {
        bestDistance = fullDist;
        bestMatch = dest;
      }
    }
  }

  return bestMatch;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ===========================
// ERROR DISPLAY
// ===========================
function showDestinationError(message) {
  const errorEl = document.getElementById('destination-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  // Re-trigger shake animation
  errorEl.style.animation = 'none';
  errorEl.offsetHeight; // Force reflow
  errorEl.style.animation = '';
}

function hideDestinationError() {
  const errorEl = document.getElementById('destination-error');
  if (errorEl) errorEl.classList.add('hidden');
}

function showInlineError(message) {
  showDestinationError(message);
}

// ===========================
// ===========================
// CUSTOM DROPDOWN UI CONTROLLER
// ===========================
function initCustomSelects() {
  const selectWrappers = document.querySelectorAll('.select-wrapper');

  selectWrappers.forEach(wrapper => {
    const nativeSelect = wrapper.querySelector('select');
    if (!nativeSelect) return;

    // Hide native select visually while keeping it functional in DOM
    nativeSelect.style.position = 'absolute';
    nativeSelect.style.opacity = '0';
    nativeSelect.style.pointerEvents = 'none';
    nativeSelect.style.width = '0';
    nativeSelect.style.height = '0';

    // Create custom UI container
    const customWrapper = document.createElement('div');
    customWrapper.className = 'custom-select-wrapper';

    // Trigger button
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';

    const selectedOption = nativeSelect.options[nativeSelect.selectedIndex] || nativeSelect.options[0];
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'trigger-text';
    labelSpan.textContent = selectedOption ? selectedOption.textContent : '';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'custom-select-arrow';
    arrowSpan.textContent = '▼';

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowSpan);

    // Options Menu
    const menu = document.createElement('div');
    menu.className = 'custom-options-menu';

    Array.from(nativeSelect.options).forEach((opt, idx) => {
      const optionEl = document.createElement('div');
      optionEl.className = `custom-option ${opt.selected ? 'selected' : ''}`;
      optionEl.dataset.value = opt.value;

      // Extract text & price range badge if present
      const optText = opt.textContent;
      if (optText.includes('(') && optText.includes(')')) {
        const mainPart = optText.substring(0, optText.indexOf('(')).trim();
        const badgePart = optText.substring(optText.indexOf('(') + 1, optText.indexOf(')')).trim();
        
        optionEl.innerHTML = `
          <span>${escapeHtml(mainPart)}</span>
          <span class="option-badge">${escapeHtml(badgePart)}</span>
        `;
      } else {
        optionEl.textContent = optText;
      }

      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Update native select
        nativeSelect.value = opt.value;
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // Update trigger text
        labelSpan.textContent = optText;

        // Update selected class
        menu.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
        optionEl.classList.add('selected');

        // Close menu
        customWrapper.classList.remove('open');
      });

      menu.appendChild(optionEl);
    });

    // Toggle menu
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other open custom dropdowns
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
        if (w !== customWrapper) w.classList.remove('open');
      });
      customWrapper.classList.toggle('open');
    });

    customWrapper.appendChild(trigger);
    customWrapper.appendChild(menu);
    wrapper.appendChild(customWrapper);
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
      w.classList.remove('open');
    });
  });
}

// ===========================
// FULL-SCREEN PERCENTAGE LOADING
// ===========================
let loadingController = null;
const CIRCUMFERENCE = 427.25; // 2 * PI * 68

function startLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  const percentEl = document.getElementById('loading-percent');
  const statusEl = document.getElementById('loading-status');
  const ringFill = document.getElementById('progress-ring-fill');
  const flightPlane = document.getElementById('flight-plane');
  
  if (!overlay || !percentEl || !ringFill) return null;

  overlay.classList.remove('hidden');
  
  let currentPercent = 0;
  let intervalId = null;

  const stepStatusMessages = [
    { threshold: 0, msg: "Analyzing destination & travel style...", step: 1 },
    { threshold: 25, msg: "Searching top local spots & hidden gems...", step: 2 },
    { threshold: 55, msg: "Calculating daily routes & local prices...", step: 3 },
    { threshold: 80, msg: "Customizing packing list & travel tips...", step: 4 }
  ];

  function updateProgressUI(pct) {
    const val = Math.floor(pct);
    percentEl.textContent = val;
    
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = Math.max(0, offset);
    
    if (flightPlane) {
      flightPlane.style.left = `${pct}%`;
    }

    // Update status text & active step indicator
    for (let i = stepStatusMessages.length - 1; i >= 0; i--) {
      if (pct >= stepStatusMessages[i].threshold) {
        statusEl.textContent = stepStatusMessages[i].msg;
        updateStepDots(stepStatusMessages[i].step);
        break;
      }
    }
  }

  function updateStepDots(activeStep) {
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById(`step-${i}`);
      if (dot) {
        if (i <= activeStep) dot.classList.add('active');
        else dot.classList.remove('active');
      }
    }
  }

  updateProgressUI(0);

  // Increment up to 90% while waiting for async response
  intervalId = setInterval(() => {
    if (currentPercent < 90) {
      const increment = Math.max(0.6, (90 - currentPercent) * 0.07);
      currentPercent += increment;
      updateProgressUI(currentPercent);
    }
  }, 70);

  return {
    finish: () => {
      return new Promise((resolve) => {
        clearInterval(intervalId);
        const finishInterval = setInterval(() => {
          currentPercent += (100 - currentPercent) * 0.35 + 1.5;
          if (currentPercent >= 100) {
            currentPercent = 100;
            updateProgressUI(100);
            clearInterval(finishInterval);
            setTimeout(() => {
              overlay.classList.add('hidden');
              resolve();
            }, 450);
          } else {
            updateProgressUI(currentPercent);
          }
        }, 30);
      });
    },
    stop: () => {
      clearInterval(intervalId);
      overlay.classList.add('hidden');
    }
  };
}

// ===========================
// MAIN APP INIT
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize background slideshow
  initBackgroundSlideshow();

  // Initialize predictive text
  initPredictiveText();

  // Initialize custom dropdown UI
  initCustomSelects();

  // Restore state from localStorage if available
  const savedItinerary = localStorage.getItem('currentItinerary');
  if (savedItinerary) {
    try {
      const parsed = JSON.parse(savedItinerary);
      window.currentItineraryData = parsed;
      renderItineraryView(parsed);
      switchView('itinerary-view');
    } catch (e) {
      console.error(e);
      switchView('home-view');
    }
  } else {
    switchView('home-view');
  }

  // Handle Form Submit
  const form = document.getElementById('travel-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideDestinationError();
    
    const destination = document.getElementById('destination').value.trim();
    const days = parseInt(document.getElementById('days').value);
    const group = document.getElementById('group').value;
    const vibe = document.getElementById('vibe').value;
    const budget = document.getElementById('budget').value;

    // Validate destination
    if (!destination) {
      showDestinationError("Please enter a destination.");
      return;
    }

    if (destination.length < 2) {
      showDestinationError("Please enter a valid destination name.");
      return;
    }

    // Check for obviously invalid input (numbers only, special chars only)
    if (/^[\d\s]+$/.test(destination)) {
      showDestinationError("That doesn't look like a real place. Try entering a city or country name.");
      return;
    }

    if (/^[^a-zA-Z]+$/.test(destination)) {
      showDestinationError("Please enter a valid destination name with letters.");
      return;
    }
    
    setLoadingState(true);
    const loader = startLoadingOverlay();
    
    try {
      const itinerary = await generateItinerary(destination, days, group, vibe, budget);
      
      // Save globally and to localStorage
      window.currentItineraryData = itinerary;
      localStorage.setItem('currentItinerary', JSON.stringify(itinerary));
      
      if (loader) {
        await loader.finish();
      }

      renderItineraryView(itinerary);
      switchView('itinerary-view');
    } catch (error) {
      if (loader) loader.stop();
      // Show inline error instead of alert — stay on landing page
      showInlineError(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingState(false);
    }
  });

  // Handle Back Button
  document.getElementById('back-btn').addEventListener('click', () => {
    // Clear current session
    localStorage.removeItem('currentItinerary');
    window.currentItineraryData = null;
    switchView('home-view');
  });
});

function setLoadingState(isLoading) {
  const btnText = document.getElementById('btn-text');
  const btnLoader = document.getElementById('btn-loader');
  const submitBtn = document.getElementById('submit-btn');
  
  if (isLoading) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    submitBtn.disabled = false;
  }
}
