"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#lg)" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M22 18l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#00CEC9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.logoTitle}>PaperForge</div>
          <span className={styles.logoSub}>English Pathshala</span>
        </div>

        <h1 className={styles.authTitle}>Welcome back</h1>
        <p className={styles.authSubtitle}>Sign in to your account to continue</p>

        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className="label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="teacher@englishpathshala.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className={styles.divider}>
          Don&apos;t have an account?
          <Link href="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
