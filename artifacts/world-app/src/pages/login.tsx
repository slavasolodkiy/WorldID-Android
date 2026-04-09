/**
 * Login screen — shown when the user has no active session.
 *
 * Calls POST /api/auth/login with username or worldId.
 * On success the session cookie is set by the browser and `onSuccess`
 * is called so the AuthProvider can refresh its state.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useLogin, ApiError } from "@workspace/api-client-react";
import { Shield, AlertCircle } from "lucide-react";

interface LoginProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter your username or World ID.");
      return;
    }

    const isWorldId = trimmed.startsWith("wld_");
    loginMutation.mutate(
      { data: isWorldId ? { worldId: trimmed } : { username: trimmed } },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) {
            setError("User not found. Check your username or World ID.");
          } else {
            setError("Sign in failed. Please try again.");
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-primary/20 ring-4 ring-primary/30 flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">World App</h1>
          <p className="text-sm text-muted-foreground mt-1">Proof of Personhood</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
              Username or World ID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              placeholder="satoshi_w or wld_1a2b..."
              autoComplete="username"
              autoFocus
              className="w-full bg-card border border-border/50 rounded-2xl px-4 py-3.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl p-3"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loginMutation.isPending || !username.trim()}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
          >
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </motion.button>
        </form>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          World App · Proof of Personhood for All Humans
        </p>
      </motion.div>
    </div>
  );
}
