const Product = require("../models/Product");
const Order = require("../models/Order");

/**
 * Views vs Purchases Analysis
 *
 * Compares product page view counts (stored in Product.viewCount) against
 * actual purchase quantities from delivered orders.
 * Calculates conversion rate = purchases / views.
 *
 * Uses $lookup to join aggregated order items back to products.
 */
async function viewsVsPurchasesAnalysis(limit = 20) {
  // Step 1: aggregate purchase counts from orders
  const purchaseData = await Order.aggregate([
    { $match: { status: { $in: ["delivered", "shipped", "confirmed"] } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalPurchases: { $sum: "$items.quantity" },
        totalRevenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] },
        },
      },
    },
  ]);

  const purchaseMap = {};
  purchaseData.forEach((p) => {
    purchaseMap[p._id.toString()] = {
      totalPurchases: p.totalPurchases,
      totalRevenue: p.totalRevenue,
    };
  });

  // Step 2: fetch product view counts
  const products = await Product.find(
    { isActive: true },
    { name: 1, viewCount: 1, "ratings.average": 1, basePrice: 1 }
  )
    .sort({ viewCount: -1 })
    .limit(limit)
    .lean();

  // Step 3: merge
  return products.map((p) => {
    const purchase = purchaseMap[p._id.toString()] || {
      totalPurchases: 0,
      totalRevenue: 0,
    };
    const conversionRate =
      p.viewCount > 0
        ? ((purchase.totalPurchases / p.viewCount) * 100).toFixed(2)
        : "0.00";

    return {
      productId: p._id,
      productName: p.name,
      viewCount: p.viewCount,
      totalPurchases: purchase.totalPurchases,
      totalRevenue: purchase.totalRevenue,
      conversionRate: parseFloat(conversionRate),
      averageRating: p.ratings?.average || 0,
      basePrice: p.basePrice,
    };
  });
}

module.exports = { viewsVsPurchasesAnalysis };
