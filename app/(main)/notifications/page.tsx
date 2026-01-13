"use client";

import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, UserPlus, Clock, AlertTriangle, CheckCircle2, ArrowLeft, Bell } from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- 型定義 ---
type NotificationType = 'like' | 'comment' | 'follow' | 'deadline_today' | 'deadline_overdue' | 'followed_post' | 'followed_task_complete';

interface Notification {
    id: string;
    type: NotificationType;
    actor_id: string;
    actor_data?: {
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

        // 1. まず期限切れチェックを行う（ここで自動で通知データを作る）
        await checkDeadlines(supabase, user!.id);

        // 2. その後、最新の通知一覧を取得する
        await fetchNotifications(supabase, user!.id);
    };

    // --- ★タスク期限チェックロジック★ ---
    const checkDeadlines = async (supabase: any, userId: string) => {
        // 未完了のタスクを取得
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('is_completed', false)
            .not('deadline', 'is', null); // 期限があるものだけ

        if (!tasks || tasks.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0); // 時間をリセットして日付だけで比較

        for (const task of tasks) {
            const deadlineDate = new Date(task.deadline);
            deadlineDate.setHours(0, 0, 0, 0);

            let type: NotificationType | null = null;
            let content = "";

            // 期限比較
            if (deadlineDate.getTime() < today.getTime()) {
                // 期限切れ
                type = 'deadline_overdue';
                content = "タスクの期限が過ぎています";
            } else if (deadlineDate.getTime() === today.getTime()) {
                // 本日が期限（残り24時間以内）
                type = 'deadline_today';
                content = "今日までのタスクがあります";
            }

            if (type) {
                // まだ通知していなければ作成（重複防止）
                // 同じタスク、同じタイプ、同じ日の通知があるかチェック
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('link_id', task.id.toString()) // タスクIDで紐付け
                    .eq('type', type)
                    .gte('created_at', today.toISOString()) // 「今日作成されたもの」があるか
                    .limit(1);

                if (!existing || existing.length === 0) {
                    await supabase.from('notifications').insert({
                        user_id: userId,
                        type: type,
                        title: task.title,
                        content: content,
                        link_id: task.id.toString(),
                        is_read: false
                    });
                }
            }
        }
    };

    // --- 通知取得ロジック ---
    const fetchNotifications = async (supabase: any, userId: string) => {
        const { data: notifData, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("通知取得エラー:", error);
            setIsLoading(false);
            return;
        }

        if (!notifData || notifData.length === 0) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        // ユーザー情報の取得（フォロー通知やいいね通知用）
        const actorIds = [...new Set(notifData.map((n: any) => n.actor_id).filter(Boolean))];
        let profileMap = new Map();

        if (actorIds.length > 0) {
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', actorIds);

            profilesData?.forEach((p: any) => profileMap.set(p.id, p));
        }

        const formattedNotifications = notifData.map((n: any) => ({
            ...n,
            actor_data: n.actor_id ? profileMap.get(n.actor_id) : null
        }));

        setNotifications(formattedNotifications);

        // 未読を既読にする
        const hasUnread = formattedNotifications.some((n: any) => !n.is_read);
        if (hasUnread) {
            setTimeout(async () => {
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', userId)
                    .eq('is_read', false);

                // 画面上の未読表示も消す
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            }, 2000);
        }

        setIsLoading(false);
    };

    // --- 画面遷移用ロジック ---
    const handleNotificationClick = (notification: Notification) => {
        // タスク系通知ならタスクページへ
        if (['deadline_today', 'deadline_overdue', 'followed_task_complete'].includes(notification.type)) {
            router.push(`/tasks`);
        }
        // フォロー通知ならその人のプロフィールへ
        else if (notification.type === 'follow') {
            router.push(`/user/${notification.actor_id}`);
        }
        // それ以外（いいね、コメント）は投稿詳細へ
        else if (notification.link_id) {
            router.push(`/post/${notification.link_id}`);
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

    // アイコン定義
    const renderIcon = (type: NotificationType) => {
        switch (type) {
            case 'followed_post': return <div className="bg-orange-100 p-2 rounded-full"><Bell className="w-5 h-5 text-orange-500" /></div>;
            case 'followed_task_complete': return <div className="bg-emerald-100 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>;
            case 'like': return <div className="bg-pink-100 p-2 rounded-full"><Heart className="w-5 h-5 text-pink-500 fill-pink-500" /></div>;
            case 'comment': return <div className="bg-sky-100 p-2 rounded-full"><MessageCircle className="w-5 h-5 text-sky-500 fill-sky-100" /></div>;
            case 'follow': return <div className="bg-indigo-100 p-2 rounded-full"><UserPlus className="w-5 h-5 text-indigo-500" /></div>;

            // ▼ タスク通知アイコン
            case 'deadline_today': return <div className="bg-amber-100 p-2 rounded-full"><Clock className="w-5 h-5 text-amber-600" /></div>;
            case 'deadline_overdue': return <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-5 h-5 text-red-600" /></div>;

            default: return <div className="bg-gray-100 p-2 rounded-full"><Bell className="w-5 h-5 text-gray-400" /></div>;
        }
    };

    // メッセージ定義
    const renderContent = (n: Notification) => {
        const name = n.actor_data?.name || "誰か";
        const postContent = n.content || "投稿";

        switch (n.type) {
            // いいね
            case 'like':
                return (
                    <div>
                        <span className="font-bold">{name}</span>さんがあなたの投稿にいいねしました
                        <div className="mt-1 pl-2 border-l-2 border-gray-200 text-xs text-gray-500 line-clamp-1">
                            {postContent}
                        </div>
                    </div>
                );
            // コメント
            case 'comment': return <><span className="font-bold">{name}</span>さんがコメントしました</>;
            // フォロー（追加しました）
            case 'follow': return <><span className="font-bold">{name}</span>さんがあなたをフォローしました</>;

            // ▼ タスク通知（文言を要望通りに修正）
            case 'deadline_today':
                return (
                    <div>
                        <span className="font-bold text-amber-600">今日までのタスクがあります</span>
                        <div className="text-gray-600 text-xs mt-0.5">「{n.title}」の期限は今日です</div>
                    </div>
                );
            case 'deadline_overdue':
                return (
                    <div>
                        <span className="font-bold text-red-600">タスクの期限が過ぎています</span>
                        <div className="text-gray-600 text-xs mt-0.5">「{n.title}」は未完了のままです</div>
                    </div>
                );

            case 'followed_post': return <><span className="font-bold">{name}</span>さんが投稿しました</>;
            case 'followed_task_complete': return <><span className="font-bold">{name}</span>さんがタスク「{n.title}」を完了！</>;
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
                                <div className="text-sm text-gray-800">{renderContent(n)}</div>
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