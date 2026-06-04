"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./papers.module.css";
import { createClient } from "@/lib/supabase/client";
import { generatePDF, downloadBlob, checkBackendHealth } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  school_name: string;
  exam_name: string | null;
  subject: string;
  class_grade: string;
  duration_minutes: number | null;
  max_marks: number | null;
  total_marks: number | null;
  sections: any[];
  status: "draft" | "finalized" | "archived";
  pdf_storage_path: string | null;
  created_at: string;
}

export default function PapersPage() {
  const supabase = createClient();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("papers")
        .select("*")
        .order("created_at", { ascending: false });
      setPapers(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const deletePaper = async (id: string) => {
    if (!confirm("Delete this paper permanently?")) return;
    await supabase.from("papers").delete().eq("id", id);
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  const regeneratePDF = async (paper: Paper) => {
    setGeneratingId(paper.id);
    try {
      const backendUp = await checkBackendHealth();
      if (!backendUp) {
        alert("Backend is offline. Deploy to HuggingFace Spaces to enable PDF generation.");
        return;
      }

      const pdfPayload = {
        title: paper.title,
        school_name: paper.school_name,
        exam_name: paper.exam_name || "",
        subject: paper.subject,
        class_grade: paper.class_grade,
        duration_minutes: paper.duration_minutes,
        max_marks: paper.max_marks,
        total_marks: paper.total_marks,
        instructions: "",
        sections: Array.isArray(paper.sections) ? paper.sections : [],
      };

      const { blob, filename } = await generatePDF(pdfPayload);
      downloadBlob(blob, filename);

      await supabase.from("papers").update({ status: "finalized" }).eq("id", paper.id);
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...p, status: "finalized" } : p)));
    } catch (err: any) {
      alert("PDF generation failed: " + err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const getTotalQuestions = (sections: any[]) => {
    if (!Array.isArray(sections)) return 0;
    return sections.reduce((sum: number, s: any) => sum + (s.questions?.length || 0), 0);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border-hover)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Paper Archive</h1>
          <p className={styles.subtitle}>View, download, and manage your generated exam papers.</p>
        </div>
        <Link href="/builder" className="btn btn-primary">
          + New Paper
        </Link>
      </header>

      {papers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <div className={styles.emptyTitle}>No papers created yet</div>
          <div className={styles.emptyDesc}>
            Use the{" "}
            <Link href="/builder" style={{ color: "var(--primary-light)", fontWeight: 600 }}>Paper Builder</Link>{" "}
            to assemble your first exam paper.
          </div>
        </div>
      ) : (
        <div className={styles.papersGrid}>
          {papers.map((paper) => (
            <div key={paper.id} className={styles.paperCard}>
              <div className={styles.paperCardHeader}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className={styles.paperTitle}>{paper.title}</div>
                  <span
                    className={`${styles.statusBadge} ${
                      paper.status === "finalized" ? styles.statusFinalized :
                      paper.status === "archived" ? styles.statusArchived :
                      styles.statusDraft
                    }`}
                  >
                    {paper.status}
                  </span>
                </div>
                <div className={styles.paperMeta}>
                  <span className={styles.paperMetaItem}>📚 {paper.subject}</span>
                  <span className={styles.paperMetaItem}>🎓 {paper.class_grade}</span>
                  {paper.duration_minutes && (
                    <span className={styles.paperMetaItem}>⏱ {paper.duration_minutes} min</span>
                  )}
                  <span className={styles.paperMetaItem}>📅 {formatDate(paper.created_at)}</span>
                </div>
              </div>

              <div className={styles.paperStats}>
                <div className={styles.paperStat}>
                  <div className={styles.paperStatValue}>{getTotalQuestions(paper.sections)}</div>
                  <div className={styles.paperStatLabel}>Questions</div>
                </div>
                <div className={styles.paperStat}>
                  <div className={styles.paperStatValue}>{Array.isArray(paper.sections) ? paper.sections.length : 0}</div>
                  <div className={styles.paperStatLabel}>Sections</div>
                </div>
                <div className={styles.paperStat}>
                  <div className={styles.paperStatValue}>{paper.total_marks || paper.max_marks || "—"}</div>
                  <div className={styles.paperStatLabel}>Marks</div>
                </div>
              </div>

              <div className={styles.paperActions}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => regeneratePDF(paper)}
                  disabled={generatingId === paper.id}
                >
                  {generatingId === paper.id ? "Generating…" : "📄 Generate PDF"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deletePaper(paper.id)}>
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
