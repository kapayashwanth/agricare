import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist
const uploadsDir = path.join(__dirname, "uploads");
const reportsDir = path.join(__dirname, "reports");
const metaDir = path.join(reportsDir, "meta");
for (const dir of [uploadsDir, reportsDir, metaDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Multer configuration with security constraints
const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const time = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const ext = path.extname(safeOriginal) || ".jpg";
    cb(null, `crop_${time}${ext}`);
  },
});
const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG, JPEG, PNG are allowed"));
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Gemini setup
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

function buildAnalysisPrompt() {
  return (
    "You are an expert agronomist. Analyze the provided crop image for disease detection. " +
    "Identify the most likely disease, list practical treatments/medicines (brand-agnostic when possible), " +
    "provide a concise description, and list likely causes. " +
    "Return a STRICT JSON object with keys: disease (string), medicines (string[]), description (string), causes (string[]). " +
    "No markdown or extra commentary."
  );
}

async function analyzeWithGemini(imagePath, mimeType) {
  if (!genAI)
    throw new Error(
      "Gemini API key not configured. Set GEMINI_API_KEY in .env"
    );

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");

  const prompt = buildAnalysisPrompt();
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  let jsonText = text.trim();
  // If the model returns markdown code fences, strip them
  const codeFenceMatch = jsonText.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (codeFenceMatch) {
    jsonText = codeFenceMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Failed to parse AI response as JSON");
  }

  // Basic validation and normalization
  const disease =
    typeof parsed.disease === "string" ? parsed.disease : "Unknown";
  const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
  const description =
    typeof parsed.description === "string" ? parsed.description : "";
  const causes = Array.isArray(parsed.causes) ? parsed.causes : [];

  return { disease, medicines, description, causes };
}

// Routes
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const { path: filePath, mimetype, filename } = req.file;

    const analysis = await analyzeWithGemini(filePath, mimetype);

    // Persist the analysis JSON alongside the image for traceability
    const meta = {
      timestamp: new Date().toISOString(),
      imageFilename: filename,
      ...analysis,
    };
    const metaFile = path.join(metaDir, `${path.parse(filename).name}.json`);
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), "utf-8");

    res.json({
      success: true,
      imageFilename: filename,
      imageUrl: `/uploads/${filename}`,
      analysis,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

// Save PDF report
app.post("/api/save-report", async (req, res) => {
  try {
    const { pdfDataUrl, baseName, analysis, imageFilename } = req.body || {};
    if (!pdfDataUrl || !pdfDataUrl.startsWith("data:application/pdf;base64,")) {
      return res.status(400).json({ error: "Invalid or missing PDF data" });
    }

    const base64 = pdfDataUrl.replace("data:application/pdf;base64,", "");
    const buffer = Buffer.from(base64, "base64");
    const safeBase = (baseName || `analysis_${Date.now()}`).replace(
      /[^a-zA-Z0-9_.-]/g,
      "_"
    );
    const pdfPath = path.join(reportsDir, `${safeBase}.pdf`);
    fs.writeFileSync(pdfPath, buffer);

    // Optionally persist analysis bundle as JSON
    if (analysis) {
      const analysisPath = path.join(metaDir, `${safeBase}.json`);
      fs.writeFileSync(
        analysisPath,
        JSON.stringify({ analysis, imageFilename }, null, 2)
      );
    }

    res.json({ success: true, reportUrl: `/reports/${safeBase}.pdf` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

// Serve uploaded files and reports statically with read-only access
app.use(
  "/uploads",
  express.static(uploadsDir, { immutable: true, maxAge: "30d" })
);
app.use(
  "/reports",
  express.static(reportsDir, { immutable: true, maxAge: "30d" })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`AgriCare server running on http://localhost:${PORT}`);
});
