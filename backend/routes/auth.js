const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();

const usersFilePath = path.resolve(__dirname, '../models/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Helper function to read users
const readUsers = () => {
  const data = fs.readFileSync(usersFilePath, 'utf-8');
  return JSON.parse(data);
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCredentials'
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthToken'
 *       401:
 *         description: Invalid username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const users = readUsers();
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate JWT
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '1h',
  });

  res.json({ token });
});

module.exports = router;