"use client";

import { useState } from "react";
import { Loader2, Sparkles, Network } from "lucide-react";

// 型定義（少し緩くしてエラーを防ぐ）
type TreeItem = {
  name: string;
  children?: TreeItem[];
};

type TreeResponse = {
  goal?: string;
  children?: TreeItem[];
};

export default function PlanPage() {
  const [inputGoal, setInputGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!inputGoal) return;
    setIsLoading(true);
    setTreeData(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: inputGoal }),
      });

      // API自体がエラーを返した場合（500エラーなど）
      if (!res.ok) {
        throw new Error(`Server Error: ${res.status}`);
      }

      const data = await res.json();
      console.log("AI Response:", data); // ブラウザのコンソールで確認用

      // データの中身チェック（ここが重要）
      if (!data || !data.children || !Array.isArray(data.children)) {
        throw new Error("AIが正しいデータを返しませんでした。もう一度試してください。");
      }

      setTreeData(data);
    } catch (error: any) {
      console.error("Error details:", error);
      setErrorMsg(error.message || "予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5E9] pb-24 px-4 pt-8">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-[#2E5D4B] flex items-center justify-center gap-2">
            <Sparkles className="text-[#F2994A]" />
            AI計画作成
          </h1>
          <p className="text-sm text-[#2E5D4B]/70">
            目標を入力すると、AIが学習要素を<br/>スキルツリー形式で分解します。
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#2E5D4B]/10 space-y-4">
          <label className="block text-sm font-bold text-[#2E5D4B] mb-2">
            達成したい目標は？
          </label>
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="例：TOEIC 800点、フルマラソン完走"
            className="w-full p-4 rounded-xl bg-[#F8F5E9] border-none text-[#2E5D4B] placeholder-[#2E5D4B]/40 focus:ring-2 focus:ring-[#2E5D4B]"
          />

          <button
            onClick={handleGenerate}
            disabled={isLoading || !inputGoal}
            className="w-full bg-[#2E5D4B] disabled:bg-[#2E5D4B]/50 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                思考中...
              </>
            ) : (
              <>
                <Network size={20} />
                分解する
              </>
            )}
          </button>
        </div>

        {/* エラー表示エリア */}
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            <strong>エラー:</strong> {errorMsg}
          </div>
        )}

        {/* 結果表示エリア（安全に表示） */}
        {treeData && treeData.children && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-[#2E5D4B] font-bold border-b border-[#2E5D4B]/10 pb-2">
              <Network size={18} />
              <span>{treeData.goal || inputGoal} の分解図</span>
            </div>
            
            <div className="pl-2">
              {treeData.children.map((item, index) => (
                <TreeBranch key={index} item={item} level={0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 再帰コンポーネント（ここも安全対策済み）
function TreeBranch({ item, level }: { item: TreeItem; level: number }) {
  if (!item) return null; // データがないなら何も表示しない

  const isRoot = level === 0;
  const hasChildren = item.children && item.children.length > 0;
  
  return (
    <div className="relative">
      <div className="absolute left-[-12px] top-0 bottom-0 w-px bg-[#2E5D4B]/20" />
      <div className="absolute left-[-12px] top-6 w-3 h-px bg-[#2E5D4B]/20" />

      <div className={`
        relative mb-3 ml-2 p-4 rounded-xl border
        ${isRoot ? "bg-white border-[#2E5D4B] shadow-md" : ""}
        ${!isRoot && hasChildren ? "bg-white border-[#2E5D4B]/20" : ""}
        ${!hasChildren ? "bg-[#F8F5E9] border-[#2E5D4B]/10" : ""}
      `}>
        <h3 className={`font-bold ${isRoot ? "text-lg text-[#2E5D4B]" : "text-sm text-[#2E5D4B]"}`}>
          {item.name}
        </h3>
      </div>

      {hasChildren && (
        <div className="pl-6 border-l border-[#2E5D4B]/20 ml-6">
          {item.children!.map((child, idx) => (
            <TreeBranch key={idx} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}