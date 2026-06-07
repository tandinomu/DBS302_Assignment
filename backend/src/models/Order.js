const mongoose = require("mongoose");
const { Schema } = mongoose;

// Order items are EMBEDDED with price/name SNAPSHOTS.
// Rationale: product prices change over time; the order must preserve the exact
// price and name at the moment of purchase for legal and accounting accuracy.
// We store product ref purely for admin cross-linking — the snapshot is authoritative.
const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    nameSnapshot: { type: String, required: true },
    priceSnapshot: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    sku: { type: String },
    imageSnapshot: { type: String },
  },
  { _id: false }
);

// Shipping address EMBEDDED — it is a snapshot of the address chosen at checkout;
// the user may change their address later, this must remain unchanged.
const ShippingAddressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    // user REFERENCED — needed for profile-level queries like order history
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true, validate: (v) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled", "returned"],
      default: "placed",
    },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    paymentMethod: {
      type: String,
      enum: ["credit_card", "debit_card", "upi", "wallet", "cod"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    placedAt: { type: Date, default: Date.now },
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Index 5: Order history — user's orders sorted newest-first
// Justification: GET /orders always filters by user AND sorts by placedAt DESC;
// this compound index satisfies both in a single B-tree traversal
OrderSchema.index({ user: 1, placedAt: -1 }, { name: "user_order_history_idx" });

// Index for analytics aggregation pipeline ($match on status)
OrderSchema.index({ status: 1, placedAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
