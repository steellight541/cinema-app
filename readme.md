# Cinema App

A full-stack web application for managing cinema screenings, movie listings, and ticket reservations. Built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

- **User Authentication**: Login system with JWT tokens
- **Movie Management**: Browse popular and upcoming movies from TMDB API
- **Screening Management**: Create, edit, and delete movie screenings (Manager only)
- **Ticket Reservation**: Reserve tickets with QR code generation
- **Real-time Updates**: WebSocket integration for live updates
- **Analytics Dashboard**: Ticket sales charts for managers
- **Responsive Design**: Modern CSS with mobile-friendly interface

## Project Structure

```
cinema-app/
├── backend/                    # Server-side application
│   ├── middleware/            # Express middleware (auth, CORS, etc.)
│   ├── models/               # Database models and schemas
│   ├── routes/               # API route handlers
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── movies.js        # Movie-related endpoints
│   │   └── screenings.js    # Screening management endpoints
│   ├── utils/               # Utility functions
│   └── server.js           # Main server entry point
├── frontend/                  # Client-side application
│   ├── index.html          # Main HTML file
│   ├── style.css           # Application styles
│   └── app.js              # Frontend JavaScript logic
├── .env                      # Environment variables
├── .gitignore               # Git ignore file
├── .dockerignore            # Docker ignore file
├── dockerfile               # Docker configuration
├── package.json             # Node.js dependencies
├── package-lock.json        # Locked dependency versions
└── README.md               # This file
```

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- TMDB API key (for movie data)

## Setup Instructions

### 1. Clone or Navigate to the Repository

```bash
cd cinema-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Start Script

First, update your `package.json` to include a start script:

```json
{
  "scripts": {
    "start": "node backend/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### 4. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# Database
DB_PATH=./cinema.db

# JWT Secret (use a strong, random string)
JWT_SECRET=your-super-secret-jwt-key-here

# TMDB API Configuration
TMDB_API_KEY=your-tmdb-api-key-here
TMDB_BASE_URL=https://api.themoviedb.org/3

# WebSocket Configuration
WS_PORT=8080
```

### 5. Get TMDB API Key

1. Visit [The Movie Database (TMDB)](https://www.themoviedb.org/)
2. Create a free account
3. Go to Settings → API
4. Request an API key
5. Add your API key to the `.env` file

### 6. Initialize the Database

The database will be automatically created when you first run the server. The SQLite database includes:

- **users** table (authentication)
- **screenings** table (movie screenings)
- **tickets** table (reservations)

### 7. Start the Application

```bash
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **WebSocket**: ws://localhost:8080

## Default Users

The application creates default users on first run:

- **Manager**: 
  - Username: `manager`
  - Password: `password123`
  - Role: Can create/edit/delete screenings

- **Regular User**:
  - Username: `user`
  - Password: `password123`
  - Role: Can browse movies and reserve tickets

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (if enabled)

### Movies
- `GET /api/movies/popular` - Get popular movies
- `GET /api/movies/upcoming` - Get upcoming movies
- `GET /api/movies/genre/:genreId` - Get movies by genre
- `GET /api/movies/genres` - Get all genres

### Screenings
- `GET /api/screenings` - Get all screenings
- `POST /api/screenings` - Create new screening (Manager only)
- `PUT /api/screenings/:id` - Update screening (Manager only)
- `DELETE /api/screenings/:id` - Delete screening (Manager only)
- `POST /api/screenings/reserve` - Reserve ticket

## Frontend Features

### For All Users
- Browse popular and upcoming movies
- Filter movies by genre or search by name
- View available screenings
- Filter screenings by date or movie name
- Reserve tickets and receive QR codes

### For Managers
- All user features plus:
- Create new movie screenings
- Edit existing screenings
- Delete screenings
- View ticket sales analytics
- Real-time updates via WebSocket

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database
- **JWT** - Authentication
- **WebSocket** - Real-time communication
- **QR Code** - Ticket generation
- **bcrypt** - Password hashing
- **Axios** - HTTP client for TMDB API
- **CORS** - Cross-origin resource sharing
- **Swagger** - API documentation

### Frontend
- **Vanilla JavaScript** - Client-side logic
- **CSS3** - Modern styling with variables and grid
- **Chart.js** - Analytics visualization
- **WebSocket** - Real-time updates

### External APIs
- **TMDB API** - Movie data and images

## Docker Support

Build and run with Docker:

```bash
# Build the image
docker build -t cinema-app .

# Run the container
docker run -p 3000:3000 -p 8080:8080 cinema-app
```

## Development

### Project Architecture

1. **Backend**: RESTful API with JWT authentication located in `/backend`
2. **Frontend**: Single-page application with tab-based navigation in `/frontend`
3. **Database**: SQLite for simplicity and portability
4. **Real-time**: WebSocket for live screening updates

### Key Files

- `backend/server.js` - Main server configuration and startup
- `frontend/app.js` - All client-side JavaScript logic
- `frontend/style.css` - Complete styling with CSS variables and responsive design
- `backend/routes/` - API endpoint implementations
- `backend/models/` - Database schema and operations

### CSS Architecture

The application uses a modern CSS architecture with:
- **CSS Variables** - Centralized color scheme, spacing, and design tokens
- **Component-based Styling** - Modular styles for cards, buttons, forms
- **Responsive Design** - Mobile-first approach with breakpoints
- **Grid Layout** - CSS Grid for movie/screening cards
- **Flexbox** - Tab navigation and form layouts

### Adding New Features

1. **Backend**: Add routes in `/backend/routes` directory
2. **Frontend**: Extend `frontend/app.js` with new functions
3. **Database**: Modify models in `/backend/models` directory
4. **Styling**: Update `frontend/style.css` with new component styles

## Troubleshooting

### Common Issues

1. **Database errors**: Ensure write permissions in project directory
2. **TMDB API errors**: Verify API key in `.env` file
3. **WebSocket connection**: Check if port 8080 is available
4. **Login issues**: Verify JWT_SECRET is set in `.env`
5. **Server won't start**: Ensure Node.js is installed and `npm install` was run

### Debugging

- Check browser console for frontend errors
- Monitor server logs for backend issues
- Verify network requests in browser dev tools
- Test API endpoints directly with tools like Postman

### CSS Issues

The application includes comprehensive responsive CSS:
- Check CSS variables in `:root` for color/spacing customization
- Responsive breakpoints at 992px, 768px, and 576px
- Grid layouts automatically adjust for different screen sizes

## File Structure Details

### Backend Structure
```
backend/
├── middleware/     # Authentication, CORS, validation
├── models/        # Database schemas and operations
├── routes/        # Express route handlers
├── utils/         # Helper functions
└── server.js      # Main application entry point
```

### Frontend Structure
```
frontend/
├── index.html     # Main HTML structure
├── style.css      # Complete styling system
└── app.js         # All JavaScript functionality
```

## License

This project is for educational purposes. Please respect TMDB's terms of service when using their API.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## GitHub Repository

Repository: https://github.com/steellight541/cinema-app.git