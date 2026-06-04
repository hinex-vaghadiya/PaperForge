import Link from "next/link";
import styles from "./dashboard.module.css";

export default function Dashboard() {
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <p className={styles.greeting}>Welcome back 👋</p>
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
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Uploads</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>❓</div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Questions Extracted</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Approved</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📄</div>
          <div className={styles.statValue}>0</div>
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
