const express = require("express");
const cors = require('cors')
const fileUpload = require('express-fileupload')
const axios = require('axios');
const fd = require('form-data')
const fs = require("fs");
const path = require("path");
require("dotenv").config();


const app = express();

app.use(cors());
app.use(fileUpload());

const tempPath = path.join(__dirname, "temp_input.pdf");

app.post('/kompres', async(req, res) => {
  try{
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ success: false, error: "No PDF uploaded" });
    }

    const authRes = await axios.post("https://api.ilovepdf.com/v1/auth", {
      public_key: process.env.PUBLIC_KEY,
    });
    const token = authRes.data.token;
    // Catatan: token berlaku ±2 jam

    // 2) Start → dapatkan server & task id
    const startRes = await axios.get(
      `https://api.ilovepdf.com/v1/start/compress/us`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { server, task } = startRes.data;

    // 3) Upload → kirim semua file ke server yang ditunjuk
    const uploaded = [];
    await req.files.pdf.mv(tempPath);
    const form = new fd();
    form.append("task", task);
    form.append("file", fs.createReadStream(path.resolve(tempPath)));

    const uploadRes = await axios.post(`https://${server}/v1/upload`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders(),
      },
    });

    // Simpan server_filename untuk dipakai di step process
    uploaded.push({
      server_filename: uploadRes.data.server_filename,
      filename: req.files.pdf.name,
    });

    // 4) Process → jalankan merge dengan urutan files sesuai array
    const processRes = await axios.post(
      `https://${server}/v1/process`,
      {
        task,
        tool: "compress",
        files: uploaded.map((f) => ({
          server_filename: f.server_filename,
          filename: f.filename,
          rotate: 0,
        })),
        // Optional: output_filename, packaged_filename, ignore_errors, dll
        output_filename: "compressed",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (processRes.data.status !== "TaskSuccess") {
      console.warn("Process status:", processRes.data.status);
    }

    // 5) Download → ambil hasil PDF
    const downloadRes = await axios.get(
      `https://${server}/v1/download/${task}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
      }
    );

    // Simpan sebagai merged.pdf
    fs.writeFileSync("merged_compressed.pdf", downloadRes.data);
    console.log("Selesai: merged.pdf");

    // di server
    res.download(path.join(__dirname, "merged_compressed.pdf"), "compressed.pdf");


  } catch (err) {
    // Tampilkan detail error dari API
    if (err.response?.data) {
      console.error("API Error:", JSON.stringify(err.response.data, null, 2));
      return res.status(500).json({ success: false, error: err.message });
    } else {
      return res.status(500).json({ success: false, error: err.message });
    }
  } finally{
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (e) {
        console.warn("Gagal hapus temp file:", e.message);
      }
  }
});

// handler global biar nggak exit diam-diam
process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});
process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT || 3000}`);
});
