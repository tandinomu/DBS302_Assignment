const mongoose = require("mongoose");
const { Schema } = mongoose;

// Self-referencing parent for hierarchical category tree (e.g. Electronics → Laptops)
const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    description: { type: String, trim: true, maxlength: 500 },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parent: 1 });

module.exports = mongoose.model("Category", CategorySchema);
