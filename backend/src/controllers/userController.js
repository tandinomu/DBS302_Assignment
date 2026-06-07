const User = require("../models/User");
const Product = require("../models/Product");

/**
 * @route GET /users/me
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId, "-password", { maxTimeMS: 5000 }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PUT /users/me
 */
async function updateMe(req, res, next) {
  try {
    const { name, paymentPreferences } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (paymentPreferences) updates.paymentPreferences = paymentPreferences;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true, select: "-password", maxTimeMS: 5000 }
    ).lean();

    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * @route POST /users/me/addresses
 */
async function addAddress(req, res, next) {
  try {
    const { street, city, country, zip, isDefault } = req.body;
    if (!street || !city || !country || !zip) {
      return res.status(400).json({ error: "street, city, country and zip are required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $push: { addresses: { street, city, country, zip, isDefault: !!isDefault } } },
      { new: true, select: "addresses", maxTimeMS: 5000 }
    ).lean();

    return res.json({ success: true, data: user.addresses });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /users/me/wishlist
 */
async function getWishlist(req, res, next) {
  try {
    const user = await User.findById(req.user.userId, "wishlist", { maxTimeMS: 5000 })
      .populate("wishlist", "name basePrice images ratings isActive")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, data: user.wishlist });
  } catch (err) {
    next(err);
  }
}

/**
 * @route POST /users/me/wishlist/:productId
 */
async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId, "_id").lean();
    if (!product) return res.status(404).json({ error: "Product not found" });

    await User.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { wishlist: productId } }, // $addToSet prevents duplicates
      { maxTimeMS: 5000 }
    );
    return res.json({ success: true, message: "Added to wishlist" });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /users/me/wishlist/:productId
 */
async function removeFromWishlist(req, res, next) {
  try {
    await User.findByIdAndUpdate(
      req.user.userId,
      { $pull: { wishlist: req.params.productId } },
      { maxTimeMS: 5000 }
    );
    return res.json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  addAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
