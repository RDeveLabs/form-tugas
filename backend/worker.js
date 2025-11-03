const { Worker } = require("bullmq");
const fs = require("fs");
const { spawn } = require("child_process");

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

const worker = new Worker("compress-pdf", async job => {
  const { inputPath, outputPath, tempDir } = job.data;
  console.log("🔧 Memproses:", inputPath);

  try {
    await compressWithGhostscript(inputPath, outputPath);
    console.log("✅ Kompresi selesai:", outputPath);
  } catch (err) {
    console.error("❌ Gagal kompresi:", err.message);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}, {
  connection: { host: "127.0.0.1", port: 6379 }
});
