import { motion } from "framer-motion";
import { useGetIdentity, useGetWallet, useGetTransactionSummary } from "@workspace/api-client-react";
import {
  ShieldCheck, Shield, Copy, CheckCheck, ChevronRight, Bell, Lock, Globe, Smartphone, Info, LogOut
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function formatUsd(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(val);
}

export default function Profile() {
  const { data: identity, isLoading } = useGetIdentity();
  const { data: wallet } = useGetWallet();
  const { data: summary } = useGetTransactionSummary();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const settingsGroups = [
    {
      label: "Account",
      items: [
        { icon: Bell, label: "Notifications", desc: "Manage alerts and push notifications" },
        { icon: Lock, label: "Security", desc: "PIN, biometrics, recovery" },
        { icon: Smartphone, label: "Linked Devices", desc: "Manage trusted devices" },
      ],
    },
    {
      label: "App",
      items: [
        { icon: Globe, label: "Language & Region", desc: "English (US)" },
        { icon: Info, label: "About World App", desc: "v2.4.1 — Terms & Privacy" },
      ],
    },
  ];

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-border/30">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-5">
        {/* Profile card */}
        {isLoading ? (
          <div className="h-40 bg-card/50 rounded-3xl animate-pulse border border-border/30" />
        ) : identity ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-card border border-border/50 rounded-3xl p-5 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-blue-900/60 flex items-center justify-center ring-2 ring-primary/30 flex-shrink-0">
                <span className="text-3xl font-bold text-primary">
                  {identity.username?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-foreground">@{identity.username}</p>
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1",
                  identity.verificationLevel === "orb"
                    ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                )}>
                  {identity.verificationLevel === "orb"
                    ? <ShieldCheck className="w-3 h-3" />
                    : <Shield className="w-3 h-3" />}
                  {identity.verificationLevel === "orb" ? "Orb Verified" : "Device Verified"}
                </div>
              </div>
            </div>

            {/* Wallet address */}
            <div className="mt-4 bg-background/50 rounded-2xl p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Wallet</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-foreground flex-1 truncate">{identity.walletAddress}</p>
                <button
                  onClick={() => handleCopy(identity.walletAddress)}
                  className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0 hover:bg-muted/60 transition-colors"
                >
                  {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Member since {new Date(identity.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </motion.div>
        ) : null}

        {/* Stats */}
        {(wallet || summary) && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Portfolio", value: wallet ? formatUsd(wallet.totalValueUsd) : "-" },
              { label: "Transactions", value: summary ? summary.transactionCount.toString() : "-" },
              { label: "This Month", value: summary ? formatUsd(summary.thisMonthUsd) : "-" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.1 }}
                className="bg-card border border-border/50 rounded-2xl p-3 text-center"
              >
                <p className="text-base font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Settings */}
        {settingsGroups.map((group, gi) => (
          <div key={group.label}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
              {group.label}
            </h2>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/30">
              {group.items.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: gi * 0.1 + i * 0.05 + 0.2 }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl py-3.5 font-semibold text-sm hover:bg-red-500/15 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </motion.button>

        <p className="text-center text-xs text-muted-foreground/50 pb-4">
          World App — Proof of Personhood for All Humans
        </p>
      </div>
    </div>
  );
}
