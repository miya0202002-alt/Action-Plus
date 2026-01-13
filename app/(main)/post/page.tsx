// app/(main)/post/[id]/page.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function PostDetailPage() {
    const { id } = useParams(); // URLから投稿IDを取得
    const { user } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id && user) {
            fetchPost();
        }
    }, [id, user]);

    const fetchPost = async () => {
        const supabase = await createClerkSupabaseClient(getToken);

        // 投稿データと投稿者の情報を結合して取得
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles ( name, avatar_url )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error("【デバッグ】投稿取得エラー:", error);
        } else if (data) {
            // いいね数を取得
            const { count: likeCount, error: countError } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', id);

            if (countError) console.error("【デバッグ】いいね数取得エラー:", countError);

            // 自分がいいねしているか確認
            let hasLiked = false;
            if (user) {
                const { data: likeData } = await supabase
                    .from('likes')
                    .select('*')
                    .eq('post_id', id)
                    .eq('user_id', user.id)
                    .single();
                hasLiked = !!likeData;
            }

            console.log("【デバッグ】投稿詳細取得:", {
                postId: id,
                likeCount: likeCount,
                hasLiked: hasLiked
            });

            setPost({ ...data, likeCount, hasLiked });
        }
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

    if (!post) return (
        <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">投稿が見つかりませんでした</p>
            <Link href="/" className="text-sky-500 hover:underline">ホームに戻る</Link>
        </div>
    );

    return (
        <div className="bg-white min-h-screen pb-20">
            {/* ヘッダー */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h1 className="font-bold text-lg text-gray-800">投稿詳細</h1>
            </header>

            {/* 投稿内容 */}
            <main className="max-w-xl mx-auto p-4">
                <div className="flex gap-3 mb-3 items-center">
                    <img
                        src={post.profiles?.avatar_url || "/default-avatar.png"}
                        alt=""
                        className="w-10 h-10 rounded-full bg-gray-200 object-cover"
                    />
                    <div>
                        <p className="font-bold text-gray-900">{post.profiles?.name || "名無し"}</p>
                        <p className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                <p className="text-gray-800 text-lg mb-4 whitespace-pre-wrap">{post.content}</p>

                {post.image_url && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-gray-100">
                        <img src={post.image_url} alt="Post image" className="w-full h-auto" />
                    </div>
                )}

                <div className="flex items-center gap-6 pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Heart className={`w-5 h-5 ${post.hasLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                        <span>{post.likeCount || 0} いいね！</span>
                    </div>
                    {/* コメント機能などは必要に応じて追加 */}
                </div>
            </main>
        </div>
    );
}