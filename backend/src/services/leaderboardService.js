const {
  incrementSellerLeaderboard,
  incrementBuyerLeaderboard,
  getSellerLeaderboard,
  getBuyerLeaderboard,
} = require("./cacheService");
const User = require("../models/User");

// Record a completed order in both seller and buyer leaderboards
async function recordOrderForLeaderboards(order, items, month) {
  const promises = [];

  // Buyer leaderboard
  promises.push(incrementBuyerLeaderboard(order.user.toString(), order.totalAmount, month));

  // Seller leaderboard — credit each seller proportionally
  const sellerAmounts = {};
  for (const item of items) {
    // items should include seller info; if not, skip seller tracking
    if (item.sellerId) {
      sellerAmounts[item.sellerId] =
        (sellerAmounts[item.sellerId] || 0) + item.priceSnapshot * item.quantity;
    }
  }
  for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
    promises.push(incrementSellerLeaderboard(sellerId, amount, month));
  }

  await Promise.allSettled(promises);
}

// Enrich leaderboard entries with user names from MongoDB
async function enrichLeaderboard(rawEntries, role) {
  // rawEntries from ZREVRANGE WITHSCORES: [id, score, id, score, ...]
  const enriched = [];
  for (let i = 0; i < rawEntries.length; i += 2) {
    const userId = rawEntries[i];
    const score = parseFloat(rawEntries[i + 1]);
    enriched.push({ userId, score, rank: enriched.length + 1 });
  }

  const ids = enriched.map((e) => e.userId);
  try {
    const users = await User.find(
      { _id: { $in: ids } },
      { name: 1, email: 1 }
    ).lean();
    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u; });
    return enriched.map((e) => ({
      ...e,
      name: userMap[e.userId]?.name || "Unknown",
      email: userMap[e.userId]?.email || "",
    }));
  } catch {
    return enriched;
  }
}

async function getTopSellers(month, limit = 10) {
  const raw = await getSellerLeaderboard(month, limit);
  return enrichLeaderboard(raw, "seller");
}

async function getTopBuyers(month, limit = 10) {
  const raw = await getBuyerLeaderboard(month, limit);
  return enrichLeaderboard(raw, "buyer");
}

module.exports = { recordOrderForLeaderboards, getTopSellers, getTopBuyers };
