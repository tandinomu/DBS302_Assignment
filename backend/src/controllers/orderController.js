const mongoose = require("mongoose");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const {
  clearCart,
  incrementTrendingPurchase,
  incrementSellerLeaderboard,
  incrementBuyerLeaderboard,
} = require("../services/cacheService");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @route POST /orders
 *
 * ACID Transaction — MongoDB multi-document transaction over a replica set:
 *
 *  Session  → startTransaction (writeConcern: majority + journaled)
 *  Step 1   → For each item: find inventory record and verify stock
 *  Step 2   → Atomically decrement quantityAvailable for each item
 *  Step 3   → Create the Order document with price/name snapshots
 *  Step 4   → commitTransaction
 *  On error → abortTransaction (inventory rollback is automatic)
 *  Finally  → endSession (always, to return session to pool)
 *
 * After commit: update Redis leaderboards and trending (non-transactional, best-effort)
 */
async function placeOrder(req, res, next) {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }
  if (!shippingAddress) {
    return res.status(400).json({ error: "shippingAddress is required" });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: "paymentMethod is required" });
  }

  // Start a MongoDB session for the transaction
  const session = await mongoose.startSession();

  try {
    session.startTransaction({
      readConcern: { level: "majority" },
      writeConcern: { w: "majority", j: true },
    });

    const orderItems = [];
    let totalAmount = 0;

    // ── Step 1 & 2: Check and decrement inventory for each item ──────────────
    for (const reqItem of items) {
      const { productId, sku, quantity } = reqItem;
      if (!productId || !sku || !quantity || quantity < 1) {
        throw Object.assign(new Error("Each item needs productId, sku and quantity >= 1"), {
          statusCode: 400,
        });
      }

      // Lock and read inventory inside the transaction session
      let inventory = await Inventory.findOne({ product: productId, variant: sku }).session(session);

      // Fallback 1: case-insensitive SKU match
      if (!inventory) {
        inventory = await Inventory.findOne({
          product: productId,
          variant: { $regex: new RegExp(`^${sku}$`, "i") },
        }).session(session);
        if (inventory) {
          console.log("Used case-insensitive fallback inventory for product:", productId, "sku:", sku);
        }
      }

      // Fallback 2: any inventory record for this product
      if (!inventory) {
        inventory = await Inventory.findOne({ product: productId }).session(session);
        if (inventory) {
          console.log("Used fallback inventory for product:", productId);
        }
      }

      if (!inventory) {
        throw Object.assign(
          new Error(`No inventory found for: ${productId}`),
          { statusCode: 404 }
        );
      }

      if (inventory.quantityAvailable < quantity) {
        throw Object.assign(
          new Error(
            `Insufficient stock for ${sku}: requested ${quantity}, available ${inventory.quantityAvailable}`
          ),
          { statusCode: 409 }
        );
      }

      // Atomic decrement — findOneAndUpdate is atomic within the transaction
      await Inventory.findOneAndUpdate(
        { _id: inventory._id, quantityAvailable: { $gte: quantity } },
        { $inc: { quantityAvailable: -quantity }, $set: { lastUpdated: new Date() } },
        { session, new: true, maxTimeMS: 5000 }
      );

      // Fetch product for snapshot data
      const product = await Product.findById(productId, { name: 1, seller: 1, images: 1, variants: 1 }, { session }).lean();
      if (!product) {
        throw Object.assign(new Error(`Product ${productId} not found`), { statusCode: 404 });
      }

      const variant = product.variants.find((v) => v.sku === sku);
      const unitPrice = variant?.price || 0;
      totalAmount += unitPrice * quantity;

      orderItems.push({
        product: productId,
        nameSnapshot: product.name,        // price/name snapshot for historical accuracy
        priceSnapshot: unitPrice,
        quantity,
        sku,
        imageSnapshot: product.images?.[0] || null,
        sellerId: product.seller?.toString(),
      });
    }

    // ── Step 3: Create Order document ────────────────────────────────────────
    const [order] = await Order.create(
      [
        {
          user: req.user.userId,
          items: orderItems.map(({ sellerId, ...item }) => item), // strip sellerId from document
          totalAmount: Math.round(totalAmount * 100) / 100,
          shippingAddress,
          paymentMethod,
          status: "placed",
          placedAt: new Date(),
          statusHistory: [{ status: "placed", changedAt: new Date() }],
        },
      ],
      { session }
    );

    // ── Step 4: Commit ────────────────────────────────────────────────────────
    await session.commitTransaction();

    // ── Post-commit: Redis updates (best-effort, non-blocking) ───────────────
    const month = currentMonth();
    const redisUpdates = [
      clearCart(req.user.userId),
      incrementBuyerLeaderboard(req.user.userId, totalAmount, month),
    ];

    // Credit each seller's leaderboard and trending score
    const sellerAmounts = {};
    for (const item of orderItems) {
      if (item.sellerId) {
        sellerAmounts[item.sellerId] =
          (sellerAmounts[item.sellerId] || 0) + item.priceSnapshot * item.quantity;
      }
      redisUpdates.push(incrementTrendingPurchase(item.product.toString(), item.quantity));
    }
    for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
      redisUpdates.push(incrementSellerLeaderboard(sellerId, amount, month));
    }

    await Promise.allSettled(redisUpdates);

    return res.status(201).json({ success: true, data: order });
  } catch (err) {
    // Abort rolls back ALL inventory decrements atomically
    await session.abortTransaction();

    const statusCode = err.statusCode || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ error: err.message });
    }
    next(err);
  } finally {
    // Always end the session to return it to the pool
    session.endSession();
  }
}

/**
 * @route GET /orders
 * Uses { user: 1, placedAt: -1 } compound index
 */
async function getMyOrders(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { user: req.user.userId };
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter, null, { maxTimeMS: 5000 })
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /orders/:id
 */
async function getOrder(req, res, next) {
  try {
    const order = await Order.findOne(
      { _id: req.params.id, user: req.user.userId },
      null,
      { maxTimeMS: 5000 }
    ).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PUT /orders/:id/status — admin/seller only
 */
async function updateOrderStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const validStatuses = ["placed", "confirmed", "shipped", "delivered", "cancelled", "returned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status,
        $push: { statusHistory: { status, changedAt: new Date(), note } },
      },
      { new: true, maxTimeMS: 5000 }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

async function getAllOrders(req, res, next) {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .sort({ placedAt: -1 })
      .lean();

    return res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeOrder, getMyOrders, getOrder, updateOrderStatus, getAllOrders };
