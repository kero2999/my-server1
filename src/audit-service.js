const crypto = require("node:crypto");
const supabase = require("./db");

const EVENT_TABLE = "audit_events";
const IP_SALT = process.env.AUDIT_IP_SALT || process.env.JWT_SECRET || "quadralevel-audit";

function hashIp(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(`${IP_SALT}:${value}`).digest("hex").slice(0, 32);
}

function safeMetadata(value) {
  if (!value || typeof value !== "object") return {};
  try {
    const json = JSON.stringify(value, (key, item) => {
      if (/token|secret|password|authorization|api.?key/i.test(key)) return undefined;
      if (typeof item === "string" && item.length > 1000) return item.slice(0, 1000);
      return item;
    });
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

function requestUserId(req) {
  return req.userId || null;
}

function requestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || null;
}

async function recordAuditEvent({ req, eventType, action, userId, courseId, metadata, status = "success", durationMs }) {
  const payload = {
    event_type: String(eventType || "system").slice(0, 80),
    action: String(action || "unknown").slice(0, 160),
    user_id: userId || requestUserId(req),
    course_id: courseId || null,
    status: String(status || "success").slice(0, 30),
    metadata: safeMetadata(metadata),
    ip_hash: requestIp(req) ? hashIp(requestIp(req)) : null,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
    path: String(req.originalUrl || req.path || "").slice(0, 500),
    method: String(req.method || "").slice(0, 12),
    duration_ms: Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null,
  };
  const { error } = await supabase.from(EVENT_TABLE).insert(payload);
  if (error) throw error;
  return payload;
}

function routeEventType(method, path) {
  const value = `${method} ${path}`.toLowerCase();
  if (value.includes("/auth/register")) return "registration";
  if (value.includes("/auth/login")) return "login";
  if (value.includes("/payments") || value.includes("/webhooks/paymob")) return "payment";
  if (value.includes("campaign")) return "campaign";
  if (value.includes("trial")) return "trial";
  if (value.includes("quiz") || value.includes("assessment")) return "assessment";
  if (value.includes("project")) return "graduation_project";
  if (value.includes("mentor")) return "mentor";
  if (value.includes("affiliate")) return "affiliate";
  if (value.includes("admin")) return "admin";
  if (value.includes("certificate")) return "certificate";
  if (value.includes("content")) return "content";
  return "api_request";
}

function auditRequestMiddleware() {
  return (req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const started = Date.now();
    res.on("finish", () => {
      const path = req.originalUrl || req.path || "";
      if (path.includes("/api/admin/events") || path.includes("/api/webhooks")) return;
      recordAuditEvent({
        req,
        eventType: routeEventType(req.method, path),
        action: `${req.method} ${path}`,
        status: res.statusCode >= 400 ? "error" : "success",
        durationMs: Date.now() - started,
        metadata: { statusCode: res.statusCode },
      }).catch((error) => console.error("Audit event write failed:", error.message));
    });
    next();
  };
}

module.exports = { recordAuditEvent, auditRequestMiddleware, routeEventType, safeMetadata };

/* Page visits are recorded through POST /api/events/visit from the frontend. */
