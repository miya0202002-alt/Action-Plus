"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Bell, User } from "lucide-react";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // メニューの定義
    const navItems = [
        { href: "/timeline", label: "ホーム", icon: Home },
        { href: "/tasks", label: "タスク", icon: CheckSquare },
        { href: "/plan", label: "AI作成", icon: Sparkles }, // 真ん中（AI）
        { href: "/notifications", label: "通知", icon: Bell },
        { href: "/profile", label: "マイページ", icon: User },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ページの中身（タイムラインやタスクなど）が表示される場所 
        下にメニューバーがある分、余白(pb-24)を空けて隠れないようにします
      */}
            <main className="pb-24 max-w-md mx-auto min-h-screen bg-white shadow-sm">
                {children}
            </main>

            {/* 下部固定メニューバー */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 z-50 safe-area-pb">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
                    {navItems.map((item) => {
                        // 現在のページなら青色、違えば灰色にする判定
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${isActive ? "text-sky-500" : "text-gray-400 hover:text-gray-600"
                                    }`}
                            >
                                {/* AIボタンだけ少し目立たせたい場合はここで調整可能。今はシンプルに統一 */}
                                <Icon
                                    strokeWidth={isActive ? 2.5 : 2} // アクティブ時は少し太く
                                    className={`w-6 h-6 transition-transform duration-200 ${isActive ? "scale-110" : "scale-100"
                                        }`}
                                />
                                <span className="text-[10px] font-medium tracking-tight">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}