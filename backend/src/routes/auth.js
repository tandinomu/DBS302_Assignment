const express = require("express");
const router = express.Router();
const { register, login, logout } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");

const loginLimiter = rateLimiter(
  parseInt(process.env.RATE_LIMIT_LOGIN || "5", 10),
  parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || "60", 10),
  "ip"
);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:  { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [customer, seller] }
 *     responses:
 *       201:
 *         description: User registered
 *       409:
 *         description: Email already exists
 */
router.post("/register", register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token and user object
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limit exceeded (5 attempts per 60s)
 */
router.post("/login", loginLimiter, login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout — invalidates Redis session
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *       401:
 *         description: Unauthorized
 */
router.post("/logout", authenticate, logout);

module.exports = router;
