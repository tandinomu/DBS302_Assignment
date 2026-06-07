const mongoose = require("mongoose");
const { Schema } = mongoose;

// Addresses are EMBEDDED — they are always fetched with the user and never
// queried independently, so embedding avoids a separate collection lookup.
const AddressSchema = new Schema(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    zip: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

// Payment preferences are EMBEDDED for the same reason as addresses.
const PaymentPreferenceSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["credit_card", "debit_card", "upi", "wallet", "cod"],
      required: true,
    },
    last4: { type: String, maxlength: 4 },
    cardBrand: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true, // index: 4 — unique index for fast login lookup
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "seller", "admin"],
      default: "customer",
    },
    addresses: [AddressSchema],
    paymentPreferences: [PaymentPreferenceSchema],
    // wishlist references Products — queried independently with $in, so reference
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index justification: fast O(1) lookup on login — queries always filter by email
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

module.exports = mongoose.model("User", UserSchema);
