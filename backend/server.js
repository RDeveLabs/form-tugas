const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { Queue } = require("bullmq");

const compressQueue = new Queue("compress-pdf", {
  connection: { host: "127.0.0.1", port: 6379 }
});

const app = express();
app.use(cors());
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));

app.post("/compress", async (req, res) => {
  if (!req.files || !req.files.pdf) return res.status(400).send("No PDF uploaded");

  const uuid = crypto.randomUUID();
  const tempDir = path.join(__dirname, "temp", uuid);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, "input.pdf");
  const outputPath = path.join(tempDir, "output.pdf");
  await req.files.pdf.mv(inputPath);

  await compressQueue.add("compress", {
    inputPath,
    outputPath,
    tempDir
  });

  res.send("File diterima dan sedang dikompres. Silakan cek nanti.");
});

app.listen(3000, () => console.log("🚀 Server listening on http://localhost:3000"));
