const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const chooseBtn = document.getElementById("chooseBtn");
const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");
const analyzeBtn = document.getElementById("analyzeBtn");
const loading = document.getElementById("loading");
const resultsCard = document.getElementById("resultsCard");
const downloadBtn = document.getElementById("downloadBtn");
const diseaseText = document.getElementById("diseaseText");
const medicinesList = document.getElementById("medicinesList");
const descriptionText = document.getElementById("descriptionText");
const causesList = document.getElementById("causesList");
const toast = document.getElementById("toast");

let currentFile = null;
let lastAnalysis = null;
let lastImageFilename = null;

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
const isNetlify = !isLocalhost;
const ANALYZE_URL = isNetlify ? "/.netlify/functions/analyze" : "/api/analyze";
const SAVE_REPORT_URL = isNetlify
  ? "/.netlify/functions/save-report"
  : "/api/save-report";

function showToast(message, ms = 2600) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), ms);
}

function isAllowed(file) {
  return ["image/jpeg", "image/jpg", "image/png"].includes(file.type);
}

function resetResults() {
  resultsCard.classList.add("hidden");
  downloadBtn.classList.add("hidden");
  diseaseText.textContent = "";
  medicinesList.innerHTML = "";
  descriptionText.textContent = "";
  causesList.innerHTML = "";
}

function handleFiles(files) {
  const file = files && files[0];
  if (!file) return;
  if (!isAllowed(file)) {
    showToast("Only JPG, JPEG, PNG files are allowed");
    return;
  }
  currentFile = file;
  const url = URL.createObjectURL(file);
  previewImage.src = url;
  previewContainer.classList.remove("hidden");
  analyzeBtn.disabled = false;
  resetResults();
}

chooseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach((evt) => {
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove("dragover");
  });
});
dropArea.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) handleFiles(dt.files);
});

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeImage() {
  if (!currentFile) return;
  analyzeBtn.disabled = true;
  loading.classList.remove("hidden");
  try {
    let data;
    if (isNetlify) {
      const dataUrl = await fileToDataUrl(currentFile);
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          mimeType: currentFile.type,
          originalName: currentFile.name,
        }),
      });
      const text = await res.text();
      // Try parse JSON, otherwise throw readable error
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text?.slice(0, 120) || "Invalid response");
      }
      if (!res.ok || !data.success)
        throw new Error(data.error || "Analysis failed");
    } else {
      const form = new FormData();
      form.append("image", currentFile);
      const res = await fetch(ANALYZE_URL, { method: "POST", body: form });
      data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "Analysis failed");
    }

    lastAnalysis = data.analysis;
    lastImageFilename = data.imageFilename || null;

    // Render results
    diseaseText.textContent = lastAnalysis.disease || "Unknown";

    medicinesList.innerHTML = "";
    (lastAnalysis.medicines || []).forEach((m) => {
      const li = document.createElement("li");
      li.textContent = m;
      medicinesList.appendChild(li);
    });

    descriptionText.textContent = lastAnalysis.description || "";

    causesList.innerHTML = "";
    (lastAnalysis.causes || []).forEach((c) => {
      const li = document.createElement("li");
      li.textContent = c;
      causesList.appendChild(li);
    });

    resultsCard.classList.remove("hidden");
    downloadBtn.classList.remove("hidden");
    showToast("Analysis complete");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Analysis failed");
  } finally {
    loading.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyzeImage);

document.getElementById("year").textContent = new Date().getFullYear();

async function generateAndSavePdf() {
  if (!lastAnalysis || !currentFile) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 40;
  let y = margin;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(23, 155, 64);
  doc.text("AgriCare Crop Disease Analysis", margin, y);
  y += 10;
  doc.setDrawColor(23, 155, 64);
  doc.setLineWidth(1);
  doc.line(margin, y, 555, y);
  y += 20;

  // Image
  const dataUrl = await fileToDataUrl(currentFile);
  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => (img.onload = r));
  const maxW = 555 - margin;
  const maxH = 260;
  let imgW = img.width;
  let imgH = img.height;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  imgW = imgW * scale;
  imgH = imgH * scale;
  doc.addImage(dataUrl, img.type || "JPEG", margin, y, imgW, imgH);
  y += imgH + 20;

  // Sections
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Disease Name", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const disease = lastAnalysis.disease || "Unknown";
  doc.text(disease, margin, y, { maxWidth: 515 });
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Required Medicines / Treatments", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  (lastAnalysis.medicines || []).forEach((m) => {
    doc.text(`• ${m}`, margin, y, { maxWidth: 515 });
    y += 16;
  });
  if ((lastAnalysis.medicines || []).length === 0) {
    doc.text("—", margin, y);
    y += 16;
  }
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Description", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const descLines = doc.splitTextToSize(lastAnalysis.description || "", 515);
  descLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 16;
  });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Possible Causes", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  (lastAnalysis.causes || []).forEach((c) => {
    doc.text(`• ${c}`, margin, y, { maxWidth: 515 });
    y += 16;
  });
  if ((lastAnalysis.causes || []).length === 0) {
    doc.text("—", margin, y);
    y += 16;
  }

  const baseName = `analysis_${Date.now()}`;
  const pdfDataUrl = doc.output("datauristring");

  // Trigger download
  doc.save(`${baseName}.pdf`);

  // Save to backend (works both local and Netlify)
  try {
    await fetch(SAVE_REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfDataUrl,
        baseName,
        analysis: lastAnalysis,
        imageFilename: lastImageFilename,
      }),
    });
  } catch (e) {
    console.warn("Failed to persist report to backend", e);
  }
}

downloadBtn.addEventListener("click", generateAndSavePdf);
