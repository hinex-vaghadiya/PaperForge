"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./questions.module.css";
import { createClient } from "@/lib/supabase/client";

interface Question {
  id: string;
  question_text: string | null;
  question_mode: "text" | "image";
  question_type: string;
  marks: number | null;
  subject: string;
  chapter: string | null;
  class_grade: string;
  approval_status: string;
}

const QUESTION_TYPES = [
  { value: "", label: "All Types" },
  { value: "mcq", label: "MCQ" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "numerical", label: "Numerical" },
  { value: "fill_blanks", label: "Fill in Blanks" },
  { value: "true_false", label: "True/False" },
  { value: "assertion_reason", label: "Assertion & Reason" },
  { value: "match_following", label: "Match Following" },
  { value: "other", label: "Other" },
];

export default function QuestionsPage() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("questions")
        .select("*")
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false });

      if (filterType) query = query.eq("question_type", filterType);
      if (filterSubject) query = query.ilike("subject", `%${filterSubject}%`);
      if (filterChapter) query = query.ilike("chapter", `%${filterChapter}%`);
      if (filterGrade) query = query.ilike("class_grade", `%${filterGrade}%`);
      if (searchQuery) query = query.ilike("question_text", `%${searchQuery}%`);

      const { data } = await query;
      setQuestions(data || []);
      setLoading(false);
    }
    load();
  }, [filterType, filterSubject, filterChapter, filterGrade, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((q) => q.id)));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} question(s)?`)) return;
    const ids = Array.from(selected);
    await supabase.from("questions").delete().in("id", ids);
    setQuestions((prev) => prev.filter((q) => !selected.has(q.id)));
    setSelected(new Set());
  };

  const subjects = [...new Set(questions.map((q) => q.subject).filter(Boolean))];
  const chapters = [...new Set(questions.map((q) => q.chapter).filter(Boolean))] as string[];
  const grades = [...new Set(questions.map((q) => q.class_grade).filter(Boolean))];

  const saveEdit = async () => {
    if (!editingQ) return;
    const { error } = await supabase
      .from("questions")
      .update({
        question_text: editingQ.question_text,
        question_type: editingQ.question_type,
        marks: editingQ.marks,
        subject: editingQ.subject,
        chapter: editingQ.chapter,
        class_grade: editingQ.class_grade,
      })
      .eq("id", editingQ.id);

    if (error) {
      alert("Failed to save edit: " + error.message);
      return;
    }

    setQuestions((prev) =>
      prev.map((q) => (q.id === editingQ.id ? editingQ : q))
    );
    setEditingQ(null);
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
          <h1 className={styles.title}>Question Bank</h1>
          <p className={styles.subtitle}>Browse, filter, and manage your approved questions.</p>
        </div>
        <Link href="/builder" className="btn btn-primary">
          Build Paper →
        </Link>
      </header>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search questions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterChapter}
          onChange={(e) => setFilterChapter(e.target.value)}
        >
          <option value="">All Chapters</option>
          {chapters.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
        >
          <option value="">All Standards</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <div className={styles.resultCount}>{questions.length} question{questions.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📖</div>
          <div className={styles.emptyTitle}>No approved questions yet</div>
          <div className={styles.emptyDesc}>
            Head to the{" "}
            <Link href="/review" style={{ color: "var(--primary-light)", fontWeight: 600 }}>Review Queue</Link>{" "}
            to approve extracted questions.
          </div>
        </div>
      ) : (
        <div className={styles.questionGrid}>
          {questions.map((q) => (
            <div
              key={q.id}
              className={`${styles.qRow} ${selected.has(q.id) ? styles.qRowSelected : ""}`}
              onClick={() => toggleSelect(q.id)}
            >
              <input
                type="checkbox"
                className={styles.qCheckbox}
                checked={selected.has(q.id)}
                onChange={() => toggleSelect(q.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className={styles.qText}>
                {q.question_text || "[Image question]"}
              </div>
              <div className={styles.qType}>{q.question_type.replace("_", " ")}</div>
              <div className={styles.qMarks}>{q.marks ?? "—"}</div>
              <div className={styles.qSubject}>{q.subject}</div>
              <div className={styles.qChapter}>{q.chapter || "—"}</div>
              <div className={styles.qGrade}>{q.class_grade || "—"}</div>
              <div className={styles.qActions}>
                <button
                  className={styles.qActionBtn}
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingQ(q);
                  }}
                >
                  ✎
                </button>
                <button
                  className={`${styles.qActionBtn} ${styles.deleteBtn}`}
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this question?")) {
                      supabase.from("questions").delete().eq("id", q.id).then(() => {
                        setQuestions((prev) => prev.filter((x) => x.id !== q.id));
                      });
                    }
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selection Action Bar */}
      {selected.size > 0 && (
        <div className={styles.selectionBar}>
          <span className={styles.selectionInfo}>
            {selected.size} question{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className={styles.selectionActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Deselect
            </button>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>
              {selected.size === questions.length ? "Deselect All" : "Select All"}
            </button>
            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
              Delete Selected
            </button>
            <Link href="/builder" className="btn btn-primary btn-sm">
              Add to Paper →
            </Link>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingQ && (
        <div className={styles.modalOverlay} onClick={() => setEditingQ(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Question</h3>
              <button className={styles.closeModal} onClick={() => setEditingQ(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label>Question Text</label>
                <textarea
                  className={styles.modalTextarea}
                  value={editingQ.question_text || ""}
                  onChange={(e) => setEditingQ({ ...editingQ, question_text: e.target.value })}
                  rows={4}
                />
              </div>
              <div className={styles.modalFieldRow}>
                <div className={styles.modalField}>
                  <label>Type</label>
                  <select
                    className={styles.modalInput}
                    value={editingQ.question_type}
                    onChange={(e) => setEditingQ({ ...editingQ, question_type: e.target.value })}
                  >
                    {QUESTION_TYPES.filter((t) => t.value !== "").map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.modalField}>
                  <label>Marks</label>
                  <input
                    type="number"
                    className={styles.modalInput}
                    value={editingQ.marks ?? ""}
                    onChange={(e) =>
                      setEditingQ({
                        ...editingQ,
                        marks: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.modalFieldRow}>
                <div className={styles.modalField}>
                  <label>Subject</label>
                  <input
                    className={styles.modalInput}
                    value={editingQ.subject}
                    onChange={(e) => setEditingQ({ ...editingQ, subject: e.target.value })}
                  />
                </div>
                <div className={styles.modalField}>
                  <label>Chapter</label>
                  <input
                    className={styles.modalInput}
                    value={editingQ.chapter || ""}
                    onChange={(e) => setEditingQ({ ...editingQ, chapter: e.target.value })}
                  />
                </div>
                <div className={styles.modalField}>
                  <label>Class/Grade</label>
                  <input
                    className={styles.modalInput}
                    value={editingQ.class_grade}
                    onChange={(e) => setEditingQ({ ...editingQ, class_grade: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setEditingQ(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
