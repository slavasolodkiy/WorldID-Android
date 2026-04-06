import { motion } from "framer-motion";
import { useGetIdentity, useGetCredentials, useInitiateVerification } from "@workspace/api-client-react";
import { Shield, ShieldCheck, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function OrbAnimation() {
  return (
    <div className="relative w-52 h-52 mx-auto flex items-center justify-center">
      {/* Outer glow rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-blue-500/20"
          style={{ width: `${60 + i * 35}px`, height: `${60 + i * 35}px` }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            delay: i * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Orb body */}
      <motion.div
        className="w-36 h-36 rounded-full relative overflow-hidden"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-full" />
        {/* Iris rings */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: `rgba(96, 165, 250, ${0.4 - i * 0.08})`,
              margin: `${i * 10}px`,
            }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 12 + i * 4, repeat: Infinity, ease: "linear" }}
          />
        ))}
        {/* Center pupil */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400/30 to-blue-900/80 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-blue-300/20 backdrop-blur-sm" />
          </div>
        </div>
        {/* Highlight */}
        <div className="absolute top-3 left-5 w-8 h-4 bg-white/10 rounded-full blur-sm" />
        <div className="absolute top-4 left-6 w-4 h-2 bg-white/20 rounded-full" />
      </motion.div>
    </div>
  );
}

export default function Identity() {
  const { data: identity, isLoading } = useGetIdentity();
  const { data: credentials } = useGetCredentials();
  const verifyMutation = useInitiateVerification();

  const handleVerify = () => {
    verifyMutation.mutate({ data: { level: "orb" } });
  };

  const levelConfig = {
    none: { label: "Not Verified", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-muted/30" },
    device: { label: "Device Verified", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
    orb: { label: "Orb Verified", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  };

  const level = (identity?.verificationLevel ?? "none") as keyof typeof levelConfig;
  const lvl = levelConfig[level];

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-border/30">
        <h1 className="text-2xl font-bold text-foreground">World ID</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Proof of Personhood</p>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-6">
        {/* Orb visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <OrbAnimation />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold mt-4",
              lvl.bg, lvl.border, lvl.color
            )}
          >
            {level === "orb" ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            {lvl.label}
          </motion.div>
        </motion.div>

        {/* Identity card */}
        {isLoading ? (
          <div className="h-32 bg-card/50 rounded-3xl animate-pulse border border-border/30" />
        ) : identity ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border/50 rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-blue-900/40 flex items-center justify-center ring-2 ring-primary/20">
                <span className="text-2xl font-bold text-primary">
                  {identity.username?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">@{identity.username}</p>
                <p className="text-xs text-muted-foreground">
                  Member since {new Date(identity.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="bg-background/50 rounded-2xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">World ID</p>
                <p className="text-xs font-mono text-foreground">{identity.worldId}</p>
              </div>
              {identity.nullifierHash && (
                <div className="bg-background/50 rounded-2xl p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Nullifier Hash</p>
                  <p className="text-xs font-mono text-foreground truncate">{identity.nullifierHash}</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        {/* Credentials */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Credentials</h2>
          <div className="space-y-2">
            {credentials?.map((cred, i) => (
              <motion.div
                key={cred.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 + 0.3 }}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-4"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  cred.type === "orb" && "bg-green-500/10",
                  cred.type === "device" && "bg-blue-500/10",
                  cred.type === "phone" && "bg-purple-500/10",
                )}>
                  <CheckCircle className={cn(
                    "w-5 h-5",
                    cred.type === "orb" && "text-green-400",
                    cred.type === "device" && "text-blue-400",
                    cred.type === "phone" && "text-purple-400",
                  )} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{cred.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued {new Date(cred.issuedAt).toLocaleDateString()}
                    {cred.expiresAt && ` · Expires ${new Date(cred.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  cred.isActive ? "bg-green-400" : "bg-muted-foreground"
                )} />
              </motion.div>
            ))}
            {!credentials && [1].map((i) => (
              <div key={i} className="h-16 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        </div>

        {/* Verify CTA */}
        {identity?.verificationLevel !== "orb" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-500/20 rounded-3xl p-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Upgrade to Orb Verification</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Get Orb-verified to access exclusive grants, higher limits, and the full World ecosystem.
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleVerify}
              disabled={verifyMutation.isPending}
              className="w-full mt-4 bg-primary text-primary-foreground rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              {verifyMutation.isPending ? "Initiating..." :
               verifyMutation.isSuccess ? "Session Started!" :
               "Find an Orb Location"}
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </motion.button>
          </motion.div>
        )}

        {/* What is World ID */}
        <div className="bg-card/40 border border-border/30 rounded-3xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-2">What is World ID?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            World ID is a privacy-preserving proof that you are a unique human. It uses zero-knowledge proofs
            so you can prove your uniqueness without revealing any personal information. Your biometric data
            never leaves the Orb device.
          </p>
        </div>
      </div>
    </div>
  );
}
