"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Bell, User } from "lucide-react";
// ▼ 追加: 認証とデータベース接続用
import { useAuth } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabaseClient";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // ▼ 追加: 通知バッジ用のロジック
    const { getToken, userId } = useAuth();
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        // ログインしていない、または現在通知ページにいる場合はバッジを表示しない
        if (!userId) return;
        if (pathname === '/notifications') {
            setHasUnread(false);
            return;
        }

        const checkUnread = async () => {
            const supabase = await createClerkSupabaseClient(getToken);
            // 未読(is_read=false)の数をカウントする（データの中身は取らないので軽量）
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            setHasUnread(count !== null && count > 0);
        };

        checkUnread();
    }, [userId, pathname, getToken]);
    // ▲ 追加ここまで

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
                        // ▼ 追加: このアイテムが通知ボタンかどうか判定
                        const isNotificationItem = item.href === "/notifications";

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${isActive ? "text-sky-500" : "text-gray-400 hover:text-gray-600"
                                    }`}
                            >
                                {/* ▼ 変更: アイコンを div で囲み、その中に青い点を配置 */}
                                <div className="relative">
                                    <Icon
                                        strokeWidth={isActive ? 2.5 : 2} // アクティブ時は少し太く
                                        className={`w-6 h-6 transition-transform duration-200 ${isActive ? "scale-110" : "scale-100"
                                            }`}
                                    />
                                    {/* 未読があり、かつ通知アイコンの場合のみ青い点を表示 */}
                                    {isNotificationItem && hasUnread && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-sky-500 rounded-full border-2 border-white animate-pulse" />
                                    )}
                                </div>
                                {/* ▲ 変更ここまで */}

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