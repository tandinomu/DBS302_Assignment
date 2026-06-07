const Order = require("../models/Order");

/**
 * Top-N Products by Revenue
 *
 * Pipeline:
 *  $match → filter delivered orders in date range
 *  $unwind → explode items array into individual documents
 *  $group  → aggregate revenue and quantity per product
 *  $sort   → descending by revenue
 *  $limit  → top N
 *  $lookup → join Product collection for name/category
 */
async function topProductsByRevenue(n = 10, startDate, endDate) {
  const matchStage = { status: "delivered" };
  if (startDate || endDate) {
    matchStage.placedAt = {};
    if (startDate) matchStage.placedAt.$gte = new Date(startDate);
    if (endDate) matchStage.placedAt.$lte = new Date(endDate);
  }

  return Order.aggregate([
    { $match: matchStage },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalRevenue: {
          $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] },
        },
        totalQuantitySold: { $sum: "$items.quantity" },
        orderCount: { $sum: 1 },
        productName: { $first: "$items.nameSnapshot" },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: n },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails",
        pipeline: [
          { $project: { name: 1, basePrice: 1, images: 1, ratings: 1 } },
        ],
      },
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmpty: true } },
    {
      $project: {
        productId: "$_id",
        _id: 0,
        productName: {
          $ifNull: ["$productDetails.name", "$productName"],
        },
        totalRevenue: { $round: ["$totalRevenue", 2] },
        totalQuantitySold: 1,
        orderCount: 1,
        averageRating: "$productDetails.ratings.average",
        basePrice: "$productDetails.basePrice",
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
}

/**
 * Top-N Products by Units Sold
 */
async function topProductsByUnits(n = 10) {
  return Order.aggregate([
    { $match: { status: { $in: ["delivered", "shipped", "confirmed"] } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalUnitsSold: { $sum: "$items.quantity" },
        productName: { $first: "$items.nameSnapshot" },
      },
    },
    { $sort: { totalUnitsSold: -1 } },
    { $limit: n },
    { $project: { productId: "$_id", _id: 0, productName: 1, totalUnitsSold: 1 } },
  ]);
}

module.exports = { topProductsByRevenue, topProductsByUnits };
