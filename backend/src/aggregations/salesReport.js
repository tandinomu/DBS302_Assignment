const Order = require("../models/Order");

/**
 * Monthly Sales Report
 * Groups delivered orders by year-month, sums revenue and counts orders.
 * Uses the { status: 1, placedAt: -1 } compound index for the initial $match.
 */
async function monthlySalesReport(year) {
  const startDate = year
    ? new Date(`${year}-01-01T00:00:00.000Z`)
    : new Date(new Date().getFullYear() - 1, 0, 1);
  const endDate = year
    ? new Date(`${year}-12-31T23:59:59.999Z`)
    : new Date();

  return Order.aggregate([
    {
      $match: {
        status: { $in: ["delivered", "shipped", "confirmed", "placed"] },
        placedAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$placedAt" },
          month: { $month: "$placedAt" },
        },
        totalRevenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: "$totalAmount" },
        minOrderValue: { $min: "$totalAmount" },
        maxOrderValue: { $max: "$totalAmount" },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        period: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: {
                if: { $lt: ["$_id.month", 10] },
                then: { $concat: ["0", { $toString: "$_id.month" }] },
                else: { $toString: "$_id.month" },
              },
            },
          ],
        },
        totalRevenue: { $round: ["$totalRevenue", 2] },
        orderCount: 1,
        averageOrderValue: { $round: ["$averageOrderValue", 2] },
        minOrderValue: { $round: ["$minOrderValue", 2] },
        maxOrderValue: { $round: ["$maxOrderValue", 2] },
      },
    },
  ]);
}

/**
 * Daily Sales Report for a given month
 */
async function dailySalesReport(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return Order.aggregate([
    {
      $match: {
        status: { $in: ["delivered", "shipped", "confirmed", "placed"] },
        placedAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: "$placedAt" },
        totalRevenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        day: "$_id",
        totalRevenue: { $round: ["$totalRevenue", 2] },
        orderCount: 1,
      },
    },
  ]);
}

module.exports = { monthlySalesReport, dailySalesReport };
