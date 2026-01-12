"use client";

import React, { useState, useEffect } from 'react';
import { User, Settings, Camera, CheckCircle2, Trophy, Edit3, Save, X, Users, Flame } from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';

// --- 型定義 ---
interface CompletedTask {
    id: string;
    title: string;
    completed_at: string | null;
    created_at: string;
    deadline: string | null;
}

interface Profile {
    id: string;
    name: string;
    bio: string;
    goal: string;
    avatar_url: string;
}

export default function ProfilePage() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();

    // --- 状態管理 ---
    const [profile, setProfile] = useState<Profile | null>(null);
    const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
    const [streak, setStreak] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [followingCount, setFollowingCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);

    // 編集用フォーム
    const [editForm, setEditForm] = useState({
        name: '',
        bio: '',
        goal: '',
    });

    // --- データ読み込み ---
    useEffect(() => {
        if (isLoaded && user) {
            fetchProfileData(user.id);
        }
    }, [isLoaded, user]);

    const fetchProfileData = async (userId: string) => {
        const supabase = await createClerkSupabaseClient(getToken);

        // 1. プロフィール取得
        let { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // プロフィールが存在しない場合は作成
        if (profileError && profileError.code === 'PGRST116') {
            const newProfile = {
                id: userId,
                name: user?.fullName || user?.username || "ゲストユーザー",
                avatar_url: user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                goal: "目標未設定",
                bio: "",
            };

            const { data, error } = await supabase
                .from('profiles')
                .insert(newProfile)
                .select()
                .single();

            if (data) {
                profileData = data;
            } else {
                console.error("プロフィール作成エラー:", error);
            }
        }

        if (profileData) {
            setProfile(profileData);
            setEditForm({
                name: profileData.name,
                bio: profileData.bio || '',
                goal: profileData.goal || '',
            });
        }

        // 2. フォロー数を取得
        const { count: followingCnt } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);
        setFollowingCount(followingCnt || 0);

        // 3. フォロワー数を取得
        const { count: followerCnt } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);
        setFollowerCount(followerCnt || 0);

        // 4. 完了タスク取得
        const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('is_completed', true)
            .order('created_at', { ascending: false });

        if (tasksError) {
            console.error("タスク取得エラー:", tasksError);
        }

        if (tasksData) {
            const formattedTasks: CompletedTask[] = tasksData.map((task: any) => ({
                id: task.id,
                title: task.title,
                completed_at: task.completed_at || task.updated_at || task.created_at,
                created_at: task.created_at,
                deadline: task.deadline || task.due_date || null,
            }));
            setCompletedTasks(formattedTasks);
            calculateStreak(formattedTasks);
        }
    };

    // ストリーク計算関数
    const calculateStreak = (tasks: CompletedTask[]) => {
        if (!tasks || tasks.length === 0) {
            setStreak(0);
            return;
        }

        const completedDates = new Set<string>();
        tasks.forEach(task => {
            const dateStr = task.completed_at || task.created_at;
            if (dateStr) {
                const d = new Date(dateStr);
                completedDates.add(d.toLocaleDateString('ja-JP'));
            }
        });

        let currentStreak = 0;
        const today = new Date();
        const checkDate = new Date(today);

        const todayStr = checkDate.toLocaleDateString('ja-JP');
        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toLocaleDateString('ja-JP');

        if (completedDates.has(todayStr)) {
            // 今日やった
        } else if (completedDates.has(yesterdayStr)) {
            // 今日まだだけど昨日はやった
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            setStreak(0);
            return;
        }

        while (true) {
            const dateStr = checkDate.toLocaleDateString('ja-JP');
            if (completedDates.has(dateStr)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        setStreak(currentStreak);
    };

    // --- 保存処理 ---
    const handleSave = async () => {
        if (!user || !profile) return;

        setIsSaving(true);
        const supabase = await createClerkSupabaseClient(getToken);

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                name: editForm.name,
                bio: editForm.bio,
                goal: editForm.goal,
                avatar_url: profile.avatar_url,
            });

        if (error) {
            console.error("保存エラー:", error);
            alert("保存に失敗しました: " + error.message);
        } else {
            setProfile({
                ...profile,
                name: editForm.name,
                bio: editForm.bio,
                goal: editForm.goal,
            });
            setIsEditing(false);
        }

        setIsSaving(false);
    };

    // --- 編集開始 ---
    const handleStartEdit = () => {
        if (profile) {
            setEditForm({
                name: profile.name,
                bio: profile.bio || '',
                goal: profile.goal || '',
            });
        }
        setIsEditing(true);
    };

    // --- キャンセル ---
    const handleCancel = () => {
        setIsEditing(false);
    };

    // ローディング中
    if (!isLoaded || !profile) {
        return (
            <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-gray-400">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="pb-20 bg-gray-50 min-h-screen">
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between">
                <h1 className="font-bold text-lg text-gray-800">マイページ</h1>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">非公開アカウント</span>
                    <button
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isPrivate ? 'bg-sky-500' : 'bg-gray-300'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </header>

            <div className="p-4 space-y-6">
                {/* === プロフィールセクション === */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-400 to-blue-500 opacity-10" />

                    <div className="relative flex flex-col items-center text-center">
                        {/* アイコン画像 */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
                                <img
                                    src={profile.avatar_url}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {isEditing && (
                                <button className="absolute bottom-0 right-0 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700 shadow-lg">
                                    <Camera className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* フォロー数/フォロワー数 */}
                        <div className="flex gap-6 mt-4">
                            <div className="text-center">
                                <div className="font-bold text-lg text-gray-800">{followingCount}</div>
                                <div className="text-xs text-gray-500">フォロー中</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-gray-800">{followerCount}</div>
                                <div className="text-xs text-gray-500">フォロワー</div>
                            </div>
                        </div>

                        {/* 編集モードの切り替え */}
                        {isEditing ? (
                            <div className="w-full mt-6 space-y-4">
                                {/* 編集フォームの内容 (変更なし) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1 text-left">ニックネーム</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-2 text-center font-bold focus:outline-none focus:border-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1 text-left">達成したい目標</label>
                                    <input
                                        type="text"
                                        value={editForm.goal}
                                        onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                                        className="w-full border-2 border-orange-100 bg-orange-50/50 rounded-lg p-2 text-center font-bold text-orange-700 focus:outline-none focus:border-orange-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1 text-left">自己紹介</label>
                                    <textarea
                                        rows={3}
                                        value={editForm.bio}
                                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-sky-500 resize-none"
                                    />
                                </div>

                                <div className="flex gap-2 justify-center pt-2">
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 py-2 px-4 rounded-lg bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 flex items-center justify-center gap-1"
                                    >
                                        <X className="w-4 h-4" /> キャンセル
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex-1 py-2 px-4 rounded-lg bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 flex items-center justify-center gap-1 shadow-md shadow-sky-200 disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> {isSaving ? '保存中...' : '保存する'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // ★修正箇所: デザインのみ変更★
                            <div className="w-full mt-4 flex flex-col items-center relative px-4">

                                {/* コンテナ: 親要素を relative にして名前を中央、ストリークを絶対配置で右に */}
                                <div className="relative w-full flex justify-center items-center">

                                    {/* 名前: 常に中央配置 */}
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2 truncate max-w-[60%]">
                                        {profile.name}
                                        {isPrivate && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 font-normal">鍵</span>}
                                    </h2>

                                    {/* ストリーク表示: 絶対配置で右側へ & 名前と垂直中央揃え */}
                                    {streak > 0 && (
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center animate-in zoom-in duration-300">
                                            {/* 四角い枠 (Badge Box) */}
                                            <div className="relative border border-gray-300 rounded-md px-2.5 py-0.5 bg-white shadow-sm">

                                                {/* 炎アイコン: 四角の左上の線上に配置 */}
                                                {streak >= 10 && (
                                                    <Flame className="absolute -top-3.5 -left-2.5 w-5 h-5 text-orange-500 fill-orange-500 stroke-white stroke-2" />
                                                )}

                                                {/* 数字: 黒色 */}
                                                <span className="text-sm font-bold text-gray-800 tabular-nums">
                                                    {streak}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 目標表示エリア */}
                                <div className="mt-3 px-4 py-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-lg font-bold text-sm flex items-center gap-2 animate-in fade-in">
                                    <Trophy className="w-4 h-4 flex-shrink-0" />
                                    {profile.goal || "目標を設定しよう！"}
                                </div>

                                <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed animate-in fade-in">
                                    {profile.bio || "自己紹介を追加しましょう"}
                                </p>

                                <button
                                    onClick={handleStartEdit}
                                    className="mt-6 flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-sky-500 transition-colors border border-gray-200 px-4 py-2 rounded-full"
                                >
                                    <Edit3 className="w-3 h-3" /> プロフィールを編集
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* === 完了タスク一覧セクション === */}
                <section className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            完了したタスク
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
                                                <span>完了: {task.completed_at ? new Date(task.completed_at).toLocaleDateString('ja-JP') : (task.created_at ? new Date(task.created_at).toLocaleDateString('ja-JP') : '未設定')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                まだ完了したタスクはありません。<br />
                                まずは1つ、目標を達成しよう！
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}