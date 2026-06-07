const Product = require("../models/Product");
const {
  setCachedProduct,
  invalidateProductCache,
  incrementTrendingView,
  trackUniqueVisitor,
  addRecentlyViewed,
  getUniqueVisitorCount,
} = require("../services/cacheService");

/**
 * @route GET /products
 * Supports: category, minPrice, maxPrice, page, limit, sort, tags
 */
async function listProducts(req, res, next) {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sort = "-createdAt",
      tags,
      seller,
      featured,
    } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (seller) filter.seller = seller;
    if (featured === "true") filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
    }
    if (tags) {
      filter.tags = { $in: tags.split(",").map((t) => t.trim().toLowerCase()) };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter, null, { maxTimeMS: 5000 })
        .populate("category", "name slug")
        .populate("seller", "name")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter).maxTimeMS(5000),
    ]);

    return res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /products/search?q=
 * Uses MongoDB $text index on name, description, tags
 */
async function searchProducts(req, res, next) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { $text: { $search: q }, isActive: true };

    const [products, total] = await Promise.all([
      Product.find(filter, { score: { $meta: "textScore" } }, { maxTimeMS: 5000 })
        .populate("category", "name slug")
        .sort({ score: { $meta: "textScore" } })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter).maxTimeMS(5000),
    ]);

    return res.json({
      success: true,
      data: products,
      query: q,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /products/:id
 * Cache-aside middleware handles Redis. This handler runs on cache miss.
 */
async function getProduct(req, res, next) {
  try {
    const { id } = req.params;

    // If middleware already fetched from DB (cache miss path), it's on req.cachedProduct
    let product = req.cachedProduct;

    if (!product) {
      product = await Product.findById(id)
        .populate("category", "name slug")
        .populate("seller", "name email")
        .lean()
        .maxTimeMS(5000);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      await setCachedProduct(id, product);
    }

    // Track analytics — fire-and-forget, don't block response
    const visitorId = req.user?.userId || req.ip;
    Promise.allSettled([
      incrementTrendingView(id),
      trackUniqueVisitor(id, visitorId),
      req.user && addRecentlyViewed(req.user.userId, id),
      Product.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { maxTimeMS: 3000 }),
    ]);

    const uniqueVisitors = await getUniqueVisitorCount(id);

    return res.json({
      success: true,
      data: { ...product, uniqueVisitors },
      source: "db",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route POST /products
 */
async function createProduct(req, res, next) {
  try {
    const {
      name, description, basePrice, category, subcategory,
      tags, variants, attributes, images, isFeatured,
    } = req.body;

    const product = await Product.create({
      name,
      description,
      basePrice,
      category,
      subcategory,
      tags,
      variants,
      attributes,
      images,
      isFeatured,
      seller: req.user.userId,
    });

    return res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * @route PUT /products/:id
 */
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findById(id).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });

    const isOwner = product.seller.toString() === req.user.userId;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this product" });
    }

    const updated = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
      maxTimeMS: 5000,
    });

    // Invalidate cache immediately on update
    await invalidateProductCache(id);

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * @route DELETE /products/:id — soft delete
 */
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });

    const isOwner = product.seller.toString() === req.user.userId;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Product.findByIdAndUpdate(id, { isActive: false });
    await invalidateProductCache(id);

    return res.json({ success: true, message: "Product deactivated" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  searchProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
