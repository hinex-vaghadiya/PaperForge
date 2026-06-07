"use client";

import { useState, useEffect } from "react";
import styles from "./builder.module.css";
import { createClient } from "@/lib/supabase/client";
import { generatePDF, downloadBlob, checkBackendHealth } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Question {
  id: string;
  question_text: string | null;
  question_mode: "text" | "image";
  question_type: string;
  marks: number | null;
  subject: string;
  chapter: string | null;
  class_grade: string;
}

interface SectionQuestion {
  question: Question;
  order: number;
}

interface Section {
  id: string;
  name: string;
  questions: SectionQuestion[];
}

interface PaperInfo {
  title: string;
  school_name: string;
  exam_name: string;
  subject: string;
  class_grade: string;
  duration_minutes: string;
  max_marks: string;
  instructions: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function BuilderPage() {
  const supabase = createClient();
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([
    { id: "sec-1", name: "Section A", questions: [] },
  ]);
  const [paperInfo, setPaperInfo] = useState<PaperInfo>({
    title: "",
    school_name: "English Pathshala",
    exam_name: "",
    subject: "",
    class_grade: "",
    duration_minutes: "",
    max_marks: "",
    instructions: "",
  });
  const [pickerOpen, setPickerOpen] = useState<string | null>(null); // section id
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  /* Picker filters */
  const [pickerFilterType, setPickerFilterType] = useState("");
  const [pickerFilterSubject, setPickerFilterSubject] = useState("");
  const [pickerFilterChapter, setPickerFilterChapter] = useState("");
  const [pickerFilterGrade, setPickerFilterGrade] = useState("");

  const PICKER_TYPES = [
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

  /* Load approved questions */
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("questions")
        .select("id, question_text, question_mode, question_type, marks, subject, chapter, class_grade")
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false });
      setAvailableQuestions(data || []);
    }
    load();
  }, []);

  /* Helpers */
  const usedIds = new Set(sections.flatMap((s) => s.questions.map((q) => q.question.id)));

  const addSection = () => {
    const id = `sec-${Date.now()}`;
    setSections((prev) => [...prev, { id, name: `Section ${String.fromCharCode(65 + prev.length)}`, questions: [] }]);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSectionName = (id: string, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, questions: s.questions.filter((q) => q.question.id !== questionId) }
          : s
      )
    );
  };

  const updateQuestionMarks = (sectionId: string, questionId: string, marks: number | null) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              questions: s.questions.map((sq) =>
                sq.question.id === questionId
                  ? { ...sq, question: { ...sq.question, marks } }
                  : sq
              ),
            }
          : s
      )
    );
  };

  /* Question picker */
  const openPicker = (sectionId: string) => {
    setPickerOpen(sectionId);
    setPickerSelected(new Set());
  };

  const closePicker = () => {
    setPickerOpen(null);
    setPickerSelected(new Set());
    setPickerFilterType("");
    setPickerFilterSubject("");
    setPickerFilterChapter("");
    setPickerFilterGrade("");
  };

  const togglePickerQ = (id: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmPicker = () => {
    if (!pickerOpen) return;
    const selectedQs = availableQuestions.filter((q) => pickerSelected.has(q.id));
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== pickerOpen) return s;
        const existing = s.questions.length;
        const newQs: SectionQuestion[] = selectedQs.map((q, i) => ({
          question: q,
          order: existing + i + 1,
        }));
        return { ...s, questions: [...s.questions, ...newQs] };
      })
    );
    closePicker();
  };

  /* Marks summary */
  const totalMarks = sections.reduce(
    (sum, s) => sum + s.questions.reduce((sq, q) => sq + (q.question.marks || 0), 0),
    0
  );
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  /* Generate PDF */
  const handleGenerate = async () => {
    if (totalQuestions === 0) return alert("Add at least one question.");
    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build paper payload
      const sectionPayload = sections.map((s) => ({
        name: s.name,
        questions: s.questions.map((sq) => ({
          question_id: sq.question.id,
          question_text: sq.question.question_text,
          question_mode: sq.question.question_mode,
          question_type: sq.question.question_type,
          marks: sq.question.marks,
          order: sq.order,
          override_heading: sq.override_heading,
        })),
      }));

      // 1. Save paper to database
      const dbData = {
        created_by: user.id,
        title: paperInfo.title || "Untitled Paper",
        school_name: paperInfo.school_name,
        exam_name: paperInfo.exam_name,
        subject: paperInfo.subject,
        class_grade: paperInfo.class_grade,
        duration_minutes: paperInfo.duration_minutes ? parseInt(paperInfo.duration_minutes) : null,
        max_marks: paperInfo.max_marks ? parseInt(paperInfo.max_marks) : totalMarks,
        instructions: paperInfo.instructions,
        total_marks: totalMarks,
        sections: sectionPayload,
        status: "draft",
      };

      const { data: paper, error } = await supabase
        .from("papers")
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      // 2. Try to generate PDF via backend
      const backendUp = await checkBackendHealth();

      if (backendUp) {
        try {
          const pdfPayload = {
            title: paper.title,
            school_name: paper.school_name,
            exam_name: paper.exam_name || "",
            subject: paper.subject,
            class_grade: paper.class_grade,
            duration_minutes: paper.duration_minutes,
            max_marks: paper.max_marks,
            total_marks: paper.total_marks,
            instructions: paper.instructions || "",
            sections: sectionPayload,
          };

          const { blob, filename } = await generatePDF(pdfPayload);
          downloadBlob(blob, filename);

          // Update paper status to finalized
          await supabase
            .from("papers")
            .update({ status: "finalized" })
            .eq("id", paper.id);

          alert(`✅ Paper "${paper.title}" generated and downloaded!`);
        } catch (pdfErr: any) {
          console.error("PDF generation failed:", pdfErr);
          alert(`Paper saved to archive! PDF generation failed: ${pdfErr.message}. You can retry from the Paper Archive.`);
        }
      } else {
        alert(`Paper "${paper.title}" saved to archive! Backend is offline — deploy to HuggingFace Spaces to enable PDF generation.`);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }

    setGenerating(false);
  };

  const updateInfo = (key: keyof PaperInfo, value: string) => {
    setPaperInfo((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Paper Builder</h1>
          <p className={styles.subtitle}>Assemble questions into professional exam papers.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm" onClick={addSection}>
            + Add Section
          </button>
        </div>
      </header>

      {/* Paper Info */}
      <div className={styles.paperInfo}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Paper Title</label>
          <input className={styles.fieldInput} value={paperInfo.title} placeholder="e.g. Mid-Term Examination 2025" onChange={(e) => updateInfo("title", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>School Name</label>
          <input className={styles.fieldInput} value={paperInfo.school_name} onChange={(e) => updateInfo("school_name", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Name</label>
          <input className={styles.fieldInput} value={paperInfo.exam_name} placeholder="e.g. Unit Test 3" onChange={(e) => updateInfo("exam_name", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Subject</label>
          <input className={styles.fieldInput} value={paperInfo.subject} placeholder="e.g. Physics" onChange={(e) => updateInfo("subject", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Class / Grade</label>
          <input className={styles.fieldInput} value={paperInfo.class_grade} placeholder="e.g. Class 10" onChange={(e) => updateInfo("class_grade", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Duration (min)</label>
          <input className={styles.fieldInput} type="number" value={paperInfo.duration_minutes} placeholder="e.g. 120" onChange={(e) => updateInfo("duration_minutes", e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Max Marks</label>
          <input className={styles.fieldInput} type="number" value={paperInfo.max_marks} placeholder={`Auto: ${totalMarks}`} onChange={(e) => updateInfo("max_marks", e.target.value)} />
        </div>
        <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
          <label className={styles.fieldLabel}>Instructions</label>
          <input className={styles.fieldInput} value={paperInfo.instructions} placeholder="e.g. Attempt all questions. Each section is compulsory." onChange={(e) => updateInfo("instructions", e.target.value)} />
        </div>
      </div>

      {/* Builder Layout */}
      <div className={styles.builderLayout}>
        {/* Left: Sections */}
        <div className={styles.sectionsArea}>
          {sections.map((section) => (
            <div key={section.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <input
                    className={styles.sectionNameInput}
                    value={section.name}
                    onChange={(e) => updateSectionName(section.id, e.target.value)}
                  />
                  <span className={styles.sectionMeta}>
                    {section.questions.length} Q · {section.questions.reduce((s, q) => s + (q.question.marks || 0), 0)} marks
                  </span>
                </div>
                <div className={styles.sectionActions}>
                  {sections.length > 1 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removeSection(section.id)} style={{ fontSize: "0.75rem" }}>
                      ✕ Remove
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.sectionBody}>
                {section.questions.map((sq, idx) => {
                  const prevQ = idx > 0 ? section.questions[idx - 1] : null;
                  const showGroupHeading = !prevQ || prevQ.question.question_type !== sq.question.question_type;
                  const typeLabel = PICKER_TYPES.find(t => t.value === sq.question.question_type)?.label || sq.question.question_type.replace("_", " ").toUpperCase();

                  return (
                    <div key={sq.question.id + idx} className={styles.questionWrapper}>
                      {showGroupHeading && (
                        <input
                          className={styles.qGroupHeadingInput}
                          value={sq.override_heading ?? typeLabel}
                          placeholder={typeLabel}
                          onChange={(e) => {
                            setSections(prev => prev.map(s => {
                              if (s.id !== section.id) return s;
                              return {
                                ...s,
                                questions: s.questions.map(q => q.question.id === sq.question.id ? { ...q, override_heading: e.target.value } : q)
                              };
                            }));
                          }}
                        />
                      )}
                      <div className={styles.sectionQuestion}>
                        <div className={styles.dragHandle}>⠿</div>
                        <div className={styles.sqContent}>
                          <div className={styles.sqText}>
                            {idx + 1}. {sq.question.question_text || "[Image question]"}
                          </div>
                          <div className={styles.sqMeta}>
                            <span>{sq.question.question_type.replace("_", " ")}</span>
                            <span className={styles.marksInput}>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={sq.question.marks ?? ""}
                                placeholder="—"
                                onChange={(e) =>
                                  updateQuestionMarks(
                                    section.id,
                                    sq.question.id,
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                              <label>marks</label>
                            </span>
                          </div>
                        </div>
                        <button
                          className={styles.sqRemove}
                          onClick={() => removeQuestion(section.id, sq.question.id)}
                          title="Remove from section"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button className={styles.addQuestionBtn} onClick={() => openPicker(section.id)}>
                  + Add Questions from Bank
                </button>
              </div>
            </div>
          ))}
          <button className={styles.addSectionBtn} onClick={addSection}>
            + Add New Section
          </button>
        </div>

        {/* Right: Summary */}
        <div className={styles.summaryPanel}>
          <div className={styles.summaryHeader}>Paper Summary</div>
          <div className={styles.summaryBody}>
            {sections.map((s) => (
              <div key={s.id} className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{s.name}</span>
                <span className={styles.summaryValue}>
                  {s.questions.length} Q · {s.questions.reduce((sum, q) => sum + (q.question.marks || 0), 0)}m
                </span>
              </div>
            ))}
            <div className={styles.summaryDivider} />
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{totalQuestions} Q · {totalMarks} marks</span>
            </div>
            <button
              className={`btn btn-primary ${styles.generateBtn}`}
              onClick={handleGenerate}
              disabled={generating || totalQuestions === 0}
            >
              {generating ? "Saving…" : "💾 Save & Generate PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Question Picker Modal */}
      {pickerOpen && (
        <div className={styles.pickerOverlay} onClick={closePicker}>
          <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <span>Select Questions ({pickerSelected.size} selected)</span>
              <button className="btn btn-ghost btn-sm" onClick={closePicker}>✕</button>
            </div>
            <div className={styles.pickerBody}>
              {/* Picker Filters */}
              <div className={styles.pickerFilters}>
                <select value={pickerFilterType} onChange={(e) => setPickerFilterType(e.target.value)} className={styles.pickerFilterSelect}>
                  {PICKER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select value={pickerFilterSubject} onChange={(e) => setPickerFilterSubject(e.target.value)} className={styles.pickerFilterSelect}>
                  <option value="">All Subjects</option>
                  {[...new Set(availableQuestions.map((q) => q.subject).filter(Boolean))].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select value={pickerFilterChapter} onChange={(e) => setPickerFilterChapter(e.target.value)} className={styles.pickerFilterSelect}>
                  <option value="">All Chapters</option>
                  {[...new Set(availableQuestions.map((q) => q.chapter).filter(Boolean))].map((c) => (
                    <option key={c as string} value={c as string}>{c}</option>
                  ))}
                </select>
                <select value={pickerFilterGrade} onChange={(e) => setPickerFilterGrade(e.target.value)} className={styles.pickerFilterSelect}>
                  <option value="">All Standards</option>
                  {[...new Set(availableQuestions.map((q) => q.class_grade).filter(Boolean))].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              {availableQuestions
                .filter((q) => !usedIds.has(q.id))
                .filter((q) => !pickerFilterType || q.question_type === pickerFilterType)
                .filter((q) => !pickerFilterSubject || q.subject === pickerFilterSubject)
                .filter((q) => !pickerFilterChapter || q.chapter === pickerFilterChapter)
                .filter((q) => !pickerFilterGrade || q.class_grade === pickerFilterGrade)
                .length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>No matching questions</div>
                  <div className={styles.emptyDesc}>Try adjusting your filters, or your bank may be empty.</div>
                </div>
              ) : (
                availableQuestions
                  .filter((q) => !usedIds.has(q.id))
                  .filter((q) => !pickerFilterType || q.question_type === pickerFilterType)
                  .filter((q) => !pickerFilterSubject || q.subject === pickerFilterSubject)
                  .filter((q) => !pickerFilterChapter || q.chapter === pickerFilterChapter)
                  .filter((q) => !pickerFilterGrade || q.class_grade === pickerFilterGrade)
                  .map((q) => (
                    <div
                      key={q.id}
                      className={`${styles.pickerQ} ${pickerSelected.has(q.id) ? styles.pickerQSelected : ""}`}
                      onClick={() => togglePickerQ(q.id)}
                    >
                      <input type="checkbox" checked={pickerSelected.has(q.id)} readOnly style={{ accentColor: "var(--primary)" }} />
                      <div className={styles.pickerQText}>
                        {q.question_text || "[Image question]"}
                      </div>
                      <div className={styles.pickerQMeta}>
                        {q.question_type.replace("_", " ")} · {q.marks ?? "—"}m
                      </div>
                    </div>
                  ))
              )}
            </div>
            <div className={styles.pickerFooter}>
              <button className="btn btn-ghost btn-sm" onClick={closePicker}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={confirmPicker} disabled={pickerSelected.size === 0}>
                Add {pickerSelected.size} Question{pickerSelected.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
