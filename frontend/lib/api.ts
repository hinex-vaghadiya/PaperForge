/**
 * API Configuration for connecting frontend to backend services.
 */

// Backend API URL — points to HuggingFace Spaces when deployed
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

/**
 * Call the backend PDF generation endpoint.
 * Falls back to a client-side download trigger.
 */
export async function generatePDF(paperData: {
  title: string;
  school_name: string;
  exam_name: string;
  subject: string;
  class_grade: string;
  duration_minutes: number | null;
  max_marks: number | null;
  total_marks: number | null;
  instructions: string;
  sections: Array<{
    name: string;
    questions: Array<{
      question_text: string | null;
      question_mode: string;
      question_type: string;
      marks: number | null;
      order: number;
    }>;
  }>;
}): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pdf/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paperData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDF generation failed: ${errorText}`);
  }

  const blob = await response.blob();
  
  // Try to get filename from Content-Disposition header
  let filename = "";
  const disposition = response.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch.length === 2) {
      filename = filenameMatch[1];
    }
  }

  // Fallback if header is missing
  if (!filename) {
    const safeTitle = paperData.title.replace(/[^a-zA-Z0-9 _-]/g, "");
    const contentType = response.headers.get("content-type") || "";
    const ext = contentType.includes("text/html") ? "html" : "pdf";
    filename = `${safeTitle || "Paper"}.${ext}`;
  }

  return { blob, filename };
}

/**
 * Trigger a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if the backend API is available (warm up HF Space).
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Call the backend OCR processing endpoint.
 */
export async function processOCR(fileUrl: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ocr/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_url: fileUrl, file_type: "image" }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR processing failed: ${errorText}`);
  }

  return response.json();
}
