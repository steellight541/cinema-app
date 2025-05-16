const moviesContainer = document.getElementById('movies-container');
const screeningsContainer = document.getElementById('screenings-container');
const managerScreeningsContainer = document.getElementById('manager-screenings-list'); // New container for manager's screenings
const addScreeningForm = document.getElementById('add-screening-form');
const loginForm = document.getElementById('login');
const logoutButton = document.getElementById('logout-button');

let webSocket; // Declare WebSocket variable

const setupWebSocket = () => {
  // Use ws:// for non-secure and wss:// for secure WebSocket connections
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//localhost:3000`; // Assuming backend runs on the same host/port for WS

  webSocket = new WebSocket(wsUrl);

  webSocket.onopen = () => {
    console.log('WebSocket connection established');
    // Optionally send a message to the server upon connection if needed
    // webSocket.send(JSON.stringify({ type: 'client_hello', userId: 'someUserId' }));
  };

  webSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message);

      if (message.type === 'screenings_updated') {
        const updatedScreenings = message.payload;
        // Update both the general screenings view and the manager's screenings view
        displayScreenings(updatedScreenings);
        displayManagerScreenings(updatedScreenings);
        showMessage('Screenings have been updated live!', 'info');
      }
      // Handle other message types if you add more
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  webSocket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.reason, event.code);
    // Optionally try to reconnect after a delay
    // setTimeout(setupWebSocket, 5000); // Attempt to reconnect every 5 seconds
  };

  webSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    // Error event is usually followed by a close event
  };
};

// Tab elements
const tabsContainer = document.getElementById('tabs-container');
const moviesTab = document.getElementById('movies-tab');
const screeningsTab = document.getElementById('screenings-tab'); // New Screenings Tab
const managerTab = document.getElementById('manager-tab');
const moviesContent = document.getElementById('movies-content');
const screeningsContent = document.getElementById('screenings-content'); // New Screenings Content
const managerContent = document.getElementById('manager-content');

const showMessage = (message, type = 'success') => {
  const messageContainer = document.getElementById('message-container');
  messageContainer.textContent = message;
  messageContainer.style.color = type === 'success' ? 'green' : 'red';
  messageContainer.style.marginTop = '1rem';

  // Clear the message after 3 seconds
  setTimeout(() => {
    messageContainer.textContent = '';
  }, 3000);
};

const fetchMovies = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/movies');
    if (!response.ok) {
      // If the JWT is missing or invalid for /api/movies (if it's protected)
      if (response.status === 401) {
        showMessage('Session expired or unauthorized. Please log in again.', 'error');
        logoutButton.click(); // Simulate logout
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const movies = await response.json();
    console.log('Movies:', movies); // Debugging log
    displayMovies(movies);
  } catch (error) {
    console.error('Error fetching movies:', error);
    showMessage('Could not fetch movies.', 'error');
  }
};

const displayMovies = (movies) => {
  const token = localStorage.getItem('jwt');
  const payload = token ? decodeJWT(token) : null;
  const isManager = payload && payload.role === 'manager';

  moviesContainer.innerHTML = movies
    .map(
      (movie) => `
      <div class="movie">
        <h2>${movie.title}</h2>
        <p>Rating: ${movie.vote_average}</p>
        <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
        ${
          isManager
            ? `<button class="edit-movie" data-id="${movie.id}">Edit</button>`
            : ''
        }
      </div>
    `
    )
    .join('');

  // Add event listeners for edit buttons (only if the user is a manager)
  if (isManager) {
    document.querySelectorAll('.edit-movie').forEach((button) =>
      button.addEventListener('click', (e) => handleEditMovie(e.target.dataset.id))
    );
  }
};

const handleEditMovie = async (id) => {
  const title = prompt('Enter new Title:');
  const vote_average = prompt('Enter new Rating:');
  const poster_path = prompt('Enter new Poster Path:');

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
      fetchMovies(); // Refresh the list of movies
      alert('Movie updated successfully!');
    } else {
      console.error('Failed to update movie:', await response.json());
      alert('Failed to update movie. Please try again.');
    }
  } catch (error) {
    console.error('Error updating movie:', error);
    alert('An error occurred. Please try again.');
  }
};

const fetchScreenings = async () => {
  const token = localStorage.getItem('jwt'); // Retrieve the JWT from localStorage

  if (!token) {
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/screenings', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`, // Include the JWT in the Authorization header
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
         showMessage('Session expired or unauthorized to view screenings. Please log in again.', 'error');
         logoutButton.click(); // Simulate logout
         return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const screenings = await response.json();
    displayScreenings(screenings); // Update general screenings tab
    displayManagerScreenings(screenings); // Update manager dashboard screenings
  } catch (error) {
    console.error('Error fetching screenings:', error);
    showMessage('Could not fetch screenings.', 'error');
  }
};

const displayScreenings = (screenings) => {
  if (!screeningsContainer) return; // Guard clause
  screeningsContainer.innerHTML = screenings
    .map(
      (screening) => `
      <div class="screening">
        <p>Movie ID: ${screening.movieId}</p>
        <p>Date: ${new Date(screening.date).toLocaleString()}</p>
        <p>Tickets Available: <span class="tickets-available" data-screening-id="${screening.id}">${screening.ticketsAvailable}</span></p>
        <button class="reserve-ticket" data-id="${screening.id}" ${screening.ticketsAvailable === 0 ? 'disabled' : ''}>
          ${screening.ticketsAvailable === 0 ? 'Sold Out' : 'Reserve Ticket'}
        </button>
      </div>
    `
    )
    .join('');

  // Add event listeners for reserve buttons
  document.querySelectorAll('.reserve-ticket').forEach((button) =>
    button.addEventListener('click', (e) => handleReserveTicket(e.target.dataset.id))
  );
};

// New function to display screenings in the manager dashboard
const displayManagerScreenings = (screenings) => {
  if (!managerScreeningsContainer) return; // Guard clause

  managerScreeningsContainer.innerHTML = `<h3>Manage Screenings</h3>` + screenings
    .map(
      (screening) => `
      <div class="manager-screening-item">
        <p>Movie ID: ${screening.movieId} | Date: ${new Date(screening.date).toLocaleString()} | Tickets: <span class="tickets-available" data-screening-id="${screening.id}">${screening.ticketsAvailable}</span></p>
        <div>
          <button class="edit-screening" data-id="${screening.id}">Edit</button>
          <button class="delete-screening" data-id="${screening.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join('');

  // Add event listeners for edit buttons
  document.querySelectorAll('.edit-screening').forEach((button) =>
    button.addEventListener('click', (e) => handleEditScreening(e.target.dataset.id))
  );

  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-screening').forEach((button) =>
    button.addEventListener('click', (e) => handleDeleteScreening(e.target.dataset.id))
  );
};

const handleReserveTicket = async (screeningId) => {
  const token = localStorage.getItem('jwt');

  if (!token) {
    showMessage('You must be logged in to reserve a ticket.', 'error');
    return;
  }

  const reserveButton = document.querySelector(`.reserve-ticket[data-id="${screeningId}"]`);
  if (reserveButton) {
    reserveButton.textContent = 'Processing...'; // Show loading state
    reserveButton.disabled = true; // Disable the button to prevent multiple clicks
  }

  try {
    const response = await fetch('http://localhost:3000/api/screenings/reserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ screeningId: parseInt(screeningId) }), // Ensure screeningId is a number if backend expects it
    });

    if (response.ok) {
      showMessage('Ticket reserved successfully!', 'success');
      fetchScreenings(); // Refresh the list of screenings
    } else {
      const errorData = await response.json();
      console.error('Failed to reserve ticket:', errorData);
      showMessage(errorData.message || 'Failed to reserve ticket. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error reserving ticket:', error);
    showMessage('An error occurred while reserving. Please try again.', 'error');
  } finally {
    if (reserveButton) {
      reserveButton.textContent = 'Reserve Ticket'; // Reset button text
      reserveButton.disabled = false; // Re-enable the button
    }
  }
};

const handleEditScreening = async (id) => {
  const movieId = prompt('Enter new Movie ID:');
  const date = prompt('Enter new Date (YYYY-MM-DDTHH:mm):');
  const ticketsAvailable = prompt('Enter new Tickets Available:');

  const token = localStorage.getItem('jwt');

  try {
    const response = await fetch(`http://localhost:3000/api/screenings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ movieId, date, ticketsAvailable }),
    });

    if (response.ok) {
      fetchScreenings(); // Refresh the list of screenings
      alert('Screening updated successfully!');
    } else {
      console.error('Failed to update screening:', await response.json());
      alert('Failed to update screening. Please try again.');
    }
  } catch (error) {
    console.error('Error updating screening:', error);
    alert('An error occurred. Please try again.');
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
      fetchScreenings(); // Refresh the list of screenings
    } else {
      console.error('Failed to delete screening:', await response.json());
      alert('Failed to delete screening. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting screening:', error);
    alert('An error occurred. Please try again.');
  }
};

// Handle adding a new screening
addScreeningForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevent the default form submission behavior
  console.log('Add Screening form submitted'); // Debugging log

  const movieId = document.getElementById('movieId').value;
  const date = document.getElementById('date').value;
  const ticketsAvailable = document.getElementById('ticketsAvailable').value;

  const token = localStorage.getItem('jwt'); // Retrieve the JWT from localStorage

  try {
    const response = await fetch('http://localhost:3000/api/screenings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // Include the JWT in the Authorization header
      },
      body: JSON.stringify({ 
        movieId: parseInt(movieId), // Ensure movieId is a number
        date, 
        ticketsAvailable: parseInt(ticketsAvailable) // Ensure ticketsAvailable is a number
      }),
    });

    if (response.ok) {
      fetchScreenings(); // Refresh the list of screenings dynamically (updates both views)
      addScreeningForm.reset(); // Clear the form inputs
      showMessage('Screening added successfully!', 'success');
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

// Decode JWT to get user role
const decodeJWT = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Function to check if the user is logged in
const isLoggedIn = () => {
  const token = localStorage.getItem('jwt');
  return !!token; // Return true if a token exists, false otherwise
};

// Function to toggle visibility of login form and logout button
const toggleLoginLogout = () => {
  const loginForm = document.getElementById('login-form');
  const logoutButton = document.getElementById('logout-button');

  if (isLoggedIn()) {
    loginForm.style.display = 'none'; // Hide login form
    logoutButton.style.display = 'block'; // Show logout button
  } else {
    loginForm.style.display = 'block'; // Show login form
    logoutButton.style.display = 'none'; // Hide logout button
  }
};

// Handle login
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
      localStorage.setItem('jwt', token); // Save JWT in localStorage
      toggleLoginLogout(); // Update login/logout visibility
      toggleUIBasedOnRole(); // Update UI based on role
      fetchScreeningsIfManager(); // Fetch screenings if the user is a manager
      switchTab('movies'); // Default to the movies tab
    } else {
      console.error('Login failed');
      alert('Invalid username or password');
    }
  } catch (error) {
    console.error('Error during login:', error);
  }
});

// Handle logout
logoutButton.addEventListener('click', () => {
  localStorage.removeItem('jwt'); // Remove JWT from localStorage
  localStorage.removeItem('activeTab'); // Remove the saved tab state
  toggleLoginLogout(); // Update login/logout visibility
  toggleUIBasedOnRole(); // Update UI based on role
  tabsContainer.style.display = 'none'; // Hide tabs
  switchTab('movies'); // Reset to the default tab (movies)
});

// Function to toggle UI based on role
const toggleUIBasedOnRole = () => {
  const token = localStorage.getItem('jwt');
  const loginForm = document.getElementById('login-form');
  const logoutButton = document.getElementById('logout-button');
  const managerContent = document.getElementById('manager-content');

  if (token) {
    const payload = decodeJWT(token);

    if (payload.role === 'manager') {
      tabsContainer.style.display = 'block'; // Show tabs
      managerTab.style.display = 'inline-block'; // Show manager tab
    } else {
      tabsContainer.style.display = 'block'; // Show tabs
      managerTab.style.display = 'none'; // Hide manager tab
      managerContent.style.display = 'none'; // Ensure manager content is hidden
    }
    loginForm.style.display = 'none'; // Hide login form
    logoutButton.style.display = 'block'; // Show logout button
  } else {
    tabsContainer.style.display = 'none'; // Hide tabs
    loginForm.style.display = 'block'; // Show login form
    logoutButton.style.display = 'none'; // Hide logout button
    managerContent.style.display = 'none'; // Ensure manager content is hidden
  }
};

// Tab switching logic
const switchTab = (tab) => {
    localStorage.setItem('activeTab', tab); // Save the active tab in localStorage
  if (tab === 'movies') {
    moviesContent.style.display = 'block';
    screeningsContent.style.display = 'none';
    managerContent.style.display = 'none';
    moviesTab.classList.add('active');
    screeningsTab.classList.remove('active');
    managerTab.classList.remove('active');
  } else if (tab === 'screenings') {
    moviesContent.style.display = 'none';
    screeningsContent.style.display = 'block';
    managerContent.style.display = 'none';
    moviesTab.classList.remove('active');
    screeningsTab.classList.add('active');
    managerTab.classList.remove('active');
    fetchScreenings(); // Fetch screenings when switching to this tab
  } else if (tab === 'manager') {
    moviesContent.style.display = 'none';
    screeningsContent.style.display = 'none';
    managerContent.style.display = 'block';
    moviesTab.classList.remove('active');
    screeningsTab.classList.remove('active');
    managerTab.classList.add('active');
    fetchScreenings(); // Fetch screenings when switching to manager tab
  }
};

// Add event listeners for tab buttons
moviesTab.addEventListener('click', () => switchTab('movies'));
screeningsTab.addEventListener('click', () => switchTab('screenings')); // New Screenings Tab
managerTab.addEventListener('click', () => switchTab('manager'));

// Function to fetch screenings only if the user is a manager
const fetchScreeningsIfManager = () => {
  const token = localStorage.getItem('jwt');
  if (token) {
    const payload = decodeJWT(token);
    if (payload && payload.role === 'manager') { // Added null check for payload
      if (managerTab.style.display !== 'none' && managerContent.style.display !== 'none') {
         fetchScreenings();
      }
    }
  }
};

// Restore the active tab on page load
const savedTab = localStorage.getItem('activeTab') || 'movies'; // Default to 'movies' if no tab is saved

// Call this function on page load
toggleUIBasedOnRole();
toggleLoginLogout();
fetchMovies(); // Fetch movies on initial load
switchTab(savedTab);
setupWebSocket(); // Initialize WebSocket connection when the app loads