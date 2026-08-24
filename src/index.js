require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const webhookRoutes = require("./routes/webhooks");
const mentorRoutes = require("./routes/mentor");
const projectsRoutes = require("./routes/projects");
const coursesRoutes = require("./routes/courses");
const paymentsRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");
const contentRoutes = require("./routes/content");
const certificatesRoutes = require("./routes/certificates");

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
  })
);

// مهم: راوت الـ webhook لازم ياخد الـ body كنص خام (raw) قبل ما نعمل express.json()
// عشان التحقق من التوقيع (signature) يشتغل صح.
app.use("/api/webhooks", express.text({ type: "*/*" }), webhookRoutes);

// باقي الراوتس بتاخد JSON عادي
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/certificates", certificatesRoutes);

app.get("/health", (req, res) => res.json({ ok: true, service: "marketing-platform-server" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
