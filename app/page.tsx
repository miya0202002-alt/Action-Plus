import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, Target, CheckCircle, Users } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    // 画面全体をスマホ枠のように扱う
    <div className="min-h-screen bg-[#F8F5E9] flex flex-col items-center pb-24">
      
      {/* ヒーローセクション（トップの目立つ部分） */}
      <div className="w-full max-w-md px-6 pt-12 pb-8 flex flex-col items-center text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#2E5D4B]">
            ActionPlus
          </h1>
          <p className="text-sm font-medium text-[#2E5D4B]/70">
            迷う時間を、動く時間へ。
          </p>
        </div>

        {/* ログイン・開始ボタンエリア */}
        <div className="w-full pt-4">
          <SignedOut>
            {/* 未ログイン時：Googleログインボタンが出る */}
            <SignInButton mode="modal">
              <button className="w-full bg-[#2E5D4B] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#2E5D4B]/20 active:scale-95 transition-transform flex items-center justify-center gap-3">
                <span>今すぐはじめる</span>
                <ArrowRight size={20} />
              </button>
            </SignInButton>
            <p className="mt-4 text-xs text-gray-500">
              大学生のための目標達成プラットフォーム
            </p>
          </SignedOut>

          <SignedIn>
            {/* ログイン済み：続きからボタン */}
            <Link 
              href="/plan" 
              className="w-full bg-[#F2994A] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#F2994A]/20 active:scale-95 transition-transform flex items-center justify-center gap-3 block"
            >
              <span>今日の活動を始める</span>
              <ArrowRight size={20} />
            </Link>
          </SignedIn>
        </div>
      </div>

      {/* 機能紹介カード（スマホで見やすい縦並び） */}
      <div className="w-full max-w-md px-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#2E5D4B]/10 flex items-center gap-4">
          <div className="bg-[#E8F5E9] p-3 rounded-full text-[#2E5D4B]">
            <Target size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#2E5D4B]">AI計画作成</h3>
            <p className="text-xs text-gray-500">目標に合わせてロードマップを自動生成</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#2E5D4B]/10 flex items-center gap-4">
          <div className="bg-[#FFF3E0] p-3 rounded-full text-[#F2994A]">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#2E5D4B]">習慣化サポート</h3>
            <p className="text-xs text-gray-500">毎日のタスク管理で継続できる</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#2E5D4B]/10 flex items-center gap-4">
          <div className="bg-[#E1F5FE] p-3 rounded-full text-[#56CCF2]">
            <Users size={24} />
          </div>
          <div>
            <h3 className="font-bold text-[#2E5D4B]">コミュニティ</h3>
            <p className="text-xs text-gray-500">同じ目標を持つ仲間と励まし合う</p>
          </div>
        </div>
      </div>

    </div>
  );
}