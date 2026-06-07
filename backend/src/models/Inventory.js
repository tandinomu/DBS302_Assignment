const mongoose = require("mongoose");
const { Schema } = mongoose;

// Inventory is a SEPARATE COLLECTION from Product.
// Justification: inventory must be updated atomically inside ACID transactions
// (decrement stock as part of order placement). Isolating it in its own collection
// allows row-level locks per product/variant without locking the entire product
// document, reducing contention in high-concurrency scenarios.
const InventorySchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // variant identifies which SKU this record tracks
    variant: { type: String, required: true },
    quantityAvailable: { type: Number, required: true, min: 0, default: 0 },
    // quantityReserved: items in carts/pending orders, not yet fulfilled
    quantityReserved: { type: Number, default: 0, min: 0 },
    warehouse: { type: String, default: "main" },
    reorderThreshold: { type: Number, default: 10 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index 7: Stock lookup during order placement
// Justification: the ACID transaction does findOneAndUpdate({ product, variant })
// on every order item; this index turns that into an O(log n) index scan
InventorySchema.index(
  { product: 1, variant: 1 },
  { unique: true, name: "product_variant_stock_idx" }
);

// Index for low-stock alert aggregation pipeline
InventorySchema.index({ quantityAvailable: 1 });

module.exports = mongoose.model("Inventory", InventorySchema);
