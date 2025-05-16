const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

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
   *     summary: Retrieve all screenings
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
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
    const screenings = loadScreeningsData();
    res.json(screenings);
  });

  /**
   * @swagger
   * /api/screenings:
   *   post:
   *     summary: Create a new screening (Manager only)
   *     tags: [Screenings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ScreeningInput'
   *     responses:
   *       201:
   *         description: Screening created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Screening'
   *       400:
   *         description: All fields are required
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden (user is not a manager)
   *       500:
   *         description: Server error
   */
  router.post('/', verifyToken, verifyRole('manager'), (req, res) => {
    const { movieId, date, ticketsAvailable } = req.body;

    if (!movieId || !date || ticketsAvailable == null) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const screenings = loadScreeningsData();
    const newId = screenings.length > 0 ? Math.max(...screenings.map(s => s.id)) + 1 : 1;
    const newScreening = {
      id: newId,
      movieId: parseInt(movieId),
      date,
      ticketsAvailable: parseInt(ticketsAvailable),
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
  router.put('/:id', verifyToken, verifyRole('manager'), (req, res) => {
    const { id } = req.params;
    const { movieId, date, ticketsAvailable } = req.body;

    let screenings = loadScreeningsData();
    const screeningIndex = screenings.findIndex((s) => s.id === parseInt(id));

    if (screeningIndex === -1) {
      return res.status(404).json({ error: 'Screening not found' });
    }

    if (movieId == null || !date || ticketsAvailable == null) {
      return res.status(400).json({ error: 'All fields (movieId, date, ticketsAvailable) are required for update' });
    }

    screenings[screeningIndex] = { 
        id: parseInt(id), 
        movieId: parseInt(movieId),
        date, 
        ticketsAvailable: parseInt(ticketsAvailable)
    };
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
   * /api/screenings/reserve:
   *   post:
   *     summary: Reserve a ticket for a screening
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
   *         description: Ticket reserved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ReservationConfirmation'
   *       400:
   *         description: Invalid input (e.g., screeningId missing, no tickets available, already reserved)
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Screening not found
   *       500:
   *         description: Server error
   */
  router.post('/reserve', verifyToken, (req, res) => {
    const { screeningId } = req.body;
    const userId = req.user.id;

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
      screenings[screeningIndex].ticketsAvailable--;
      saveScreeningsData(screenings);

      if (!reservations[userId]) {
        reservations[userId] = [];
      }
      reservations[userId].push(parseInt(screeningId));
      saveReservationsData(reservations);

      broadcastMessage({ type: 'screenings_updated', payload: loadScreeningsData() });
      res.status(200).json({ message: "Ticket reserved successfully", screening: screenings[screeningIndex] });
    } else {
      res.status(400).json({ message: "No tickets available for this screening" });
    }
  });

  return router;
};