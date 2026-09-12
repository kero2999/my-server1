require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("./middleware/rate-limit");

const authRoutes = require("./routes/auth");
const webhookRoutes = require("./routes/webhooks");
const mentorRoutes = require("./routes/mentor");
const projectsRoutes = require("./routes/projects");
const coursesRoutes = require("./routes/courses");
const paymentsRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");
const contentRoutes = require("./routes/content");
const certificatesRoutes = require("./routes/certificates");
const reviewsRoutes = require("./routes/reviews");
const campaignsRoutes = require("./routes/campaigns");
const countriesRoutes = require("./routes/countries");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!allowedOrigins.length) {
  allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    optionsSuccessStatus: 204,
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});

app.use(
  "/api",
  rateLimit({ name: "api-global", windowMs: 60 * 1000, max: 120 })
);

// مهم: راوت الـ webhook لازم ياخد الـ body كنص خام (raw) قبل ما نعمل express.json()
// عشان التحقق من التوقيع (signature) يشتغل صح.
app.use("/api/webhooks", express.text({ type: "*/*", limit: "1mb" }), webhookRoutes);

// باقي الراوتس بتاخد JSON عادي مع حد يمنع أجسام الطلبات الضخمة.
app.use(express.json({ limit: "256kb", strict: true }));
app.use("/api/auth", authRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/countries", countriesRoutes);

app.get("/health", (req, res) => res.json({ ok: true, service: "marketing-platform-server" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
