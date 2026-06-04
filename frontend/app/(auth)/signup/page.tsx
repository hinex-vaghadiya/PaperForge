"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess("Account created! Check your email to verify, then sign in.");
    setLoading(false);
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#lg2)" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M22 18l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <defs>
                <linearGradient id="lg2" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#00CEC9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.logoTitle}>PaperForge</div>
          <span className={styles.logoSub}>English Pathshala</span>
        </div>

        <h1 className={styles.authTitle}>Create your account</h1>
        <p className={styles.authSubtitle}>Start digitizing questions and building papers</p>

        <form onSubmit={handleSignup} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.field}>
            <label className="label" htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              className="input"
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              placeholder="teacher@englishpathshala.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="input"
              type="password"
              placeholder="Min 6 characters"
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className={styles.divider}>
          Already have an account?
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
