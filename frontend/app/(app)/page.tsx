import Link from "next/link";
import styles from "./dashboard.module.css";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let uploadsCount = 0;
  let questionsExtractedCount = 0;
  let approvedCount = 0;
  let papersCreatedCount = 0;
  let fullName = "there";

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (profile?.full_name) {
      fullName = profile.full_name.split(" ")[0];
    }

    const { count: uploads } = await supabase.from("upload_batches").select("*", { count: "exact", head: true }).eq("created_by", user.id);
    const { count: questions } = await supabase.from("questions").select("*", { count: "exact", head: true }).eq("created_by", user.id);
    const { count: approved } = await supabase.from("questions").select("*", { count: "exact", head: true }).eq("created_by", user.id).eq("approval_status", "approved");
    const { count: papers } = await supabase.from("papers").select("*", { count: "exact", head: true }).eq("created_by", user.id);

    uploadsCount = uploads || 0;
    questionsExtractedCount = questions || 0;
    approvedCount = approved || 0;
    papersCreatedCount = papers || 0;
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <p className={styles.greeting}>Welcome back, {fullName} 👋</p>
        <h1 className={styles.title}>
          <span className={styles.highlight}>PaperForge</span> Dashboard
        </h1>
        <p className={styles.subtitle}>
          Digitize questions from textbooks and build professional exam papers in minutes.
        </p>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📤</div>
          <div className={styles.statValue}>{uploadsCount}</div>
          <div className={styles.statLabel}>Uploads</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>❓</div>
          <div className={styles.statValue}>{questionsExtractedCount}</div>
          <div className={styles.statLabel}>Questions Extracted</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statValue}>{approvedCount}</div>
          <div className={styles.statLabel}>Approved</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📄</div>
          <div className={styles.statValue}>{papersCreatedCount}</div>
          <div className={styles.statLabel}>Papers Created</div>
        </div>
      </div>

      {/* Quick Actions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <Link href="/upload" className={styles.actionCard}>
            <div className={styles.actionIcon}>📷</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Upload Textbook Images</div>
              <div className={styles.actionDesc}>
                Upload photos of textbook pages, scanned documents, or PDF files for OCR processing.
              </div>
            </div>
          </Link>
          <Link href="/review" className={styles.actionCard}>
            <div className={styles.actionIcon}>🔍</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Review Extracted Questions</div>
              <div className={styles.actionDesc}>
                Verify OCR accuracy, approve or reject questions, and crop image-based questions.
              </div>
            </div>
          </Link>
          <Link href="/builder" className={styles.actionCard}>
            <div className={styles.actionIcon}>🏗️</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Build Question Paper</div>
              <div className={styles.actionDesc}>
                Select questions, organize sections, set marks, and generate professional PDF papers.
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Workflow */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.workflow}>
          <div className={styles.workflowStep}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepTitle}>Upload</div>
            <div className={styles.stepDesc}>Photos, scans, or PDFs</div>
          </div>
          <div className={styles.workflowStep}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepTitle}>OCR Extract</div>
            <div className={styles.stepDesc}>AI reads your pages</div>
          </div>
          <div className={styles.workflowStep}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepTitle}>Review</div>
            <div className={styles.stepDesc}>Approve questions</div>
          </div>
          <div className={styles.workflowStep}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepTitle}>Build Paper</div>
            <div className={styles.stepDesc}>Select & organize</div>
          </div>
          <div className={styles.workflowStep}>
            <div className={styles.stepNumber}>5</div>
            <div className={styles.stepTitle}>Export PDF</div>
            <div className={styles.stepDesc}>Professional output</div>
          </div>
        </div>
      </section>
    </div>
  );
}
