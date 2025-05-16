require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});
const express = require('express');
const cors = require('cors');
const http = require('http'); // Import http module
const { WebSocketServer } = require('ws'); // Import WebSocketServer

const moviesRoute = require('./routes/movies');
const screeningsRouteModule = require('./routes/screenings'); // Import as a module that exports a function
const authRoute = require('./routes/auth');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Create WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

const clients = new Set();

// Broadcast function to send messages to all connected clients
const broadcastMessage = (message) => {
  console.log("Broadcasting message:", message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) { // WebSocket is a constructor, use client.OPEN
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending message to client:", error);
      }
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  clients.add(ws);

  ws.on('message', (message) => {
    console.log('Received message from client:', message.toString());
    // For now, we primarily broadcast from server to clients.
    // You could implement client-to-server messages here if needed.
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error with a client:', error);
    clients.delete(ws); // Ensure client is removed on error
  });
});

app.use(cors());
app.use(express.json());
app.use('/api/movies', moviesRoute);
// Pass the broadcastMessage function to the screenings route module
app.use('/api/screenings', screeningsRouteModule(broadcastMessage));
app.use('/api/auth', authRoute);

// Swagger Options
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Cinema API',
      version: '1.0.0',
      description: 'API for managing cinema movies, screenings, and reservations',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'user1' },
            role: { type: 'string', enum: ['user', 'manager'], example: 'user' },
          },
        },
        LoginCredentials: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'manager' },
            password: { type: 'string', example: 'password123' },
          },
        },
        AuthToken: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
        Movie: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 653346 },
            title: { type: 'string', example: 'Kingdom of the Planet of the Apes' },
            vote_average: { type: 'number', format: 'float', example: 7.2 },
            poster_path: { type: 'string', example: '/gKkl37BQuKTanygYQG1pyYgLVgf.jpg' },
          },
        },
        Screening: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            movieId: { type: 'integer', example: 653346 },
            date: { type: 'string', format: 'date-time', example: '2025-05-20T19:00:00.000Z' },
            ticketsAvailable: { type: 'integer', example: 100 },
          },
        },
        ScreeningInput: {
          type: 'object',
          required: ['movieId', 'date', 'ticketsAvailable'],
          properties: {
            movieId: { type: 'integer', example: 653346 },
            date: { type: 'string', format: 'date-time', example: '2025-05-20T19:00:00Z' },
            ticketsAvailable: { type: 'integer', example: 100 },
          },
        },
        ReservationInput: {
            type: 'object',
            required: ['screeningId'],
            properties: {
                screeningId: { type: 'integer', example: 1 },
            }
        },
        ReservationConfirmation: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Ticket reserved successfully' },
                screening: { $ref: '#/components/schemas/Screening' }
            }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid input' },
            message: { type: 'string', example: 'Detailed error message' }
          },
        },
      },
    },
    security: [ // Global security definition, can be overridden at operation level
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs
  apis: ['./routes/*.js'], // Files containing JSDoc comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start the HTTP server (which also hosts the WebSocket server)
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} and WebSocket server is active`);
});