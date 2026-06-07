const { setSession, getSession, deleteSession } = require("./cacheService");

async function createSession(user) {
  const sessionData = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    loginAt: Date.now(),
  };
  await setSession(user._id.toString(), sessionData);
  return sessionData;
}

async function validateSession(userId) {
  return await getSession(userId);
}

async function destroySession(userId) {
  await deleteSession(userId);
}

module.exports = { createSession, validateSession, destroySession };
