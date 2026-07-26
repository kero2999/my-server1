require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const webhookRoutes = require("./routes/webhooks");
const mentorRoutes = require("./routes/mentor");
const projectsRoutes = require("./routes/projects");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
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

app.get("/health", (req, res) => res.json({ ok: true, service: "marketing-platform-server" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
