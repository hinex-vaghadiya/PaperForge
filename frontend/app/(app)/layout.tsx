import styles from "../shell.module.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

/**
 * App layout — wraps all authenticated pages with sidebar navigation.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.appShell}>
      <Sidebar />
      <MobileNav />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
