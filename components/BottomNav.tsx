"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, CheckSquare, Activity, FileText, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const notifications = {
    "/timeline": true,
    "/mypage": false,
  };

  const navItems = [
    { name: "ホーム！！", href: "/", icon: Home },
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
        // @ts-ignore
        const hasNotification = notifications[item.href];

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? "text-[#2E5D4B] font-bold" : "text-[#2E5D4B]/60"
              }`}
          >
            {/* ★修正: inline-flexに変更し、基準をアイコンサイズに完全固定 */}
            <div className="relative inline-flex">
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />

              {/* ★修正: 位置を -1 (4px) に変更し、右上へ押し出す */}
              {hasNotification && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-[#F8F5E9]" />
              )}
            </div>

            <span className="text-[10px] mt-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}