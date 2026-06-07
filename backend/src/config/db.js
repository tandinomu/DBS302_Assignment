const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not defined");

  await mongoose.connect(uri, {
    // Read concern "majority" ensures we only read data acknowledged by a quorum
    // of replica set members — protects against reading uncommitted data on failover
    readConcernLevel: "majority",
    // Write concern: majority + journaled ensures writes survive single-node failures
    writeConcern: { w: "majority", j: true },
    // Timeouts prevent hanging queries on network partition
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 50,
    minPoolSize: 5,
  });

  isConnected = true;

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Connection error:", err.message);
    isConnected = false;
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected — will attempt reconnect");
    isConnected = false;
  });

  mongoose.connection.on("reconnected", () => {
    console.info("[MongoDB] Reconnected");
    isConnected = true;
  });

  console.info(`[MongoDB] Connected to replica set — primary: ${mongoose.connection.host}`);
}

function getConnectionStatus() {
  return {
    state: mongoose.connection.readyState,
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    stateLabel: ["disconnected", "connected", "connecting", "disconnecting"][
      mongoose.connection.readyState
    ],
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}

module.exports = { connectDB, getConnectionStatus };
