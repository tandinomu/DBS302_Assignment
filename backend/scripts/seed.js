require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { getRedisClient } = require("../src/config/redis");

const User = require("../src/models/User");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Review = require("../src/models/Review");
const Inventory = require("../src/models/Inventory");

const SALT_ROUNDS = 12;
const PASSWORD_HASH = bcrypt.hashSync("Password123!", SALT_ROUNDS);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

const lorem = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://admin:adminpass@localhost:27017/shopnest?replicaSet=rs0&authSource=admin";
  await mongoose.connect(uri, { readConcernLevel: "majority", writeConcern: { w: "majority" } });
  console.log("Connected to MongoDB");

  const redis = getRedisClient();

  // ── Clean slate ──────────────────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Inventory.deleteMany({}),
  ]);
  console.log("Cleared existing data");

  // ── Users ─────────────────────────────────────────────────────────────────────
  const users = await User.insertMany([
    { name: "Admin User",      email: "admin@shopnest.com",   password: PASSWORD_HASH, role: "admin"    },
    { name: "Seller Alice",    email: "alice@shopnest.com",   password: PASSWORD_HASH, role: "seller"   },
    { name: "Seller Bob",      email: "bob@shopnest.com",     password: PASSWORD_HASH, role: "seller"   },
    { name: "Customer Carol",  email: "carol@shopnest.com",   password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Dave",   email: "dave@shopnest.com",    password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Eve",    email: "eve@shopnest.com",     password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Frank",  email: "frank@shopnest.com",   password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Grace",  email: "grace@shopnest.com",   password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Hank",   email: "hank@shopnest.com",    password: PASSWORD_HASH, role: "customer" },
    { name: "Customer Iris",   email: "iris@shopnest.com",    password: PASSWORD_HASH, role: "customer" },
  ]);
  const [admin, sellerAlice, sellerBob, ...customers] = users;
  console.log(`Created ${users.length} users`);

  // ── Categories (hierarchical) ─────────────────────────────────────────────────
  const catElec = await Category.create({ name: "Electronics", slug: "electronics", description: "Electronic devices and accessories" });
  const catCloth = await Category.create({ name: "Clothing", slug: "clothing", description: "Fashion and apparel" });
  const catBooks = await Category.create({ name: "Books", slug: "books", description: "Books and literature" });
  const catHome = await Category.create({ name: "Home & Garden", slug: "home-garden", description: "Home improvement and decor" });
  const catSports = await Category.create({ name: "Sports", slug: "sports", description: "Sports and fitness equipment" });

  // Subcategories
  await Category.insertMany([
    { name: "Laptops",       slug: "laptops",       parent: catElec._id },
    { name: "Smartphones",   slug: "smartphones",   parent: catElec._id },
    { name: "Headphones",    slug: "headphones",    parent: catElec._id },
    { name: "Men's Wear",    slug: "mens-wear",     parent: catCloth._id },
    { name: "Women's Wear",  slug: "womens-wear",   parent: catCloth._id },
    { name: "Fiction",       slug: "fiction",       parent: catBooks._id },
    { name: "Non-Fiction",   slug: "non-fiction",   parent: catBooks._id },
    { name: "Furniture",     slug: "furniture",     parent: catHome._id },
    { name: "Gym Equipment", slug: "gym-equipment", parent: catSports._id },
    { name: "Outdoor",       slug: "outdoor",       parent: catSports._id },
  ]);

  const categories = [catElec, catCloth, catBooks, catHome, catSports];
  console.log(`Created ${categories.length} parent categories + 10 subcategories`);

  // ── Products (50) ────────────────────────────────────────────────────────────
  const productDefs = [
    // Electronics (15)
    { name: "ProBook X1 Laptop",        cat: catElec, subcat: "laptops",     price: 1299, tags: ["laptop","ultrabook","portable"], attrs: { ram: "16GB", storage: "512GB SSD", processor: "Intel Core i7-1355U", display: "14 inch FHD", battery: "12h" }, seller: sellerAlice },
    { name: "DevBook Pro 16",           cat: catElec, subcat: "laptops",     price: 1899, tags: ["laptop","developer","performance"], attrs: { ram: "32GB", storage: "1TB NVMe", processor: "AMD Ryzen 9 7940H", display: "16 inch 4K", battery: "10h" }, seller: sellerAlice },
    { name: "BudgetBook Lite",          cat: catElec, subcat: "laptops",     price: 499,  tags: ["laptop","budget","student"], attrs: { ram: "8GB", storage: "256GB SSD", processor: "Intel Celeron N5100", display: "15.6 inch HD", battery: "8h" }, seller: sellerBob },
    { name: "Galaxy Z Phone",           cat: catElec, subcat: "smartphones", price: 899,  tags: ["smartphone","android","5g"], attrs: { ram: "12GB", storage: "256GB", camera: "108MP", battery: "5000mAh", display: "6.7 inch AMOLED" }, seller: sellerAlice },
    { name: "iPhone Ultra 15",          cat: catElec, subcat: "smartphones", price: 1199, tags: ["smartphone","ios","premium"], attrs: { ram: "8GB", storage: "512GB", camera: "200MP ProRAW", battery: "4200mAh", display: "6.1 inch Super Retina" }, seller: sellerBob },
    { name: "Pixel Perfect 8",          cat: catElec, subcat: "smartphones", price: 699,  tags: ["smartphone","android","camera"], attrs: { ram: "8GB", storage: "128GB", camera: "50MP", battery: "4575mAh", display: "6.2 inch OLED" }, seller: sellerAlice },
    { name: "SoundBlast Pro Headphones",cat: catElec, subcat: "headphones",  price: 349,  tags: ["headphones","noise-cancelling","wireless"], attrs: { driverSize: "40mm", frequency: "20Hz-20kHz", battery: "30h ANC", connectivity: "Bluetooth 5.3", weight: "250g" }, seller: sellerBob },
    { name: "BassDrops Studio Cans",    cat: catElec, subcat: "headphones",  price: 199,  tags: ["headphones","studio","wired"], attrs: { driverSize: "50mm", frequency: "5Hz-38kHz", impedance: "38 Ohm", connectivity: "3.5mm + 6.3mm adapter", weight: "310g" }, seller: sellerAlice },
    { name: "EarBud Lite Wireless",     cat: catElec, subcat: "headphones",  price: 79,   tags: ["earbuds","wireless","sport"], attrs: { battery: "8h + 32h case", connectivity: "Bluetooth 5.2", waterproof: "IPX5", weight: "5g each" }, seller: sellerBob },
    { name: "UltraTab 12 Pro",          cat: catElec, subcat: "tablets",     price: 749,  tags: ["tablet","productivity","drawing"], attrs: { ram: "12GB", storage: "256GB", display: "12.4 inch 120Hz", battery: "10090mAh", stylus: "included" }, seller: sellerAlice },
    { name: "SmartWatch Series 9",      cat: catElec, subcat: "wearables",   price: 449,  tags: ["smartwatch","health","fitness"], attrs: { display: "1.9 inch Always-On", battery: "18h", sensors: "ECG,SpO2,GPS", waterproof: "50m", os: "WatchOS" }, seller: sellerBob },
    { name: "Mechanical Gaming KB",     cat: catElec, subcat: "accessories", price: 149,  tags: ["keyboard","gaming","mechanical"], attrs: { switches: "Cherry MX Red", backlight: "RGB", layout: "TKL", connectivity: "USB-C + Wireless" }, seller: sellerAlice },
    { name: "4K Webcam ProStream",      cat: catElec, subcat: "accessories", price: 199,  tags: ["webcam","streaming","4k"], attrs: { resolution: "4K 30fps", fov: "90°", autofocus: "AI-powered", microphone: "dual noise-cancelling" }, seller: sellerBob },
    { name: "NVMe SSD 2TB",             cat: catElec, subcat: "storage",     price: 129,  tags: ["ssd","storage","fast"], attrs: { interface: "PCIe 4.0 x4", readSpeed: "7000MB/s", writeSpeed: "6500MB/s", formFactor: "M.2 2280" }, seller: sellerAlice },
    { name: "Portable Power Bank 30K",  cat: catElec, subcat: "accessories", price: 59,   tags: ["powerbank","portable","charging"], attrs: { capacity: "30000mAh", ports: "USB-C 65W PD + 2x USB-A", weight: "580g", fastCharge: "65W" }, seller: sellerBob },

    // Clothing (10)
    { name: "Classic Cotton T-Shirt",   cat: catCloth, subcat: "mens-wear",   price: 29,  tags: ["tshirt","casual","cotton"], attrs: { fabric: "100% Organic Cotton", fit: "regular", care: "machine wash cold", origin: "India" }, seller: sellerAlice },
    { name: "Slim Chino Pants",         cat: catCloth, subcat: "mens-wear",   price: 59,  tags: ["pants","casual","slim"], attrs: { fabric: "98% Cotton 2% Elastane", fit: "slim", care: "machine wash warm", closure: "zip fly" }, seller: sellerBob },
    { name: "Floral Summer Dress",      cat: catCloth, subcat: "womens-wear", price: 49,  tags: ["dress","summer","floral"], attrs: { fabric: "100% Viscose", fit: "A-line", care: "hand wash", length: "midi" }, seller: sellerAlice },
    { name: "Denim Jacket Vintage",     cat: catCloth, subcat: "mens-wear",   price: 89,  tags: ["jacket","denim","vintage"], attrs: { fabric: "100% Denim Cotton", fit: "oversized", care: "machine wash cold", pockets: "4" }, seller: sellerBob },
    { name: "Yoga Leggings Pro",        cat: catCloth, subcat: "womens-wear", price: 45,  tags: ["leggings","yoga","activewear"], attrs: { fabric: "87% Nylon 13% Spandex", fit: "compression", care: "machine wash cold", waistband: "high-rise" }, seller: sellerAlice },
    { name: "Woolen Sweater Knit",      cat: catCloth, subcat: "mens-wear",   price: 79,  tags: ["sweater","winter","wool"], attrs: { fabric: "80% Merino Wool 20% Polyester", fit: "regular", care: "dry clean", thickness: "heavy" }, seller: sellerBob },
    { name: "Linen Blazer Formal",      cat: catCloth, subcat: "mens-wear",   price: 149, tags: ["blazer","formal","linen"], attrs: { fabric: "55% Linen 45% Cotton", fit: "slim", care: "dry clean", buttons: "2" }, seller: sellerAlice },
    { name: "Running Shorts Dry-Fit",   cat: catCloth, subcat: "mens-wear",   price: 35,  tags: ["shorts","running","dryfit"], attrs: { fabric: "100% Polyester DryFit", fit: "athletic", care: "machine wash cold", pockets: "zip pocket" }, seller: sellerBob },
    { name: "Silk Evening Blouse",      cat: catCloth, subcat: "womens-wear", price: 95,  tags: ["blouse","silk","evening"], attrs: { fabric: "100% Pure Silk", fit: "relaxed", care: "hand wash only", neckline: "V-neck" }, seller: sellerAlice },
    { name: "Waterproof Hiking Jacket", cat: catCloth, subcat: "mens-wear",   price: 179, tags: ["jacket","hiking","waterproof"], attrs: { fabric: "Gore-Tex 3L", fit: "regular", waterproof: "20000mm", breathability: "10000 MVP" }, seller: sellerBob },

    // Books (10)
    { name: "The Algorithm Mindset",    cat: catBooks, subcat: "non-fiction", price: 24, tags: ["programming","algorithms","cs"], attrs: { author: "Robert Chen", isbn: "978-0-13-110362-7", pages: 452, publisher: "TechPress", year: 2023 }, seller: sellerAlice },
    { name: "MongoDB: The Definitive Guide", cat: catBooks, subcat: "non-fiction", price: 49, tags: ["mongodb","database","nosql"], attrs: { author: "Shannon Bradshaw", isbn: "978-1-491-95446-1", pages: 514, publisher: "O'Reilly", year: 2019 }, seller: sellerBob },
    { name: "Redis in Action",          cat: catBooks, subcat: "non-fiction", price: 44, tags: ["redis","cache","database"], attrs: { author: "Josiah L. Carlson", isbn: "978-1-617-29009-9", pages: 320, publisher: "Manning", year: 2013 }, seller: sellerAlice },
    { name: "Clean Architecture",       cat: catBooks, subcat: "non-fiction", price: 39, tags: ["software","architecture","design"], attrs: { author: "Robert C. Martin", isbn: "978-0-13-468599-1", pages: 432, publisher: "Prentice Hall", year: 2018 }, seller: sellerBob },
    { name: "The Midnight Library",     cat: catBooks, subcat: "fiction",     price: 18, tags: ["fiction","contemporary","bestseller"], attrs: { author: "Matt Haig", isbn: "978-0-525-55947-4", pages: 304, publisher: "Viking", year: 2020 }, seller: sellerAlice },
    { name: "Dune: Part One",           cat: catBooks, subcat: "fiction",     price: 22, tags: ["scifi","epic","fantasy"], attrs: { author: "Frank Herbert", isbn: "978-0-441-01359-7", pages: 896, publisher: "Ace Books", year: 1965 }, seller: sellerBob },
    { name: "Atomic Habits",            cat: catBooks, subcat: "non-fiction", price: 27, tags: ["self-help","productivity","habits"], attrs: { author: "James Clear", isbn: "978-0-735-21129-2", pages: 320, publisher: "Avery", year: 2018 }, seller: sellerAlice },
    { name: "Project Hail Mary",        cat: catBooks, subcat: "fiction",     price: 20, tags: ["scifi","space","adventure"], attrs: { author: "Andy Weir", isbn: "978-0-593-13520-4", pages: 476, publisher: "Ballantine Books", year: 2021 }, seller: sellerBob },
    { name: "Deep Work",                cat: catBooks, subcat: "non-fiction", price: 25, tags: ["productivity","focus","work"], attrs: { author: "Cal Newport", isbn: "978-1-455-58669-1", pages: 304, publisher: "Grand Central Publishing", year: 2016 }, seller: sellerAlice },
    { name: "Sapiens",                  cat: catBooks, subcat: "non-fiction", price: 22, tags: ["history","humanity","anthropology"], attrs: { author: "Yuval Noah Harari", isbn: "978-0-062-31609-7", pages: 443, publisher: "Harper", year: 2015 }, seller: sellerBob },

    // Home (8)
    { name: "Ergonomic Office Chair",   cat: catHome, subcat: "furniture",   price: 499, tags: ["chair","office","ergonomic"], attrs: { material: "Mesh back, foam seat", adjustment: "height,armrest,lumbar", weightCapacity: "120kg", warranty: "5 years" }, seller: sellerAlice },
    { name: "Standing Desk 140cm",      cat: catHome, subcat: "furniture",   price: 699, tags: ["desk","standing","electric"], attrs: { material: "Bamboo top + steel frame", heightRange: "70-115cm", motor: "dual motor quiet", maxLoad: "80kg" }, seller: sellerBob },
    { name: "Air Purifier HEPA-13",     cat: catHome, subcat: "appliances",  price: 299, tags: ["airpurifier","hepa","health"], attrs: { coverage: "50 sqm", filter: "True HEPA-13 + Activated Carbon", noiseLevel: "24dB", acdr: "300 m³/h" }, seller: sellerAlice },
    { name: "Robot Vacuum Cleaner",     cat: catHome, subcat: "appliances",  price: 399, tags: ["vacuum","robot","smart"], attrs: { suction: "3000Pa", battery: "180 min runtime", mapping: "LiDAR", mop: "yes" }, seller: sellerBob },
    { name: "Bamboo Bookshelf 5-Tier",  cat: catHome, subcat: "furniture",   price: 149, tags: ["bookshelf","bamboo","storage"], attrs: { material: "Natural Bamboo", dimensions: "80x30x175cm", tiers: 5, weightPerShelf: "30kg" }, seller: sellerAlice },
    { name: "LED Desk Lamp Smart",      cat: catHome, subcat: "lighting",    price: 79,  tags: ["lamp","led","smart"], attrs: { brightness: "500 lumens", colorTemp: "2700K-6500K", control: "touch + app", wireless: "Qi 10W charging base" }, seller: sellerBob },
    { name: "Non-Stick Cookware Set",   cat: catHome, subcat: "kitchen",     price: 199, tags: ["cookware","kitchen","non-stick"], attrs: { pieces: 12, material: "Anodized Aluminum with Ceramic Coating", ovenSafe: "230°C", dishwasherSafe: true }, seller: sellerAlice },
    { name: "Espresso Machine Pro",     cat: catHome, subcat: "kitchen",     price: 599, tags: ["coffee","espresso","premium"], attrs: { pressure: "15 bar", boiler: "dual thermoblock", grinder: "built-in conical burr", capacity: "2L water tank" }, seller: sellerBob },

    // Sports (7)
    { name: "Adjustable Dumbbells Set", cat: catSports, subcat: "gym-equipment", price: 299, tags: ["dumbbells","gym","strength"], attrs: { weightRange: "5-52.5 lbs per dumbbell", adjustment: "dial system", material: "Cast iron + ABS", plates: 15 }, seller: sellerAlice },
    { name: "Yoga Mat Premium",         cat: catSports, subcat: "gym-equipment", price: 79,  tags: ["yoga","mat","fitness"], attrs: { material: "Natural Tree Rubber", thickness: "6mm", size: "183x68cm", grip: "double-sided non-slip" }, seller: sellerBob },
    { name: "Pull-Up Bar Doorway",      cat: catSports, subcat: "gym-equipment", price: 49,  tags: ["pullup","bar","bodyweight"], attrs: { maxWeight: "150kg", installation: "no screws", widthRange: "60-100cm", material: "Steel" }, seller: sellerAlice },
    { name: "Road Bike Carbon Frame",   cat: catSports, subcat: "outdoor",       price: 1599, tags: ["bike","road","carbon"], attrs: { frameSize: "S/M/L", gears: "2x11 Shimano 105", weight: "8.1kg", material: "Carbon Fiber T800" }, seller: sellerBob },
    { name: "Trail Running Shoes",      cat: catSports, subcat: "outdoor",       price: 149, tags: ["shoes","trail","running"], attrs: { upperMaterial: "Engineered mesh", sole: "Vibram Megagrip", drop: "6mm", weight: "280g" }, seller: sellerAlice },
    { name: "Resistance Bands 5-Pack",  cat: catSports, subcat: "gym-equipment", price: 29,  tags: ["bands","resistance","stretching"], attrs: { levels: "10/20/30/40/50 lbs", material: "Natural Latex", length: "120cm", accessories: "door anchor + handles" }, seller: sellerBob },
    { name: "Foam Roller Deep Tissue",  cat: catSports, subcat: "gym-equipment", price: 39,  tags: ["foamroller","recovery","massage"], attrs: { material: "EPP Foam", length: "45cm", density: "high-density grid", diameter: "15cm" }, seller: sellerAlice },
  ];

  const products = [];
  for (const def of productDefs) {
    const colors = ["Black", "White", "Blue", "Red", "Green"];
    const sizes = ["XS", "S", "M", "L", "XL"];
    let variants;

    if (def.cat._id.equals(catCloth._id)) {
      variants = sizes.slice(0, 4).map((size) => ({
        sku: `${def.name.replace(/\s+/g, "-").slice(0, 8).toUpperCase()}-${size}`,
        size,
        color: pick(colors),
        price: def.price,
        stock: randInt(5, 60),
      }));
    } else if (def.cat._id.equals(catElec._id) || def.cat._id.equals(catSports._id)) {
      variants = [
        { sku: `${def.name.replace(/\s+/g, "-").slice(0, 8).toUpperCase()}-STD`, color: "Black", price: def.price, stock: randInt(10, 100) },
        { sku: `${def.name.replace(/\s+/g, "-").slice(0, 8).toUpperCase()}-WHT`, color: "White", price: def.price + randInt(10, 30), stock: randInt(5, 40) },
      ];
    } else {
      variants = [
        { sku: `${def.name.replace(/\s+/g, "-").slice(0, 8).toUpperCase()}-DEF`, price: def.price, stock: randInt(15, 80) },
      ];
    }

    const p = await Product.create({
      name: def.name,
      description: `${def.name} — ${lorem.slice(0, 180)}`,
      basePrice: def.price,
      category: def.cat._id,
      subcategory: def.subcat,
      tags: def.tags,
      variants,
      attributes: def.attrs,
      seller: def.seller._id,
      images: [`https://picsum.photos/seed/${def.name.replace(/\s+/g, "-").toLowerCase()}/600/600`],
      isFeatured: Math.random() > 0.7,
      ratings: { average: randFloat(3.5, 5.0), count: randInt(10, 500) },
      viewCount: randInt(100, 10000),
    });
    products.push(p);

    // Create inventory records per variant
    for (const v of variants) {
      await Inventory.create({
        product: p._id,
        variant: v.sku,
        quantityAvailable: v.stock,
        quantityReserved: randInt(0, 5),
        warehouse: pick(["main", "west", "east"]),
        reorderThreshold: 10,
      });
    }
  }
  console.log(`Created ${products.length} products with inventory records`);

  // ── Orders (20) ─────────────────────────────────────────────────────────────
  const statuses = ["placed", "confirmed", "shipped", "delivered", "delivered", "delivered", "cancelled"];
  const paymentMethods = ["credit_card", "debit_card", "upi", "wallet", "cod"];

  const orders = [];
  for (let i = 0; i < 20; i++) {
    const customer = pick(customers);
    const numItems = randInt(1, 3);
    const itemProducts = [];
    for (let j = 0; j < numItems; j++) {
      itemProducts.push(pick(products));
    }

    const items = itemProducts.map((p) => {
      const variant = pick(p.variants);
      const qty = randInt(1, 3);
      return {
        product: p._id,
        nameSnapshot: p.name,
        priceSnapshot: variant.price,
        quantity: qty,
        sku: variant.sku,
        imageSnapshot: p.images[0],
      };
    });

    const total = items.reduce((sum, it) => sum + it.priceSnapshot * it.quantity, 0);
    const status = pick(statuses);
    const daysAgo = randInt(1, 180);
    const placedAt = new Date(Date.now() - daysAgo * 86400000);

    const order = await Order.create({
      user: customer._id,
      items,
      totalAmount: Math.round(total * 100) / 100,
      status,
      shippingAddress: { street: `${randInt(1, 999)} Main St`, city: "Thimphu", country: "Bhutan", zip: "11001" },
      paymentMethod: pick(paymentMethods),
      paymentStatus: status === "delivered" ? "paid" : status === "cancelled" ? "refunded" : "pending",
      placedAt,
      statusHistory: [{ status: "placed", changedAt: placedAt }],
    });
    orders.push(order);
  }
  console.log(`Created ${orders.length} orders`);

  // ── Reviews (30+) ──────────────────────────────────────────────────────────
  const reviewComments = [
    "Excellent product, exactly as described!",
    "Good value for money. Would buy again.",
    "Arrived quickly, well packaged. Very happy.",
    "Quality is top notch. Highly recommended.",
    "Decent product but delivery was slow.",
    "Amazing build quality. Worth every penny.",
    "Not what I expected but still works fine.",
    "Perfect! Great product and fast shipping.",
    "Very durable. Using it daily for months.",
    "Great seller. Product looks premium.",
  ];

  let reviewCount = 0;
  const usedCombos = new Set();
  for (const product of products.slice(0, 35)) {
    const numReviews = randInt(1, 4);
    for (let r = 0; r < numReviews; r++) {
      const reviewer = pick(customers);
      const combo = `${product._id}-${reviewer._id}`;
      if (usedCombos.has(combo)) continue;
      usedCombos.add(combo);
      try {
        await Review.create({
          product: product._id,
          user: reviewer._id,
          rating: randInt(3, 5),
          comment: pick(reviewComments),
          verified: Math.random() > 0.5,
        });
        reviewCount++;
      } catch {
        // skip duplicate
      }
    }
  }
  console.log(`Created ${reviewCount} reviews`);

  // ── Redis: Seed trending + HyperLogLog ───────────────────────────────────────
  const pipeline = redis.pipeline();

  // Trending sorted set
  for (const p of products) {
    const score = randFloat(10, 10000);
    pipeline.zadd("trending:products", score, p._id.toString());
  }

  // HyperLogLog unique visitors for top 10 products
  for (const p of products.slice(0, 10)) {
    const numVisitors = randInt(50, 500);
    for (let v = 0; v < numVisitors; v++) {
      pipeline.pfadd(`hll:product:${p._id}:views`, `user_${randInt(1, 10000)}`);
    }
  }

  // Recently viewed for customers
  for (const customer of customers) {
    const viewedProducts = products.slice(0, 5).map((p) => p._id.toString());
    for (const pid of viewedProducts) {
      pipeline.lpush(`recent:${customer._id}`, pid);
    }
    pipeline.ltrim(`recent:${customer._id}`, 0, 9);
  }

  // Leaderboard
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  for (const order of orders.filter((o) => o.status === "delivered")) {
    pipeline.zincrby(`leaderboard:buyers:${month}`, order.totalAmount, order.user.toString());
  }

  await pipeline.exec();
  console.log("Redis seeded: trending products, HyperLogLog, recently viewed, leaderboards");

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n=== SEED COMPLETE ===");
  console.log(`Users:      ${users.length} (1 admin, 2 sellers, 7 customers)`);
  console.log(`Categories: 5 parent + 10 subcategories`);
  console.log(`Products:   ${products.length}`);
  console.log(`Inventory:  1 record per product variant`);
  console.log(`Orders:     ${orders.length}`);
  console.log(`Reviews:    ${reviewCount}`);
  console.log("\nLogin credentials (all): Password123!");
  console.log("  Admin:  admin@shopnest.com");
  console.log("  Seller: alice@shopnest.com");
  console.log("  Customer: carol@shopnest.com");

  await mongoose.disconnect();
  redis.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
