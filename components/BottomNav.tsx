"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, CheckSquare, Activity, FileText, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "ホーム", href: "/", icon: Home },
    { name: "計画", href: "/plan", icon: Map },
    { name: "やること", href: "/tasks", icon: CheckSquare },
    { name: "TL", href: "/timeline", icon: Activity },
    { name: "レポ", href: "/report", icon: FileText },
    { name: "マイ", href: "/mypage", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#F8F5E9] border-t border-[#2E5D4B]/20 h-16 flex items-center justify-around z-50 safe-area-pb">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              isActive ? "text-[#2E5D4B] font-bold" : "text-[#2E5D4B]/60"
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] mt-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
