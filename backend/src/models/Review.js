const mongoose = require("mongoose");
const { Schema } = mongoose;

// Reviews are a SEPARATE COLLECTION (reference pattern).
// Justification: reviews grow unboundedly — a popular product can have thousands.
// Embedding them in Product would cause documents to exceed MongoDB's 16MB limit
// and make every product read expensive. Keeping them separate allows independent
// pagination and index-driven retrieval.
const ReviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 },
    helpful: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index 6: Paginated reviews per product, newest-first
// Justification: every product detail page loads reviews with product filter + date sort;
// this compound index avoids a full collection scan for each request
ReviewSchema.index({ product: 1, createdAt: -1 }, { name: "product_reviews_idx" });

// Prevent a user from reviewing the same product twice
ReviewSchema.index({ product: 1, user: 1 }, { unique: true, name: "one_review_per_user" });

module.exports = mongoose.model("Review", ReviewSchema);
