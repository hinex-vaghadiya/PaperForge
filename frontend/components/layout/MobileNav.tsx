"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileNav.module.css";

const navItems = [
  { label: "Home", href: "/", icon: "⊞" },
  { label: "Upload", href: "/upload", icon: "↑" },
  { label: "Review", href: "/review", icon: "✓" },
  { label: "Bank", href: "/questions", icon: "📖" },
  { label: "Builder", href: "/builder", icon: "📄" },
  { label: "Archive", href: "/papers", icon: "📁" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.mobileNav}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.active : ""}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
