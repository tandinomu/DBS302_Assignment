const express = require("express");
const router = express.Router();
const {
  getCartHandler,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCartHandler,
  mergeCart,
} = require("../controllers/cartController");
const { authenticate, optionalAuthenticate } = require("../middleware/auth");

// Cart supports both authenticated users and guests.
// Guest carts use cookie/header guestId, user carts use JWT userId.

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get cart contents — enriched with current prices
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart items with line totals and stock status
 */
router.get("/", optionalAuthenticate, getCartHandler);

/**
 * @swagger
 * /cart/add:
 *   post:
 *     summary: Add item to cart (Redis Hash)
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, sku, quantity]
 *             properties:
 *               productId: { type: string }
 *               sku:       { type: string }
 *               quantity:  { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Item added
 */
router.post("/add", optionalAuthenticate, addToCart);

/**
 * @swagger
 * /cart/update:
 *   put:
 *     summary: Update item quantity
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Quantity updated
 */
router.put("/update", optionalAuthenticate, updateCartItem);

/**
 * @swagger
 * /cart/item:
 *   delete:
 *     summary: Remove a specific item from cart
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Item removed
 */
router.delete("/item", optionalAuthenticate, removeFromCart);

/**
 * @swagger
 * /cart:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     responses:
 *       200:
 *         description: Cart cleared
 */
router.delete("/", optionalAuthenticate, clearCartHandler);

/**
 * @swagger
 * /cart/merge:
 *   post:
 *     summary: Merge guest cart into user cart after login
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guestId]
 *             properties:
 *               guestId: { type: string }
 *     responses:
 *       200:
 *         description: Carts merged
 */
router.post("/merge", authenticate, mergeCart);

module.exports = router;
