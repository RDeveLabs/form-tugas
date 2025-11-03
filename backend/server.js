const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();

const allowedOrigins = [
  "https://rdevelabs.biz.id",
  "https://www.rdevelabs.biz.id"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true,
}));

function compressWithGhostscript(inputPath, outputPath, quality = "/ebook") {
  return new Promise((resolve, reject) => {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    const gs = spawn("gs", args);
    let stderr = "";

    gs.stderr.on("data", (data) => { stderr += data.toString(); });
    gs.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Ghostscript exited with code ${code}: ${stderr}`));
    });
    gs.on("error", (err) => reject(new Error(`Ghostscript error: ${err.message}`)));
  });
}

app.post("/compress", async (req, res) => {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).send("No PDF uploaded");
    }

    const uuid = crypto.randomUUID();
    const tempDir = path.join(__dirname, "temp", uuid);
    fs.mkdirSync(tempDir, { recursive: true });

    const inputPath = path.join(tempDir, "input.pdf");
    const outputPath = path.join(tempDir, "output.pdf");

    await req.files.pdf.mv(inputPath);
    await compressWithGhostscript(inputPath, outputPath);

    if (!fs.existsSync(outputPath)) {
      return res.status(500).send("Compression failed");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=compressed.pdf");

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on("close", () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).send("Server error: " + err.message);
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
