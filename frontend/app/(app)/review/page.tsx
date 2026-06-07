"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./review.module.css";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface UploadedFile {
  id: string;
  batch_id: string;
  file_name: string;
  storage_path: string;
  processing_status: string;
}

interface Question {
  id: string;
  question_text: string | null;
  question_image_path: string | null;
  question_mode: "text" | "image";
  question_type: string;
  marks: number | null;
  subject: string;
  chapter: string | null;
  class_grade: string;
  approval_status: "pending" | "approved" | "rejected";
  confidence_score: number | null;
  source_file_id: string | null;
}

interface Batch {
  id: string;
  name: string | null;
  file_count: number;
  status: string;
  created_at: string;
}

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "numerical", label: "Numerical" },
  { value: "fill_blanks", label: "Fill in the Blanks" },
  { value: "true_false", label: "True / False" },
  { value: "assertion_reason", label: "Assertion & Reason" },
  { value: "match_following", label: "Match the Following" },
  { value: "other", label: "Other" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const TYPE_LABELS: Record<string, string> = {
  fill_blanks: "📝 Fill in the Blanks",
  true_false: "✅ True or False",
  match_following: "🔗 Match the Following",
  mcq: "🔘 Multiple Choice",
  short_answer: "📋 Short Answer",
  long_answer: "📄 Long Answer",
  numerical: "🔢 Numerical",
  assertion_reason: "⚖️ Assertion & Reason",
  other: "📌 Other",
};

function groupByType(questions: Question[]): { type: string; label: string; questions: Question[] }[] {
  const groups: Record<string, Question[]> = {};
  for (const q of questions) {
    const t = q.question_type || "short_answer";
    if (!groups[t]) groups[t] = [];
    groups[t].push(q);
  }
  // Sort by a fixed order
  const order = ["fill_blanks", "true_false", "match_following", "mcq", "short_answer", "long_answer", "numerical", "assertion_reason"];
  return order
    .filter((t) => groups[t])
    .map((t) => ({ type: t, label: TYPE_LABELS[t] || t, questions: groups[t] }));
}
export default function ReviewPage() {
  const supabase = createClient();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFileIdx, setCurrentFileIdx] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  /* Bulk approve modal */
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkChapter, setBulkChapter] = useState("");
  const [bulkClassGrade, setBulkClassGrade] = useState("");

  /* ---------- Fetch batches ---------- */
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("upload_batches")
        .select(`
          *,
          uploaded_files (id, storage_path)
        `)
        .order("created_at", { ascending: false });
        
      const activeBatches = (data || []).filter((b: any) => {
        const activeFiles = b.uploaded_files?.filter((f: any) => f.storage_path !== "deleted") || [];
        return activeFiles.length > 0;
      });

      if (activeBatches.length > 0) {
        setBatches(activeBatches);
        setActiveBatchId(activeBatches[0].id);
      } else {
        setBatches([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  /* ---------- Fetch files for active batch ---------- */
  useEffect(() => {
    if (!activeBatchId) return;
    async function loadFiles() {
      const { data } = await supabase
        .from("uploaded_files")
        .select("*")
        .eq("batch_id", activeBatchId)
        .neq("storage_path", "deleted")
        .order("created_at", { ascending: true });
      setFiles(data || []);
      setCurrentFileIdx(0);
    }
    loadFiles();
  }, [activeBatchId]);

  /* ---------- Fetch questions for active file ---------- */
  useEffect(() => {
    if (!files.length) {
      setQuestions([]);
      return;
    }
    const file = files[currentFileIdx];
    if (!file) return;
    async function loadQuestions() {
      const { data } = await supabase
        .from("questions")
        .select("*")
        .eq("source_file_id", file.id)
        .order("created_at", { ascending: true });
      setQuestions(data || []);
    }
    loadQuestions();
  }, [files, currentFileIdx]);

  /* ---------- Get signed URL for source image ---------- */
  useEffect(() => {
    if (!files.length) {
      setImageUrl(null);
      return;
    }
    const file = files[currentFileIdx];
    if (!file) return;
    async function getUrl() {
      const { data } = await supabase.storage
        .from("uploads")
        .createSignedUrl(file.storage_path, 3600);
      setImageUrl(data?.signedUrl || null);
    }
    getUrl();
  }, [files, currentFileIdx]);

  /* ---------- Actions ---------- */
  const updateQuestion = useCallback(async (id: string, updates: Partial<Question>) => {
    await supabase.from("questions").update(updates).eq("id", id);
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  }, []);

  const approve = (id: string) => updateQuestion(id, { approval_status: "approved" });
  const reject = (id: string) => updateQuestion(id, { approval_status: "rejected" });

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditText(q.question_text || "");
  };
  const saveEdit = (id: string) => {
    updateQuestion(id, { question_text: editText });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const openApproveModal = () => {
    if (pendingCount === 0) return;
    setShowApproveModal(true);
  };

  const confirmApproveAll = async () => {
    if (!bulkSubject.trim()) return alert("Please enter a subject.");
    const pendingQs = questions.filter((q) => q.approval_status === "pending");
    if (!pendingQs.length) return;

    const updates: Partial<Question> = {
      approval_status: "approved",
      subject: bulkSubject.trim(),
      chapter: bulkChapter.trim() || null,
      class_grade: bulkClassGrade.trim(),
    };

    for (const q of pendingQs) {
      await supabase.from("questions").update(updates).eq("id", q.id);
    }

    setQuestions((prev) =>
      prev.map((q) =>
        q.approval_status === "pending" ? { ...q, ...updates } : q
      )
    );

    setShowApproveModal(false);
    setBulkSubject("");
    setBulkChapter("");
    setBulkClassGrade("");
  };

  /* ---------- Stats ---------- */
  const pendingCount = questions.filter((q) => q.approval_status === "pending").length;
  const approvedCount = questions.filter((q) => q.approval_status === "approved").length;
  const rejectedCount = questions.filter((q) => q.approval_status === "rejected").length;

  const currentFile = files[currentFileIdx];

  /* ---------- Confidence badge ---------- */
  const confBadge = (score: number | null) => {
    if (score === null) return null;
    const pct = Math.round(score * 100);
    let cls = styles.confLow;
    if (pct >= 85) cls = styles.confHigh;
    else if (pct >= 60) cls = styles.confMed;
    return <span className={`${styles.confidenceBadge} ${cls}`}>{pct}%</span>;
  };

  /* ---------- Render ---------- */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>Loading review queue…</div>
        </div>
      </div>
    );
  }

  if (!batches.length) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Review Queue</h1>
            <p className={styles.subtitle}>Verify extracted questions before adding them to your bank.</p>
          </div>
        </header>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No uploads to review</div>
          <div className={styles.emptyDesc}>
            <Link href="/upload" style={{ color: "var(--primary-light)", fontWeight: 600 }}>Upload documents</Link>{" "}
            first, then come back to review extracted questions.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Review Queue</h1>
          <p className={styles.subtitle}>Verify extracted questions before adding them to your bank.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-success btn-sm"
            onClick={openApproveModal}
            disabled={pendingCount === 0}
          >
            ✓ Approve All ({pendingCount})
          </button>
        </div>
      </header>

      {/* Stats */}
      {questions.length > 0 && (
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={`${styles.statDot} ${styles.dotPending}`} />
            {pendingCount} Pending
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statDot} ${styles.dotApproved}`} />
            {approvedCount} Approved
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statDot} ${styles.dotRejected}`} />
            {rejectedCount} Rejected
          </div>
        </div>
      )}

      {/* Batch Selector */}
      <div className={styles.batchSelector}>
        {batches.map((b) => (
          <button
            key={b.id}
            className={`${styles.batchChip} ${b.id === activeBatchId ? styles.batchChipActive : ""}`}
            onClick={() => setActiveBatchId(b.id)}
          >
            {b.name || "Unnamed Batch"}
            <span className={styles.batchCount}>{b.file_count}</span>
          </button>
        ))}
      </div>

      {/* File Navigator */}
      {files.length > 0 && (
        <div className={styles.fileNav}>
          <button
            className={styles.fileNavBtn}
            disabled={currentFileIdx === 0}
            onClick={() => setCurrentFileIdx((i) => i - 1)}
          >
            ‹
          </button>
          <span className={styles.fileNavInfo}>
            File {currentFileIdx + 1} of {files.length}
          </span>
          <button
            className={styles.fileNavBtn}
            disabled={currentFileIdx >= files.length - 1}
            onClick={() => setCurrentFileIdx((i) => i + 1)}
          >
            ›
          </button>
          {currentFile && (
            <span className={styles.fileNavName}>{currentFile.file_name}</span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {files.length === 0 ? (
        <div className={styles.emptyState} style={{ marginTop: "var(--space-2xl)" }}>
          <div className={styles.emptyIcon}>🗑️</div>
          <div className={styles.emptyTitle}>Nothing to review here</div>
          <div className={styles.emptyDesc}>All files in this batch have been deleted from storage.</div>
        </div>
      ) : (
        <div className={styles.reviewLayout}>
        {/* Left: Source Image */}
        <div className={styles.sourcePanel}>
          <div className={styles.panelHeader}>
            <span>Source Image</span>
            <div className={styles.zoomControls}>
              <button className={styles.zoomBtn} onClick={() => setZoom((z) => Math.max(25, z - 25))}>−</button>
              <span className={styles.zoomLevel}>{zoom}%</span>
              <button className={styles.zoomBtn} onClick={() => setZoom((z) => Math.min(300, z + 25))}>+</button>
              <button className={styles.zoomBtn} onClick={() => setZoom(100)} title="Reset zoom">↺</button>
            </div>
          </div>
          <div className={styles.imageContainer}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Source document"
                className={styles.sourceImage}
                style={{ width: `${zoom}%` }}
                draggable={false}
              />
            ) : (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Loading image…</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Questions grouped by type */}
        <div className={styles.questionsPanel}>
          {questions.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <div className={styles.emptyTitle}>No questions extracted yet</div>
              <div className={styles.emptyDesc}>
                OCR processing hasn&apos;t run for this file yet. Questions will appear here once the backend processes it.
              </div>
            </div>
          ) : (
            groupByType(questions).map((group) => (
              <div key={group.type} className={styles.typeSection}>
                <div className={styles.typeSectionHeader}>
                  <span className={styles.typeSectionTitle}>{group.label}</span>
                  <span className={styles.typeSectionCount}>{group.questions.length} question{group.questions.length !== 1 ? "s" : ""}</span>
                </div>
                {group.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`${styles.questionCard} ${
                      q.approval_status === "approved" ? styles.questionCardApproved : ""
                    } ${q.approval_status === "rejected" ? styles.questionCardRejected : ""}`}
                  >
                    {/* Header */}
                    <div className={styles.questionHeader}>
                      <span className={styles.questionNumber}>{idx + 1}</span>
                      <div className={styles.questionBadges}>
                        {q.question_mode === "image" && (
                          <span className={styles.imageModeTag}>📷 Image</span>
                        )}
                        {confBadge(q.confidence_score)}
                        <span className={`badge ${
                          q.approval_status === "approved" ? "badge-success" :
                          q.approval_status === "rejected" ? "badge-danger" :
                          "badge-warning"
                        }`}>
                          {q.approval_status}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className={styles.questionBody}>
                      {editingId === q.id ? (
                        <textarea
                          className={styles.questionTextEditing}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <div className={styles.questionText}>
                          {q.question_text || "[No text — image-only question]"}
                        </div>
                      )}
                    </div>

                    {/* Type badge */}
                    <div className={styles.metaEditor}>
                      <div className={styles.metaField}>
                        <label>Type</label>
                        <select
                          value={q.question_type}
                          onChange={(e) => updateQuestion(q.id, { question_type: e.target.value })}
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={styles.questionActions}>
                      <button
                        className={`${styles.actionBtn} ${styles.approveBtn} ${
                          q.approval_status === "approved" ? styles.approvedBtn : ""
                        }`}
                        onClick={() => approve(q.id)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.rejectBtn} ${
                          q.approval_status === "rejected" ? styles.rejectedBtn : ""
                        }`}
                        onClick={() => reject(q.id)}
                      >
                        ✗ Reject
                      </button>
                      {editingId === q.id ? (
                        <>
                          <button className={`${styles.actionBtn} ${styles.approveBtn}`} onClick={() => saveEdit(q.id)}>
                            💾 Save
                          </button>
                          <button className={`${styles.actionBtn}`} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => startEdit(q)}>
                          ✎ Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        </div>
      )}

      {/* Bulk Approve Modal */}
      {showApproveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowApproveModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Set Metadata for All Questions</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowApproveModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>These values will be applied to all <strong>{pendingCount}</strong> pending questions before approving.</p>
              <div className={styles.modalField}>
                <label>Subject *</label>
                <input
                  type="text"
                  value={bulkSubject}
                  placeholder="e.g. Science, English, Math"
                  onChange={(e) => setBulkSubject(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.modalField}>
                <label>Chapter / Unit</label>
                <input
                  type="text"
                  value={bulkChapter}
                  placeholder="e.g. Ch 3 - Natural Resources"
                  onChange={(e) => setBulkChapter(e.target.value)}
                />
              </div>
              <div className={styles.modalField}>
                <label>Standard / Class</label>
                <input
                  type="text"
                  value={bulkClassGrade}
                  placeholder="e.g. Class 10, Grade 8"
                  onChange={(e) => setBulkClassGrade(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowApproveModal(false)}>Cancel</button>
              <button className="btn btn-success btn-sm" onClick={confirmApproveAll} disabled={!bulkSubject.trim()}>
                ✓ Approve All {pendingCount} Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
