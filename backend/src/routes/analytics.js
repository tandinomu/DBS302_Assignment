const express = require("express");
const router = express.Router();
const {
  salesReport,
  topProducts,
  lowStock,
  viewsVsPurchases,
  trending,
  sellerLeaderboard,
  buyerLeaderboard,
  uniqueVisitors,
  cacheStats,
} = require("../controllers/analyticsController");
const { authenticate, authorize } = require("../middleware/auth");

const adminOnly = [authenticate, authorize("admin")];

/**
 * @swagger
 * /analytics/sales:
 *   get:
 *     summary: Monthly/daily sales report via aggregation pipeline
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [monthly, daily] }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, description: "Required for daily period" }
 *     responses:
 *       200:
 *         description: Sales data grouped by period
 */
router.get("/sales", ...adminOnly, salesReport);

/**
 * @swagger
 * /analytics/top-products:
 *   get:
 *     summary: Top-N products by revenue or units sold
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: n
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: metric
 *         schema: { type: string, enum: [revenue, units] }
 *     responses:
 *       200:
 *         description: Ranked product list with revenue totals
 */
router.get("/top-products", ...adminOnly, topProducts);

/**
 * @swagger
 * /analytics/low-stock:
 *   get:
 *     summary: Low stock alert — inventory items below threshold
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Items sorted by urgency
 */
router.get("/low-stock", ...adminOnly, lowStock);

/**
 * @swagger
 * /analytics/views-vs-purchases:
 *   get:
 *     summary: Compare product view counts to purchase counts — conversion rate
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Conversion rate analysis per product
 */
router.get("/views-vs-purchases", ...adminOnly, viewsVsPurchases);

/**
 * @swagger
 * /analytics/trending:
 *   get:
 *     summary: Trending products from Redis sorted set
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Top trending products with scores
 */
router.get("/trending", trending);

/**
 * @swagger
 * /analytics/leaderboard/sellers:
 *   get:
 *     summary: Top sellers leaderboard from Redis sorted set
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: string, example: "2025-01" }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Sellers ranked by revenue
 */
router.get("/leaderboard/sellers", sellerLeaderboard);

/**
 * @swagger
 * /analytics/leaderboard/buyers:
 *   get:
 *     summary: Top buyers leaderboard from Redis sorted set
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Buyers ranked by spend
 */
router.get("/leaderboard/buyers", buyerLeaderboard);

/**
 * @swagger
 * /analytics/unique-visitors/{productId}:
 *   get:
 *     summary: Unique visitor count via HyperLogLog
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Approximate unique visitor count (±0.81% error)
 */
router.get("/unique-visitors/:productId", uniqueVisitors);

/**
 * @swagger
 * /analytics/cache-stats:
 *   get:
 *     summary: Redis cache statistics — hit ratio, memory, clients
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cache performance metrics
 */
router.get("/cache-stats", ...adminOnly, cacheStats);

module.exports = router;
