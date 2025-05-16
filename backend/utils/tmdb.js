const axios = require('axios');
require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
console.log('TMDB_API_KEY:', TMDB_API_KEY); // Debugging line to check if the API key is loaded correctly
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const fetchMovies = async () => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching movies from TMDB:', error.message);
    throw error;
  }
};

module.exports = { fetchMovies };