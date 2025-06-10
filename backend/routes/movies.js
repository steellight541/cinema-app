const express = require('express');
const {
  fetchMovies,
  fetchPopularMovies,
  fetchUpcomingMovies,
  fetchGenres,
  fetchMoviesByGenre
} = require('../utils/tmdb');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Movies
 *   description: Movie browsing and management
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
 * /api/movies/popular:
 *   get:
 *     summary: Retrieve a list of popular movies from TMDB
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: A list of popular movies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Failed to fetch movies
 */
router.get('/popular', async (req, res) => {
  try {
    const movies = await fetchPopularMovies();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular movies' });
  }
});

/**
 * @swagger
 * /api/movies/upcoming:
 *   get:
 *     summary: Retrieve a list of upcoming movies from TMDB
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: A list of upcoming movies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Failed to fetch movies
 */
router.get('/upcoming', async (req, res) => {
  try {
    const movies = await fetchUpcomingMovies();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming movies' });
  }
});

/**
 * @swagger
 * /api/movies/genres:
 *   get:
 *     summary: Retrieve a list of movie genres from TMDB
 *     tags: [Movies]
 *     responses:
 *       200:
 *         description: A list of movie genres
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *       500:
 *         description: Failed to fetch genres
 */
router.get('/genres', async (req, res) => {
  try {
    const genres = await fetchGenres();
    res.json(genres);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

/**
 * @swagger
 * /api/movies/genre/{genreId}:
 *   get:
 *     summary: Retrieve movies by a specific genre ID from TMDB
 *     tags: [Movies]
 *     parameters:
 *       - in: path
 *         name: genreId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the genre
 *     responses:
 *       200:
 *         description: A list of movies for the specified genre
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movie'
 *       500:
 *         description: Failed to fetch movies for the genre
 */
router.get('/genre/:genreId', async (req, res) => {
  try {
    const genreId = parseInt(req.params.genreId);
    if (isNaN(genreId)) {
      return res.status(400).json({ error: 'Invalid genre ID' });
    }
    const movies = await fetchMoviesByGenre(genreId);
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch movies for genre ${req.params.genreId}` });
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
 *       400:
 *         description: All fields are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Movie not found (simulated)
 */
router.put('/:id', verifyToken, verifyRole('manager'), (req, res) => {
  const { id } = req.params;
  const { title, vote_average, poster_path } = req.body;

  if (!title || vote_average === undefined || !poster_path) {
    return res.status(400).json({ error: 'All fields are required and must be valid' });
  }

  const updatedMovie = { id: parseInt(id), title, vote_average: parseFloat(vote_average), poster_path };
  res.json(updatedMovie);
});

module.exports = router;