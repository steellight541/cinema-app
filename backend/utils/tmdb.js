const axios = require('axios');
require('dotenv').config({
    path: require('path').resolve(__dirname, '../../.env') // Adjusted path to .env in project root
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const fetchPopularMovies = async () => { // Renamed from fetchMovies for clarity
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US', page: 1 },
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching popular movies from TMDB:', error.message);
    throw error;
  }
};

const fetchUpcomingMovies = async () => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/upcoming`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US', page: 1 },
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching upcoming movies from TMDB:', error.message);
    throw error;
  }
};

const fetchGenres = async () => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US' },
    });
    return response.data.genres;
  } catch (error) {
    console.error('Error fetching genres from TMDB:', error.message);
    throw error;
  }
};

const fetchMoviesByGenre = async (genreId) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        sort_by: 'popularity.desc',
        page: 1,
        with_genres: genreId,
      },
    });
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching movies for genre ID ${genreId} from TMDB:`, error.message);
    throw error;
  }
};

const searchMovieByTitle = async (title) => {
  if (!title) {
    throw new Error('Movie title is required for search.');
  }
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: title,
        page: 1 // We nemen de resultaten van de eerste pagina
      },
    });
    if (response.data && response.data.results && response.data.results.length > 0) {
      return response.data.results[0]; // Retourneer het volledige eerste filmobject
    }
    return null; // Geen film gevonden
  } catch (error) {
    console.error('Error searching movie by title from TMDB:', error.message);
    throw error; // Gooi de error door zodat de aanroeper het kan afhandelen
  }
};

const searchMoviesForSuggestions = async (query) => {
  if (!query) {
    return []; // Return empty array if no query
  }
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        page: 1 
      },
    });
    if (response.data && response.data.results) {
      return response.data.results; // Return all results from the first page
    }
    return []; // No movies found or error
  } catch (error) {
    console.error('Error searching movies for suggestions from TMDB:', error.message);
    // In a real app, you might want to throw or handle this more gracefully
    return []; // Return empty on error to prevent frontend issues
  }
};

module.exports = {
  fetchPopularMovies,
  fetchUpcomingMovies,
  fetchGenres,
  fetchMoviesByGenre,
  searchMovieByTitle,
  searchMoviesForSuggestions
};