"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function checkAdminAndLoadUsers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, email, created_at")
        .order("created_at", { ascending: false });

      if (profiles) setUsers(profiles);
      setLoading(false);
    }
    checkAdminAndLoadUsers();
  }, [supabase, router]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      alert("Failed to update role: " + error.message);
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Delete this user's profile? Note: This deletes their PaperForge profile data but not their underlying authentication account, which requires Superadmin access.")) return;
    
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) {
      alert("Failed to delete profile: " + error.message);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  };

  if (loading) {
    return <div className={styles.page}>Loading Admin Panel...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Admin Panel</h1>
        <p className={styles.subtitle}>Manage registered users and their roles.</p>
      </header>

      <div className={styles.tableContainer}>
        {users.length === 0 ? (
          <div className={styles.emptyState}>No users found.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.email || "N/A"}</td>
                  <td>
                    {user.email === "hinexvaghadiya12@gmail.com" ? (
                      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{user.role}</span>
                    ) : (
                      <select 
                        className={styles.roleSelect} 
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="teacher">Teacher</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                    )}
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actions}>
                      {user.email !== "hinexvaghadiya12@gmail.com" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user.id)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
