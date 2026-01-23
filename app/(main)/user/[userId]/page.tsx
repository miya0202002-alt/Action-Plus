"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Trophy, User as UserIcon, UserPlus, UserMinus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabaseClient';

// --- 型定義 ---
interface Profile {
    id: string;
    name: string;
    bio: string;
    goal: string;
    avatar_url: string;
}

interface CompletedTask {
    id: number;
    title: string;
    completed_at: string;
    deadline: string;
}

export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { user: currentUser, isLoaded: isAuthLoaded } = useUser();
    const userId = params.userId as string;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // ソーシャルステート
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowActionLoading, setIsFollowActionLoading] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchUserData(userId);
        }
    }, [userId, isAuthLoaded, currentUser]);

    const fetchUserData = async (id: string) => {
        setIsLoading(true);
        setNotFound(false);

        // 1. プロフィール取得
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (profileError || !profileData) {
            setNotFound(true);
            setIsLoading(false);
            return;
        }

        setProfile(profileData);

        // 2. フォロー状況確認 (自分がログインしている場合)
        if (currentUser && currentUser.id !== id) {
            const { data: followData } = await supabase
                .from('follows')
                .select('*')
                .eq('follower_id', currentUser.id)
                .eq('following_id', id)
                .single();

            setIsFollowing(!!followData);
        }

        // 3. カウント取得
        const { count: followers } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', id);
        setFollowerCount(followers || 0);

        const { count: followings } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', id);
        setFollowingCount(followings || 0);

        // 4. 完了タスク取得
        const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', id)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false });

        if (tasksData) {
            setCompletedTasks(tasksData);
        }

        setIsLoading(false);
    };

    // フォロー切り替え
    const handleToggleFollow = async () => {
        if (!currentUser || !profile || isFollowActionLoading) return;
        if (currentUser.id === profile.id) return;

        setIsFollowActionLoading(true);

        if (isFollowing) {
            // フォロー解除
            const { error } = await supabase
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', profile.id);

            if (!error) {
                setIsFollowing(false);
                setFollowerCount(prev => prev - 1);
            }
        } else {
            // フォロー
            const { error } = await supabase
                .from('follows')
                .insert({
                    follower_id: currentUser.id,
                    following_id: profile.id
                });

            if (!error) {
                setIsFollowing(true);
                setFollowerCount(prev => prev + 1);

                // 通知の送出 (重複防止)
                const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', profile.id)
                    .eq('actor_id', currentUser.id)
                    .eq('type', 'follow')
                    .limit(1);

                if (!existingNotif || existingNotif.length === 0) {
                    await supabase.from('notifications').insert({
                        id: crypto.randomUUID(),
                        user_id: profile.id,
                        actor_id: currentUser.id,
                        type: 'follow',
                        content: `${currentUser.fullName || currentUser.username || "誰か"}さんにフォローされました`,
                        is_read: false
                    });
                }
            }
        }

        setIsFollowActionLoading(false);
    };

    // ローディング中
    if (isLoading || !isAuthLoaded) {
        return (
            <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-gray-400">読み込み中...</div>
            </div>
        );
    }

    // ユーザーが見つからない
    if (notFound || !profile) {
        return (
            <div className="pb-20 bg-gray-50 min-h-screen">
                <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h1 className="font-bold text-lg text-gray-800">ユーザー</h1>
                </header>
                <div className="flex flex-col items-center justify-center p-8 mt-20">
                    <UserIcon className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-bold">ユーザーが見つかりません</p>
                    <p className="text-gray-400 text-sm mt-2">このユーザーは存在しないか、削除された可能性があります。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 bg-gray-50 min-h-screen">
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="font-bold text-lg text-gray-800">{profile.name}</h1>
            </header>

            <div className="p-4 space-y-6">
                {/* === プロフィールセクション === */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    {/* 背景装飾 */}
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-400 to-blue-500 opacity-10" />

                    <div className="relative flex flex-col items-center text-center">
                        {/* アイコン画像 */}
                        <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
                            <img
                                src={profile.avatar_url}
                                alt={profile.name}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        <div className="w-full mt-4 flex flex-col items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {profile.name}
                            </h2>

                            {/* フォロー数/フォロワー数 */}
                            <div className="flex gap-6 mt-2 mb-4">
                                <div className="text-center">
                                    <div className="font-bold text-gray-800">{followingCount}</div>
                                    <div className="text-xs text-gray-500">フォロー中</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-gray-800">{followerCount}</div>
                                    <div className="text-xs text-gray-500">フォロワー</div>
                                </div>
                            </div>

                            {/* フォローボタン (自分以外の場合のみ表示) */}
                            {currentUser && currentUser.id !== profile.id && (
                                <button
                                    onClick={handleToggleFollow}
                                    disabled={isFollowActionLoading}
                                    className={`mb-4 flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 shadow-sm ${isFollowing
                                        ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 border border-gray-200'
                                        : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sky-200'
                                        } disabled:opacity-50`}
                                >
                                    {isFollowing ? (
                                        <><UserMinus className="w-4 h-4" /> フォロー解除</>
                                    ) : (
                                        <><UserPlus className="w-4 h-4" /> フォローする</>
                                    )}
                                </button>
                            )}

                            {/* 目標表示エリア */}
                            {profile.goal && (
                                <div className="px-4 py-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-lg font-bold text-sm flex items-center gap-2 animate-in fade-in">
                                    <Trophy className="w-4 h-4 flex-shrink-0" />
                                    {profile.goal}
                                </div>
                            )}

                            {/* 自己紹介 */}
                            {profile.bio && (
                                <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed animate-in fade-in">
                                    {profile.bio}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* === 完了タスク一覧セクション === */}
                <section className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            達成したタスク
                        </h3>
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">
                            Total: {completedTasks.length}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {completedTasks.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {completedTasks.map((task) => (
                                    <div key={task.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-700 line-through decoration-gray-300 decoration-2">
                                                {task.title}
                                            </p>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                                <span>期限: {task.deadline || '未設定'}</span>
                                                <span className="text-gray-300">|</span>
                                                <span>完了: {task.completed_at ? new Date(task.completed_at).toLocaleDateString('ja-JP') : '未設定'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                まだ完了したタスクはありません。
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
