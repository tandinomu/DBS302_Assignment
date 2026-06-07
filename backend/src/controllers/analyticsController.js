const { monthlySalesReport, dailySalesReport } = require("../aggregations/salesReport");
const { topProductsByRevenue, topProductsByUnits } = require("../aggregations/topProducts");
const { lowStockAlert } = require("../aggregations/lowStock");
const { viewsVsPurchasesAnalysis } = require("../aggregations/viewsVsPurchases");
const {
  getTrendingProducts,
  getSellerLeaderboard,
  getBuyerLeaderboard,
  getUniqueVisitorCount,
  getCacheStats,
} = require("../services/cacheService");
const Product = require("../models/Product");

/**
 * @route GET /analytics/sales
 */
async function salesReport(req, res, next) {
  try {
    const { period = "monthly", year, month } = req.query;
    let data;
    if (period === "daily" && year && month) {
      data = await dailySalesReport(parseInt(year), parseInt(month));
    } else {
      data = await monthlySalesReport(year ? parseInt(year) : null);
    }
    return res.json({ success: true, period, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/top-products
 */
async function topProducts(req, res, next) {
  try {
    const { n = 10, metric = "revenue", startDate, endDate } = req.query;
    let data;
    if (metric === "units") {
      data = await topProductsByUnits(parseInt(n));
    } else {
      data = await topProductsByRevenue(parseInt(n), startDate, endDate);
    }
    return res.json({ success: true, metric, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/low-stock
 */
async function lowStock(req, res, next) {
  try {
    const { threshold = 10 } = req.query;
    const data = await lowStockAlert(parseInt(threshold));
    return res.json({ success: true, threshold: parseInt(threshold), count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/views-vs-purchases
 */
async function viewsVsPurchases(req, res, next) {
  try {
    const { limit = 20 } = req.query;
    const data = await viewsVsPurchasesAnalysis(parseInt(limit));
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/trending
 * Reads from Redis sorted set, enriches with product names from MongoDB
 */
async function trending(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const raw = await getTrendingProducts(parseInt(limit));

    // raw = [productId, score, productId, score, ...]
    const enriched = [];
    for (let i = 0; i < raw.length; i += 2) {
      enriched.push({ productId: raw[i], score: parseFloat(raw[i + 1]) });
    }

    const ids = enriched.map((e) => e.productId);
    const products = await Product.find(
      { _id: { $in: ids } },
      { name: 1, basePrice: 1, images: 1, "ratings.average": 1 }
    ).lean();

    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    const result = enriched.map((e, idx) => ({
      rank: idx + 1,
      productId: e.productId,
      score: e.score,
      name: productMap[e.productId]?.name || "Unknown",
      basePrice: productMap[e.productId]?.basePrice,
      rating: productMap[e.productId]?.ratings?.average,
      image: productMap[e.productId]?.images?.[0],
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/leaderboard/sellers
 */
async function sellerLeaderboard(req, res, next) {
  try {
    const { month, limit = 10 } = req.query;
    const { getTopSellers } = require("../services/leaderboardService");
    const data = await getTopSellers(month, parseInt(limit));
    return res.json({ success: true, month: month || "current", data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/leaderboard/buyers
 */
async function buyerLeaderboard(req, res, next) {
  try {
    const { month, limit = 10 } = req.query;
    const { getTopBuyers } = require("../services/leaderboardService");
    const data = await getTopBuyers(month, parseInt(limit));
    return res.json({ success: true, month: month || "current", data });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/unique-visitors/:productId
 */
async function uniqueVisitors(req, res, next) {
  try {
    const { productId } = req.params;
    const count = await getUniqueVisitorCount(productId);
    return res.json({ success: true, productId, uniqueVisitors: count });
  } catch (err) {
    next(err);
  }
}

/**
 * @route GET /analytics/cache-stats
 */
async function cacheStats(req, res, next) {
  try {
    const stats = await getCacheStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  salesReport,
  topProducts,
  lowStock,
  viewsVsPurchases,
  trending,
  sellerLeaderboard,
  buyerLeaderboard,
  uniqueVisitors,
  cacheStats,
};
