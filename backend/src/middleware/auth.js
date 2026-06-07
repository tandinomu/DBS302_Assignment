const jwt = require("jsonwebtoken");
const { getSession } = require("../services/cacheService");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Validate against Redis session — if session was deleted (logout), token is invalid
    const session = await getSession(decoded.userId);
    if (!session) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Like authenticate, but silently skips instead of returning 401 when no/invalid token.
// Used for cart routes that support both authenticated users and guests.
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(); // invalid/expired token → treat as guest
    }
    const session = await getSession(decoded.userId);
    if (session) {
      req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    }
    next();
  } catch {
    next();
  }
}

module.exports = { authenticate, authorize, optionalAuthenticate };
