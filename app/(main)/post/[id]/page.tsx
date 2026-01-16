"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { ArrowLeft, MessageSquare, Heart, Share2, Loader2, Send, Check } from 'lucide-react';

// 時間フォーマット関数
const getRelativeTime = (dateString: string) => {
    if (!dateString) return '';
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

export default function PostDetailPage() {
    const { id } = useParams();
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();

    const [post, setPost] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isLoaded && id) {
            fetchPostData();
        }
    }, [isLoaded, id]);

    const fetchPostData = async () => {
        const supabase = await createClerkSupabaseClient(getToken);

        // 1. 投稿データの取得
        // ここでもしprofilesのリレーションがないとエラーになる場合は、profilesのselectを外す必要がありますが、
        // 投稿側は表示できている前提でそのままにしています。
        const { data: postData, error } = await supabase
            .from('posts')
            .select(`
                *,
                tasks ( title ),
                profiles ( name, avatar_url )
            `)
            .eq('id', id)
            .single();

        if (error || !postData) {
            console.error("Post fetch error", error);
            setIsLoading(false);
            return;
        }

        // 2. いいね状態取得
        const { count: likeCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id);

        let myLike = null;
        if (user) {
            const { data } = await supabase.from('likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle();
            myLike = data;
        }

        setPost({
            ...postData,
            like_count: likeCount || 0,
            has_liked: !!myLike
        });

        // 3. コメント取得（ここを修正：テーブル連携を使わない方式）
        // まずコメントだけ取得
        const { data: commentsData, error: commentsError } = await supabase
            .from('comments')
            .select('*') // profilesを含めず、単独で取得
            .eq('post_id', id)
            .order('created_at', { ascending: true });

        if (!commentsError && commentsData && commentsData.length > 0) {
            // コメントに含まれるuser_idのリストを作成
            const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];

            // プロフィール情報を別途取得
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', userIds);

            // コメントとプロフィールをプログラム上で合体させる
            const mergedComments = commentsData.map((comment: any) => {
                const profile = profilesData?.find((p: any) => p.id === comment.user_id);
                return {
                    ...comment,
                    profiles: profile || { name: 'Unknown', avatar_url: null }
                };
            });

            setComments(mergedComments);
        } else {
            setComments([]);
        }

        setIsLoading(false);
    };

    const toggleLike = async () => {
        if (!post || !user) return;
        const currentLiked = post.has_liked;

        setPost((prev: any) => ({
            ...prev,
            has_liked: !currentLiked,
            like_count: currentLiked ? prev.like_count - 1 : prev.like_count + 1
        }));

        const supabase = await createClerkSupabaseClient(getToken);
        if (currentLiked) {
            await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id);
        } else {
            await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
        }
    };

    const handleCommentSubmit = async () => {
        if (!commentText.trim() || !user || !post) return;
        setIsSubmitting(true);

        try {
            const supabase = await createClerkSupabaseClient(getToken);

            // 4. コメント送信（ここも修正：テーブル連携を使わない）
            // 単純に insert して、返り値は自分のデータのみ取得
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    user_id: user.id,
                    post_id: post.id,
                    content: commentText.trim()
                })
                .select() // ここで profiles を指定しない
                .single();

            if (error) throw error;

            if (data) {
                // 画面表示用データを作成（Clerkのユーザー情報を使って即座に表示）
                // データベースからprofilesを引くのではなく、今ログインしているuser情報を使う
                const newCommentForDisplay = {
                    ...data,
                    profiles: {
                        name: user.fullName || user.username || "自分", // Clerkの情報を使用
                        avatar_url: user.imageUrl // Clerkの情報を使用
                    }
                };

                setComments(prev => [...prev, newCommentForDisplay]);
                setCommentText("");
            }
        } catch (error) {
            console.error("Comment submit error:", error);
            alert("コメントできませんでした。");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" /></div>;
    if (!post) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500"><p>投稿が見つかりませんでした</p><button onClick={() => router.back()} className="mt-4 text-sky-500">戻る</button></div>;

    const postTaskTitle = post.task_snapshot?.title || post.tasks?.title;
    const isSystemMessage = !post.content || post.content === `タスク「${postTaskTitle}」を完了しました！`;
    const displayContent = post.content;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 h-14 flex items-center px-4 gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-lg text-gray-800">投稿</h1>
            </header>

            <div className="max-w-xl mx-auto">
                {/* 投稿本体 */}
                <div className="bg-white border-b border-gray-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <img src={post.profiles?.avatar_url || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full border border-gray-100 object-cover" />
                        <div>
                            <p className="font-bold text-gray-900">{post.profiles?.name || "Unknown User"}</p>
                            <p className="text-xs text-gray-400">{getRelativeTime(post.created_at)}</p>
                        </div>
                    </div>

                    {/* テキスト */}
                    {displayContent && (
                        <p className="text-gray-900 text-base whitespace-pre-wrap leading-relaxed mb-3">{displayContent}</p>
                    )}

                    {/* タスク完了カード */}
                    {postTaskTitle && (
                        <div className="my-3 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                <Check className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold mb-0.5">タスクを完了しました</p>
                                <p className="text-base font-bold text-gray-800">{postTaskTitle}</p>
                            </div>
                        </div>
                    )}

                    {/* 画像 */}
                    {post.image_url && (
                        <div className="mt-2 mb-4 rounded-xl overflow-hidden border border-gray-100">
                            <img src={post.image_url} alt="Post" className="w-full h-auto" />
                        </div>
                    )}

                    <div className="flex items-center gap-6 pt-2 border-t border-gray-50 mt-2">
                        <div className="flex items-center gap-2 text-gray-500">
                            <MessageSquare className="w-5 h-5" />
                            <span className="text-sm">{comments.length}</span>
                        </div>
                        <button onClick={toggleLike} className={`flex items-center gap-2 transition-colors ${post.has_liked ? 'text-pink-600' : 'text-gray-500'}`}>
                            <Heart className={`w-5 h-5 ${post.has_liked ? 'fill-current' : ''}`} />
                            <span className="text-sm">{post.like_count}</span>
                        </button>
                        <button className="text-gray-500 hover:text-green-500 transition-colors ml-auto">
                            <Share2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* コメントエリア */}
                <div className="p-4 space-y-4">
                    <h3 className="font-bold text-gray-500 text-sm px-1">コメント</h3>

                    {comments.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100 border-dashed">
                            <p className="text-sm">まだコメントはありません</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <img src={comment.profiles?.avatar_url || "/default-avatar.png"} className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm text-gray-800">{comment.profiles?.name}</span>
                                            <span className="text-xs text-gray-400">{getRelativeTime(comment.created_at)}</span>
                                        </div>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* コメント入力バー（固定） */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-3 pb-6 sm:pb-3 px-4 z-20">
                <div className="max-w-xl mx-auto flex items-end gap-2">
                    <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="素敵なコメントを送信..."
                        className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
                        rows={1}
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                    <button
                        onClick={handleCommentSubmit}
                        disabled={!commentText.trim() || isSubmitting}
                        className="p-3 bg-sky-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-600 transition-colors shadow-md"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}