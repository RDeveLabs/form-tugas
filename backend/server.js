const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(fileUpload({ limits: { fileSize: 20 * 1024 * 1024 } })); // max 20MB


// Helper: run Ghostscript to compress a PDF
function compressWithGhostscript(inputPath, outputPath, quality = "/ebook") {
  return new Promise((resolve, reject) => {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`, // /screen /ebook /printer /prepress
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    console.log("⚙️  Menjalankan Ghostscript:", ["gs", ...args].join(" "));

    const gs = spawn("gs", args);

    let stderr = "";
    gs.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    gs.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Ghostscript exited with code ${code}: ${stderr}`));
      }
    });

    gs.on("error", (err) => {
      reject(new Error(`Failed to start Ghostscript (gs). Is it installed? ${err.message}`));
    });
  });
}

app.post("/compress", async (req, res) => {
  try {
    console.time("total-compress");

    if (!req.files || !req.files.pdf) {
      console.warn("⚠️ Tidak ada file yang dikirim");
      return res.status(400).send("No PDF uploaded");
    }

    console.log("📥 File diterima:", req.files.pdf.name, "-", req.files.pdf.size, "bytes");

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("📂 Folder temp dibuat:", tempDir);
    }

    const inputPath = path.join(tempDir, "input.pdf");
    const outputPath = path.join(tempDir, "output.pdf");

    console.time("save-file");
    await req.files.pdf.mv(inputPath);
    console.timeEnd("save-file");
    console.log("✅ File disimpan di:", inputPath);

    console.time("compress-process");
    await compressWithGhostscript(inputPath, outputPath, "/ebook");
    console.timeEnd("compress-process");

    if (!fs.existsSync(outputPath)) {
      console.error("❌ Output file tidak dibuat!");
      return res.status(500).send("Compression failed, no output file");
    }

    const compressed = fs.readFileSync(outputPath);
    console.log("📦 Output size:", compressed.length, "bytes");

    console.timeEnd("total-compress");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=compressed.pdf");

    fs.createReadStream(outputPath).pipe(res).on("finish", () => {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    });

  } catch (e) {
    console.error("❌ Server error:", e);
    res.status(500).send(e.message);
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
  // quick runtime check for Ghostscript availability
  const check = spawn("gs", ["--version"]);
  check.stdout.on("data", (d) => console.log("Ghostscript version:", d.toString().trim()));
  check.on("error", () => {
    console.warn("⚠️ Ghostscript (gs) tidak ditemukan di PATH. Install dulu supaya kompresi jalan.");
  });
});
