"use client";

import { useState, useEffect } from "react";
import styles from "./storage.module.css";
import { createClient } from "@/lib/supabase/client";

interface StoredFile {
  id: string;
  batch_id: string;
  file_name: string;
  storage_path: string;
  processing_status: string;
  created_at: string;
  batch_name: string | null;
}

export default function StoragePage() {
  const supabase = createClient();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("uploaded_files")
        .select("id, batch_id, file_name, storage_path, processing_status, created_at, upload_batches(name)")
        .order("created_at", { ascending: false });

      const mapped = (data || []).map((f: any) => ({
        ...f,
        batch_name: f.upload_batches?.name || null,
      }));
      setFiles(mapped);

      // Load thumbnails
      const thumbs: Record<string, string> = {};
      for (const f of mapped.slice(0, 50)) {
        const { data: urlData } = await supabase.storage
          .from("uploads")
          .createSignedUrl(f.storage_path, 3600);
        if (urlData?.signedUrl) thumbs[f.id] = urlData.signedUrl;
      }
      setPreviews(thumbs);
      setLoading(false);
    }
    load();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.id)));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} image(s) from storage? This cannot be undone.`)) return;
    setDeleting(true);

    const toDelete = files.filter((f) => selected.has(f.id));
    const storagePaths = toDelete.map((f) => f.storage_path);

    // Delete from Supabase Storage
    const { error: storageErr } = await supabase.storage
      .from("uploads")
      .remove(storagePaths);

    if (storageErr) {
      alert("Storage delete failed: " + storageErr.message);
      setDeleting(false);
      return;
    }

    // Delete records from DB
    const ids = toDelete.map((f) => f.id);
    await supabase.from("uploaded_files").delete().in("id", ids);

    setFiles((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
    setDeleting(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatSize = (name: string) => {
    // We don't have file size from DB, show file extension
    const ext = name.split(".").pop()?.toUpperCase() || "FILE";
    return ext;
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>Loading storage…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Storage Manager</h1>
          <p className={styles.subtitle}>
            View and delete uploaded source images to free up storage space.
          </p>
        </div>
        <div className={styles.headerStats}>
          <span className={styles.fileCount}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      {files.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📦</div>
          <div className={styles.emptyTitle}>No files in storage</div>
          <div className={styles.emptyDesc}>
            Upload some documents first, then come back here to manage storage.
          </div>
        </div>
      ) : (
        <>
          {/* Select All bar */}
          <div className={styles.toolbar}>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>
              {selected.size === files.length ? "Deselect All" : "Select All"}
            </button>
            {selected.size > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : `🗑 Delete ${selected.size} File${selected.size !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {/* File Grid */}
          <div className={styles.fileGrid}>
            {files.map((f) => (
              <div
                key={f.id}
                className={`${styles.fileCard} ${selected.has(f.id) ? styles.fileCardSelected : ""}`}
                onClick={() => toggleSelect(f.id)}
              >
                <div className={styles.fileThumbnail}>
                  {previews[f.id] ? (
                    <img src={previews[f.id]} alt={f.file_name} />
                  ) : (
                    <div className={styles.filePlaceholder}>📄</div>
                  )}
                  <input
                    type="checkbox"
                    className={styles.fileCheckbox}
                    checked={selected.has(f.id)}
                    onChange={() => toggleSelect(f.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{f.file_name}</div>
                  <div className={styles.fileMeta}>
                    <span>{formatSize(f.file_name)}</span>
                    <span>{formatDate(f.created_at)}</span>
                  </div>
                  {f.batch_name && (
                    <div className={styles.fileBatch}>{f.batch_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
