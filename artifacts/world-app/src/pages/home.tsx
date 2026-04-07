import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  useGetWallet,
  useGetIdentity,
  useGetTransactions,
  useGetGrants,
  useGetStats,
} from "@workspace/api-client-react";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, TrendingUp, TrendingDown, ChevronRight, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatUsd(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
}

function formatToken(val: number, decimals = 3) {
  return val.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <p className="text-xs text-red-300 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-400 font-medium hover:text-red-300 transition-colors underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const { data: wallet, isLoading: walletLoading, isError: walletError, refetch: refetchWallet } = useGetWallet();
  const { data: identity } = useGetIdentity();
  const { data: transactions, isError: txError, refetch: refetchTx } = useGetTransactions({ page: 1, limit: 5 });
  const { data: grants } = useGetGrants();
  const { data: stats } = useGetStats();

  const availableGrants = grants?.filter((g) => g.status === "available") ?? [];

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase">World App</p>
            <h1 className="text-2xl font-bold text-foreground mt-0.5">
              {identity ? `Hi, ${identity.username}` : "Hello"}
            </h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
            <span className="text-primary font-bold text-sm">
              {identity?.username?.charAt(0)?.toUpperCase() ?? "W"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-6">
        {walletError && (
          <ErrorBanner message="Could not load wallet balance." onRetry={() => refetchWallet()} />
        )}

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-blue-900/20 to-transparent" />
          <div className="relative bg-card/80 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
            <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase mb-2">Total Balance</p>
            {walletLoading ? (
              <div className="h-10 bg-muted/30 rounded-xl animate-pulse w-48" />
            ) : walletError ? (
              <p className="text-4xl font-bold text-muted-foreground tracking-tight">—</p>
            ) : (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-end gap-3">
                <span className="text-4xl font-bold text-foreground tracking-tight">
                  {formatUsd(wallet?.totalValueUsd ?? 0)}
                </span>
              </motion.div>
            )}
            {!walletError && (
              <div className={cn(
                "flex items-center gap-1.5 mt-2",
                (wallet?.change24hPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {(wallet?.change24hPercent ?? 0) >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span className="text-sm font-medium">
                  {(wallet?.change24hPercent ?? 0) >= 0 ? "+" : ""}{wallet?.change24hPercent?.toFixed(2)}% today
                </span>
                <span className="text-xs text-muted-foreground">
                  ({(wallet?.change24hUsd ?? 0) >= 0 ? "+" : ""}{formatUsd(wallet?.change24hUsd ?? 0)})
                </span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3 mt-5">
              {[
                { label: "Send", icon: ArrowUpRight, href: "/wallet", color: "text-blue-400" },
                { label: "Receive", icon: ArrowDownLeft, href: "/wallet", color: "text-green-400" },
                { label: "Swap", icon: RefreshCw, href: "/wallet", color: "text-purple-400" },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex-1">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2 bg-background/60 rounded-2xl py-3 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <action.icon className={cn("w-5 h-5", action.color)} />
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Grant Banner */}
        {availableGrants.length > 0 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Link href="/wallet">
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 hover:bg-amber-500/15 transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">
                    {availableGrants.length} grant{availableGrants.length > 1 ? "s" : ""} available
                  </p>
                  <p className="text-xs text-amber-400/70 truncate">
                    Claim your WLD — {availableGrants.map(g => `${g.amountWld} WLD`).join(", ")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Tokens */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Tokens</h2>
            <Link href="/wallet" className="text-xs text-primary font-medium">See all</Link>
          </div>
          <div className="space-y-2">
            {wallet?.tokens?.map((token, i) => (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.15 }}
                className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl p-4 hover:border-border transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-blue-800/30 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                  <span className="text-xs font-bold text-primary">{token.symbol.slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{token.name}</p>
                  <p className="text-xs text-muted-foreground">{formatToken(token.balance)} {token.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatUsd(token.balanceUsd)}</p>
                  <p className={cn("text-xs font-medium", token.change24hPercent >= 0 ? "text-green-400" : "text-red-400")}>
                    {token.change24hPercent >= 0 ? "+" : ""}{token.change24hPercent.toFixed(2)}%
                  </p>
                </div>
              </motion.div>
            ))}
            {walletLoading && [1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
            ))}
            {!walletLoading && !walletError && wallet?.tokens?.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No tokens in your wallet yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Recent Activity</h2>
            <Link href="/activity" className="text-xs text-primary font-medium">See all</Link>
          </div>
          <div className="space-y-2">
            {txError && (
              <ErrorBanner message="Could not load transactions." onRetry={() => refetchTx()} />
            )}
            {transactions?.transactions?.slice(0, 3).map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.25 }}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-3.5 hover:border-border transition-all"
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                  tx.type === "receive" && "bg-green-500/10",
                  tx.type === "send" && "bg-red-500/10",
                  tx.type === "grant" && "bg-amber-500/10",
                  tx.type === "swap" && "bg-purple-500/10",
                )}>
                  {tx.type === "receive" && <ArrowDownLeft className="w-4 h-4 text-green-400" />}
                  {tx.type === "send" && <ArrowUpRight className="w-4 h-4 text-red-400" />}
                  {tx.type === "grant" && <Zap className="w-4 h-4 text-amber-400" />}
                  {tx.type === "swap" && <RefreshCw className="w-4 h-4 text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {tx.type === "receive" ? `From ${tx.fromUsername ?? "Unknown"}` :
                     tx.type === "send" ? `To ${tx.toUsername ?? "Unknown"}` :
                     tx.type === "grant" ? "Grant Received" : "Swap"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    tx.type === "receive" || tx.type === "grant" ? "text-green-400" : "text-foreground"
                  )}>
                    {tx.type === "receive" || tx.type === "grant" ? "+" : "-"}{tx.amount} {tx.token}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatUsd(tx.amountUsd)}</p>
                </div>
              </motion.div>
            ))}
            {!transactions && !txError && [1, 2].map((i) => (
              <div key={i} className="h-14 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
            ))}
            {!txError && transactions?.transactions?.length === 0 && (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">No recent activity.</p>
              </div>
            )}
          </div>
        </div>

        {/* Global Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card/40 border border-border/30 rounded-3xl p-5"
          >
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">World Network</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Verified Humans", value: (stats.totalVerifiedHumans / 1e6).toFixed(1) + "M" },
                { label: "Countries", value: stats.totalCountries.toLocaleString() },
                { label: "Mini Apps", value: stats.totalMiniApps.toLocaleString() },
                { label: "WLD Distributed", value: (stats.totalWldDistributed / 1e6).toFixed(1) + "M" },
              ].map((stat) => (
                <div key={stat.label} className="bg-background/50 rounded-2xl p-3">
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
