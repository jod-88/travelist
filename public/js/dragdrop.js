// dragdrop.js - Integrasi dengan SortableJS

window.initSortable = function(container, activeDayNumber) {
  // Hanya inisialisasi pada item-item .place-card
  new Sortable(container, {
    handle: '.drag-handle', // Handle specifically for dragging
    animation: 150,
    ghostClass: 'sortable-ghost',
    draggable: '.place-card', // Hanya elemen ini yang bisa di-drag, bukan divider
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;

      console.log(`Pindah dari index ${evt.oldIndex} ke ${evt.newIndex}`);
      
      // Update state data lokal
      updateItineraryDataState(activeDayNumber, evt.item.dataset.id, evt.newIndex);
      
      // Render ulang list agar divider transport ikut ter-update
      renderDayPlaces(activeDayNumber);
    }
  });
}

function updateItineraryDataState(dayNumber, placeId, newDOMIndex) {
  if (!window.currentItineraryData) return;

  const data = window.currentItineraryData;
  const dayIndex = data.generatedDays.findIndex(d => d.dayNumber === dayNumber);
  if (dayIndex === -1) return;

  const places = Array.from(data.generatedDays[dayIndex].places);
  const oldArrIndex = places.findIndex(p => p.id === placeId);
  if (oldArrIndex === -1) return;

  // Hapus item dari array lama
  const [movedItem] = places.splice(oldArrIndex, 1);
  
  // Hitung index baru di array (karena di DOM ada elemen divider, index DOM / 2 = index Array)
  // Misal: DOM [Card0, Div1, Card2, Div3, Card4] 
  // Jika drop di index 2 (Card2 lama posisinya), artinya array index = 1.
  const newArrIndex = Math.floor(newDOMIndex / 2);
  
  places.splice(newArrIndex, 0, movedItem);
  data.generatedDays[dayIndex].places = places;

  // Simpan ke localStorage
  localStorage.setItem('currentItinerary', JSON.stringify(data));
}
