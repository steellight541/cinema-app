const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode'); // Import QRCode library
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const { searchMovieByTitle, searchMoviesForSuggestions } = require('../utils/tmdb'); // Add searchMoviesForSuggestions

const screeningsFilePath = path.resolve(__dirname, '../models/screenings.json');
const reservationsFilePath = path.join(__dirname, '../models/reservations.json');

// Helper functions to read/write screenings
const loadScreeningsData = () => {
  try {
    const dataBuffer = fs.readFileSync(screeningsFilePath);
    const dataJSON = dataBuffer.toString();
    return JSON.parse(dataJSON);
  } catch (error) {
    console.error("Error reading screenings data:", error);
    return [];
  }
};

const saveScreeningsData = (data) => {
  try {
    const dataJSON = JSON.stringify(data, null, 2);
    fs.writeFileSync(screeningsFilePath, dataJSON);
  } catch (error) {
    console.error("Error writing screenings data:", error);
  }
};

const loadReservationsData = () => {
  try {
    if (fs.existsSync(reservationsFilePath)) {
      const dataBuffer = fs.readFileSync(reservationsFilePath);
      const dataJSON = dataBuffer.toString();
      if (dataJSON) {
        return JSON.parse(dataJSON);
      }
    }
    return {};
  } catch (error) {
    console.error("Error reading reservations data:", error);
    return {};
  }
};

const saveReservationsData = (data) => {
  try {
    const dataJSON = JSON.stringify(data, null, 2);
    fs.writeFileSync(reservationsFilePath, dataJSON);
  } catch (error) {
    console.error("Error writing reservations data:", error);
  }
};

// This module now exports a function that takes broadcastMessage
module.exports = (broadcastMessage) => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   name: Screenings
   *   description: Screening management and ticket reservations
   */

  /**
   * @swagger
   * /api/screenings:
   *   get:
   *     summary: Retrieve all screenings, optionally filtered by date
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *         required: false
   *         description: Filter screenings by a specific date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: A list of screenings
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Screening'
   *       401:
   *         description: Unauthorized (token missing or invalid)
   *       500:
   *         description: Server error
   */
  router.get('/', verifyToken, (req, res) => {
    let screenings = loadScreeningsData();
    const filterDate = req.query.date; // e.g., "2025-05-17"

    if (filterDate) {
      screenings = screenings.filter(screening => {
        // Compare only the date part of the screening.date (ISO string)
        return screening.date.startsWith(filterDate);
      });
    }
    res.json(screenings);
  });

  /**
   * @swagger
   * /api/screenings:
   *   post:
   *     summary: Create a new screening using movie title (Manager only)
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - movieTitle
   *               - date
   *               - ticketsAvailable
   *             properties:
   *               movieTitle:
   *                 type: string
   *                 example: "Kingdom of the Planet of the Apes"
   *               date:
   *                 type: string
   *                 format: date-time
   *                 example: "2025-05-20T19:00:00Z"
   *               ticketsAvailable:
   *                 type: integer
   *                 example: 100
   *     responses:
   *       201:
   *         description: Screening created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Screening'
   *       400:
   *         description: All fields are required, invalid ticketsAvailable value, or movie title not found/ambiguous
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (user is not a manager)
   *       500:
   *         description: Server error or error searching for movie
   */
  router.post('/', verifyToken, verifyRole('manager'), async (req, res) => {
    const { movieTitle, date, ticketsAvailable } = req.body;

    if (!movieTitle || !date || ticketsAvailable == null) {
      return res.status(400).json({ error: 'Movie title, date, and tickets available are required' });
    }

    let foundMovie;
    try {
      foundMovie = await searchMovieByTitle(movieTitle);
      if (!foundMovie || !foundMovie.id) {
        return res.status(400).json({ error: `Movie with title "${movieTitle}" not found or TMDB search failed.` });
      }
    } catch (tmdbError) {
      console.error("TMDB search error:", tmdbError);
      return res.status(500).json({ error: 'Failed to search for movie on TMDB.' });
    }
    
    const movieId = foundMovie.id;

    const screenings = loadScreeningsData();
    const newId = screenings.length > 0 ? Math.max(...screenings.map(s => s.id)) + 1 : 1;
    
    const initialTickets = parseInt(ticketsAvailable);
    if (isNaN(initialTickets) || initialTickets < 0) {
        return res.status(400).json({ error: 'Invalid ticketsAvailable value' });
    }

    const newScreening = {
      id: newId,
      movieId: movieId,
      movieTitle: foundMovie.title, // Sla de titel van de film op
      moviePosterPath: foundMovie.poster_path, // Sla het poster pad op
      date,
      initialTicketsAvailable: initialTickets,
      ticketsAvailable: initialTickets,
    };

    screenings.push(newScreening);
    saveScreeningsData(screenings);

    broadcastMessage({ type: 'screenings_updated', payload: loadScreeningsData() });
    res.status(201).json(newScreening); 
  });

  /**
   * @swagger
   * /api/screenings/{id}:
   *   put:
   *     summary: Update an existing screening (Manager only)
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: Numeric ID of the screening to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ScreeningInput'
   *     responses:
   *       200:
   *         description: Screening updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Screening'
   *       400:
   *         description: Invalid input or all fields required
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Screening not found
   *       500:
   *         description: Server error
   */
  router.put('/:id', verifyToken, verifyRole('manager'), async (req, res) => {
    const { id } = req.params;
    const { movieId: inputMovieId, movieTitle: inputMovieTitle, date, ticketsAvailable } = req.body;

    let screenings = loadScreeningsData();
    const screeningIndex = screenings.findIndex((s) => s.id === parseInt(id));

    if (screeningIndex === -1) {
      return res.status(404).json({ error: 'Screening not found' });
    }
    
    const updatedScreening = { ...screenings[screeningIndex] };

    if (inputMovieTitle) { // Als titel wordt gegeven, zoek ID en details op
        try {
            const foundMovie = await searchMovieByTitle(inputMovieTitle);
            if (foundMovie && foundMovie.id) {
                updatedScreening.movieId = foundMovie.id;
                updatedScreening.movieTitle = foundMovie.title; 
                updatedScreening.moviePosterPath = foundMovie.poster_path;
            } else {
                console.warn(`Movie title "${inputMovieTitle}" not found for update, keeping old movie details if any.`);
            }
        } catch (tmdbError) {
            console.error("TMDB search error during update:", tmdbError);
        }
    } else if (inputMovieId !== undefined) { // Als ID direct wordt gegeven
        if (updatedScreening.movieId !== parseInt(inputMovieId)) {
            updatedScreening.movieId = parseInt(inputMovieId);
        }
    }

    if (date !== undefined) updatedScreening.date = date;
    
    if (ticketsAvailable !== undefined) {
      const newInitialTickets = parseInt(ticketsAvailable);
      if (isNaN(newInitialTickets) || newInitialTickets < 0) {
        return res.status(400).json({ error: 'Invalid ticketsAvailable value for update' });
      }
      updatedScreening.initialTicketsAvailable = newInitialTickets;
      updatedScreening.ticketsAvailable = newInitialTickets;
    }

    screenings[screeningIndex] = updatedScreening;
    saveScreeningsData(screenings);

    broadcastMessage({ type: 'screenings_updated', payload: loadScreeningsData() });
    res.json(screenings[screeningIndex]);
  });

  /**
   * @swagger
   * /api/screenings/{id}:
   *   delete:
   *     summary: Delete a screening (Manager only)
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: Numeric ID of the screening to delete
   *     responses:
   *       204:
   *         description: Screening deleted successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Screening not found
   *       500:
   *         description: Server error
   */
  router.delete('/:id', verifyToken, verifyRole('manager'), (req, res) => {
    const { id } = req.params;

    let screenings = loadScreeningsData();
    const updatedScreenings = screenings.filter((s) => s.id !== parseInt(id));

    if (screenings.length === updatedScreenings.length) {
      return res.status(404).json({ error: 'Screening not found or no change' });
    }

    saveScreeningsData(updatedScreenings);

    broadcastMessage({ type: 'screenings_updated', payload: loadScreeningsData() });
    res.status(204).send();
  });

  /**
   * @swagger
   * /api/movies/suggestions:
   *   get:
   *     summary: Get movie title suggestions based on a query
   *     tags: [Movies, Screenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         required: true
   *         description: The search term for movie titles
   *     responses:
   *       200:
   *         description: A list of movie suggestions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: integer
   *                   title:
   *                     type: string
   *                   release_date:
   *                     type: string
   *       400:
   *         description: Query parameter is required
   *       401:
   *         description: Unauthorized
   */
  router.get('/movies/suggestions', verifyToken, async (req, res) => {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
      const movieResults = await searchMoviesForSuggestions(query);
      // Map to a simpler format and limit the number of suggestions
      const suggestions = movieResults
        .map(movie => ({
          id: movie.id,
          title: movie.title,
          release_date: movie.release_date 
        }))
        .slice(0, 7); // Return up to 7 suggestions

      res.json(suggestions);
    } catch (error) {
      console.error('Error fetching movie suggestions:', error);
      res.status(500).json({ error: 'Failed to fetch movie suggestions' });
    }
  });

  /**
   * @swagger
   * /api/screenings/reserve:
   *   post:
   *     summary: Reserve a ticket for a screening and get a QR code
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ReservationInput'
   *     responses:
   *       200:
   *         description: Ticket reserved successfully, includes QR code
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message: { type: 'string', example: 'Ticket reserved successfully' }
   *                 screening: { $ref: '#/components/schemas/Screening' }
   *                 qrCodeDataUrl: { type: 'string', format: 'url', example: 'data:image/png;base64,...' }
   *       400:
   *         description: Invalid input (e.g., screeningId missing, no tickets available, already reserved)
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Screening not found
   *       500:
   *         description: Server error
   */
  router.post('/reserve', verifyToken, async (req, res) => {
    const { screeningId } = req.body;
    const userId = req.user.id;
    const username = req.user.username; // Get username from token

    if (screeningId == null) {
      return res.status(400).json({ message: "Screening ID is required" });
    }

    let screenings = loadScreeningsData();
    let reservations = loadReservationsData();

    const screeningIndex = screenings.findIndex(s => s.id === parseInt(screeningId));

    if (screeningIndex === -1) {
      return res.status(404).json({ message: "Screening not found" });
    }

    const screeningToBook = screenings[screeningIndex];
    const movieIdToBook = screeningToBook.movieId;

    const userReservedScreeningIds = reservations[userId] || [];
    for (const reservedScreeningId of userReservedScreeningIds) {
      const reservedScreeningDetails = screenings.find(s => s.id === reservedScreeningId);
      if (reservedScreeningDetails && reservedScreeningDetails.movieId === movieIdToBook) {
        return res.status(400).json({ message: "You have already reserved a ticket for this movie." });
      }
    }

    if (screeningToBook.ticketsAvailable > 0) {
      screenings[screeningIndex].ticketsAvailable--; // Only this is adjusted
      saveScreeningsData(screenings);

      if (!reservations[userId]) {
        reservations[userId] = [];
      }
      reservations[userId].push(parseInt(screeningId));
      saveReservationsData(reservations);

      // Generate QR Code
      const reservationData = {
        userId: userId,
        username: username,
        screeningId: screeningToBook.id,
        movieId: screeningToBook.movieId,
        movieTitle: screeningToBook.movieTitle || 'N/A', // Gebruik opgeslagen titel
        moviePosterPath: screeningToBook.moviePosterPath || null, // Gebruik opgeslagen poster
        screeningDate: screeningToBook.date,
        reservedAt: new Date().toISOString() // Add a timestamp
      };
      const qrDataString = JSON.stringify(reservationData);
      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qrDataString);
      } catch (err) {
        console.error('Failed to generate QR code', err);
      }

      broadcastMessage({ type: 'screenings_updated', payload: loadScreeningsData() });
      res.status(200).json({
        message: "Ticket reserved successfully",
        screening: screenings[screeningIndex],
        qrCodeDataUrl: qrCodeDataUrl // Send QR code data URL to client
      });
    } else {
      res.status(400).json({ message: "No tickets available for this screening" });
    }
  });

  return router;
};