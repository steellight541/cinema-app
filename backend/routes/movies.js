const express = require('express');
const { fetchMovies } = require('../utils/tmdb');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const router = express.Router();


/**
 * @swagger
 * tags:
 *   name: Movies
 *   description: Movie management (currently read-only from TMDB, example PUT for future)
 */

/**
 * @swagger
 * /api/movies:
 *   get:
 *     summary: Retrieve a list of movies from TMDB
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: A list of movies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Failed to fetch movies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const movies = await fetchMovies();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

/**
 * @swagger
 * /api/movies/{id}:
 *   put:
 *     summary: Update a movie (Manager only) - Example endpoint
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the movie to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                title: { type: 'string' }
 *                vote_average: { type: 'number' }
 *                poster_path: { type: 'string' }
 *             example:
 *                title: "Updated Movie Title"
 *                vote_average: 8.5
 *                poster_path: "/newPath.jpg"
 *     responses:
 *       200:
 *         description: Movie updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 *       400:
 *         description: All fields are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not a manager)
 *       404:
 *         description: Movie not found (simulated)
 */
router.put('/:id', verifyToken, verifyRole('manager'), (req, res) => {
  const { id } = req.params;
  const { title, vote_average, poster_path } = req.body;

  if (!title || !vote_average || !poster_path) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Simulate updating movie data (you can replace this with a database update)
  const updatedMovie = { id: parseInt(id), title, vote_average, poster_path };
  res.json(updatedMovie);
});

module.exports = router;