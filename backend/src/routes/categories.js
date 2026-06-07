const express = require("express");
const Category = require("../models/Category");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { parent } = req.query;
    const filter = { isActive: true };
    if (parent === "true") filter.parent = null;
    else if (parent) filter.parent = parent;
    const cats = await Category.find(filter).sort({ name: 1 }).lean();
    return res.json({ success: true, data: cats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
