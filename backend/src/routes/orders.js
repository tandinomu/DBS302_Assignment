const express = require("express");
const router = express.Router();
const { placeOrder, getMyOrders, getOrder, updateOrderStatus, getAllOrders } = require("../controllers/orderController");
const { authenticate, authorize } = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");

const checkoutLimiter = rateLimiter(
  parseInt(process.env.RATE_LIMIT_CHECKOUT || "3", 10),
  parseInt(process.env.RATE_LIMIT_CHECKOUT_WINDOW || "60", 10),
  "user"
);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Place order — ACID MongoDB transaction
 *     description: |
 *       Executes a multi-document ACID transaction:
 *       1. Checks inventory for each item
 *       2. Decrements quantityAvailable atomically
 *       3. Creates Order with price/name snapshots
 *       4. Commits — on any failure, all changes are rolled back
 *       After commit, updates Redis leaderboards and trending scores.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddress, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string }
 *                     sku:       { type: string }
 *                     quantity:  { type: integer }
 *               shippingAddress:
 *                 type: object
 *                 properties:
 *                   street:  { type: string }
 *                   city:    { type: string }
 *                   country: { type: string }
 *                   zip:     { type: string }
 *               paymentMethod: { type: string, enum: [credit_card, debit_card, upi, wallet, cod] }
 *     responses:
 *       201:
 *         description: Order placed successfully
 *       409:
 *         description: Insufficient stock
 *       429:
 *         description: Rate limit exceeded (3 per 60s)
 */
router.post("/", authenticate, checkoutLimiter, placeOrder);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get current user's order history
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated order history
 */
router.get("/", authenticate, getMyOrders);

router.get("/all", authenticate, authorize("admin"), getAllOrders);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get("/:id", authenticate, getOrder);

/**
 * @swagger
 * /orders/{id}/status:
 *   put:
 *     summary: Update order status (admin/seller)
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [placed, confirmed, shipped, delivered, cancelled, returned] }
 *               note:   { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put("/:id/status", authenticate, authorize("admin", "seller"), updateOrderStatus);

module.exports = router;
