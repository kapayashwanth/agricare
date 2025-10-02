import { GoogleGenerativeAI } from "@google/generative-ai";
import { createBlob } from "@netlify/blobs";

const allowed = new Set(["image/jpeg", "image/jpg", "image/png"]);

function buildPrompt() {
  return (
    "You are an expert agronomist. Analyze the provided crop image for disease detection. " +
    "Identify the most likely disease, list practical treatments/medicines, " +
    "provide a concise description, and list likely causes. " +
    "Return STRICT JSON with keys: disease (string), medicines (string[]), description (string), causes (string[])."
  );
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const isBase64 = event.isBase64Encoded;
    const raw = isBase64
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw body:", raw?.slice(0, 200));
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Expected JSON body",
          details: parseError.message,
        }),
      };
    }

    const { imageDataUrl, mimeType, originalName } = payload || {};
    if (!imageDataUrl || !mimeType) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing imageDataUrl or mimeType" }),
      };
    }
    if (!allowed.has(mimeType)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Only JPG, JPEG, PNG are allowed" }),
      };
    }

    const apiKey = "AIzaSyDa_UmO8bZNlJr6AwK0YuT5RcXXSHp4byE";
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API key not configured" }),
      };
    }

    const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, "");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = buildPrompt();
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType } },
    ]);

    const text = result.response.text().trim();
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
    const jsonText = (match ? match[1] : text).trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    const disease =
      typeof parsed.disease === "string" ? parsed.disease : "Unknown";
    const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
    const description =
      typeof parsed.description === "string" ? parsed.description : "";
    const causes = Array.isArray(parsed.causes) ? parsed.causes : [];

    const timestamp = Date.now();
    const safeName = (originalName || `crop_${timestamp}.png`).replace(
      /[^a-zA-Z0-9_.-]/g,
      "_"
    );
    try {
      await createBlob({
        name: `uploads/${safeName}`,
        data: Buffer.from(base64, "base64"),
        contentType: mimeType,
      });
      await createBlob({
        name: `meta/${safeName.replace(/\.[^.]+$/, "")}.json`,
        data: JSON.stringify({
          timestamp: new Date().toISOString(),
          imageFilename: safeName,
          disease,
          medicines,
          description,
          causes,
        }),
        contentType: "application/json",
      });
    } catch (e) {
      // Non-fatal if Blobs is not available
      console.warn("Blob save failed:", e?.message || e);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        imageFilename: safeName,
        analysis: { disease, medicines, description, causes },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Analysis failed" }),
    };
  }
}
