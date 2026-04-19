require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db"); // ← no src/ prefix
const urlsRouter = require("./routes/urls"); // ← no src/ prefix

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Add health check endpoint BEFORE urlsRouter — to prevent the :short_url in urlRoute greedily receives requests
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));

app.use("", urlsRouter);

connectDB();

module.exports = app; // ← no app.listen here
