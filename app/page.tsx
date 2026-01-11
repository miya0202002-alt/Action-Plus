"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Chrome, Loader2 } from 'lucide-react';
import { SignInButton, useUser } from "@clerk/nextjs";

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // 画面が表示されたら実行される処理
  useEffect(() => {
    // ロードが完了していて、かつログイン済みなら
    if (isLoaded && isSignedIn) {
      // タイムラインへ強制移動（履歴に残さないreplaceを使用）
      router.replace('/timeline');
    }
  }, [isLoaded, isSignedIn, router]);

  // 1. まだ確認中、または 2. ログイン済み（転送待ち）の場合
  // 画面には何も表示しないか、ローディングだけ表示する
  if (!isLoaded || isSignedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      </div>
    );
  }

  // 3. ログインしていない場合のみ、以下の画面を表示
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* 背景の装飾 */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-sky-100 rounded-full blur-[90px] opacity-50 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-sky-100 rounded-full blur-[90px] opacity-50 pointer-events-none" />

      {/* メインコンテンツ */}
      <div className="z-10 flex flex-col items-center w-full max-w-sm">

        {/* ロゴエリア */}
        <h1 className="text-5xl font-extrabold text-sky-500 mb-4 tracking-tight drop-shadow-sm">
          ActionPlus
        </h1>

        {/* キャッチコピー */}
        <p className="text-gray-400 text-lg mb-20 font-medium tracking-wide">
          迷う時間を、動く時間へ。
        </p>

        {/* ログインボタンエリア */}
        <div className="w-full">
          <SignInButton mode="modal" forceRedirectUrl="/timeline">
            <button
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-medium py-4 px-4 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow-md active:scale-95 transition-all duration-200"
            >
              <Chrome className="w-6 h-6 text-gray-900" />
              <span className="text-base">Googleでログイン</span>
            </button>
          </SignInButton>
        </div>

      </div>
    </div>
  );
}