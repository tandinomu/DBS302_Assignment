const express = require("express");
const router = express.Router();
const {
  getMe,
  updateMe,
  addAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile with embedded addresses
 */
router.get("/me", authenticate, getMe);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.put("/me", authenticate, updateMe);

/**
 * @swagger
 * /users/me/addresses:
 *   post:
 *     summary: Add an address to embedded addresses array
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, city, country, zip]
 *             properties:
 *               street:    { type: string }
 *               city:      { type: string }
 *               country:   { type: string }
 *               zip:       { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated addresses array
 */
router.post("/me/addresses", authenticate, addAddress);

/**
 * @swagger
 * /users/me/wishlist:
 *   get:
 *     summary: Get wishlist with populated product details
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of wishlist products
 */
router.get("/me/wishlist", authenticate, getWishlist);

/**
 * @swagger
 * /users/me/wishlist/{productId}:
 *   post:
 *     summary: Add product to wishlist
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Added to wishlist
 */
router.post("/me/wishlist/:productId", authenticate, addToWishlist);

/**
 * @swagger
 * /users/me/wishlist/{productId}:
 *   delete:
 *     summary: Remove product from wishlist
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Removed from wishlist
 */
router.delete("/me/wishlist/:productId", authenticate, removeFromWishlist);

module.exports = router;
