"use client";

import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, UserPlus, Clock, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';

// --- 型定義 ---
type NotificationType = 'like' | 'comment' | 'follow' | 'deadline_today' | 'deadline_overdue' | 'followed_post' | 'followed_task_complete';

interface Notification {
    id: string;
    type: NotificationType;
    actorName?: string;
    actorAvatar?: string;
    content?: string;
    taskTitle?: string;
    timestamp: string;
    isRead: boolean;
}

export default function NotificationsPage() {
    // --- モックデータ ---
    const [notifications, setNotifications] = useState<Notification[]>([
        {
            id: "new1",
            type: "followed_task_complete",
            actorName: "進撃の受験生",
            taskTitle: "数学IA 基礎問題精講 全範囲完了",
            timestamp: "5分前",
            isRead: false,
        },
        {
            id: "new2",
            type: "followed_post",
            actorName: "YoutuberのAさん",
            content: "今月の目標を達成しました！来月はさらに難易度を上げます。",
            timestamp: "10分前",
            isRead: false,
        },
        {
            id: "1",
            type: "deadline_overdue",
            taskTitle: "数学のチャート式 P.30まで",
            timestamp: "たった今",
            isRead: false,
        },
        {
            id: "2",
            type: "deadline_today",
            taskTitle: "英単語ターゲット1900 復習",
            timestamp: "今日 0:00",
            isRead: false,
        },
        {
            id: "3",
            type: "comment",
            actorName: "田中 太郎",
            content: "これすごく参考になります！私も真似してみます。",
            timestamp: "2時間前",
            isRead: true,
        },
        {
            id: "4",
            type: "like",
            actorName: "鈴木 花子",
            content: "毎日5時起きしてランニングする目標を立てました！",
            timestamp: "5時間前",
            isRead: true,
        },
    ]);

    // ▼ 自動既読処理: ページを開いて1.5秒後に、すべての未読を既読にする
    useEffect(() => {
        const timer = setTimeout(() => {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        }, 1500); // 1.5秒待機（ユーザーが「未読がある」と認識する時間を作る）

        return () => clearTimeout(timer);
    }, []);

    // --- メッセージ生成ロジック ---
    const renderNotificationContent = (notification: Notification) => {
        switch (notification.type) {
            case 'followed_post':
                return (
                    <div className="flex-1">
                        <p className="text-sm text-gray-800">
                            <span className="font-bold">{notification.actorName}</span>さんが投稿しました。
                        </p>
                        <div className="mt-1 text-xs text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded-lg italic">
                            "{notification.content}"
                        </div>
                    </div>
                );
            case 'followed_task_complete':
                return (
                    <div className="flex-1">
                        <p className="text-sm text-gray-800">
                            <span className="font-bold">{notification.actorName}</span>さんがタスクを完了しました！
                        </p>
                        <p className="text-xs text-sky-600 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {notification.taskTitle}
                        </p>
                    </div>
                );
            case 'like':
                return (
                    <div className="flex-1">
                        <p className="text-sm text-gray-800">
                            <span className="font-bold">{notification.actorName}</span>さんがあなたの投稿をいいねしました。
                        </p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1 border-l-2 border-gray-200 pl-2">
                            {notification.content}
                        </p>
                    </div>
                );
            case 'comment':
                return (
                    <div className="flex-1">
                        <p className="text-sm text-gray-800">
                            <span className="font-bold">{notification.actorName}</span>さんがあなたの投稿にコメントしました。
                        </p>
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-lg">
                            "{notification.content}"
                        </p>
                    </div>
                );
            case 'follow':
                return (
                    <div className="flex-1">
                        <p className="text-sm text-gray-800">
                            <span className="font-bold">{notification.actorName}</span>さんがあなたをフォローしました。
                        </p>
                    </div>
                );
            case 'deadline_today':
                return (
                    <div className="flex-1">
                        <p className="text-sm font-bold text-orange-600">
                            タスクの期限が近づいています
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            「{notification.taskTitle}」の期限は今日までです。
                        </p>
                    </div>
                );
            case 'deadline_overdue':
                return (
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-600">
                            タスクの期限が過ぎています
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            「{notification.taskTitle}」の期限が過ぎています。
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    // --- アイコン出し分け ---
    const renderIcon = (type: NotificationType) => {
        switch (type) {
            case 'followed_post':
                return <div className="bg-purple-100 p-2 rounded-full"><FileText className="w-5 h-5 text-purple-500" /></div>;
            case 'followed_task_complete':
                return <div className="bg-emerald-100 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>;
            case 'like':
                return <div className="bg-pink-100 p-2 rounded-full"><Heart className="w-5 h-5 text-pink-500 fill-pink-500" /></div>;
            case 'comment':
                return <div className="bg-blue-100 p-2 rounded-full"><MessageCircle className="w-5 h-5 text-blue-500 fill-blue-100" /></div>;
            case 'follow':
                return <div className="bg-green-100 p-2 rounded-full"><UserPlus className="w-5 h-5 text-green-500" /></div>;
            case 'deadline_today':
                return <div className="bg-orange-100 p-2 rounded-full"><Clock className="w-5 h-5 text-orange-500" /></div>;
            case 'deadline_overdue':
                return <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-5 h-5 text-red-500" /></div>;
        }
    };

    return (
        <div className="pb-20">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between">
                <h1 className="font-bold text-lg text-gray-800">通知</h1>
                {/* ボタンは削除しました */}
            </header>

            <div className="divide-y divide-gray-50">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`flex gap-4 p-4 transition-all duration-500 ${ // duration-500で色がふわっと変わる
                            notification.isRead ? 'bg-white' : 'bg-sky-50/50'
                            }`}
                    >
                        {/* アイコン */}
                        <div className="flex-shrink-0 mt-1">
                            {renderIcon(notification.type)}
                        </div>

                        {/* 内容 */}
                        <div className="flex flex-col flex-1 gap-1">
                            {renderNotificationContent(notification)}
                            <span className="text-[10px] text-gray-400 font-medium">
                                {notification.timestamp}
                            </span>
                        </div>

                        {/* 未読マーク（既読になるとフェードアウトして消える） */}
                        <div className={`flex-shrink-0 self-center transition-opacity duration-500 ${notification.isRead ? 'opacity-0' : 'opacity-100'}`}>
                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                        </div>
                    </div>
                ))}

                {notifications.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        新しい通知はありません
                    </div>
                )}
            </div>
        </div>
    );
}