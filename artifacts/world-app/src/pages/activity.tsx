import { useState } from "react";
import { motion } from "framer-motion";
import { useGetTransactions, useGetTransactionSummary } from "@workspace/api-client-react";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Zap, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatUsd(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
}

type TxType = "all" | "send" | "receive" | "grant" | "swap";

const FILTERS: { label: string; value: TxType }[] = [
  { label: "All", value: "all" },
  { label: "Received", value: "receive" },
  { label: "Sent", value: "send" },
  { label: "Grants", value: "grant" },
];

export default function Activity() {
  const [filter, setFilter] = useState<TxType>("all");

  const { data: txData, isLoading, isError, refetch } = useGetTransactions(
    filter !== "all" ? { type: filter, page: 1, limit: 50 } : { page: 1, limit: 50 }
  );
  const { data: summary, isLoading: summaryLoading } = useGetTransactionSummary();

  const txTypeConfig = {
    receive: { icon: ArrowDownLeft, color: "text-green-400", bg: "bg-green-500/10", sign: "+" },
    send: { icon: ArrowUpRight, color: "text-red-400", bg: "bg-red-500/10", sign: "-" },
    grant: { icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10", sign: "+" },
    swap: { icon: RefreshCw, color: "text-purple-400", bg: "bg-purple-500/10", sign: "" },
  };

  const statusConfig = {
    confirmed: { icon: CheckCircle, color: "text-green-400" },
    pending: { icon: Clock, color: "text-amber-400" },
    failed: { icon: XCircle, color: "text-red-400" },
  };

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-border/30">
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
      </div>

      <div className="pt-5 pb-8">
        {/* Summary cards */}
        <div className="px-4 grid grid-cols-2 gap-2 mb-5">
          {summaryLoading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
              ))
            : summary
            ? [
                { label: "Total Received", value: formatUsd(summary.totalReceivedUsd), color: "text-green-400" },
                { label: "Total Sent", value: formatUsd(summary.totalSentUsd), color: "text-red-400" },
                { label: "Grants Earned", value: formatUsd(summary.totalGrantsUsd), color: "text-amber-400" },
                { label: "This Month", value: formatUsd(summary.thisMonthUsd), color: "text-primary" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border/50 rounded-2xl p-3"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={cn("text-base font-bold mt-0.5", stat.color)}>{stat.value}</p>
                </motion.div>
              ))
            : null}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border/50 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {isError && (
          <div className="px-4 mb-4">
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300 flex-1">Could not load transactions.</p>
              <button onClick={() => refetch()} className="text-xs text-red-400 font-medium underline underline-offset-2">Retry</button>
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className="px-4 space-y-2">
          {isLoading && [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-18 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
          ))}

          {!isLoading && !isError && txData?.transactions?.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Send or receive tokens to see activity here.</p>
            </div>
          )}

          {txData?.transactions?.map((tx, i) => {
            const type = tx.type as keyof typeof txTypeConfig;
            const cfg = txTypeConfig[type] ?? txTypeConfig.swap;
            const status = tx.status as keyof typeof statusConfig;
            const StatusIcon = statusConfig[status]?.icon ?? CheckCircle;

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-4 relative overflow-hidden"
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-0.5",
                  type === "receive" && "bg-green-400",
                  type === "send" && "bg-red-400",
                  type === "grant" && "bg-amber-400",
                  type === "swap" && "bg-purple-400",
                )} />

                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-2", cfg.bg)}>
                  <cfg.icon className={cn("w-4.5 h-4.5", cfg.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize truncate">
                    {type === "receive"
                      ? `From ${tx.fromUsername ?? (tx.fromAddress ? tx.fromAddress.slice(0, 8) + "..." : "Unknown")}`
                      : type === "send"
                      ? `To ${tx.toUsername ?? (tx.toAddress ? tx.toAddress.slice(0, 8) + "..." : "Unknown")}`
                      : type === "grant"
                      ? "Grant Received"
                      : "Token Swap"}
                  </p>
                  {tx.note && (
                    <p className="text-xs text-muted-foreground truncate">{tx.note}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusIcon className={cn("w-3 h-3", statusConfig[status]?.color ?? "text-green-400")} />
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(tx.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    "text-sm font-bold",
                    type === "receive" || type === "grant" ? "text-green-400" : "text-foreground"
                  )}>
                    {cfg.sign}{tx.amount.toFixed(2)} {tx.token}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatUsd(tx.amountUsd)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
