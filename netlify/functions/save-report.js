import { createBlob } from "@netlify/blobs";

export const config = { path: "/api/save-report" };

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const isBase64 = event.isBase64Encoded;
    const bodyRaw = isBase64
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    const payload = JSON.parse(bodyRaw || "{}");

    const { pdfDataUrl, baseName, analysis, imageFilename } = payload;
    if (!pdfDataUrl || !pdfDataUrl.startsWith("data:application/pdf;base64,")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or missing PDF data" }),
      };
    }

    const base64 = pdfDataUrl.replace("data:application/pdf;base64,", "");
    const buffer = Buffer.from(base64, "base64");

    const safeBase = (baseName || `analysis_${Date.now()}`).replace(
      /[^a-zA-Z0-9_.-]/g,
      "_"
    );
    const pdfPath = `reports/${safeBase}.pdf`;

    try {
      await createBlob({
        name: pdfPath,
        data: buffer,
        contentType: "application/pdf",
      });

      if (analysis) {
        await createBlob({
          name: `meta/${safeBase}.json`,
          data: JSON.stringify({ analysis, imageFilename }),
          contentType: "application/json",
        });
      }
    } catch (e) {
      // Non-fatal if Blobs is unavailable
      console.warn("Blob save failed:", e?.message || e);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        reportUrl: `/.netlify/blobs/${pdfPath}`,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to save report" }),
    };
  }
}
