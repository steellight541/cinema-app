const moviesContainer = document.getElementById('movies-container');
const moviesContentHeadline = document.querySelector('#movies-content h1'); // For updating "Popular Movies" text
const movieFiltersContainer = document.getElementById('movie-filters-container');
const movieCategorySelect = document.getElementById('movie-category-select');
const movieGenreSelect = document.getElementById('movie-genre-select');
const movieNameSearchInput = document.getElementById('movie-name-search');
const screeningsContainer = document.getElementById('screenings-container');
const managerScreeningsContainer = document.getElementById('manager-screenings-list'); // New container for manager's screenings
const addScreeningForm = document.getElementById('add-screening-form');
const movieTitleInput = document.getElementById('movieTitle'); // Direct reference to the input
const movieTitleSuggestionsContainer = document.getElementById('movie-title-suggestions'); // NEW
const loginForm = document.getElementById('login');
const logoutButton = document.getElementById('logout-button');
const messageContainer = document.getElementById('message-container');
const ticketSalesChartContainer = document.getElementById('ticket-sales-chart-container');
let ticketSalesChart = null;

// Popover elements for editing screenings
const editScreeningPopover = document.getElementById('edit-screening-popover');
const editScreeningPopoverForm = document.getElementById('edit-screening-popover-form');
const editScreeningIdInput_popover = document.getElementById('edit-screening-id-popover');
const editMovieTitleInput_popover = document.getElementById('edit-movieTitle-popover');
const editDateInput_popover = document.getElementById('edit-date-popover');
const editTicketsAvailableInput_popover = document.getElementById('edit-ticketsAvailable-popover');

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200'; // w200 is een goede maat voor posters in een lijst

// Screening filter elements
const screeningDateFilterInput = document.getElementById('screening-date-filter');
const screeningNameFilterInput = document.getElementById('screening-name-filter'); // NIEUW
const applyScreeningFilterButton = document.getElementById('apply-screening-filter');
const clearScreeningFilterButton = document.getElementById('clear-screening-filter');
const qrCodeContainer = document.getElementById('qr-code-container');
const ticketQrCodeImg = document.getElementById('ticket-qr-code-img');
let salesChart = null; // Variable to keep track of the chart instance

let allFetchedScreenings = []; // Globale variabele om alle opgehaalde screenings op te slaan voor client-side filtering
let allFetchedMovies = []; // To store movies for client-side name searching
let allScreeningsForManager = []; // To store screenings specifically for manager view and editing
let currentMovieCategory = 'popular'; // Default category
let currentGenreId = ''; // Default no genre
let webSocket; // Declare WebSocket variable

const setupWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//localhost:3000`;

  webSocket = new WebSocket(wsUrl);

  webSocket.onopen = () => {
    console.log('WebSocket connection established');
  };

  webSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message);

      if (message.type === 'screenings_updated') {
        allScreeningsForManager = message.payload; // Update manager's local copy
        const currentFilterDate = screeningDateFilterInput.value;
        let userViewScreenings = message.payload;
        if (currentFilterDate) {
            userViewScreenings = userViewScreenings.filter(screening => screening.date.startsWith(currentFilterDate));
        }
        allFetchedScreenings = userViewScreenings; // Update for client-side filtering on user tab

        applyClientSideFilters(); // Update user view

        if (document.getElementById('manager-tab').classList.contains('active')) {
            displayManagerScreenings(message.payload); // Manager toont altijd alle (nieuwste) screenings
            renderTicketSalesChart(message.payload);
        }
        showMessage('Screenings have been updated live!', 'info');
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  webSocket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.reason, event.code);
  };

  webSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

const tabsContainer = document.getElementById('tabs-container');
const moviesTab = document.getElementById('movies-tab');
const screeningsTab = document.getElementById('screenings-tab');
const managerTab = document.getElementById('manager-tab');
const moviesContent = document.getElementById('movies-content');
const screeningsContent = document.getElementById('screenings-content');
const managerContent = document.getElementById('manager-content');

const showMessage = (message, type = 'info') => { // Default to 'info'
  messageContainer.textContent = message;
  messageContainer.className = 'message'; // Reset classes
  messageContainer.classList.add(type); // Add success, error, or info
  
  // Optional: auto-hide message after some time
  setTimeout(() => {
    messageContainer.textContent = '';
    messageContainer.className = 'message';
  }, 5000);
};

const fetchAndDisplayGenres = async () => {
  const currentMovieGenreSelect = document.getElementById('movie-genre-select');
  if (!currentMovieGenreSelect) {
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/movies/genres');
    if (!response.ok) throw new Error('Failed to fetch genres');
    const genres = await response.json();
    currentMovieGenreSelect.innerHTML = '<option value="">All Genres</option>'; // Reset
    genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id;
      option.textContent = genre.name;
      currentMovieGenreSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching genres:', error);
    showMessage('Could not load movie genres.', 'error');
  }
};

const fetchMovies = async () => {
  const token = localStorage.getItem('jwt');
  if (!token && (currentMovieCategory !== 'popular' && currentMovieCategory !== 'upcoming' && !currentGenreId)) { // Allow public access for basic categories
     // If we decide some categories need auth, add checks here
  }

  let endpoint = 'http://localhost:3000/api/movies/';
  let headlineText = "Movies";
  const currentMovieGenreSelect = document.getElementById('movie-genre-select'); // Get dynamically

  if (currentGenreId && currentMovieGenreSelect) {
    endpoint += `genre/${currentGenreId}`;
    const selectedGenreText = currentMovieGenreSelect.options[currentMovieGenreSelect.selectedIndex]?.text || 'Selected Genre';
    headlineText = `${selectedGenreText} Movies`;
  } else {
    switch (currentMovieCategory) {
      case 'upcoming':
        endpoint += 'upcoming';
        headlineText = 'Upcoming Movies';
        break;
      case 'popular':
      default:
        endpoint += 'popular';
        headlineText = 'Popular Movies';
        break;
    }
  }
  
  const currentMoviesContentHeadline = document.querySelector('#movies-content h2');
  if (currentMoviesContentHeadline) currentMoviesContentHeadline.textContent = headlineText;

  try {
    const response = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      if (response.status === 401 && token) { // Only show auth error if token was present
        showMessage('Session expired or unauthorized. Please log in again.', 'error');
        logoutButton.click(); // Consider if this is always desired
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allFetchedMovies = await response.json();
    applyMovieNameFilter(); // This will call displayMovies
  } catch (error) {
    console.error('Error fetching movies:', error);
    showMessage(`Could not fetch ${headlineText.toLowerCase()}.`, 'error');
    allFetchedMovies = [];
    applyMovieNameFilter(); // Display empty
  }
};

const applyMovieNameFilter = () => {
  const currentMovieNameSearchInput = document.getElementById('movie-name-search');
  const searchTerm = currentMovieNameSearchInput ? currentMovieNameSearchInput.value.toLowerCase().trim() : "";
  let moviesToDisplay = allFetchedMovies;

  if (searchTerm) {
    moviesToDisplay = allFetchedMovies.filter(movie =>
      movie.title.toLowerCase().includes(searchTerm)
    );
  }
  displayMovies(moviesToDisplay);
};

const displayMovies = (movies) => {
  const token = localStorage.getItem('jwt');
  const payload = token ? decodeJWT(token) : null;
  const isManager = payload && payload.role === 'manager';

  const currentMoviesContainer = document.getElementById('movies-container');
  if (!currentMoviesContainer) {
    console.error('Movies container not found in displayMovies. Make sure #movies-container exists in #movies-content.');
    return;
  }

  currentMoviesContainer.innerHTML = movies
    .map(
      (movie) => `
      <div class="movie">
        <img src="${TMDB_IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}">
        <div class="movie-info">
          <h2>${movie.title}</h2>
          <p>Rating: ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</p>
          ${ movie.release_date ? `<p class="release-date">Release: ${movie.release_date.substring(0,4)}</p>` : ''}
        </div>
        ${
          isManager
            ? `<button class="edit-movie btn-secondary" data-id="${movie.id}">Edit</button>`
            : ''
        }
      </div>
    `
    )
    .join('');

  if (isManager) {
    document.querySelectorAll('.edit-movie').forEach((button) =>
      button.addEventListener('click', (e) => handleEditMovie(e.target.dataset.id))
    );
  }
};

const handleEditMovie = async (id) => {
  const movieToEdit = allFetchedMovies.find(m => m.id === parseInt(id));
  const currentTitle = movieToEdit ? movieToEdit.title : '';
  const currentRating = movieToEdit ? movieToEdit.vote_average : '';
  const currentPosterPath = movieToEdit ? movieToEdit.poster_path : '';

  const title = prompt('Enter new Title:', currentTitle);
  let vote_average_str = prompt('Enter new Rating (e.g., 7.5):', currentRating);
  let poster_path = prompt('Enter new Poster Path (e.g., /newPath.jpg):', currentPosterPath);

  if (title === null || vote_average_str === null || poster_path === null) {
    showMessage('Movie update cancelled.', 'info');
    return;
  }
  const vote_average = parseFloat(vote_average_str);
  if (isNaN(vote_average)) {
    showMessage('Invalid rating. Please enter a number.', 'error');
    return;
  }

  const token = localStorage.getItem('jwt');

  try {
    const response = await fetch(`http://localhost:3000/api/movies/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, vote_average, poster_path }),
    });

    if (response.ok) {
      const updatedMovieData = await response.json();
      const index = allFetchedMovies.findIndex(m => m.id === updatedMovieData.id);
      if (index !== -1) {
        allFetchedMovies[index] = { ...allFetchedMovies[index], ...updatedMovieData };
      } else {
        allFetchedMovies.push(updatedMovieData);
      }
      applyMovieNameFilter();
      showMessage('Movie updated successfully!', 'success');
    } else {
      console.error('Failed to update movie:', await response.json());
      showMessage('Failed to update movie. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error updating movie:', error);
    showMessage('An error occurred. Please try again.', 'error');
  }
};

const fetchScreenings = async (filterDate = null) => {
  const token = localStorage.getItem('jwt');

  if (!token) {
    return;
  }

  let url = 'http://localhost:3000/api/screenings';
  if (filterDate) {
    url += `?date=${filterDate}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        showMessage('Session expired or unauthorized to view screenings. Please log in again.', 'error');
        logoutButton.click();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    allFetchedScreenings = await response.json(); // Sla op voor client-side filtering
    applyClientSideFilters(); // Pas direct client-side filters toe (inclusief naam)

    displayManagerScreenings(allFetchedScreenings); 

  } catch (error) {
    console.error('Error fetching screenings:', error);
    showMessage('Could not fetch screenings.', 'error');
    allFetchedScreenings = []; // Reset bij fout
    applyClientSideFilters(); // Toon lege lijst
  }
};

const applyClientSideFilters = () => {
  const currentScreeningNameFilterInput = document.getElementById('screening-name-filter');
  const nameFilterText = currentScreeningNameFilterInput ? currentScreeningNameFilterInput.value.toLowerCase().trim() : "";
  let screeningsToDisplay = allFetchedScreenings;

  if (nameFilterText) {
    screeningsToDisplay = allFetchedScreenings.filter(screening => 
      screening.movieTitle && screening.movieTitle.toLowerCase().includes(nameFilterText)
    );
  }
  
  displayScreenings(screeningsToDisplay);
};

const displayScreenings = (screenings) => {
  const currentScreeningsContainer = document.getElementById('screenings-container');
  if (!currentScreeningsContainer) return;
  currentScreeningsContainer.innerHTML = screenings
    .map(
      (screening) => {
        const posterUrl = screening.moviePosterPath 
          ? `${TMDB_IMAGE_BASE_URL}${screening.moviePosterPath}`
          : 'https://via.placeholder.com/100x150.png?text=No+Image'; // Fallback image
        const movieTitleText = screening.movieTitle || `Movie ID: ${screening.movieId}`; // Fallback to ID if title is missing

        return `
          <div class="screening">
            <img src="${posterUrl}" alt="${movieTitleText}" class="screening-poster">
            <div class="screening-details">
              <h4>${movieTitleText}</h4>
              <p>Date: ${new Date(screening.date).toLocaleString()}</p>
              <p>Tickets Available: <span class="tickets-available" data-screening-id="${screening.id}">${screening.ticketsAvailable}</span></p>
              <button class="reserve-ticket" data-id="${screening.id}" ${screening.ticketsAvailable === 0 ? 'disabled' : ''}>
                ${screening.ticketsAvailable === 0 ? 'Sold Out' : 'Reserve Ticket'}
              </button>
            </div>
          </div>
        `;
      }
    )
    .join('');

  document.querySelectorAll('.reserve-ticket').forEach((button) =>
    button.addEventListener('click', (e) => handleReserveTicket(e.target.dataset.id))
  );
};

const displayManagerScreenings = (screenings) => {
  allScreeningsForManager = screenings; // Store for easy access when editing
  const currentManagerScreeningsContainer = document.getElementById('manager-screenings-list');
  if (!currentManagerScreeningsContainer) return;

  currentManagerScreeningsContainer.innerHTML = `<h3>Manage Screenings</h3>` + screenings
    .map(
      (screening) => {
        const posterUrl = screening.moviePosterPath
          ? `${TMDB_IMAGE_BASE_URL}${screening.moviePosterPath}`
          : 'https://via.placeholder.com/80x120.png?text=No+Image'; // Kleinere fallback voor manager lijst
        const movieTitleText = screening.movieTitle || `Movie ID: ${screening.movieId}`;

        return `
          <div class="manager-screening-item" id="manager-screening-${screening.id}">
            <img src="${posterUrl}" alt="${movieTitleText}" class="manager-screening-poster">
            <div class="manager-screening-details">
              <p><strong>${movieTitleText}</strong></p>
              <p>Screening ID: ${screening.id} | Date: ${new Date(screening.date).toLocaleString()}</p>
              <p>Tickets: <span class="tickets-available" data-screening-id="${screening.id}">${screening.ticketsAvailable}</span> (Initial: ${screening.initialTicketsAvailable || 'N/A'})</p>
            </div>
            <div class="manager-screening-actions">
              <button class="edit-screening" data-id="${screening.id}" popovertarget="edit-screening-popover">Edit</button>
              <button class="delete-screening btn-danger" data-id="${screening.id}">Delete</button>
            </div>
          </div>
        `;
      }
    )
    .join('');

  document.querySelectorAll('.edit-screening').forEach((button) =>
    button.addEventListener('click', (e) => {
      handlePopulateEditScreeningForm(e.target.dataset.id, e.target);
    })
  );

  document.querySelectorAll('.delete-screening').forEach((button) =>
    button.addEventListener('click', (e) => handleDeleteScreening(e.target.dataset.id))
  );
};

const handlePopulateEditScreeningForm = (screeningId, buttonElement) => {
  const screeningToEdit = allScreeningsForManager.find(s => s.id === parseInt(screeningId));
  if (!screeningToEdit) {
    showMessage('Could not find screening data to edit.', 'error');
    return;
  }

  editScreeningIdInput_popover.value = screeningToEdit.id;
  editMovieTitleInput_popover.value = screeningToEdit.movieTitle || ''; // TMDB will find ID if title changes
  
  // Format date for datetime-local input: YYYY-MM-DDTHH:mm
  const localDateTime = new Date(new Date(screeningToEdit.date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  editDateInput_popover.value = localDateTime;
  
  editTicketsAvailableInput_popover.value = screeningToEdit.initialTicketsAvailable; // Edit the initial/total capacity
};

if (editScreeningPopoverForm) {
  editScreeningPopoverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const screeningId = editScreeningIdInput_popover.value;
    const movieTitle = editMovieTitleInput_popover.value;
    const date = editDateInput_popover.value;
    const ticketsAvailable = editTicketsAvailableInput_popover.value;

    const token = localStorage.getItem('jwt');
    if (!token) {
      showMessage('Authentication error. Please log in again.', 'error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/screenings/${screeningId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          movieTitle, // Backend will use this to find/update movieId and poster
          date,
          ticketsAvailable: parseInt(ticketsAvailable),
        }),
      });

      if (response.ok) {
        const updatedScreening = await response.json(); // Get the full updated screening
        const index = allScreeningsForManager.findIndex(s => s.id === parseInt(screeningId));
        if (index !== -1) {
          allScreeningsForManager[index] = updatedScreening;
        } else {
          allScreeningsForManager.push(updatedScreening);
        }
        displayManagerScreenings(allScreeningsForManager); 
        showMessage('Screening updated successfully!', 'success');
        editScreeningPopover.hidePopover(); // Hide the popover
      } else {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to update screening.', 'error');
      }
    } catch (error) {
      console.error('Error updating screening:', error);
      showMessage('An error occurred while updating the screening.', 'error');
    }
  });
}

const renderTicketSalesChart = (screenings) => {
  const chartCanvas = document.getElementById('ticketSalesChart');
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext('2d');

  const labels = screenings.map(s => `${s.movieTitle || 'Screening ' + s.id}`); // Gebruik titel in grafiek labels
  const soldTicketsData = screenings.map(s => {
    const initial = s.initialTicketsAvailable || 0;
    const available = s.ticketsAvailable || 0;
    return initial - available;
  });
  const availableTicketsData = screenings.map(s => s.ticketsAvailable || 0);

  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Tickets Sold',
          data: soldTicketsData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Tickets Available',
          data: availableTicketsData,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Tickets'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Screenings'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      }
    }
  });
};

const handleReserveTicket = async (screeningId) => {
  const token = localStorage.getItem('jwt');
  const currentQrCodeContainer = document.getElementById('qr-code-container'); // Get fresh reference
  const currentTicketQrCodeImg = document.getElementById('ticket-qr-code-img'); // Get fresh reference

  if(currentQrCodeContainer) currentQrCodeContainer.style.display = 'none';

  if (!token) {
    showMessage('You must be logged in to reserve a ticket.', 'error');
    return;
  }

  const reserveButton = document.querySelector(`.reserve-ticket[data-id="${screeningId}"]`);
  if (reserveButton) {
    reserveButton.textContent = 'Processing...';
    reserveButton.disabled = true;
  }

  try {
    const response = await fetch('http://localhost:3000/api/screenings/reserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ screeningId: parseInt(screeningId) }),
    });

    const responseData = await response.json();

    if (response.ok) {
      showMessage('Ticket reserved successfully! Your QR code is below.', 'success');

      if (responseData.qrCodeDataUrl && currentTicketQrCodeImg && currentQrCodeContainer) {
        currentTicketQrCodeImg.src = responseData.qrCodeDataUrl;
        currentQrCodeContainer.style.display = 'block';
      } else {
        showMessage('Ticket reserved, but QR code could not be generated.', 'warning');
      }
    } else {
      console.error('Failed to reserve ticket:', responseData);
      showMessage(responseData.message || 'Failed to reserve ticket. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error reserving ticket:', error);
    showMessage('An error occurred while reserving. Please try again.', 'error');
  }
};

const handleDeleteScreening = async (id) => {
  const token = localStorage.getItem('jwt');

  if (!confirm('Are you sure you want to delete this screening?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/screenings/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      fetchScreenings();
    } else {
      console.error('Failed to delete screening:', await response.json());
      alert('Failed to delete screening. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting screening:', error);
    alert('An error occurred. Please try again.');
  }
};

// Debounce function
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

const clearMovieSuggestions = () => {
  const currentMovieTitleSuggestionsContainer = document.getElementById('movie-title-suggestions');
  if (currentMovieTitleSuggestionsContainer) {
    currentMovieTitleSuggestionsContainer.innerHTML = '';
    currentMovieTitleSuggestionsContainer.style.display = 'none';
  }
};

const renderMovieSuggestions = (suggestions) => {
  const currentMovieTitleSuggestionsContainer = document.getElementById('movie-title-suggestions');
  if (!currentMovieTitleSuggestionsContainer) return;
  clearMovieSuggestions();

  if (suggestions.length === 0) {
    return;
  }

  currentMovieTitleSuggestionsContainer.style.display = 'block';
  suggestions.forEach(movie => {
    const suggestionItem = document.createElement('div');
    suggestionItem.classList.add('suggestion-item');
    let displayText = movie.title;
    if (movie.release_date) {
      displayText += ` (${movie.release_date.substring(0, 4)})`;
    }
    suggestionItem.textContent = displayText;
    suggestionItem.addEventListener('click', () => {
      movieTitleInput.value = movie.title; // Use the original title without the year for the input
      clearMovieSuggestions();
    });
    currentMovieTitleSuggestionsContainer.appendChild(suggestionItem);
  });
};

const fetchMovieSuggestions = async (query) => {
  if (query.length < 2) { // Only search if query is at least 2 characters
    clearMovieSuggestions();
    return;
  }

  const token = localStorage.getItem('jwt');
  if (!token) return;

  try {
    const response = await fetch(`http://localhost:3000/api/screenings/movies/suggestions?query=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) {
      const suggestions = await response.json();
      renderMovieSuggestions(suggestions);
    } else {
      console.error('Failed to fetch movie suggestions');
      clearMovieSuggestions();
    }
  } catch (error) {
    console.error('Error fetching movie suggestions:', error);
    clearMovieSuggestions();
  }
};

// Debounced version of fetchMovieSuggestions
const debouncedFetchMovieSuggestions = debounce(fetchMovieSuggestions, 300);

if (movieTitleInput) {
  movieTitleInput.addEventListener('input', (e) => {
    debouncedFetchMovieSuggestions(e.target.value);
  });

  movieTitleInput.addEventListener('blur', () => {
    setTimeout(() => {
        if (!movieTitleSuggestionsContainer.matches(':hover')) {
            clearMovieSuggestions();
        }
    }, 150);
  });
}

addScreeningForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Add Screening form submitted');

  const movieTitleValue = movieTitleInput.value;
  const date = document.getElementById('date').value;
  const ticketsAvailable = document.getElementById('ticketsAvailable').value;

  const token = localStorage.getItem('jwt');

  try {
    const response = await fetch('http://localhost:3000/api/screenings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        movieTitle: movieTitleValue,
        date, 
        ticketsAvailable: parseInt(ticketsAvailable)
      }),
    });

    if (response.ok) {
      const newScreening = await response.json();
      addScreeningForm.reset();
      clearMovieSuggestions();
      showMessage(`Screening added successfully for movie: ${newScreening.movieTitle || movieTitleValue}!`, 'success');
    } else {
      const errorData = await response.json();
      console.error('Failed to add screening:', errorData);
      showMessage(errorData.error || 'Failed to add screening. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error adding screening:', error);
    showMessage('An error occurred while adding screening. Please try again.', 'error');
  }
});

const initializeMoviesTabEventListeners = () => {
    const categorySelect = document.getElementById('movie-category-select');
    const genreSelect = document.getElementById('movie-genre-select');
    const nameSearchInput = document.getElementById('movie-name-search');

    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            currentMovieCategory = e.target.value;
            currentGenreId = '';
            const currentGenreSelect = document.getElementById('movie-genre-select');
            if (currentGenreSelect) currentGenreSelect.value = '';
            fetchMovies();
        });
    }

    if (genreSelect) {
        genreSelect.addEventListener('change', (e) => {
            currentGenreId = e.target.value;
            fetchMovies();
        });
    }

    if (nameSearchInput) {
        nameSearchInput.addEventListener('input', debounce(applyMovieNameFilter, 300));
    }
};

const initializeScreeningsTabEventListeners = () => {
    const applyBtn = document.getElementById('apply-screening-filter');
    const clearBtn = document.getElementById('clear-screening-filter');
    const nameInput = document.getElementById('screening-name-filter');
    const dateInput = document.getElementById('screening-date-filter');

    if (applyBtn && dateInput) {
        applyBtn.addEventListener('click', () => {
            fetchScreenings(dateInput.value || null);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (dateInput) dateInput.value = '';
            if (nameInput) nameInput.value = '';
            fetchScreenings();
        });
    }

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            applyClientSideFilters();
        });
    }
};

const initializeManagerTabEventListeners = () => {
    const form = document.getElementById('add-screening-form');
    const titleInput = document.getElementById('movieTitle');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const movieTitleValue = document.getElementById('movieTitle').value; // Get fresh value
            const dateValue = document.getElementById('date').value; // Get fresh value
            const ticketsAvailableValue = document.getElementById('ticketsAvailable').value; // Get fresh value
            const token = localStorage.getItem('jwt');

            try {
                const response = await fetch('http://localhost:3000/api/screenings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        movieTitle: movieTitleValue,
                        date: dateValue,
                        ticketsAvailable: parseInt(ticketsAvailableValue)
                    }),
                });

                if (response.ok) {
                    const newScreening = await response.json();
                    form.reset();
                    const currentSuggestionsContainer = document.getElementById('movie-title-suggestions');
                    if (currentSuggestionsContainer) {
                        currentSuggestionsContainer.innerHTML = '';
                        currentSuggestionsContainer.style.display = 'none';
                    }
                    showMessage(`Screening added successfully for movie: ${newScreening.movieTitle || movieTitleValue}!`, 'success');
                    // If not using WebSockets to update, you might need to re-fetch manager screenings here
                } else {
                    const errorData = await response.json();
                    console.error('Failed to add screening:', errorData);
                    showMessage(errorData.error || 'Failed to add screening. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error adding screening:', error);
                showMessage('An error occurred while adding screening. Please try again.', 'error');
            }
        });
    }

    if (titleInput) {
        titleInput.addEventListener('input', (e) => {
            debouncedFetchMovieSuggestions(e.target.value);
        });

        titleInput.addEventListener('blur', () => {
            setTimeout(() => {
                const currentSuggestionsContainer = document.getElementById('movie-title-suggestions');
                if (currentSuggestionsContainer && !currentSuggestionsContainer.matches(':hover')) {
                     currentSuggestionsContainer.innerHTML = '';
                     currentSuggestionsContainer.style.display = 'none';
                }
            }, 150);
        });
    }
};

movieCategorySelect.addEventListener('change', (e) => {
  currentMovieCategory = e.target.value;
  currentGenreId = ''; // Reset genre when category changes
  movieGenreSelect.value = ''; // Visually reset genre dropdown
  fetchMovies();
});

movieGenreSelect.addEventListener('change', (e) => {
  currentGenreId = e.target.value;
  fetchMovies();
});

movieNameSearchInput.addEventListener('input', debounce(applyMovieNameFilter, 300));

const decodeJWT = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const isLoggedIn = () => {
  const token = localStorage.getItem('jwt');
  return !!token;
};

const toggleUIBasedOnRole = () => {
  const token = localStorage.getItem('jwt');
  const loginForm = document.getElementById('login-form'); // This is the inner form
  const logoutButton = document.getElementById('logout-button');
  const managerContent = document.getElementById('manager-content');
  const loginSection = document.getElementById('login-section'); // The section containing the form
  const loginWrapperContainer = loginSection ? loginSection.parentElement : null; // The outer .container div

  if (token) {
    const payload = decodeJWT(token);

    if (loginWrapperContainer) {
      loginWrapperContainer.style.display = 'none'; // Hide the whole login wrapper
    }
    if (loginSection) loginSection.style.display = 'none'; // Also ensure login section itself is hidden
    if (loginForm) loginForm.style.display = 'none';
    logoutButton.style.display = 'block';
    tabsContainer.style.display = 'block'; // Or 'flex' if that's your intended display for tabs

    if (payload.role === 'manager') {
      managerTab.style.display = 'inline-block';
      // managerContent will be displayed by switchTab if manager tab is active
    } else {
      managerTab.style.display = 'none';
      if (managerContent) managerContent.style.display = 'none';
    }
  } else { // Not logged in
    if (loginWrapperContainer) {
      loginWrapperContainer.style.display = 'block'; // Show the login wrapper
    }
    if (loginSection) loginSection.style.display = 'flex'; // Assuming login-section uses flex for centering
    if (loginForm) loginForm.style.display = 'block'; // Show the actual form
    logoutButton.style.display = 'none';
    tabsContainer.style.display = 'none';
    if (managerContent) managerContent.style.display = 'none';
    managerTab.style.display = 'none';
  }
};

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem('jwt', token);
      toggleUIBasedOnRole();
      fetchScreeningsIfManager();
      switchTab('movies'); // Switch to default tab
    } else {
      console.error('Login failed');
      showMessage('Invalid username or password', 'error'); // Use showMessage for consistency
    }
  } catch (error) {
    console.error('Error during login:', error);
    showMessage('Error during login. Please try again.', 'error');
  }
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  localStorage.removeItem('activeTab');
  toggleUIBasedOnRole();
  switchTab('movies'); // Reset to a default view, which will be hidden if not logged in
});

const switchTab = (tab) => {
  localStorage.setItem('activeTab', tab);
  if (tab === 'movies') {
    moviesContent.style.display = 'block';
    screeningsContent.style.display = 'none';
    managerContent.style.display = 'none';
    moviesTab.classList.add('active');
    screeningsTab.classList.remove('active');
    managerTab.classList.remove('active');
    moviesContent.innerHTML = `
        <h2>Popular Movies</h2>
        <div id="movie-filters-container" class="filter-container">
            <div class="filter-group">
                <label for="movie-category-select">Category:</label>
                <select id="movie-category-select">
                    <option value="popular">Popular</option>
                    <option value="upcoming">Upcoming</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="movie-genre-select">Genre:</label>
                <select id="movie-genre-select">
                    <option value="">All Genres</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="movie-name-search">Search by Name:</label>
                <input type="text" id="movie-name-search" placeholder="Enter movie name...">
            </div>
        </div>
        <div id="movies-container" class="card-grid">
            <!-- Movie cards will be dynamically added here -->
        </div>
    `;
    initializeMoviesTabEventListeners(); // NEW
    fetchMovies();
    fetchAndDisplayGenres();
  } else if (tab === 'screenings') {
    moviesContent.style.display = 'none';
    screeningsContent.style.display = 'block';
    managerContent.style.display = 'none';
    moviesTab.classList.remove('active');
    screeningsTab.classList.add('active');
    managerTab.classList.remove('active');
    screeningsContent.innerHTML = `
        <h2>Screenings</h2>
        <div id="screening-filters-container" class="filter-container">
            <label for="screening-date-filter">Filter by date:</label>
            <input type="date" id="screening-date-filter">
            <label for="screening-name-filter">Filter by movie name:</label>
            <input type="text" id="screening-name-filter" placeholder="Enter movie name...">
            <button id="apply-screening-filter">Apply Filters</button>
            <button id="clear-screening-filter" class="btn-secondary">Clear Filters</button>
        </div>
        <div id="screenings-container" class="card-grid">
            <!-- Screening cards will be dynamically added here -->
        </div>
        <div id="qr-code-container" style="display:none; margin-top: 20px; text-align: center;">
            <h3>Your Ticket QR Code:</h3>
            <img id="ticket-qr-code-img" src="" alt="Ticket QR Code" style="max-width: 200px;">
            <p><small>Scan this code at the cinema.</small></p>
        </div>
    `;
    initializeScreeningsTabEventListeners(); // NEW
    const dateFilterInput = document.getElementById('screening-date-filter');
    fetchScreenings(dateFilterInput ? dateFilterInput.value || null : null);
  } else if (tab === 'manager') {
    moviesContent.style.display = 'none';
    screeningsContent.style.display = 'none';
    managerContent.style.display = 'block';
    moviesTab.classList.remove('active');
    screeningsTab.classList.remove('active');
    managerTab.classList.add('active');
    managerContent.innerHTML = `
        <h2>Manager Dashboard</h2>
        <form id="add-screening-form" action="#">
            <label for="movieTitle">Movie Title:</label>
            <input type="text" id="movieTitle" required autocomplete="off">
            <div id="movie-title-suggestions" class="suggestions-list" style="display:none;"></div>
            <label for="date">Date:</label>
            <input type="datetime-local" id="date" required>
            <label for="ticketsAvailable">Tickets Available:</label>
            <input type="number" id="ticketsAvailable" required>
            <button type="submit">Add Screening</button>
        </form>
        <div id="manager-screenings-list" class="card-grid">
            <!-- Manager screenings will be dynamically added here -->
        </div>
        <div id="ticket-sales-chart-container" style="margin-top: 2rem; max-width: 800px; margin-left:auto; margin-right:auto;">
            <h3>Ticket Sales Overview</h3>
            <canvas id="ticketSalesChart"></canvas>
        </div>
    `;
    initializeManagerTabEventListeners(); // NEW
    const token = localStorage.getItem('jwt');
    if (token) {
      fetch('http://localhost:3000/api/screenings', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch all screenings for manager');
        return res.json();
      })
      .then(allScreenings => {
        displayManagerScreenings(allScreenings); // Ensure this gets fresh container ref
        renderTicketSalesChart(allScreenings); // Ensure this gets fresh canvas ref
      })
      .catch(error => {
        console.error("Error fetching all screenings for manager tab:", error);
        showMessage("Could not load all screenings for manager dashboard.", "error");
      });
    }
  }
};

moviesTab.addEventListener('click', () => switchTab('movies'));
screeningsTab.addEventListener('click', () => switchTab('screenings'));
managerTab.addEventListener('click', () => switchTab('manager'));

const fetchScreeningsIfManager = () => {
  const token = localStorage.getItem('jwt');
  if (token) {
    const payload = decodeJWT(token);
    if (payload && payload.role === 'manager') {
      if (managerTab.style.display !== 'none' && managerContent.style.display !== 'none') {
        fetchScreenings();
      }
    }
  }
};

const savedTab = localStorage.getItem('activeTab') || 'movies';
toggleUIBasedOnRole(); // Sets up visibility of login vs tabs

if (isLoggedIn()) {
  tabsContainer.style.display = 'block'; // Or 'flex' - ensure tabs container is visible if logged in
  switchTab(savedTab); // This will also call fetchMovies or fetchScreenings
  if (savedTab === 'movies') {
    fetchAndDisplayGenres(); // Still useful if movies tab is default
  }
  fetchScreeningsIfManager(); // Check if manager specific data needs to be loaded
} else {
  // login-section and its wrapper are made visible by toggleUIBasedOnRole
  // tabs-container is hidden
  // No need to call switchTab or fetch data for tabs
}
setupWebSocket();