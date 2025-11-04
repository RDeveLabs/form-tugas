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

const { google } = require("googleapis");
const fs = require("fs");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// coba load token.json kalau ada
if (fs.existsSync("token.json")) {
  const tokens = JSON.parse(fs.readFileSync("token.json"));
  oauth2Client.setCredentials(tokens);
}

// endpoint login
app.get("/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"]
  });
  res.redirect(url);
});

// callback setelah login
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync("token.json", JSON.stringify(tokens));
  res.send("✅ Login berhasil, token disimpan!");
});


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

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const fileMetadata = { 
      name: req.file.originalname,
      parents: ["1U3tc5qIkXtE_keQjkaWMXfjBGuiRdnFM"] // ID folder
    };
    
    const media = {
      mimeType: req.file.mimetype,
      body: require("fs").createReadStream(req.file.path)
    };

    const responseDrive = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink"
    });

    // hapus file lokal setelah upload
    require("fs").unlinkSync(req.file.path);

    res.send(`
      File berhasil diupload ke Google Drive!<br>
      ID: ${responseDrive.data.id}<br>
      Link view: <a href="${responseDrive.data.webViewLink}" target="_blank">${responseDrive.data.webViewLink}</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal upload ke Google Drive: " + err.message);
  }
});


app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
