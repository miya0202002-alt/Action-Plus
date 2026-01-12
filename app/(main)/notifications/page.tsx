"use client";

import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, UserPlus, Clock, AlertTriangle, CheckCircle2, FileText, ArrowLeft, Bell } from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- 型定義 ---
type NotificationType = 'like' | 'comment' | 'follow' | 'deadline_today' | 'deadline_overdue' | 'followed_post' | 'followed_task_complete';

interface Notification {
    id: string;
    type: NotificationType;
    actor_id: string; // 通知を送った人のID
    actor_data?: {    // 後から結合するプロフィール情報
        name: string;
        avatar_url: string;
    };
    content?: string;
    title?: string;
    link_id?: string;
    created_at: string;
    is_read: boolean;
}

export default function NotificationsPage() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- データ読み込み ---
    useEffect(() => {
        if (isLoaded && user) {
            initializeNotifications();
        }
    }, [isLoaded, user]);

    const initializeNotifications = async () => {
        setIsLoading(true);
        const supabase = await createClerkSupabaseClient(getToken);

        // 1. まず期限切れチェックを行う（通知を作る）
        await checkDeadlines(supabase, user!.id);

        // 2. その後、通知一覧を取得する
        await fetchNotifications(supabase, user!.id);
    };

    // --- 期限チェックロジック（変更なし） ---
    const checkDeadlines = async (supabase: any, userId: string) => {
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('is_completed', false);

        if (!tasks) return;

        const today = new Date();

        for (const task of tasks) {
            if (!task.deadline) continue;

            const deadlineDate = new Date(task.deadline);
            let type: NotificationType | null = null;

            today.setHours(0, 0, 0, 0);
            deadlineDate.setHours(0, 0, 0, 0);

            if (deadlineDate.getTime() < today.getTime()) {
                type = 'deadline_overdue';
            } else if (deadlineDate.getTime() === today.getTime()) {
                type = 'deadline_today';
            }

            if (type) {
                // 重複チェック
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('link_id', task.id)
                    .eq('type', type)
                    .single();

                if (!existing) {
                    await supabase.from('notifications').insert({
                        user_id: userId,
                        type: type,
                        title: task.title,
                        link_id: task.id,
                        is_read: false
                    });
                }
            }
        }
    };

    // --- 【修正ポイント】安全な通知取得ロジック ---
    const fetchNotifications = async (supabase: any, userId: string) => {
        // A. まず通知データだけ取得 (JOINしない)
        const { data: notifData, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("通知取得エラー:", {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            setIsLoading(false);
            return;
        }

        if (!notifData || notifData.length === 0) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        // B. 通知の中に含まれる「相手のID」をリストアップ
        const actorIds = [...new Set(notifData.map((n: any) => n.actor_id).filter(Boolean))];

        let profileMap = new Map();

        // C. 相手のプロフィール情報を別途取得してマッピング
        if (actorIds.length > 0) {
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', actorIds);

            profilesData?.forEach((p: any) => profileMap.set(p.id, p));
        }

        // D. 通知データとプロフィールデータを手動で合体
        const formattedNotifications = notifData.map((n: any) => ({
            ...n,
            actor_data: n.actor_id ? profileMap.get(n.actor_id) : null
        }));

        setNotifications(formattedNotifications);

        // 未読を既読にする処理
        const hasUnread = formattedNotifications.some((n: any) => !n.is_read);
        if (hasUnread) {
            setTimeout(async () => {
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', userId)
                    .eq('is_read', false);

                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            }, 2000);
        }

        setIsLoading(false);
    };

    // --- 画面表示用ロジック ---
    const handleNotificationClick = (notification: Notification) => {
        if (!notification.link_id) return;

        if (['deadline_today', 'deadline_overdue', 'followed_task_complete'].includes(notification.type)) {
            // タスクページへ（必要に応じてURLを調整してください）
            // router.push(`/tasks?id=${notification.link_id}`);
            alert("タスク画面へ移動します");
        } else {
            // 投稿詳細ページへ（必要に応じてURLを調整してください）
            // router.push(`/post/${notification.link_id}`);
            alert("投稿画面へ移動します");
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 24 * 60 * 60 * 1000) {
            if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}分前`;
            return `${Math.floor(diff / 3600000)}時間前`;
        }
        return date.toLocaleDateString('ja-JP');
    };

    // アイコンの定義
    const renderIcon = (type: NotificationType) => {
        switch (type) {
            case 'followed_post': return <div className="bg-orange-100 p-2 rounded-full"><Bell className="w-5 h-5 text-orange-500" /></div>;
            case 'followed_task_complete': return <div className="bg-emerald-100 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>;
            case 'like': return <div className="bg-pink-100 p-2 rounded-full"><Heart className="w-5 h-5 text-pink-500 fill-pink-500" /></div>;
            case 'comment': return <div className="bg-sky-100 p-2 rounded-full"><MessageCircle className="w-5 h-5 text-sky-500 fill-sky-100" /></div>;
            case 'follow': return <div className="bg-indigo-100 p-2 rounded-full"><UserPlus className="w-5 h-5 text-indigo-500" /></div>;
            case 'deadline_today': return <div className="bg-amber-100 p-2 rounded-full"><Clock className="w-5 h-5 text-amber-600" /></div>;
            case 'deadline_overdue': return <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-5 h-5 text-red-600" /></div>;
            default: return <div className="bg-gray-100 p-2 rounded-full"><Bell className="w-5 h-5 text-gray-400" /></div>;
        }
    };

    // メッセージの定義
    const renderContent = (n: Notification) => {
        const name = n.actor_data?.name || "誰か";
        switch (n.type) {
            case 'followed_post': return <><span className="font-bold">{name}</span>さんが投稿しました</>;
            case 'followed_task_complete': return <><span className="font-bold">{name}</span>さんがタスク「{n.title}」を完了！</>;
            case 'like': return <><span className="font-bold">{name}</span>さんが「いいね」しました</>;
            case 'comment': return <><span className="font-bold">{name}</span>さんがコメントしました</>;
            case 'follow': return <><span className="font-bold">{name}</span>さんがフォローしました</>;
            case 'deadline_today': return <span className="font-bold text-orange-600">タスク「{n.title}」の期限は今日です</span>;
            case 'deadline_overdue': return <span className="font-bold text-red-600">タスク「{n.title}」の期限が過ぎています</span>;
            default: return "新しい通知があります";
        }
    };

    if (!isLoaded) return <div className="p-8 text-center text-gray-400">読み込み中...</div>;

    return (
        <div className="bg-white min-h-screen pb-20">
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-4">
                <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">通知</h1>
            </header>

            <div className="divide-y divide-gray-50 max-w-xl mx-auto">
                {isLoading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">通知を確認中...</div>
                ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                        <div key={n.id} onClick={() => handleNotificationClick(n)} className={`flex gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${n.is_read ? 'bg-white' : 'bg-sky-50/40'}`}>
                            <div className="relative flex-shrink-0 mt-1">
                                {n.actor_data?.avatar_url && <img src={n.actor_data.avatar_url} className="absolute -top-1 -left-1 w-6 h-6 rounded-full border border-white z-10 object-cover" alt="" />}
                                {renderIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800">{renderContent(n)}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                            </div>
                            {!n.is_read && <div className="w-2 h-2 bg-sky-500 rounded-full self-center flex-shrink-0 animate-pulse" />}
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Bell className="w-12 h-12 mb-4 text-gray-200" />
                        <p className="text-sm">通知はありません</p>
                    </div>
                )}
            </div>
        </div>
    );
}