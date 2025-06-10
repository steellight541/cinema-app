// DOM Elements - Cache commonly used elements
const moviesContainer = document.getElementById('movies-container');
const moviesContentHeadline = document.querySelector('#movies-content h1');
const movieFiltersContainer = document.getElementById('movie-filters-container');
const screeningsContainer = document.getElementById('screenings-container');
const managerScreeningsContainer = document.getElementById('manager-screenings-list');
const loginForm = document.getElementById('login');
const logoutButton = document.getElementById('logout-button');
const messageContainer = document.getElementById('message-container');
const ticketSalesChartContainer = document.getElementById('ticket-sales-chart-container');

// Popover elements for editing screenings
const editScreeningPopover = document.getElementById('edit-screening-popover');
const editScreeningPopoverForm = document.getElementById('edit-screening-popover-form');
const editScreeningIdInput_popover = document.getElementById('edit-screening-id-popover');
const editMovieTitleInput_popover = document.getElementById('edit-movieTitle-popover');
const editDateInput_popover = document.getElementById('edit-date-popover');
const editTicketsAvailableInput_popover = document.getElementById('edit-ticketsAvailable-popover');

// Tab elements
const tabsContainer = document.getElementById('tabs-container');
const moviesTab = document.getElementById('movies-tab');
const screeningsTab = document.getElementById('screenings-tab');
const managerTab = document.getElementById('manager-tab');
const moviesContent = document.getElementById('movies-content');
const screeningsContent = document.getElementById('screenings-content');
const managerContent = document.getElementById('manager-content');

// Constants
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200';

// Global state
let allFetchedScreenings = [];
let allFetchedMovies = [];
let allScreeningsForManager = [];
let currentMovieCategory = 'popular';
let currentGenreId = '';
let mqttClient; // Add MQTT client global variable
let salesChart; // Add salesChart global variable

const MQTT_BROKER_URL_FRONTEND = 'ws://localhost:9001'; // IMPORTANT: Use WebSocket port for browser MQTT
const MQTT_TOPIC_SCREENINGS_FRONTEND = 'cinema/screenings/updated';

// Utility functions
const debounce = (func, delay) => {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

const decodeJWT = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const isLoggedIn = () => !!localStorage.getItem('jwt');

const showMessage = (message, type = 'info') => {
  messageContainer.textContent = message;
  messageContainer.className = 'message';
  messageContainer.classList.add(type);
  
  setTimeout(() => {
    messageContainer.textContent = '';
    messageContainer.className = 'message';
  }, 5000);
};

// MQTT setup
const setupMQTT = () => {
  // Note: Browsers connect to MQTT brokers over WebSockets.
  // Your MQTT broker needs to be configured to listen on a WebSocket port.
  // For Mosquitto, you'd add listeners in mosquitto.conf:
  // listener 1883
  // listener 9001 protocol websockets
  // Ensure MQTT_BROKER_URL_FRONTEND points to the WebSocket listener of your broker.
  
  if (typeof mqtt === 'undefined') {
      console.error("MQTT.js library not loaded. Make sure it's included in your HTML.");
      showMessage("Real-time updates unavailable (MQTT library missing).", "error");
      return;
  }

  mqttClient = mqtt.connect(MQTT_BROKER_URL_FRONTEND);

  mqttClient.on('connect', () => {
    showMessage('Real-time updates connected.', 'info');
    
    // Subscribe to the topic the backend publishes to
    mqttClient.subscribe(MQTT_TOPIC_SCREENINGS_FRONTEND, (err) => {
      if (err) {
        console.error('Failed to subscribe to MQTT topic:', MQTT_TOPIC_SCREENINGS_FRONTEND, err);
        showMessage('Failed to subscribe for live updates.', 'error');
      } else {
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    // message is Buffer, convert to string
    const messageString = message.toString();

    try {
      const parsedMessage = JSON.parse(messageString);

      // Adapt your existing message handling logic here
      if (topic === MQTT_TOPIC_SCREENINGS_FRONTEND && parsedMessage.type === 'screenings_updated') {
        allScreeningsForManager = parsedMessage.payload; // Assuming this global var is still used
        const screeningDateFilterInput = document.getElementById('screening-date-filter');
        const currentFilterDate = screeningDateFilterInput?.value;
        
        let userViewScreenings = parsedMessage.payload;
        if (currentFilterDate) {
          userViewScreenings = userViewScreenings.filter(screening => 
            screening.date.startsWith(currentFilterDate)
          );
        }
        allFetchedScreenings = userViewScreenings; // Assuming this global var is still used

        applyClientSideFilters(); // Assuming this function exists and updates UI

        if (managerTab.classList.contains('active')) { // managerTab needs to be defined
          displayManagerScreenings(parsedMessage.payload); // Assuming this function exists
          renderTicketSalesChart(parsedMessage.payload); // Assuming this function exists
        }
        showMessage('Screenings have been updated live via MQTT!', 'info');
      }
      // Add other message type handlers if needed
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT connection error:', error);
    showMessage('Real-time update connection error.', 'error');
  });

  mqttClient.on('reconnect', () => {
    showMessage('Reconnecting for live updates...', 'info');
  });
  
  mqttClient.on('close', () => {
    showMessage('Real-time updates disconnected.', 'warning');
  });
};

// Movie functions
const fetchAndDisplayGenres = async () => {
  const genreSelect = document.getElementById('movie-genre-select');
  if (!genreSelect) return;

  try {
    const response = await fetch('http://localhost:3000/api/movies/genres');
    if (!response.ok) throw new Error('Failed to fetch genres');
    const genres = await response.json();
    
    genreSelect.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id;
      option.textContent = genre.name;
      genreSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching genres:', error);
    showMessage('Could not load movie genres.', 'error');
  }
};

const fetchMovies = async () => {
  const token = localStorage.getItem('jwt');
  let endpoint = 'http://localhost:3000/api/movies/';
  let headlineText = "Movies";
  const genreSelect = document.getElementById('movie-genre-select');

  if (currentGenreId && genreSelect) {
    endpoint += `genre/${currentGenreId}`;
    const selectedGenreText = genreSelect.options[genreSelect.selectedIndex]?.text || 'Selected Genre';
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
  
  const headline = document.querySelector('#movies-content h2');
  if (headline) headline.textContent = headlineText;

  try {
    const response = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    if (!response.ok) {
      if (response.status === 401 && token) {
        showMessage('Session expired or unauthorized. Please log in again.', 'error');
        logoutButton.click();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    allFetchedMovies = await response.json();
    applyMovieNameFilter();
  } catch (error) {
    console.error('Error fetching movies:', error);
    showMessage(`Could not fetch ${headlineText.toLowerCase()}.`, 'error');
    allFetchedMovies = [];
    applyMovieNameFilter();
  }
};

const applyMovieNameFilter = () => {
  const searchInput = document.getElementById('movie-name-search');
  const searchTerm = searchInput?.value.toLowerCase().trim() || "";
  
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
  const isManager = payload?.role === 'manager';
  const container = document.getElementById('movies-container');
  
  if (!container) {
    console.error('Movies container not found');
    return;
  }

  container.innerHTML = movies
    .map(movie => `
      <div class="movie">
        <img src="${TMDB_IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}">
        <div class="movie-info">
          <h2>${movie.title}</h2>
          <p>Rating: ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</p>
          ${movie.release_date ? `<p class="release-date">Release: ${movie.release_date.substring(0,4)}</p>` : ''}
        </div>
        ${isManager ? `<button class="edit-movie btn-secondary" data-id="${movie.id}">Edit</button>` : ''}
      </div>
    `)
    .join('');

  if (isManager) {
    container.querySelectorAll('.edit-movie').forEach(button =>
      button.addEventListener('click', (e) => handleEditMovie(e.target.dataset.id))
    );
  }
};

const handleEditMovie = async (id) => {
  const movieToEdit = allFetchedMovies.find(m => m.id === parseInt(id));
  if (!movieToEdit) return;

  const title = prompt('Enter new Title:', movieToEdit.title);
  const vote_average_str = prompt('Enter new Rating (e.g., 7.5):', movieToEdit.vote_average);
  const poster_path = prompt('Enter new Poster Path (e.g., /newPath.jpg):', movieToEdit.poster_path);

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

// Screening functions
const fetchScreenings = async (filterDate = null) => {
  const token = localStorage.getItem('jwt');
  if (!token) return;

  let url = 'http://localhost:3000/api/screenings';
  if (filterDate) url += `?date=${filterDate}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        showMessage('Session expired or unauthorized to view screenings. Please log in again.', 'error');
        logoutButton.click();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    allFetchedScreenings = await response.json();
    applyClientSideFilters();
    displayManagerScreenings(allFetchedScreenings);
  } catch (error) {
    console.error('Error fetching screenings:', error);
    showMessage('Could not fetch screenings.', 'error');
    allFetchedScreenings = [];
    applyClientSideFilters();
  }
};

const applyClientSideFilters = () => {
  const nameFilterInput = document.getElementById('screening-name-filter');
  const nameFilterText = nameFilterInput?.value.toLowerCase().trim() || "";
  
  let screeningsToDisplay = allFetchedScreenings;
  if (nameFilterText) {
    screeningsToDisplay = allFetchedScreenings.filter(screening => 
      screening.movieTitle?.toLowerCase().includes(nameFilterText)
    );
  }
  
  displayScreenings(screeningsToDisplay);
};

const displayScreenings = (screenings) => {
  const container = document.getElementById('screenings-container');
  if (!container) return;

  container.innerHTML = screenings
    .map(screening => {
      const posterUrl = screening.moviePosterPath 
        ? `${TMDB_IMAGE_BASE_URL}${screening.moviePosterPath}`
        : 'https://via.placeholder.com/100x150.png?text=No+Image';
      const movieTitleText = screening.movieTitle || `Movie ID: ${screening.movieId}`;

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
    })
    .join('');

  container.querySelectorAll('.reserve-ticket').forEach(button =>
    button.addEventListener('click', (e) => handleReserveTicket(e.target.dataset.id))
  );
};

const displayManagerScreenings = (screenings) => {
  allScreeningsForManager = screenings;
  const container = document.getElementById('manager-screenings-list');
  if (!container) return;

  container.innerHTML = `<h3>Manage Screenings</h3>` + screenings
    .map(screening => {
      const posterUrl = screening.moviePosterPath
        ? `${TMDB_IMAGE_BASE_URL}${screening.moviePosterPath}`
        : 'https://via.placeholder.com/80x120.png?text=No+Image';
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
    })
    .join('');

  container.querySelectorAll('.edit-screening').forEach(button =>
    button.addEventListener('click', (e) => handlePopulateEditScreeningForm(e.target.dataset.id))
  );

  container.querySelectorAll('.delete-screening').forEach(button =>
    button.addEventListener('click', (e) => handleDeleteScreening(e.target.dataset.id))
  );
};

const handleReserveTicket = async (screeningId) => {
  const token = localStorage.getItem('jwt');
  const qrCodeContainer = document.getElementById('qr-code-container');
  const ticketQrCodeImg = document.getElementById('ticket-qr-code-img');

  if (qrCodeContainer) qrCodeContainer.style.display = 'none';

  if (!token) {
    showMessage('You must be logged in to reserve a ticket.', 'error');
    return;
  }

  // 1. Prompt for email
  const userEmail = prompt("Please enter your email address to receive your ticket confirmation:");

  if (!userEmail) {
    showMessage("Email address is required to reserve a ticket.", "info");
    return; // Exit if no email is provided
  }

  // Basic email validation (optional, but good practice)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    showMessage("Please enter a valid email address.", "error");
    return;
  }

  const reserveButton = document.querySelector(`.reserve-ticket[data-id="${screeningId}"]`);
  const originalButtonText = reserveButton?.textContent || 'Reserve Ticket';
  
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
      body: JSON.stringify({ 
        screeningId: parseInt(screeningId),
        email: userEmail // 2. Include email in the request body
      }),
    });

    const responseData = await response.json();

    if (response.ok) {
      // 3. Update success message based on backend response
      let successMsg = responseData.message || 'Ticket reserved successfully!';
      if (responseData.previewUrl) { // For Ethereal email testing
        successMsg += ` Email preview: ${responseData.previewUrl}`;
      } else if (responseData.message && responseData.message.includes("email sent")) {
        successMsg = 'Ticket reserved and email confirmation sent!';
      } else {
         successMsg = 'Ticket reserved! Check your email for confirmation.';
      }
      showMessage(successMsg, 'success');


      if (responseData.qrCodeDataUrl && ticketQrCodeImg && qrCodeContainer) {
        ticketQrCodeImg.src = responseData.qrCodeDataUrl;
        qrCodeContainer.style.display = 'block';
      } else if (!responseData.qrCodeDataUrl && responseData.message && !responseData.message.toLowerCase().includes("failed")) {
        // If ticket was reserved but QR somehow not generated on backend, but no explicit failure
        showMessage(successMsg + ' QR code display unavailable.', 'warning');
      }


      // Update button to show sold out if no tickets left
      // The backend response for 'screenings[screeningIndex]' might not be directly available
      // in responseData.ticketsAvailable. Let's assume the WebSocket update will handle UI.
      // Or, if the backend sends back the updated screening's ticketsAvailable:
      const updatedScreeningInfo = responseData.screening; // Assuming backend sends this
      if (reserveButton) {
        const ticketsAvailableAfterReservation = updatedScreeningInfo ? updatedScreeningInfo.ticketsAvailable : (parseInt(reserveButton.parentElement.querySelector('.tickets-available').textContent) -1) ;
        
        if (ticketsAvailableAfterReservation <= 0) {
          reserveButton.textContent = 'Sold Out';
          reserveButton.disabled = true;
        } else {
          reserveButton.textContent = originalButtonText; // Or "Reserve Another"
          reserveButton.disabled = false;
        }
        
        // Update the tickets available display (WebSocket should also do this)
        const ticketsSpan = document.querySelector(`span.tickets-available[data-screening-id="${screeningId}"]`);
        if (ticketsSpan) {
          ticketsSpan.textContent = ticketsAvailableAfterReservation;
        }
      }
    } else {
      console.error('Failed to reserve ticket:', responseData);
      showMessage(responseData.message || 'Failed to reserve ticket. Please try again.', 'error');
      
      if (reserveButton) {
        reserveButton.textContent = originalButtonText;
        reserveButton.disabled = false;
      }
    }
  } catch (error) {
    console.error('Error reserving ticket:', error);
    showMessage('An error occurred while reserving. Please try again.', 'error');
    
    if (reserveButton) {
      reserveButton.textContent = originalButtonText;
      reserveButton.disabled = false;
    }
  }
};

const handleDeleteScreening = async (id) => {
  const token = localStorage.getItem('jwt');

  if (!confirm('Are you sure you want to delete this screening?')) return;

  try {
    const response = await fetch(`http://localhost:3000/api/screenings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      fetchScreenings();
    } else {
      console.error('Failed to delete screening:', await response.json());
      showMessage('Failed to delete screening. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error deleting screening:', error);
    showMessage('An error occurred. Please try again.', 'error');
  }
};

const handlePopulateEditScreeningForm = (screeningId) => {
  const screeningToEdit = allScreeningsForManager.find(s => s.id === parseInt(screeningId));
  if (!screeningToEdit) {
    showMessage('Could not find screening data to edit.', 'error');
    return;
  }

  editScreeningIdInput_popover.value = screeningToEdit.id;
  editMovieTitleInput_popover.value = screeningToEdit.movieTitle || '';
  
  const localDateTime = new Date(new Date(screeningToEdit.date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  editDateInput_popover.value = localDateTime;
  
  editTicketsAvailableInput_popover.value = screeningToEdit.initialTicketsAvailable;
};

// Movie suggestions
const clearMovieSuggestions = () => {
  const suggestionsContainer = document.getElementById('movie-title-suggestions');
  if (suggestionsContainer) {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none';
  }
};

const renderMovieSuggestions = (suggestions) => {
  const suggestionsContainer = document.getElementById('movie-title-suggestions');
  if (!suggestionsContainer) return;
  
  clearMovieSuggestions();
  if (suggestions.length === 0) return;

  suggestionsContainer.style.display = 'block';
  suggestions.forEach(movie => {
    const suggestionItem = document.createElement('div');
    suggestionItem.classList.add('suggestion-item');
    let displayText = movie.title;
    if (movie.release_date) {
      displayText += ` (${movie.release_date.substring(0, 4)})`;
    }
    suggestionItem.textContent = displayText;
    suggestionItem.addEventListener('click', () => {
      const movieTitleInput = document.getElementById('movieTitle');
      if (movieTitleInput) {
        movieTitleInput.value = movie.title;
        clearMovieSuggestions();
      }
    });
    suggestionsContainer.appendChild(suggestionItem);
  });
};

const fetchMovieSuggestions = async (query) => {
  if (query.length < 2) {
    clearMovieSuggestions();
    return;
  }

  const token = localStorage.getItem('jwt');
  if (!token) return;

  try {
    const response = await fetch(`http://localhost:3000/api/screenings/movies/suggestions?query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
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

const debouncedFetchMovieSuggestions = debounce(fetchMovieSuggestions, 300);

// Chart rendering
const renderTicketSalesChart = (screenings) => {
  const chartCanvas = document.getElementById('ticketSalesChart');
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext('2d');
  const labels = screenings.map(s => s.movieTitle || `Screening ${s.id}`);
  const soldTicketsData = screenings.map(s => {
    const initial = s.initialTicketsAvailable || 0;
    const available = s.ticketsAvailable || 0;
    return initial - available;
  });
  const availableTicketsData = screenings.map(s => s.ticketsAvailable || 0);

  if (salesChart) salesChart.destroy();

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
          title: { display: true, text: 'Number of Tickets' }
        },
        x: {
          title: { display: true, text: 'Screenings' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
};

// Authentication functions
const toggleUIBasedOnRole = () => {
  const token = localStorage.getItem('jwt');
  const loginSection = document.getElementById('login-section');
  const loginWrapperContainer = loginSection?.parentElement;

  if (token) {
    const payload = decodeJWT(token);

    if (loginWrapperContainer) loginWrapperContainer.style.display = 'none';
    if (loginSection) loginSection.style.display = 'none';
    logoutButton.style.display = 'block';
    tabsContainer.style.display = 'block';

    if (payload?.role === 'manager') {
      managerTab.style.display = 'inline-block';
    } else {
      managerTab.style.display = 'none';
      if (managerContent) managerContent.style.display = 'none';
    }
  } else {
    if (loginWrapperContainer) loginWrapperContainer.style.display = 'block';
    if (loginSection) loginSection.style.display = 'flex';
    logoutButton.style.display = 'none';
    tabsContainer.style.display = 'none';
    if (managerContent) managerContent.style.display = 'none';
    managerTab.style.display = 'none';
  }
};

// Tab switching
const switchTab = (tab) => {
  localStorage.setItem('activeTab', tab);
  
  // Hide all contents and remove active classes
  [moviesContent, screeningsContent, managerContent].forEach(content => {
    if (content) content.style.display = 'none';
  });
  [moviesTab, screeningsTab, managerTab].forEach(tabEl => {
    if (tabEl) tabEl.classList.remove('active');
  });

  if (tab === 'movies') {
    moviesContent.style.display = 'block';
    moviesTab.classList.add('active');
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
      <div id="movies-container" class="card-grid"></div>
    `;
    initializeMoviesTabEventListeners();
    fetchMovies();
    fetchAndDisplayGenres();
  } else if (tab === 'screenings') {
    screeningsContent.style.display = 'block';
    screeningsTab.classList.add('active');
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
      <div id="screenings-container" class="card-grid"></div>
      <div id="qr-code-container" style="display:none; margin-top: 20px; text-align: center;">
        <h3>Your Ticket QR Code:</h3>
        <img id="ticket-qr-code-img" src="" alt="Ticket QR Code" style="max-width: 200px;">
        <p><small>Scan this code at the cinema.</small></p>
      </div>
    `;
    initializeScreeningsTabEventListeners();
    const dateFilterInput = document.getElementById('screening-date-filter');
    fetchScreenings(dateFilterInput?.value || null);
  } else if (tab === 'manager') {
    managerContent.style.display = 'block';
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
      <div id="manager-screenings-list" class="card-grid"></div>
      <div id="ticket-sales-chart-container" style="margin-top: 2rem; max-width: 800px; margin-left:auto; margin-right:auto;">
        <h3>Ticket Sales Overview</h3>
        <canvas id="ticketSalesChart"></canvas>
      </div>
    `;
    initializeManagerTabEventListeners();
    
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
        displayManagerScreenings(allScreenings);
        renderTicketSalesChart(allScreenings);
      })
      .catch(error => {
        console.error("Error fetching all screenings for manager tab:", error);
        showMessage("Could not load all screenings for manager dashboard.", "error");
      });
    }
  }
};

// Event listener initialization functions
const initializeMoviesTabEventListeners = () => {
  const categorySelect = document.getElementById('movie-category-select');
  const genreSelect = document.getElementById('movie-genre-select');
  const nameSearchInput = document.getElementById('movie-name-search');

  categorySelect?.addEventListener('change', (e) => {
    currentMovieCategory = e.target.value;
    currentGenreId = '';
    const currentGenreSelect = document.getElementById('movie-genre-select');
    if (currentGenreSelect) currentGenreSelect.value = '';
    fetchMovies();
  });

  genreSelect?.addEventListener('change', (e) => {
    currentGenreId = e.target.value;
    fetchMovies();
  });

  nameSearchInput?.addEventListener('input', debounce(applyMovieNameFilter, 300));
};

const initializeScreeningsTabEventListeners = () => {
  const applyBtn = document.getElementById('apply-screening-filter');
  const clearBtn = document.getElementById('clear-screening-filter');
  const nameInput = document.getElementById('screening-name-filter');
  const dateInput = document.getElementById('screening-date-filter');

  applyBtn?.addEventListener('click', () => {
    fetchScreenings(dateInput?.value || null);
  });

  clearBtn?.addEventListener('click', () => {
    if (dateInput) dateInput.value = '';
    if (nameInput) nameInput.value = '';
    fetchScreenings();
  });

  nameInput?.addEventListener('input', applyClientSideFilters);
};

const initializeManagerTabEventListeners = () => {
  const form = document.getElementById('add-screening-form');
  const titleInput = document.getElementById('movieTitle');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const movieTitleValue = document.getElementById('movieTitle')?.value;
    const dateValue = document.getElementById('date')?.value;
    const ticketsAvailableValue = document.getElementById('ticketsAvailable')?.value;
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

  titleInput?.addEventListener('input', (e) => {
    debouncedFetchMovieSuggestions(e.target.value);
  });

  titleInput?.addEventListener('blur', () => {
    setTimeout(() => {
      const suggestionsContainer = document.getElementById('movie-title-suggestions');
      if (suggestionsContainer && !suggestionsContainer.matches(':hover')) {
        clearMovieSuggestions();
      }
    }, 150);
  });
};

// Main event listeners
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username')?.value;
  const password = document.getElementById('password')?.value;

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
      switchTab('movies');
    } else {
      console.error('Login failed');
      showMessage('Invalid username or password', 'error');
    }
  } catch (error) {
    console.error('Error during login:', error);
    showMessage('Error during login. Please try again.', 'error');
  }
});

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  localStorage.removeItem('activeTab');
  toggleUIBasedOnRole();
  switchTab('movies');
});

// Edit screening popover form
editScreeningPopoverForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const screeningId = editScreeningIdInput_popover?.value;
  const movieTitle = editMovieTitleInput_popover?.value;
  const date = editDateInput_popover?.value;
  const ticketsAvailable = editTicketsAvailableInput_popover?.value;
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
        movieTitle,
        date,
        ticketsAvailable: parseInt(ticketsAvailable),
      }),
    });

    if (response.ok) {
      const updatedScreening = await response.json();
      const index = allScreeningsForManager.findIndex(s => s.id === parseInt(screeningId));
      if (index !== -1) {
        allScreeningsForManager[index] = updatedScreening;
      }
      displayManagerScreenings(allScreeningsForManager);
      showMessage('Screening updated successfully!', 'success');
      editScreeningPopover?.hidePopover();
    } else {
      const errorData = await response.json();
      showMessage(errorData.error || 'Failed to update screening.', 'error');
    }
  } catch (error) {
    console.error('Error updating screening:', error);
    showMessage('An error occurred while updating the screening.', 'error');
  }
});

// Tab click events
moviesTab?.addEventListener('click', () => switchTab('movies'));
screeningsTab?.addEventListener('click', () => switchTab('screenings'));
managerTab?.addEventListener('click', () => switchTab('manager'));

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  toggleUIBasedOnRole();

  const savedTab = localStorage.getItem('activeTab') || 'movies';
  switchTab(savedTab);

  // Only setup MQTT here, after the initial UI setup
  setupMQTT();
});