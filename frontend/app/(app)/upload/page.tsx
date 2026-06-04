"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import styles from "./upload.module.css";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { processOCR, checkBackendHealth } from "@/lib/api";

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

/**
 * Compress an image file to max dimensions and quality.
 */
async function compressImage(file: File, maxWidth = 2000, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    // If not an image or already small, skip compression
    if (!file.type.startsWith("image/") || file.size < 100000) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressed = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressed);
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [batchCreating, setBatchCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const additions: UploadFile[] = [];
    Array.from(newFiles).forEach((file) => {
      if (!acceptedTypes.includes(file.type)) return;
      if (file.size > 50 * 1024 * 1024) return; // 50MB limit

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";

      additions.push({ id, file, preview, status: "pending", progress: 0 });
    });
    setFiles((prev) => [...prev, ...additions]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]);
  };

  // Drag & Drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleUploadAll = async () => {
    if (!user) return;
    
    const pendingFiles = files.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setBatchCreating(true);

    // 1. Create a tracking batch in the database
    const { data: batch, error: batchError } = await supabase
      .from('upload_batches')
      .insert({
        created_by: user.id,
        name: `Upload - ${new Date().toLocaleString()}`,
        file_count: pendingFiles.length,
        status: 'pending'
      })
      .select()
      .single();

    setBatchCreating(false);

    if (batchError || !batch) {
      alert("Failed to initialize upload batch.");
      console.error(batchError);
      return;
    }

    // Check backend health before we start processing
    const backendUp = await checkBackendHealth();
    if (!backendUp) {
      alert("Backend API is offline. Files will be uploaded but not processed. Ensure your backend is running.");
    }

    // 2. Process each file
    for (const f of files) {
      if (f.status !== "pending") continue;

      try {
        // Mark as compressing
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "compressing", progress: 10 } : x)));
        const compressed = await compressImage(f.file);

        // Mark as uploading
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "uploading", progress: 40 } : x)));

        // Clean filename and construct user-specific path
        const safeName = f.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.id}/${batch.id}/${Date.now()}_${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, compressed, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, progress: 80 } : x)));

        // 3. Register file in database
        const { data: dbFile, error: dbError } = await supabase
          .from('uploaded_files')
          .insert({
            batch_id: batch.id,
            file_name: f.file.name,
            file_type: f.file.type.includes('pdf') ? 'pdf' : (f.file.type.includes('png') ? 'png' : 'jpg'),
            storage_path: filePath,
            processing_status: backendUp ? 'ocr_running' : 'pending' 
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (backendUp && dbFile) {
          // 4. Generate signed URL for backend to download
          const { data: signedUrlData, error: signError } = await supabase.storage
            .from('uploads')
            .createSignedUrl(filePath, 3600);
            
          if (signError) throw signError;

          // 5. Call OCR pipeline
          const ocrResult = await processOCR(signedUrlData.signedUrl);

          // 6. Save extracted questions to database
          if (ocrResult.questions && ocrResult.questions.length > 0) {
            const questionsToInsert = ocrResult.questions.map((q: any) => ({
              source_file_id: dbFile.id,
              batch_id: batch.id,
              created_by: user.id,
              question_text: q.question_text,
              question_type: q.question_type || 'short_answer',
              marks: q.marks,
              subject: 'Unknown',
              class_grade: 'Unknown',
              confidence_score: ocrResult.confidence,
              approval_status: 'pending'
            }));

            const { error: insertError } = await supabase.from('questions').insert(questionsToInsert);
            if (insertError) {
              console.error("Failed to insert questions:", insertError);
              throw insertError;
            }
          }

          // 7. Update file status
          await supabase
            .from('uploaded_files')
            .update({ 
              processing_status: 'completed',
              extracted_text: ocrResult.raw_ocr_text,
              confidence_score: ocrResult.confidence
            })
            .eq('id', dbFile.id);
        }

        // Mark as done
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "done", progress: 100 } : x)));
      } catch (err: any) {
        console.error("Upload/OCR error for file", f.file.name, err);
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "error", error: err.message || "Upload failed" } : x)));
      }
    }
    
    // 4. Mark batch as processing
    await supabase
      .from('upload_batches')
      .update({ status: 'processing' })
      .eq('id', batch.id);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Upload Documents</h1>
          <p className={styles.subtitle}>
            Upload textbook photos, scanned pages, or PDFs to extract questions.
          </p>
        </div>
        {files.length > 0 && (
          <div className={styles.headerActions}>
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear All
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUploadAll}
              disabled={pendingCount === 0 || batchCreating || !user}
            >
              {batchCreating ? "Initializing..." : `Upload ${pendingCount > 0 ? `(${pendingCount})` : "All"}`}
            </button>
          </div>
        )}
      </header>

      {/* Drop Zone */}
      <div
        className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          className={styles.fileInput}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
        <div className={styles.dropzoneIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className={styles.dropzoneTitle}>
          {isDragOver ? "Drop files here!" : "Drag & drop files or click to browse"}
        </div>
        <div className={styles.dropzoneDesc}>
          JPG, PNG, PDF — Max 50MB per file — Images auto-compressed
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <span className={styles.fileListTitle}>
              {files.length} file{files.length !== 1 ? "s" : ""} selected
              {doneCount > 0 && <span className={styles.doneTag}> · {doneCount} uploaded</span>}
            </span>
          </div>
          <div className={styles.files}>
            {files.map((f) => (
              <div key={f.id} className={`${styles.fileCard} ${styles[f.status]}`}>
                {/* Thumbnail */}
                <div className={styles.fileThumbnail}>
                  {f.preview ? (
                    <img src={f.preview} alt={f.file.name} />
                  ) : (
                    <div className={styles.pdfIcon}>PDF</div>
                  )}
                </div>
                {/* Info */}
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{f.file.name}</div>
                  <div className={styles.fileMeta}>
                    {(f.file.size / 1024).toFixed(0)} KB
                    {f.status === "compressing" && " · Compressing..."}
                    {f.status === "uploading" && " · Uploading..."}
                    {f.status === "done" && " · ✓ Uploaded"}
                    {f.status === "error" && ` · ✗ ${f.error}`}
                  </div>
                  {/* Progress bar */}
                  {(f.status === "compressing" || f.status === "uploading") && (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {/* Remove */}
                <button
                  className={`btn btn-ghost btn-icon ${styles.removeBtn}`}
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  aria-label="Remove file"
                  disabled={f.status === 'uploading' || f.status === 'compressing'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
