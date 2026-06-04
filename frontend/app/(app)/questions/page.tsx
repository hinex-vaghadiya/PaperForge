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
];

export default function QuestionsPage() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
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
      if (searchQuery) query = query.ilike("question_text", `%${searchQuery}%`);

      const { data } = await query;
      setQuestions(data || []);
      setLoading(false);
    }
    load();
  }, [filterType, filterSubject, searchQuery]);

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
              <div className={styles.qActions}>
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
    </div>
  );
}
