const express = require("express");
const router = express.Router();
const {
  listProducts,
  searchProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { authenticate, authorize } = require("../middleware/auth");
const { productCacheMiddleware } = require("../middleware/cacheMiddleware");

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "-createdAt" }
 *     responses:
 *       200:
 *         description: Paginated product list
 */
router.get("/", listProducts);

/**
 * @swagger
 * /products/search:
 *   get:
 *     summary: Full-text search using MongoDB text index
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Search results ranked by relevance score
 */
router.get("/search", searchProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get product by ID (cache-aside with Redis)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details — X-Cache header indicates HIT or MISS
 *       404:
 *         description: Product not found
 */
router.get("/:id", productCacheMiddleware, getProduct);

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product (seller or admin)
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, basePrice, category, variants]
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *               basePrice:   { type: number }
 *               category:    { type: string, description: "Category ObjectId" }
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sku:   { type: string }
 *                     price: { type: number }
 *                     stock: { type: number }
 *               attributes: { type: object, description: "Polymorphic — any key/value pairs" }
 *     responses:
 *       201:
 *         description: Product created
 */
router.post("/", authenticate, authorize("seller", "admin"), createProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product and invalidate cache
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product updated, Redis cache invalidated
 */
router.put("/:id", authenticate, authorize("seller", "admin"), updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Soft-delete a product
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deactivated
 */
router.delete("/:id", authenticate, authorize("seller", "admin"), deleteProduct);

module.exports = router;
