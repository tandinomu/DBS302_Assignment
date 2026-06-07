const Product = require("../models/Product");
const {
  getCart,
  setCartItem,
  removeCartItem,
  clearCart,
  mergeGuestCart,
} = require("../services/cacheService");

function resolveIdentity(req) {
  if (req.user) return { id: req.user.userId, isGuest: false };
  const guestId = req.cookies?.guestId || req.headers["x-guest-id"];
  return { id: guestId, isGuest: true };
}

function isValidSku(sku) {
  return typeof sku === "string" && sku.trim() !== "" && !/^\d+$/.test(sku.trim());
}

/**
 * @route GET /cart
 */
async function getCartHandler(req, res, next) {
  try {
    const { id, isGuest } = resolveIdentity(req);
    if (!id) return res.json({ success: true, items: {}, total: 0 });

    const cartHash = await getCart(id, isGuest);
    if (!cartHash || Object.keys(cartHash).length === 0) {
      return res.json({ success: true, items: [], total: 0 });
    }

    // Enrich: look up current product prices
    const entries = Object.entries(cartHash);
    const productIds = [...new Set(entries.map(([field]) => field.split(":")[0]))];

    const products = await Product.find(
      { _id: { $in: productIds }, isActive: true },
      { name: 1, basePrice: 1, images: 1, variants: 1 }
    ).lean();

    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    let total = 0;
    const invalidItems = [];
    const items = entries.reduce((acc, [field, qty]) => {
      const [productId, sku] = field.split(":");
      if (!isValidSku(sku)) {
        invalidItems.push({ productId, sku });
        return acc;
      }
      const product = productMap[productId];
      const quantity = parseInt(qty, 10);
      const variant = product?.variants?.find((v) => v.sku === sku);
      const unitPrice = variant?.price || product?.basePrice || 0;
      total += unitPrice * quantity;

      acc.push({
        productId,
        sku,
        quantity,
        productName: product?.name || "Unknown",
        unitPrice,
        lineTotal: unitPrice * quantity,
        image: product?.images?.[0] || null,
        inStock: (variant?.stock || 0) >= quantity,
      });
      return acc;
    }, []);

    if (invalidItems.length > 0) {
      await Promise.all(invalidItems.map(({ productId, sku }) => removeCartItem(id, productId, sku, isGuest)));
    }

    return res.json({ success: true, items, total: Math.round(total * 100) / 100 });
  } catch (err) {
    next(err);
  }
}

/**
 * @route POST /cart/add
 */
async function addToCart(req, res, next) {
  try {
    const { productId, sku, quantity = 1 } = req.body;
    if (!productId || !sku) {
      return res.status(400).json({ error: "productId and sku are required" });
    }
    if (!isValidSku(sku)) {
      return res.status(400).json({ error: "Invalid SKU" });
    }

    const product = await Product.findOne(
      { _id: productId, isActive: true },
      { variants: 1 }
    ).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });

    const variant = product.variants.find((v) => v.sku === sku);
    if (!variant) return res.status(404).json({ error: "Variant not found" });
    if (variant.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock", available: variant.stock });
    }

    const { id, isGuest } = resolveIdentity(req);
    if (!id) return res.status(400).json({ error: "No user or guest ID" });

    const cartHash = await getCart(id, isGuest);
    const currentQty = parseInt(cartHash[`${productId}:${sku}`] || "0", 10);
    await setCartItem(id, productId, sku, currentQty + quantity, isGuest);

    return res.json({ success: true, message: "Item added to cart" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PUT /cart/update
 */
async function updateCartItem(req, res, next) {
  try {
    const { productId, sku, quantity } = req.body;
    if (!productId || !sku || quantity == null) {
      return res.status(400).json({ error: "productId, sku and quantity are required" });
    }
    if (!isValidSku(sku)) {
      return res.status(400).json({ error: "Invalid SKU" });
    }

    const { id, isGuest } = resolveIdentity(req);
    if (!id) return res.status(400).json({ error: "No user or guest ID" });

    await setCartItem(id, productId, sku, Math.max(0, parseInt(quantity, 10)), isGuest);
    return res.json({ success: true, message: "Cart updated" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /cart/item
 */
async function removeFromCart(req, res, next) {
  try {
    const { productId, sku } = req.body;
    const { id, isGuest } = resolveIdentity(req);
    await removeCartItem(id, productId, sku, isGuest);
    return res.json({ success: true, message: "Item removed" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /cart
 */
async function clearCartHandler(req, res, next) {
  try {
    const { id, isGuest } = resolveIdentity(req);
    await clearCart(id, isGuest);
    return res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route POST /cart/merge — merge guest cart into user cart on login
 */
async function mergeCart(req, res, next) {
  try {
    const { guestId } = req.body;
    if (!guestId) return res.status(400).json({ error: "guestId is required" });
    await mergeGuestCart(guestId, req.user.userId);
    return res.json({ success: true, message: "Cart merged" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCartHandler,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCartHandler,
  mergeCart,
};
