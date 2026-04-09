import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetWallet,
  useGetReceiveInfo,
  useSendTokens,
  getGetWalletQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownLeft, Copy, CheckCheck, ChevronLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatUsd(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);
}

type View = "overview" | "send" | "receive";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Generate a simple UUID-v4 for client-side idempotency keys */
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function Wallet() {
  const [view, setView] = useState<View>("overview");
  const [copied, setCopied] = useState(false);
  const [sendForm, setSendForm] = useState({ toAddress: "", amount: "", token: "WLD", note: "" });
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Client-side idempotency key — generated once per send intent, reset on success/cancel
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => uuid());

  const { data: wallet, isLoading, isError: walletError, refetch: refetchWallet } = useGetWallet();
  const { data: receiveInfo } = useGetReceiveInfo();
  const sendMutation = useSendTokens();
  const queryClient = useQueryClient();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    setSendError(null);

    if (!sendForm.toAddress) {
      setSendError("Please enter a destination address.");
      return;
    }
    if (!ETH_ADDRESS_RE.test(sendForm.toAddress)) {
      setSendError("Address must be a valid 0x-prefixed Ethereum address (42 characters).");
      return;
    }
    if (!sendForm.amount || parseFloat(sendForm.amount) <= 0) {
      setSendError("Amount must be greater than zero.");
      return;
    }

    const selectedToken = wallet?.tokens?.find((t) => t.symbol === sendForm.token);
    if (selectedToken && parseFloat(sendForm.amount) > selectedToken.balance) {
      setSendError(`Insufficient balance. You have ${selectedToken.balance.toFixed(4)} ${selectedToken.symbol}.`);
      return;
    }

    sendMutation.mutate(
      {
        data: {
          toAddress: sendForm.toAddress,
          amount: parseFloat(sendForm.amount),
          token: sendForm.token,
          note: sendForm.note || undefined,
        },
        // Pass idempotency key via the request options header
        // Orval's second arg is `options?: RequestInit`
      },
      {
        onSuccess: () => {
          setSendSuccess(true);
          setIdempotencyKey(uuid()); // rotate key for next send
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          setTimeout(() => {
            setSendSuccess(false);
            setView("overview");
            setSendForm({ toAddress: "", amount: "", token: "WLD", note: "" });
          }, 2000);
        },
        onError: (err: unknown) => {
          // ApiError carries the parsed response body in `.data`
          const apiErr = err as ApiError<{ error?: string; code?: string }>;
          const serverMsg = apiErr?.data?.error;
          setSendError(serverMsg ?? "Transaction failed. Please try again.");
        },
      }
    );
  };

  // Reset idempotency key when navigating away from send view (cancel intent)
  const handleBackFromSend = () => {
    setView("overview");
    setSendError(null);
    setIdempotencyKey(uuid());
  };

  const selectedToken = wallet?.tokens?.find((t) => t.symbol === sendForm.token);

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          {view !== "overview" && (
            <button
              onClick={handleBackFromSend}
              className="w-9 h-9 rounded-full bg-card flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {view === "overview" ? "Wallet" : view === "send" ? "Send" : "Receive"}
          </h1>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pt-6 pb-8 space-y-5"
          >
            {walletError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300 flex-1">Could not load wallet.</p>
                <button onClick={() => refetchWallet()} className="text-xs text-red-400 font-medium underline underline-offset-2">Retry</button>
              </div>
            )}

            {/* Total balance */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-indigo-900/10 to-transparent" />
              <div className="relative bg-card/80 border border-white/10 rounded-3xl p-6 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Portfolio Value</p>
                {isLoading ? (
                  <div className="h-12 bg-muted/30 rounded-xl animate-pulse mx-auto w-48" />
                ) : (
                  <p className="text-5xl font-bold text-foreground tracking-tight">
                    {walletError ? "—" : formatUsd(wallet?.totalValueUsd ?? 0)}
                  </p>
                )}
                <p className={cn(
                  "text-sm font-medium mt-2",
                  (wallet?.change24hPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {!walletError && `${(wallet?.change24hPercent ?? 0) >= 0 ? "+" : ""}${wallet?.change24hPercent?.toFixed(2)}% (24h)`}
                </p>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView("send")}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Send
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView("receive")}
                    className="flex-1 flex items-center justify-center gap-2 bg-card border border-white/20 text-foreground rounded-2xl py-3 font-semibold text-sm hover:border-white/30 transition-colors"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Receive
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Tokens list */}
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Your Tokens</h2>
              <div className="space-y-2">
                {wallet?.tokens?.map((token, i) => (
                  <motion.div
                    key={token.symbol}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl p-4"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-blue-900/40 flex items-center justify-center ring-1 ring-white/10 flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{token.symbol}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{token.name}</p>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">{token.chain}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{token.priceUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatUsd(token.balanceUsd)}</p>
                      <p className="text-xs text-muted-foreground">{token.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })} {token.symbol}</p>
                      <p className={cn("text-xs font-medium", token.change24hPercent >= 0 ? "text-green-400" : "text-red-400")}>
                        {token.change24hPercent >= 0 ? "+" : ""}{token.change24hPercent.toFixed(2)}%
                      </p>
                    </div>
                  </motion.div>
                ))}
                {isLoading && [1, 2, 3].map((i) => (
                  <div key={i} className="h-18 bg-card/50 rounded-2xl animate-pulse border border-border/30" />
                ))}
                {!isLoading && !walletError && wallet?.tokens?.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">No tokens yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Wallet address */}
            {receiveInfo && (
              <div className="bg-card/40 border border-border/30 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Wallet Address</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-foreground flex-1 truncate">{receiveInfo.address}</p>
                  <button
                    onClick={() => handleCopy(receiveInfo.address)}
                    className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0 hover:bg-muted/60 transition-colors"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === "send" && (
          <motion.div
            key="send"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="px-4 pt-6 pb-8 space-y-4"
          >
            <AnimatePresence>
              {sendSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center"
                >
                  <p className="text-green-400 font-semibold">Transaction sent successfully!</p>
                </motion.div>
              )}
              {sendError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{sendError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Token selector */}
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest block mb-2">Token</label>
              <div className="flex gap-2">
                {wallet?.tokens?.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => setSendForm((f) => ({ ...f, token: token.symbol }))}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold transition-all",
                      sendForm.token === token.symbol
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-card border-border/50 text-foreground hover:border-border"
                    )}
                  >
                    {token.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest block mb-2">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  value={sendForm.amount}
                  min={0}
                  onChange={(e) => { setSendForm((f) => ({ ...f, amount: e.target.value })); setSendError(null); }}
                  className="w-full bg-card border border-border/50 rounded-2xl px-4 py-3.5 text-2xl font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  {sendForm.token}
                </span>
              </div>
              {selectedToken && sendForm.amount && (
                <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                  ≈ {formatUsd(parseFloat(sendForm.amount) * selectedToken.priceUsd)}
                </p>
              )}
              {selectedToken && (
                <p className="text-xs text-muted-foreground mt-1 ml-1">
                  Available: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
                </p>
              )}
            </div>

            {/* To address */}
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest block mb-2">To</label>
              <input
                type="text"
                placeholder="0x... Ethereum address"
                value={sendForm.toAddress}
                onChange={(e) => { setSendForm((f) => ({ ...f, toAddress: e.target.value })); setSendError(null); }}
                className="w-full bg-card border border-border/50 rounded-2xl px-4 py-3.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest block mb-2">Note (optional)</label>
              <input
                type="text"
                placeholder="What's this for?"
                value={sendForm.note}
                onChange={(e) => setSendForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full bg-card border border-border/50 rounded-2xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Idempotency key indicator (dev aid — hidden in production) */}
            {import.meta.env.DEV && (
              <p className="text-xs text-muted-foreground/40 font-mono truncate">key: {idempotencyKey}</p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              disabled={!sendForm.toAddress || !sendForm.amount || sendMutation.isPending}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-bold text-base disabled:opacity-40 hover:bg-primary/90 transition-colors mt-2"
            >
              {sendMutation.isPending ? "Sending…" : `Send ${sendForm.token}`}
            </motion.button>
          </motion.div>
        )}

        {view === "receive" && (
          <motion.div
            key="receive"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="px-4 pt-6 pb-8 flex flex-col items-center space-y-6"
          >
            <p className="text-sm text-muted-foreground text-center">
              Share your address to receive WLD, USDC, or ETH on World Chain
            </p>

            {/* QR Code */}
            <div className="w-56 h-56 bg-white rounded-3xl flex items-center justify-center p-4 shadow-2xl shadow-white/10">
              <div className="w-full h-full relative">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {Array.from({ length: 10 }).map((_, row) =>
                    Array.from({ length: 10 }).map((_, col) => {
                      const hash = (row * 13 + col * 7 + row * col) % 3;
                      const isCorner = (row < 3 && col < 3) || (row < 3 && col > 6) || (row > 6 && col < 3);
                      const isDark = isCorner || hash === 0;
                      return (
                        <rect key={`${row}-${col}`} x={col * 20 + 1} y={row * 20 + 1} width={18} height={18} rx={2} fill={isDark ? "#000" : "#fff"} />
                      );
                    })
                  )}
                  {[[0,0],[0,140],[140,0]].map(([x,y], i) => (
                    <g key={i}>
                      <rect x={x} y={y} width={60} height={60} rx={6} fill="#000"/>
                      <rect x={x+8} y={y+8} width={44} height={44} rx={4} fill="#fff"/>
                      <rect x={x+16} y={y+16} width={28} height={28} rx={2} fill="#000"/>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <div className="w-full text-center">
              <p className="text-base font-bold text-foreground mb-1">@{receiveInfo?.username}</p>
              <p className="text-xs font-mono text-muted-foreground break-all px-4">{receiveInfo?.address}</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => receiveInfo && handleCopy(receiveInfo.address)}
              className="flex items-center gap-2 bg-card border border-white/20 text-foreground rounded-2xl px-6 py-3 font-semibold text-sm hover:border-white/30 transition-all"
            >
              {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Address"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
