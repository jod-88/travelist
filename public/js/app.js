// app.js - Controller Utama

document.addEventListener('DOMContentLoaded', () => {
  // Ambil state dari localStorage jika ada
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
    
    const destination = document.getElementById('destination').value;
    const days = parseInt(document.getElementById('days').value);
    const group = document.getElementById('group').value;
    const vibe = document.getElementById('vibe').value;
    const budget = document.getElementById('budget').value;
    
    setLoadingState(true);
    
    try {
      const itinerary = await generateItinerary(destination, days, group, vibe, budget);
      
      // Simpan di global dan localStorage
      window.currentItineraryData = itinerary;
      localStorage.setItem('currentItinerary', JSON.stringify(itinerary));
      
      renderItineraryView(itinerary);
      switchView('itinerary-view');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoadingState(false);
    }
  });

  // Handle Back Button
  document.getElementById('back-btn').addEventListener('click', () => {
    // Hapus sesi saat ini
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
