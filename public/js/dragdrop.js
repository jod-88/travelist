// dragdrop.js - SortableJS Integration

window.initSortable = function(container, activeDayNumber) {
  // Only initialize on .place-card elements
  new Sortable(container, {
    handle: '.drag-handle', // Handle specifically for dragging
    animation: 150,
    ghostClass: 'sortable-ghost',
    draggable: '.place-card', // Only these elements can be dragged, not dividers
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;

      console.log(`Moved from index ${evt.oldIndex} to ${evt.newIndex}`);
      
      // Update local data state
      updateItineraryDataState(activeDayNumber, evt.item.dataset.id, evt.newIndex);
      
      // Re-render list so transport dividers update correctly
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

  // Remove item from old position
  const [movedItem] = places.splice(oldArrIndex, 1);
  
  // Calculate new array index (DOM has divider elements between cards)
  // e.g.: DOM [Card0, Div1, Card2, Div3, Card4]
  // Drop at DOM index 2 (Card2's old position) means array index = 1
  const newArrIndex = Math.floor(newDOMIndex / 2);
  
  places.splice(newArrIndex, 0, movedItem);
  data.generatedDays[dayIndex].places = places;

  // Save to localStorage
  localStorage.setItem('currentItinerary', JSON.stringify(data));
}
