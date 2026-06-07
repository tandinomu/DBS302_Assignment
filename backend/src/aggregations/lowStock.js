const Inventory = require("../models/Inventory");

/**
 * Low Stock Alert
 *
 * Pipeline:
 *  $match  → inventory records where quantityAvailable < threshold
 *  $lookup → join Product for name and category
 *  $sort   → ascending by quantityAvailable (most urgent first)
 *
 * Uses { quantityAvailable: 1 } index for the initial $match.
 */
async function lowStockAlert(threshold = 10) {
  return Inventory.aggregate([
    {
      $match: {
        quantityAvailable: { $lt: threshold },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          {
            $project: {
              name: 1,
              basePrice: 1,
              isActive: 1,
              seller: 1,
              "ratings.average": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: { path: "$productInfo", preserveNullAndEmpty: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "productInfo.seller",
        foreignField: "_id",
        as: "sellerInfo",
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    {
      $unwind: { path: "$sellerInfo", preserveNullAndEmpty: true },
    },
    {
      $sort: { quantityAvailable: 1 },
    },
    {
      $project: {
        _id: 0,
        inventoryId: "$_id",
        productId: "$product",
        productName: "$productInfo.name",
        variant: 1,
        quantityAvailable: 1,
        quantityReserved: 1,
        reorderThreshold: 1,
        warehouse: 1,
        sellerName: "$sellerInfo.name",
        sellerEmail: "$sellerInfo.email",
        lastUpdated: 1,
        isProductActive: "$productInfo.isActive",
        urgency: {
          $switch: {
            branches: [
              { case: { $eq: ["$quantityAvailable", 0] }, then: "OUT_OF_STOCK" },
              { case: { $lte: ["$quantityAvailable", 3] }, then: "CRITICAL" },
              { case: { $lte: ["$quantityAvailable", 7] }, then: "LOW" },
            ],
            default: "WATCH",
          },
        },
      },
    },
  ]);
}

module.exports = { lowStockAlert };
