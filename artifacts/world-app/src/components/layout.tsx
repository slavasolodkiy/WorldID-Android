import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Wallet, Grid, Activity, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // Force dark mode on html
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/wallet", icon: Wallet, label: "Wallet" },
    { href: "/identity", icon: Grid, label: "ID" },
    { href: "/activity", icon: Activity, label: "Activity" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="flex justify-center min-h-[100dvh] bg-black text-foreground w-full">
      <div className="w-full max-w-[430px] bg-background relative flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/5">
        
        <main className="flex-1 overflow-y-auto pb-24 relative z-0">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 w-full max-w-[430px] glass-panel rounded-t-3xl pb-safe z-50">
          <div className="flex justify-around items-center h-20 px-2">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center w-16 h-full gap-1 group"
                >
                  <div className={cn(
                    "p-2 rounded-full transition-all duration-300",
                    isActive ? "bg-primary/20 text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
