"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Camera, CheckCircle2, Trophy, Edit3, Save, X, Flame, Loader2,
    MessageSquare, Calendar, ChevronRight, ChevronDown, Heart, Share2,
    Check, Send, MoreHorizontal, Trash2
} from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDeadlineLabel } from '@/lib/dateUtils';

// --- 型定義 ---
interface Task {
    id: string;
    title: string;
    completed_at: string | null;
    created_at: string;
    deadline: string | null;
    goal_title: string;
    is_completed: boolean;
}

interface SubElementGroup {
    title: string;
    fullTitle: string;
    tasks: Task[];
}

interface ElementGroup {
    title: string;
    subElements: SubElementGroup[];
}

interface GoalGroup {
    goalName: string;
    elements: ElementGroup[];
}

interface Profile {
    id: string;
    name: string;
    bio: string;
    goal: string;
    avatar_url: string;
}

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles?: {
        name: string;
        avatar_url: string;
    };
}

interface Post {
    id: string;
    user_id: string;
    content: string;
    image_url?: string;
    created_at: string;
    like_count: number;
    comment_count: number;
    has_liked: boolean;
    tasks?: { title: string } | null;
    task_snapshot?: { title: string } | null;
    profiles?: { name: string; avatar_url: string; id: string };
}

type TabType = 'completed_tasks' | 'past_posts';

// --- 時間変換関数 ---
const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}秒前`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}時間前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}日前`;

    return past.toLocaleDateString('ja-JP');
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return '未設定';
    return new Date(dateString).toLocaleDateString('ja-JP');
};

export default function ProfilePage() {
    const { user, isLoaded } = useUser();
    const { getToken, signOut } = useAuth();
    const router = useRouter();

    // --- 状態管理 ---
    const [profile, setProfile] = useState<Profile | null>(null);
    const [goalGroups, setGoalGroups] = useState<GoalGroup[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [streak, setStreak] = useState(0);
    const [expandedGoals, setExpandedGoals] = useState<string[]>([]);
    const [expandedElements, setExpandedElements] = useState<string[]>([]); // "Goal-Element"
    const [expandedSubElements, setExpandedSubElements] = useState<string[]>([]); // fullTitle

    // UI状態
    const [activeTab, setActiveTab] = useState<TabType>('completed_tasks');
    const [isEditing, setIsEditing] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [followingCount, setFollowingCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);

    const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

    // --- コメントモーダル用状態 ---
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    // 選択された投稿の「ID」だけでなく「投稿データそのもの」を保持する
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [postComments, setPostComments] = useState<Comment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // フォロー・フォロワーモーダル用
    const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
    const [followModalType, setFollowModalType] = useState<'following' | 'followers'>('following');
    const [followList, setFollowList] = useState<Profile[]>([]);

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

        // 1. プロフィール
        let { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError && profileError.code === 'PGRST116') {
            const newProfile = {
                id: userId,
                name: user?.fullName || user?.username || "ゲストユーザー",
                avatar_url: user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                goal: "目標未設定",
                bio: "",
            };
            const { data } = await supabase.from('profiles').insert(newProfile).select().single();
            if (data) profileData = data;
        }

        if (profileData) {
            setProfile(profileData);
            setEditForm({
                name: profileData.name,
                bio: profileData.bio || '',
                goal: profileData.goal || '',
            });
        }

        // 2. フォロー/フォロワー数
        const { count: followingCnt } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
        setFollowingCount(followingCnt || 0);
        const { count: followerCnt } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
        setFollowerCount(followerCnt || 0);

        // 3. タスク取得
        const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (tasksData) {
            const completedOnly = tasksData.filter((t: any) => t.is_completed);
            calculateStreak(completedOnly);

            // 階層構造の構築
            const hierarchy: { [goalName: string]: { [elementName: string]: { [subElementName: string]: Task[] } } } = {};

            completedOnly.forEach((row: any) => {
                const fullTitle = row.goal_title || "未分類";

                let goalName = "未分類";
                let elementName = "その他";
                let subElementName = "全般";

                if (fullTitle.includes(": ")) {
                    const [g, rest] = fullTitle.split(": ");
                    goalName = g;
                    if (rest.includes(" > ")) {
                        const [e, se] = rest.split(" > ");
                        elementName = e;
                        subElementName = se;
                    } else {
                        elementName = rest;
                    }
                } else {
                    goalName = fullTitle;
                }

                const task: Task = {
                    id: row.id,
                    title: row.title,
                    completed_at: row.completed_at,
                    created_at: row.created_at,
                    deadline: row.deadline,
                    goal_title: fullTitle,
                    is_completed: true
                };

                if (!hierarchy[goalName]) hierarchy[goalName] = {};
                if (!hierarchy[goalName][elementName]) hierarchy[goalName][elementName] = {};
                if (!hierarchy[goalName][elementName][subElementName]) hierarchy[goalName][elementName][subElementName] = [];

                hierarchy[goalName][elementName][subElementName].push(task);
            });

            const formattedGroups: GoalGroup[] = Object.keys(hierarchy).map(goalName => ({
                goalName,
                elements: Object.keys(hierarchy[goalName]).map(elementName => ({
                    title: elementName,
                    subElements: Object.keys(hierarchy[goalName][elementName]).map(subElementName => ({
                        title: subElementName,
                        fullTitle: `${goalName}: ${elementName}${subElementName !== '全般' ? ' > ' + subElementName : ''}`,
                        tasks: hierarchy[goalName][elementName][subElementName]
                    }))
                }))
            }));

            setGoalGroups(formattedGroups);
            setExpandedGoals(formattedGroups.map(g => g.goalName));
        }

        // 4. 過去の投稿
        const { data: postsData } = await supabase
            .from('posts')
            .select(`
                *,
                tasks ( title ),
                profiles ( name, avatar_url, id ) 
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (postsData) {
            const formattedPosts = await Promise.all(postsData.map(async (p: any) => {
                const { count: likeCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
                const { count: commentCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
                const { data: myLike } = await supabase.from('likes').select('id').eq('post_id', p.id).eq('user_id', user?.id).single();

                return {
                    ...p,
                    like_count: likeCount || 0,
                    comment_count: commentCount || 0,
                    has_liked: !!myLike
                };
            }));
            setPosts(formattedPosts);
        }
    };

    const calculateStreak = (completedTasks: any[]) => {
        if (!completedTasks || completedTasks.length === 0) {
            setStreak(0);
            return;
        }
        const completedDates = new Set<string>();
        completedTasks.forEach(task => {
            const dateStr = task.completed_at || task.created_at;
            if (dateStr) {
                const d = new Date(dateStr);
                completedDates.add(d.toLocaleDateString('ja-JP'));
            }
        });
        let currentStreak = 0;
        const checkDate = new Date();
        const todayStr = checkDate.toLocaleDateString('ja-JP');
        if (!completedDates.has(todayStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
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

    const fetchFollowList = async (type: 'following' | 'followers') => {
        if (!user) return;
        const supabase = await createClerkSupabaseClient(getToken);

        if (type === 'following') {
            const { data } = await supabase
                .from('follows')
                .select('following_id, profiles!follows_following_id_fkey(*)')
                .eq('follower_id', user.id);

            if (data) {
                setFollowList(data.map((f: any) => f.profiles).filter(Boolean));
            }
        } else {
            const { data } = await supabase
                .from('follows')
                .select('follower_id, profiles!follows_follower_id_fkey(*)')
                .eq('following_id', user.id);

            if (data) {
                setFollowList(data.map((f: any) => f.profiles).filter(Boolean));
            }
        }
    };

    const openFollowModal = async (type: 'following' | 'followers') => {
        setFollowModalType(type);
        setIsFollowModalOpen(true);
        setFollowList([]);
        await fetchFollowList(type);
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !user) return;
        const file = event.target.files[0];
        if (file.size > 2 * 1024 * 1024) return alert("画像サイズが大きすぎます(2MB以下)");

        setIsUploading(true);
        try {
            const supabase = await createClerkSupabaseClient(getToken);
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            if (profile) setProfile({ ...profile, avatar_url: urlData.publicUrl });
        } catch (error) {
            console.error(error);
            alert('アップロード失敗');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !profile) return;
        setIsSaving(true);
        const supabase = await createClerkSupabaseClient(getToken);
        const { error } = await supabase.from('profiles').upsert({
            id: user.id,
            name: editForm.name,
            bio: editForm.bio,
            goal: editForm.goal,
            avatar_url: profile.avatar_url,
        });
        if (!error) {
            setProfile({ ...profile, ...editForm });
            setIsEditing(false);
        } else {
            alert("保存失敗");
        }
        setIsSaving(false);
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
    };

    const deleteCompletedTask = async (taskId: string) => {
        if (!confirm('この完了タスクを削除しますか?')) return;
        const supabase = await createClerkSupabaseClient(getToken);
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (!error && user) {
            fetchProfileData(user.id);
        } else {
            alert('削除に失敗しました');
        }
    };

    const toggleGoal = (goalName: string) => {
        setExpandedGoals(prev =>
            prev.includes(goalName) ? prev.filter(g => g !== goalName) : [...prev, goalName]
        );
    };

    const toggleElement = (goalName: string, elementName: string) => {
        const key = `${goalName}-${elementName}`;
        setExpandedElements(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const toggleSubElement = (fullTitle: string) => {
        setExpandedSubElements(prev =>
            prev.includes(fullTitle) ? prev.filter(ft => ft !== fullTitle) : [...prev, fullTitle]
        );
    };

    const deletePost = async (postId: string) => {
        if (!confirm('本当にこの投稿を削除しますか？')) return;
        try {
            const supabase = await createClerkSupabaseClient(getToken);
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) throw error;
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (error) {
            console.error('削除エラー:', error);
            alert('削除に失敗しました');
        }
    };

    const handlePostClick = (post: Post) => {
        // 詳細ページへの遷移は一旦無効化し、モーダルで完結させる（必要に応じて変更可）
        // router.push(`/post/${post.id}`);
    };

    const toggleLike = async (postId: string, currentLiked: boolean, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;

        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    has_liked: !currentLiked,
                    like_count: currentLiked ? p.like_count - 1 : p.like_count + 1
                };
            }
            return p;
        }));

        const supabase = await createClerkSupabaseClient(getToken);
        if (currentLiked) {
            await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
        } else {
            await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
        }
    };

    // --- コメント機能 ---
    const fetchComments = async (postId: string) => {
        setIsLoadingComments(true);
        try {
            const supabase = await createClerkSupabaseClient(getToken);
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    *,
                    profiles ( name, avatar_url )
                `)
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (!error) {
                setPostComments(data || []);
            }
        } catch (err) {
            console.error("Fetch comments error:", err);
        } finally {
            setIsLoadingComments(false);
        }
    };

    const openCommentModal = async (post: Post, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedPost(post); // 投稿データをセット
        setIsCommentModalOpen(true);
        setCommentText("");
        setPostComments([]);
        await fetchComments(post.id);
    };

    const handleSubmitComment = async () => {
        if (!commentText.trim() || !selectedPost || !user) return;
        setIsSubmittingComment(true);

        const supabase = await createClerkSupabaseClient(getToken);

        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    user_id: user.id,
                    post_id: selectedPost.id,
                    content: commentText.trim()
                })
                .select(`
                    *,
                    profiles ( name, avatar_url )
                `)
                .single();

            if (error) throw error;

            if (data) {
                setPosts(prev => prev.map(p => {
                    if (p.id === selectedPost.id) {
                        return { ...p, comment_count: p.comment_count + 1 };
                    }
                    return p;
                }));
                setPostComments(prev => [...prev, data]);
                setCommentText("");
            }
        } catch (error) {
            console.error(error);
            alert("コメント送信に失敗しました");
        } finally {
            setIsSubmittingComment(false);
        }
    };


    // --- レンダリング ---
    const renderCompletedTasks = () => {
        if (goalGroups.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                    <Trophy className="w-12 h-12 mb-4 text-gray-200" />
                    <p className="font-bold text-gray-500">まだ完了したタスクはありません。</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {goalGroups.map((goalGroup) => {
                    const isGoalExpanded = expandedGoals.includes(goalGroup.goalName);

                    return (
                        <div key={goalGroup.goalName} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white mb-4">
                            {/* 第1階層: 目標 (Goal) */}
                            <div
                                onClick={() => toggleGoal(goalGroup.goalName)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-sky-50/30"
                            >
                                <div className="flex items-center gap-3">

                                    <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        {goalGroup.goalName}
                                    </h2>
                                </div>
                                <div className="text-gray-400">
                                    {isGoalExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </div>
                            </div>

                            {isGoalExpanded && (
                                <div className="p-4 space-y-4 bg-white border-t border-gray-100">
                                    {goalGroup.elements.map((elementGroup) => {
                                        const elKey = `${goalGroup.goalName}-${elementGroup.title}`;
                                        const isElementExpanded = expandedElements.includes(elKey);

                                        return (
                                            <div key={elementGroup.title} className="bg-white rounded-xl border border-gray-100 overflow-hidden border-l-4 border-l-sky-500 shadow-sm">
                                                {/* 第2階層: 要素 (Element) */}
                                                <div
                                                    onClick={() => toggleElement(goalGroup.goalName, elementGroup.title)}
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/30"
                                                >
                                                    <h3 className="font-bold text-gray-700 text-xs">{elementGroup.title}</h3>
                                                    <div className="text-gray-400">
                                                        {isElementExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                </div>

                                                {isElementExpanded && (
                                                    <div className="p-3 space-y-3 bg-white">
                                                        {elementGroup.subElements.map((subGroup) => {
                                                            const isSubExpanded = expandedSubElements.includes(subGroup.fullTitle);

                                                            return (
                                                                <div key={subGroup.title} className="rounded-lg border border-gray-100 overflow-hidden border-l-4 border-l-orange-400">
                                                                    {/* 第3階層: 中項目 (SubElement) */}
                                                                    <div
                                                                        onClick={() => toggleSubElement(subGroup.fullTitle)}
                                                                        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/20"
                                                                    >
                                                                        <h4 className="font-bold text-gray-600 text-[10px]">{subGroup.title}</h4>
                                                                        <div className="text-gray-400">
                                                                            {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </div>
                                                                    </div>

                                                                    {isSubExpanded && (
                                                                        <div className="p-2 space-y-2 bg-gray-50/10">
                                                                            {subGroup.tasks.map((task) => (
                                                                                <div key={task.id} className="relative flex items-start gap-2 p-3 rounded-lg border bg-gray-50 border-gray-100 opacity-80 mb-1 last:mb-0 group">
                                                                                    <button
                                                                                        onClick={() => deleteCompletedTask(task.id)}
                                                                                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        title="削除"
                                                                                    >
                                                                                        <X className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                    <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-sky-500 border-sky-500">
                                                                                        <Check className="w-2.5 h-2.5 text-white" />
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0 pr-6">
                                                                                        <p className="text-[11px] font-bold leading-relaxed text-gray-400 line-through break-words">
                                                                                            {task.title}
                                                                                        </p>
                                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                                            <Calendar className="w-2.5 h-2.5 text-gray-300" />
                                                                                            <span className="text-[9px] text-gray-400 font-bold">
                                                                                                完了: {formatDate(task.completed_at || task.created_at)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderPastPosts = () => {
        if (posts.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                    <MessageSquare className="w-12 h-12 mb-4 text-gray-200" />
                    <p className="font-bold text-gray-500">まだ投稿はありません</p>
                </div>
            );
        }

        return (
            <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                {posts.map((post) => {
                    const taskTitle = post.task_snapshot?.title || post.tasks?.title;
                    const hasTask = !!taskTitle;

                    return (
                        <article key={post.id} className="bg-white p-4 border-b border-gray-100">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0">
                                    <img
                                        src={post.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest"}
                                        alt="avatar"
                                        className="w-10 h-10 rounded-full border border-gray-100 object-cover"
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-bold text-gray-900 text-sm truncate">{post.profiles?.name}</span>
                                            <span className="text-gray-400 text-xs flex-shrink-0">· {getRelativeTime(post.created_at)}</span>
                                        </div>

                                        <div className="relative">
                                            <button
                                                className="text-gray-400 hover:text-sky-500 rounded-full p-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuPostId(openMenuPostId === post.id ? null : post.id);
                                                }}
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                            {openMenuPostId === post.id && (
                                                <div className="absolute right-0 top-full bg-white shadow-lg border border-gray-100 rounded-lg z-10 w-24">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deletePost(post.id); }}
                                                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        削除
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <p className="mt-1 text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                                    {hasTask && (
                                        <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-white flex items-start gap-3">
                                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-500 mb-0.5">タスクを完了しました</div>
                                                <div className="text-sm font-bold text-gray-900 truncate">{taskTitle}</div>
                                            </div>
                                        </div>
                                    )}

                                    {post.image_url && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
                                            <img src={post.image_url} alt="post" className="w-full h-auto object-cover max-h-96" />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-3 max-w-xs pr-4">
                                        <button
                                            onClick={(e) => openCommentModal(post, e)}
                                            className="group flex items-center gap-1.5 text-gray-500 hover:text-sky-500"
                                        >
                                            <MessageSquare className="w-4.5 h-4.5" />
                                            <span className="text-xs">{post.comment_count > 0 && post.comment_count}</span>
                                        </button>

                                        <button
                                            onClick={(e) => toggleLike(post.id, post.has_liked, e)}
                                            className={`group flex items-center gap-1.5 ${post.has_liked ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}
                                        >
                                            <Heart className={`w-4.5 h-4.5 ${post.has_liked ? 'fill-current' : ''}`} />
                                            <span className="text-xs">{post.like_count > 0 && post.like_count}</span>
                                        </button>

                                        <button className="text-gray-500 hover:text-green-500">
                                            <Share2 className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        );
    };

    if (!isLoaded || !profile) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="pb-24 bg-gray-50 min-h-screen" onClick={() => setOpenMenuPostId(null)}>
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between">
                <h1 className="font-bold text-lg text-gray-800">マイページ</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handleSignOut} className="text-xs text-red-500 font-bold border border-red-200 px-3 py-1 rounded-full hover:bg-red-50">
                        ログアウト
                    </button>
                </div>
            </header>

            <div className="p-4 space-y-6">
                {/* プロフィール */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-sky-400 to-blue-500 opacity-10" />
                    <div className="relative flex flex-col items-center text-center">
                        <div className="relative group">
                            <input
                                id="avatar-upload"
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                disabled={!isEditing || isUploading}
                                className="hidden"
                            />
                            {isEditing ? (
                                <label htmlFor="avatar-upload" className="block relative cursor-pointer">
                                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white relative">
                                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                            {isUploading && <Loader2 className="w-8 h-8 text-white animate-spin" />}
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 right-0 bg-gray-800 text-white p-2 rounded-full z-10">
                                        <Camera className="w-4 h-4" />
                                    </div>
                                </label>
                            ) : (
                                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-6 mt-4">
                            <button onClick={() => openFollowModal('following')} className="text-center hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors">
                                <div className="font-bold text-lg text-gray-800">{followingCount}</div>
                                <div className="text-xs text-gray-500">フォロー中</div>
                            </button>
                            <button onClick={() => openFollowModal('followers')} className="text-center hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors">
                                <div className="font-bold text-lg text-gray-800">{followerCount}</div>
                                <div className="text-xs text-gray-500">フォロワー</div>
                            </button>
                        </div>

                        {isEditing ? (
                            <div className="w-full mt-6 space-y-4">
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg p-2 text-center font-bold"
                                    placeholder="名前"
                                />
                                <input
                                    type="text"
                                    value={editForm.goal}
                                    onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                                    className="w-full border border-orange-100 bg-orange-50 rounded-lg p-2 text-center font-bold text-orange-700"
                                    placeholder="目標"
                                    maxLength={20}
                                />
                                <textarea
                                    value={editForm.bio}
                                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                    className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none"
                                    placeholder="自己紹介"
                                    maxLength={100}
                                />
                                <div className="flex gap-2 justify-center pt-2">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 px-4 rounded-lg bg-gray-100 font-bold text-sm">キャンセル</button>
                                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2 px-4 rounded-lg bg-sky-500 text-white font-bold text-sm">保存</button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full mt-4 flex flex-col items-center relative px-4">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    {profile.name}
                                </h2>
                                {streak > 0 && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                                        <div className="relative border border-gray-300 rounded-md px-2.5 py-0.5 bg-white shadow-sm">
                                            {streak >= 3 && <Flame className="absolute -top-3.5 -left-2.5 w-5 h-5 text-orange-500 fill-orange-500 stroke-white stroke-2" />}
                                            <span className="text-sm font-bold text-gray-800">{streak}日連続</span>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-3 px-4 py-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-lg font-bold text-sm flex items-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    {profile.goal || "目標を設定しよう！"}
                                </div>
                                <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{profile.bio || "自己紹介未設定"}</p>
                                <button onClick={() => {
                                    setEditForm({ name: profile.name, bio: profile.bio, goal: profile.goal });
                                    setIsEditing(true);
                                }} className="mt-6 flex items-center gap-2 text-xs font-bold text-gray-400 border border-gray-200 px-4 py-2 rounded-full">
                                    <Edit3 className="w-3 h-3" /> プロフィールを編集
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex p-1 bg-gray-200/50 rounded-xl">
                    <button
                        onClick={() => setActiveTab('completed_tasks')}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'completed_tasks' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <CheckCircle2 className="w-5 h-5" /> 完了タスク
                    </button>
                    <button
                        onClick={() => setActiveTab('past_posts')}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'past_posts' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <MessageSquare className="w-5 h-5" /> 過去の投稿
                    </button>
                </div>

                <section>
                    {activeTab === 'completed_tasks' ? renderCompletedTasks() : renderPastPosts()}
                </section>
            </div>

            {/* --- コメントモーダル (修正版) --- */}
            {isCommentModalOpen && selectedPost && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div
                        className="w-full max-w-lg bg-white h-[90vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                            <h3 className="font-bold text-gray-800">コメント</h3>
                            <button onClick={() => setIsCommentModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* スクロールエリア (元の投稿 + コメント) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* 元の投稿を表示 */}
                            <div className="pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <img src={selectedPost.profiles?.avatar_url} className="w-8 h-8 rounded-full border" />
                                    <span className="font-bold text-sm">{selectedPost.profiles?.name}</span>
                                    <span className="text-xs text-gray-400">{getRelativeTime(selectedPost.created_at)}</span>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedPost.content}</p>
                                {selectedPost.image_url && (
                                    <img src={selectedPost.image_url} className="mt-2 rounded-lg w-full object-cover max-h-60" />
                                )}
                            </div>

                            {/* コメント一覧 */}
                            <div className="space-y-4">
                                {isLoadingComments ? (
                                    <div className="flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                                ) : postComments.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-4">コメントはまだありません</p>
                                ) : (
                                    postComments.map((comment) => (
                                        <div key={comment.id} className="flex gap-3">
                                            <img src={comment.profiles?.avatar_url} className="w-8 h-8 rounded-full border flex-shrink-0" />
                                            <div className="flex-1 bg-gray-50 p-3 rounded-xl rounded-tl-none">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-gray-700">{comment.profiles?.name}</span>
                                                    <span className="text-[10px] text-gray-400">{getRelativeTime(comment.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 入力エリア (最下部固定) */}
                        <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0 safe-area-bottom">
                            <div className="flex gap-2 items-center bg-gray-100 rounded-full px-4 py-2">
                                <input
                                    type="text"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="コメントを入力..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm focus:outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSubmitComment()}
                                />
                                <button
                                    onClick={handleSubmitComment}
                                    disabled={!commentText.trim() || isSubmittingComment}
                                    className="text-sky-500 disabled:opacity-50 font-bold p-1"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === フォロー・フォロワーモーダル === */}
            {isFollowModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">
                                {followModalType === 'following' ? 'フォロー中' : 'フォロワー'}
                            </h3>
                            <button onClick={() => setIsFollowModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {followList.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {followList.map((profile) => (
                                        <Link
                                            key={profile.id}
                                            href={`/user/${profile.id}`}
                                            onClick={() => setIsFollowModalOpen(false)}
                                            className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <img
                                                src={profile.avatar_url}
                                                alt={profile.name}
                                                className="w-12 h-12 rounded-full border border-gray-100 object-cover"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{profile.name}</p>
                                                {profile.goal && (
                                                    <p className="text-xs text-gray-500 truncate">{profile.goal}</p>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <p className="text-sm">
                                        {followModalType === 'following' ? 'フォロー中のユーザーはいません' : 'フォロワーはいません'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}