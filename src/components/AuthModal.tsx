"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { persistMemberSession } from "@/lib/use-member";
import { btnGhost, btnPrimary, eyebrow, input, label } from "./ui";

type UserProfile = {
  id: string;
  email: string;
  role: "member" | "admin";
};

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signin",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "signin" | "signup" | "forgot" | "update_password";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "update_password">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("reset") === "true" || window.location.hash.includes("type=recovery")) {
        setMode("update_password");
      }
    }
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update_password");
      }
    });
    return () => {
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError("Authentication is not configured yet. Please configure Supabase in .env.local.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to process password reset request");
        }
        setMessage(data.message || "A reset link has been dispatched to your Gmail if an account exists.");
      } else if (mode === "update_password") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;

        setMessage("Password updated successfully! Signing you in…");
        if (updateData.user) {
          const { data: sessData } = await supabase.auth.getSession();
          persistMemberSession(
            updateData.user,
            sessData.session?.access_token,
            sessData.session?.refresh_token
          );
        }

        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("grove_auth_changed"));
            if (window.location.pathname !== "/member") {
              window.location.href = "/member";
            }
          }
        }, 1200);
      } else if (mode === "signup") {
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName }),
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) {
          throw new Error(registerData.error || "Failed to create account");
        }

        setMessage("Account created! Welcome email sent to your Gmail.");

        // Automatically sign in the user
        let signedIn = false;
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (!signInError) {
            signedIn = true;
          }
        } catch {
          // fallback to login proxy below
        }

        if (!signedIn) {
          const proxyRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const proxyData = await proxyRes.json();
          if (proxyRes.ok && proxyData.user) {
            if (proxyData.access_token && proxyData.refresh_token) {
              try {
                await supabase.auth.setSession({
                  access_token: proxyData.access_token,
                  refresh_token: proxyData.refresh_token,
                });
              } catch {}
            }
            persistMemberSession(proxyData.user, proxyData.access_token, proxyData.refresh_token);
            signedIn = true;
          }
        } else {
          try {
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData.session) {
              persistMemberSession(
                sessData.session.user,
                sessData.session.access_token,
                sessData.session.refresh_token
              );
            }
          } catch {}
        }

        setTimeout(() => {
          onClose();
          if (onSuccess) {
            onSuccess();
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("grove_auth_changed"));
            if (window.location.pathname !== "/member") {
              window.location.href = "/member";
            }
          }
        }, 1200);
      } else {
        // Sign In
        let signedIn = false;
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (!signInError) {
            signedIn = true;
          } else if (
            signInError.message?.toLowerCase().includes("fetch") ||
            signInError.message?.toLowerCase().includes("network")
          ) {
            // will try proxy below
          } else {
            throw signInError;
          }
        } catch (directErr: unknown) {
          const msg = directErr instanceof Error ? directErr.message : "";
          if (!msg.toLowerCase().includes("fetch") && !msg.toLowerCase().includes("network")) {
            throw directErr;
          }
        }

        if (!signedIn) {
          // Fallback to server-side proxy route /api/auth/login
          const proxyRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const proxyData = await proxyRes.json();
          if (!proxyRes.ok) {
            throw new Error(proxyData.error || "Authentication failed");
          }

          if (proxyData.access_token && proxyData.refresh_token) {
            try {
              await supabase.auth.setSession({
                access_token: proxyData.access_token,
                refresh_token: proxyData.refresh_token,
              });
            } catch {}
          }

          if (proxyData.user) {
            persistMemberSession(proxyData.user, proxyData.access_token, proxyData.refresh_token);
          }
        } else {
          // If direct supabase sign in succeeded
          try {
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData.session) {
              persistMemberSession(
                sessData.session.user,
                sessData.session.access_token,
                sessData.session.refresh_token
              );
            }
          } catch {}
        }

        onClose();
        if (onSuccess) {
          onSuccess();
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("grove_auth_changed"));
          if (window.location.pathname !== "/member") {
            window.location.href = "/member";
          }
        }
      }
    } catch (err: unknown) {
      console.error("[AuthModal] error:", err);
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const getEyebrow = () => {
    if (mode === "forgot") return "Password Recovery";
    if (mode === "update_password") return "New Credentials";
    if (mode === "signup") return "Membership Registration";
    return "Member Portal";
  };

  const getTitle = () => {
    if (mode === "forgot") return "Reset password";
    if (mode === "update_password") return "Set new password";
    if (mode === "signup") return "Create an account";
    return "Sign in";
  };

  const getSubtitle = () => {
    if (mode === "forgot")
      return "Enter your email address and we'll send a secure password reset link to your Gmail.";
    if (mode === "update_password")
      return "Enter your new account password below to finish recovery.";
    if (mode === "signup")
      return "Sign up to track your games. Play 10 confirmed games to receive 50% off up to 2 courts (2 hours) on your 11th booking!";
    return "Sign in with your email to track your bookings and unlock loyalty perks.";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px] transition-all animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-6 md:p-7 shadow-xl transition-all animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 size-7 rounded-full flex items-center justify-center text-xs text-mute hover:bg-zinc-100 hover:text-ink transition"
          aria-label="Close"
        >
          ✕
        </button>

        <p className={eyebrow}>{getEyebrow()}</p>
        <h3 className="mt-1 text-2xl font-medium tracking-tight">{getTitle()}</h3>
        <p className="mt-1 text-xs text-mute leading-relaxed">{getSubtitle()}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label className={label}>Full Name</label>
              <input
                type="text"
                required
                className={input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
          )}

          {mode !== "update_password" && (
            <div>
              <label className={label}>Email address</label>
              <input
                type="email"
                required
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
          )}

          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <label className={label}>
                  {mode === "update_password" ? "New Password" : "Password"}
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-[11px] text-zinc-500 hover:text-ink underline transition font-medium mb-1"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === "update_password" && (
            <div>
              <label className={label}>Confirm New Password</label>
              <input
                type="password"
                required
                minLength={6}
                className={input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <p className="text-xs text-wine">{error}</p>}
          {message && <p className="text-xs text-emerald-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full py-2.5 mt-2`}
          >
            {loading
              ? "Processing…"
              : mode === "forgot"
              ? "Send Reset Link"
              : mode === "update_password"
              ? "Update Password"
              : mode === "signup"
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          {mode === "forgot" || mode === "update_password" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-mute underline hover:text-ink font-medium"
            >
              ← Back to sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-mute underline hover:text-ink font-medium"
            >
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
