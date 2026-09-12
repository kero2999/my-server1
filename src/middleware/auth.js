const jwt = require("jsonwebtoken");

function authenticate(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId || null;
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const userId = authenticate(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "الجلسة منتهية أو غير صالحة، سجّل دخولك مرة أخرى." });
  }
  req.userId = userId;
  next();
}

module.exports = { requireAuth, authenticate };
