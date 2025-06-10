require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});
const express = require('express');
const cors = require('cors');
const http = require('http');
const mqtt = require('mqtt'); // Add MQTT client
const path = require('path');

const moviesRoute = require('./routes/movies');
const screeningsRouteModule = require('./routes/screenings');
const authRoute = require('./routes/auth');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'; // Add MQTT Broker URL
const MQTT_TOPIC_SCREENINGS = 'cinema/screenings/updated'; // Define a topic

// --- BEGIN SENDGRID CONFIGURATION ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
app.set('sendgrid', sgMail);
app.set('verifiedSenderEmail', process.env.VERIFIED_SENDER_EMAIL);
// --- END SENDGRID CONFIGURATION ---

const server = http.createServer(app);

// --- BEGIN MQTT CLIENT SETUP ---
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on('connect', () => {
    // You could subscribe to topics here if the backend needs to listen for messages
});

mqttClient.on('error', (error) => {
    console.error('MQTT Client Error:', error);
});

mqttClient.on('reconnect', () => {
    console.log('MQTT client reconnecting...');
});

mqttClient.on('close', () => {
    console.log('MQTT client disconnected.');
});
// --- END MQTT CLIENT SETUP ---


// Modified broadcastMessage function to publish to MQTT
const broadcastMessage = (message) => {
  if (mqttClient.connected) {
    const topic = MQTT_TOPIC_SCREENINGS; // Or determine topic based on message type
    const payload = JSON.stringify(message);
    mqttClient.publish(topic, payload, (err) => {
      if (err) {
        console.error('MQTT publish error:', err);
      } else {
      }
    });
  } else {
    console.warn('MQTT client not connected. Message not published:', message);
  }
};

app.use(cors());
app.use(express.json());
app.use('/api/movies', moviesRoute);
app.use('/api/screenings', screeningsRouteModule(broadcastMessage)); // Pass the new broadcastMessage
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
            movieTitle: { type: 'string', example: 'Kingdom of the Planet of the Apes', description: 'Title of the movie for this screening' },
            moviePosterPath: { type: 'string', example: '/gKkl37BQuKTanygYQG1pyYgLVgf.jpg', description: 'Poster path of the movie' },
            date: { type: 'string', format: 'date-time', example: '2025-05-20T19:00:00.000Z' },
            initialTicketsAvailable: { type: 'integer', example: 100, description: 'Initial number of tickets when screening was created/last updated' },
            ticketsAvailable: { type: 'integer', example: 100 },
          },
        },
        ScreeningInput: {
          type: 'object',
          required: ['movieTitle', 'date', 'ticketsAvailable'],
          properties: {
            movieTitle: { type: 'string', example: "Kingdom of the Planet of the Apes" },
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
                screening: { $ref: '#/components/schemas/Screening' },
                qrCodeDataUrl: {
                    type: 'string',
                    format: 'url',
                    description: 'Data URL of the generated QR code for the ticket.',
                    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA....'
                }
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
  // Path to the API docs - Use absolute paths
  apis: [
    path.join(__dirname, './routes/auth.js'),
    path.join(__dirname, './routes/movies.js'),
    path.join(__dirname, './routes/screenings.js')
  ], // Files containing JSDoc comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
// You can add this line temporarily to debug the generated spec
// console.log(JSON.stringify(swaggerSpec, null, 2)); 
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} and MQTT client connecting...`);
});