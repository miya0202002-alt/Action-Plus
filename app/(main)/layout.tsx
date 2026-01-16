"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Bell, User } from "lucide-react";
// ▼ 変更: useUser を追加（Clerkから最新情報を取るため）
import { useAuth, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabaseClient";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // ▼ 追加: 通知バッジとプロフィール修復用のロジック
    const { getToken, userId } = useAuth();
    const { user } = useUser(); // Clerkのユーザー情報（名前・アイコン）を取得
    const [hasUnread, setHasUnread] = useState(false);

    // 1. プロフィールの自動修復ロジック
    useEffect(() => {
        if (!user || !userId) return;

        const fixProfile = async () => {
            const supabase = await createClerkSupabaseClient(getToken);

            // まず、現在のデータベース上の名前を確認する
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', userId)
                .single();

            // 修復対象の名前リスト
            const targetNames = ['復旧ユーザー', 'ユーザー(読込中)', '名無し', '', null];

            // データが無い、または仮の名前のままの場合
            if (!currentProfile || targetNames.includes(currentProfile?.name)) {
                console.log('プロフィールをClerkの最新情報に同期します...');

                await supabase.from('profiles').upsert({
                    id: userId,
                    name: user.fullName || user.username || '名無し', // Clerkの名前
                    avatar_url: user.imageUrl, // Clerkのアイコン
                }, { onConflict: 'id' });
            }
        };

        fixProfile();
    }, [user, userId, getToken]);

    // 2. 通知バッジのロジック
    useEffect(() => {
        if (!userId) return;
        if (pathname === '/notifications') {
            setHasUnread(false);
            return;
        }

        const checkUnread = async () => {
            const supabase = await createClerkSupabaseClient(getToken);
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            setHasUnread(count !== null && count > 0);
        };

        checkUnread();
    }, [userId, pathname, getToken]);


    // メニューの定義
    const navItems = [
        { href: "/timeline", label: "ホーム", icon: Home },
        { href: "/tasks", label: "タスク", icon: CheckSquare },
        { href: "/plan", label: "AI作成", icon: Sparkles },
        { href: "/notifications", label: "通知", icon: Bell },
        { href: "/profile", label: "マイページ", icon: User },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ページの中身 */}
            <main className="pb-24 max-w-md mx-auto min-h-screen bg-white shadow-sm">
                {children}
            </main>

            {/* 下部固定メニューバー */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 z-50 safe-area-pb">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        const isNotificationItem = item.href === "/notifications";

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${isActive ? "text-sky-500" : "text-gray-400 hover:text-gray-600"
                                    }`}
                            >
                                <div className="relative inline-flex">
                                    <Icon
                                        strokeWidth={isActive ? 2.5 : 2}
                                        className={`w-6 h-6 transition-transform duration-200 ${isActive ? "scale-110" : "scale-100"
                                            }`}
                                    />
                                    {isNotificationItem && hasUnread && (
                                        /* ★修正: top-0 right-0 で右上角に固定し、translateで外側へ押し出す */
                                        <span className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-sky-500 rounded-full border-2 border-white animate-pulse" />
                                    )}
                                </div>

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