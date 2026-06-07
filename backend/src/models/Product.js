const mongoose = require("mongoose");
const { Schema } = mongoose;

// Variants EMBEDDED — always fetched with product for display/add-to-cart;
// never queried independently across products.
const VariantSchema = new Schema(
  {
    sku: { type: String, required: true },
    size: { type: String },
    color: { type: String },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
  },
  { _id: true }
);

// Ratings EMBEDDED — always displayed alongside product; count/average are
// derived fields updated via atomic $inc and never queried independently.
const RatingsSchema = new Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    basePrice: { type: Number, required: true, min: 0 },
    // category REFERENCED — managed as a separate entity with its own CRUD lifecycle
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: String, trim: true },
    tags: [{ type: String, lowercase: true, trim: true }],
    variants: [VariantSchema],
    // Mixed type for polymorphic product attributes:
    // Electronics: { ram: "16GB", storage: "512GB SSD", processor: "i7" }
    // Clothing:    { fabric: "cotton", care: "machine wash", fit: "slim" }
    // Books:       { author: "Jane Austen", isbn: "...", pages: 350 }
    // Using Schema.Types.Mixed avoids a rigid schema that cannot accommodate
    // the diverse attribute sets across categories.
    attributes: { type: Schema.Types.Mixed, default: {} },
    // seller REFERENCED — seller is a User with its own profile, orders, etc.
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    images: [{ type: String }],
    ratings: { type: RatingsSchema, default: () => ({}) },
    viewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index 1: Full-text search across name, description, tags
// Justification: $text queries require a text index; supports GET /products/search
ProductSchema.index(
  { name: "text", description: "text", tags: "text" },
  { weights: { name: 10, tags: 5, description: 1 }, name: "product_text_idx" }
);

// Index 2: Compound index for category-filtered, price-sorted listings
// Justification: the most common browse query — category filter + sort by price
// uses both fields, making this index cover the query without a collection scan
ProductSchema.index({ category: 1, basePrice: 1 }, { name: "category_price_idx" });

// Index 3: Seller lookup for dashboard
ProductSchema.index({ seller: 1, createdAt: -1 });

// Index 4: Featured/active product listing
ProductSchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });

module.exports = mongoose.model("Product", ProductSchema);
