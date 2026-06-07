require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const { connectDB, getConnectionStatus } = require("./config/db");
const { getRedisClient, getRedisStatus } = require("./config/redis");

// Register all models before routes so Mongoose populate() works
require("./models/User");
require("./models/Category");
require("./models/Product");
require("./models/Order");
require("./models/Review");
require("./models/Inventory");

const authRouter = require("./routes/auth");
const productRouter = require("./routes/products");
const categoryRouter = require("./routes/categories");
const cartRouter = require("./routes/cart");
const orderRouter = require("./routes/orders");
const userRouter = require("./routes/users");
const analyticsRouter = require("./routes/analytics");

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));

// ─── Swagger ─────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ShopNest API",
      version: "1.0.0",
      description:
        "E-commerce platform API — DBS302 Final Project. Demonstrates MongoDB replica sets, aggregation pipelines, ACID transactions, and Redis data structures.",
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 5000}` }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./src/routes/*.js"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const mongo = getConnectionStatus();
  const redis = await getRedisStatus();

  const healthy = mongo.state === 1 && redis.connected;
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongo,
      redis,
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/products", productRouter);
app.use("/categories", categoryRouter);
app.use("/cart", cartRouter);
app.use("/orders", orderRouter);
app.use("/users", userRouter);
app.use("/analytics", analyticsRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const message = status < 500 ? err.message : "Internal server error";

  if (status >= 500) {
    console.error("[Error]", err.stack || err.message);
  }

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }

  return res.status(status).json({ error: message });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000", 10);

async function start() {
  try {
    await connectDB();
    // Initialize Redis client eagerly so connection errors surface at startup
    getRedisClient();

    app.listen(PORT, () => {
      console.info(`[ShopNest] Backend running on port ${PORT}`);
      console.info(`[ShopNest] API docs at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("[ShopNest] Failed to start:", err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
