"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Image as ImageIcon, Send, CheckCircle2, X as XIcon, Plus, Trash2, Copy } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// --- 時間を「○分前」形式にする関数 ---
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

    return past.toLocaleDateString('ja-JP'); // 1週間以上前は日付
};

// --- 型定義 ---
type Profile = {
    id: string;
    name: string;
    avatar_url: string;
    goal: string;
};

type Comment = {
    id: number;
    content: string;
    created_at: string;
    user_id: string;
    profiles?: Profile; // 結合用
};

type Post = {
    id: number;
    user_id: string; // 追加: 削除判定用
    content: string;
    image_url?: string;
    linked_task?: string;
    // likes: number; // DBのカウンターは参考程度にする
    // comments: number;
    created_at: string;
    profiles: Profile | null;

    // アプリ内計算用
    like_count: number;
    comment_count: number;
    has_liked: boolean;
};

type Task = {
    id: number;
    title: string;
};

import { useUser } from '@clerk/nextjs'; // Clerkのフックを追加

export default function HomePage() {
    // --- 状態管理 ---
    const { user, isLoaded } = useUser(); // Clerkからユーザー情報を取得
    const [posts, setPosts] = useState<Post[]>([]);
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [myFollowings, setMyFollowings] = useState<string[]>([]); // フォロー中のIDリスト

    // UI制御用
    const [activeTab, setActiveTab] = useState<'recommend' | 'following'>('recommend');
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const [openMenuPostId, setOpenMenuPostId] = useState<number | null>(null); // メニューを開いている投稿ID

    // 投稿フォーム用 (モーダル)
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [newPostContent, setNewPostContent] = useState("");
    const [selectedTask, setSelectedTask] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPosting, setIsPosting] = useState(false);

    // 詳細・コメント用
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSendingComment, setIsSendingComment] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // --- 初期データ読み込み ---
    useEffect(() => {
        if (isLoaded && user) {
            fetchData(user.id);
        }
    }, [isLoaded, user]); // ユーザーがロードされたら実行

    // スクロール制御
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY < 0) return;
            if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
                setIsHeaderVisible(false);
                setOpenMenuPostId(null); // スクロールしたらメニューを閉じる
            } else {
                setIsHeaderVisible(true);
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const fetchData = async (userId: string) => {
        setIsLoading(true);
        // 1. 自分のプロフィール取得 (Supabaseのprofilesテーブル)
        let { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // プロフィールがない場合は作成する（初回ログイン時など）
        if (!profileData && user) {
            const newProfile = {
                id: userId,
                name: user.fullName || user.username || "ゲストユーザー",
                avatar_url: user.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                goal: "目標未設定",
                bio: "",
            };
            const { data } = await supabase.from('profiles').insert(newProfile).select().single();
            if (data) profileData = data;
        }

        if (profileData) setMyProfile(profileData);

        // 2. フォローリスト取得
        const { data: followsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

        const followingIds = followsData ? followsData.map((f: any) => f.following_id) : [];
        setMyFollowings(followingIds);

        // 3. 自分が「いいね」した投稿IDリストを取得
        const { data: myLikesData } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', userId);
        const myLikedPostIds = new Set(myLikesData ? myLikesData.map((l: any) => l.post_id) : []);

        // 4. 投稿一覧を取得
        const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*, profiles(id, name, avatar_url, goal)')
            .order('created_at', { ascending: false });

        if (postsError) {
            console.error('投稿の取得に失敗:', postsError);
        }

        if (postsData) {
            // 各投稿のいいね数とコメント数を個別に取得
            const formattedPosts = await Promise.all(
                postsData.map(async (p: any) => {
                    const { count: likeCount } = await supabase
                        .from('likes')
                        .select('*', { count: 'exact', head: true })
                        .eq('post_id', p.id);

                    const { count: commentCount } = await supabase
                        .from('comments')
                        .select('*', { count: 'exact', head: true })
                        .eq('post_id', p.id);

                    return {
                        ...p,
                        like_count: likeCount || 0,
                        comment_count: commentCount || 0,
                        has_liked: myLikedPostIds.has(p.id)
                    };
                })
            );
            setPosts(formattedPosts);
        }

        // 5. 完了タスク
        if (user) {
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_completed', true);
            if (tasksData) setMyTasks(tasksData);
        }
        setIsLoading(false);
    };

    // --- 投稿削除 ---
    const deletePost = async (postId: number) => {
        if (!confirm("本当にこの投稿を削除しますか？")) return;

        // UIから削除
        setPosts(posts.filter(p => p.id !== postId));

        // DBから削除
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) alert("削除に失敗しました");
        setOpenMenuPostId(null);
    };

    // --- 共有機能 ---
    const handleShare = (postId: number) => {
        // 仮のURLを作成
        const url = `${window.location.origin}/post/${postId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("リンクをコピーしました！");
        });
    };

    // --- いいね機能 (DB永続化) ---
    const toggleLike = async (postId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!myProfile) return;

        const targetPost = posts.find(p => p.id === postId);
        if (!targetPost) return;

        const isLiked = targetPost.has_liked;
        const newLikeCount = isLiked ? targetPost.like_count - 1 : targetPost.like_count + 1;

        // 1. UI更新 (Optimistic update)
        setPosts(posts.map(p =>
            p.id === postId
                ? { ...p, like_count: newLikeCount, has_liked: !isLiked }
                : p
        ));

        // 2. DB更新
        if (isLiked) {
            // いいね取り消し
            await supabase
                .from('likes')
                .delete()
                .eq('user_id', myProfile.id)
                .eq('post_id', postId);
        } else {
            // いいね付与
            await supabase
                .from('likes')
                .insert({ user_id: myProfile.id, post_id: postId });
        }
    };

    // --- 詳細表示 & コメント取得 ---
    const handlePostClick = async (post: Post) => {
        setSelectedPost(post);
        // コメントを取得
        const { data } = await supabase
            .from('comments')
            .select(`*, profiles(name, avatar_url)`)
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

        if (data) setComments(data as any);
    };

    // --- コメント送信 ---
    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !selectedPost || !myProfile) return;
        setIsSendingComment(true);

        const { data, error } = await supabase
            .from('comments')
            .insert({
                user_id: myProfile.id,
                post_id: selectedPost.id,
                content: newComment
            })
            .select('*, profiles(name, avatar_url)') // 挿入後にデータを取得して表示に追加
            .single();

        if (!error && data) {
            setComments([...comments, data as any]);
            setNewComment("");
            // 一覧側のコメント数も更新
            setPosts(posts.map(p =>
                p.id === selectedPost.id ? { ...p, comment_count: p.comment_count + 1 } : p
            ));
        }
        setIsSendingComment(false);
    };

    // --- 投稿送信 ---
    const handlePostSubmit = async () => {
        if (!newPostContent && !selectedTask) return;
        if (!myProfile) return;

        setIsPosting(true);
        // 本来はStorageに画像を上げてURLを取得する処理が必要ですが省略
        const { error } = await supabase.from('posts').insert({
            user_id: myProfile.id,
            content: newPostContent,
            linked_task: selectedTask,
        });

        if (error) {
            alert("投稿に失敗しました: " + error.message);
        } else {
            setNewPostContent("");
            setSelectedTask(null);
            setSelectedImage(null);
            setIsPostModalOpen(false);
            fetchData(myProfile.id); // 再取得
        }
        setIsPosting(false);
    };

    // --- フィルタリング ---
    const displayedPosts = posts.filter(post => {
        if (activeTab === 'recommend') return true;
        if (activeTab === 'following') {
            return myFollowings.includes(post.user_id) || post.user_id === myProfile?.id;
        }
        return true;
    });

    return (
        <div className="bg-white min-h-screen pb-24"> {/* FABのために下の余白を増やす */}

            {/* === ヘッダー === */}
            <header
                className={`fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
                    }`}
            >
                <div className="px-4 h-14 flex items-center justify-start">
                    {/* 左上のロゴ画像 */}
                    <div className="w-8 h-8 relative">
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="object-contain w-full h-full"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<span class="font-bold text-sky-500 italic text-xl">A+</span>';
                            }}
                        />
                    </div>
                </div>

                {/* タブ */}
                <div className="flex w-full">
                    <button
                        onClick={() => { setActiveTab('recommend'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`flex-1 h-12 relative hover:bg-gray-50 transition-colors font-bold text-sm ${activeTab === 'recommend' ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                        おすすめ
                        {activeTab === 'recommend' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-sky-500 rounded-full" />}
                    </button>
                    <button
                        onClick={() => { setActiveTab('following'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`flex-1 h-12 relative hover:bg-gray-50 transition-colors font-bold text-sm ${activeTab === 'following' ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                        フォロー中
                        {activeTab === 'following' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-sky-500 rounded-full" />}
                    </button>
                </div>
            </header>

            <div className="h-[104px]" />

            {/* === タイムライン === */}
            <div className="max-w-xl mx-auto">
                {displayedPosts.map((post) => (
                    <article
                        key={post.id}
                        onClick={() => handlePostClick(post)} // 詳細を開く
                        className="bg-white p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors relative"
                    >
                        <div className="flex gap-3">
                            <Link href={user && post.user_id === user.id ? "/profile" : `/user/${post.user_id}`} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                <img
                                    src={post.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest"}
                                    alt="avatar"
                                    className="w-10 h-10 rounded-full border border-gray-100 object-cover"
                                />
                            </Link>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Link
                                            href={user && post.user_id === user.id ? "/profile" : `/user/${post.user_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1.5 truncate hover:opacity-70 transition-opacity"
                                        >
                                            <span className="font-bold text-gray-900 text-sm truncate">{post.profiles?.name}</span>
                                            <span className="text-gray-500 text-sm truncate">@{post.profiles?.id?.slice(0, 8)}</span>
                                        </Link>
                                        <span className="text-gray-400 text-xs flex-shrink-0">· {getRelativeTime(post.created_at)}</span>
                                    </div>

                                    {/* 自分の投稿なら削除メニューを表示 */}
                                    <div className="relative">
                                        <button
                                            className="text-gray-400 hover:text-sky-500 rounded-full p-1 hover:bg-sky-50 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuPostId(openMenuPostId === post.id ? null : post.id);
                                            }}
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>

                                        {openMenuPostId === post.id && post.user_id === myProfile?.id && (
                                            <div className="absolute right-0 top-full bg-white shadow-lg border border-gray-100 rounded-lg z-10 w-24 overflow-hidden">
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

                                {post.linked_task && (
                                    <div className="mt-1 inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>{post.linked_task}</span>
                                    </div>
                                )}

                                <p className="mt-1 text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                                {post.image_url && (
                                    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
                                        <img src={post.image_url} alt="post" className="w-full h-auto object-cover max-h-96" />
                                    </div>
                                )}

                                {/* アクションボタン (左から: コメント、いいね、共有) */}
                                <div className="flex items-center justify-between mt-3 max-w-xs pr-4">
                                    {/* 1. コメント */}
                                    <button
                                        className="group flex items-center gap-1.5 text-gray-500 hover:text-sky-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePostClick(post); // コメントするために詳細を開く
                                        }}
                                    >
                                        <div className="p-2 rounded-full group-hover:bg-sky-50">
                                            <MessageCircle className="w-4.5 h-4.5" />
                                        </div>
                                        <span className="text-xs group-hover:text-sky-500">{post.comment_count > 0 && post.comment_count}</span>
                                    </button>

                                    {/* 2. いいね */}
                                    <button
                                        onClick={(e) => toggleLike(post.id, e)}
                                        className={`group flex items-center gap-1.5 transition-colors ${post.has_liked ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-full group-hover:bg-pink-50`}>
                                            <Heart className={`w-4.5 h-4.5 ${post.has_liked ? 'fill-current' : ''}`} />
                                        </div>
                                        <span className="text-xs">{post.like_count > 0 && post.like_count}</span>
                                    </button>

                                    {/* 3. 共有 */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleShare(post.id); }}
                                        className="group flex items-center gap-1.5 text-gray-500 hover:text-green-500 transition-colors"
                                    >
                                        <div className="p-2 rounded-full group-hover:bg-green-50">
                                            <Share2 className="w-4.5 h-4.5" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}

                {displayedPosts.length === 0 && (
                    <div className="text-center py-20 text-gray-400 text-sm">
                        まだ投稿がありません
                    </div>
                )}
            </div>

            {/* === フローティング投稿ボタン (FAB) === */}
            {/* bottom-24 にして下のバー（想定h-16くらい）と被らないように調整 */}
            <button
                onClick={() => setIsPostModalOpen(true)}
                className="fixed bottom-24 right-6 w-14 h-14 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* === 投稿モーダル === */}
            {
                isPostModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-12 px-4 animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <button onClick={() => setIsPostModalOpen(false)} className="text-gray-900 font-medium">キャンセル</button>
                                <button onClick={handlePostSubmit} disabled={!newPostContent && !selectedTask} className="bg-sky-500 text-white px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-50">投稿する</button>
                            </div>
                            <div className="p-4 flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                    {myProfile?.avatar_url && <img src={myProfile.avatar_url} alt="Me" className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    <textarea
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                        placeholder="いまどうしてる？"
                                        className="w-full text-lg resize-none focus:outline-none placeholder-gray-400 min-h-[120px]"
                                    />
                                    {selectedTask && (
                                        <div className="mb-2 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> 完了: {selectedTask}
                                            <button onClick={() => setSelectedTask(null)}><XIcon className="w-4 h-4 ml-2" /></button>
                                        </div>
                                    )}
                                    <div className="flex gap-4 pt-2 border-t border-gray-100">
                                        <button onClick={() => fileInputRef.current?.click()} className="text-sky-500"><ImageIcon /></button>
                                        <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) setSelectedImage(URL.createObjectURL(e.target.files[0])) }} className="hidden" />
                                        <button className="text-emerald-500"><CheckCircle2 /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* === 投稿詳細 & 返信ポップアップ === */}
            {
                selectedPost && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            {/* ヘッダー */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold">投稿</h3>
                                <button onClick={() => setSelectedPost(null)}><XIcon className="w-6 h-6 text-gray-500" /></button>
                            </div>

                            {/* コンテンツエリア (スクロール可) */}
                            <div className="overflow-y-auto flex-1 p-4">
                                {/* 親投稿 */}
                                <div className="flex gap-3 mb-4">
                                    <img src={selectedPost.profiles?.avatar_url} className="w-12 h-12 rounded-full border border-gray-100" />
                                    <div>
                                        <div className="font-bold">{selectedPost.profiles?.name}</div>
                                        <div className="text-sm text-gray-500">{getRelativeTime(selectedPost.created_at)}</div>
                                    </div>
                                </div>
                                <p className="text-lg text-gray-900 whitespace-pre-wrap mb-4">{selectedPost.content}</p>

                                <hr className="border-gray-100 my-4" />

                                {/* コメント一覧 */}
                                <div className="space-y-4">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3">
                                            <img src={comment.profiles?.avatar_url} className="w-8 h-8 rounded-full bg-gray-200" />
                                            <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none flex-1">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="font-bold text-xs">{comment.profiles?.name}</span>
                                                    <span className="text-[10px] text-gray-400">{getRelativeTime(comment.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {comments.length === 0 && <p className="text-gray-400 text-sm text-center">まだコメントはありません</p>}
                                </div>
                            </div>

                            {/* 返信フォーム (最下部固定) */}
                            <div className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
                                <img src={myProfile?.avatar_url} className="w-8 h-8 rounded-full bg-gray-200" />
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="返信を投稿..."
                                    className="flex-1 bg-gray-100 px-4 py-2 rounded-full border-none text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                                <button
                                    onClick={handleCommentSubmit}
                                    disabled={!newComment.trim() || isSendingComment}
                                    className="text-sky-500 font-bold text-sm px-2 disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}