"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles, Network } from "lucide-react";

// ツリーのデータ型定義
type TreeItem = {
  name: string;
  children?: TreeItem[];
};

type TreeResponse = {
  goal: string;
  children: TreeItem[];
};

export default function PlanPage() {
  const [inputGoal, setInputGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);

  const handleGenerate = async () => {
    if (!inputGoal) return;
    setIsLoading(true);
    setTreeData(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: inputGoal }),
      });
      const data = await res.json();
      setTreeData(data);
    } catch (error) {
      console.error("Error:", error);
      alert("生成に失敗しました。もう一度試してください。");
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
          <div>
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
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !inputGoal}
            className="w-full bg-[#2E5D4B] disabled:bg-[#2E5D4B]/50 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                AIが分析中...
              </>
            ) : (
              <>
                <Network size={20} />
                分解する
              </>
            )}
          </button>
        </div>

        {/* 結果表示エリア（ツリー） */}
        {treeData && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-[#2E5D4B] font-bold border-b border-[#2E5D4B]/10 pb-2">
              <Network size={18} />
              <span>{treeData.goal} の分解図</span>
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

// 再帰的にツリーを表示するコンポーネント
function TreeBranch({ item, level }: { item: TreeItem; level: number }) {
  // レベルに応じた色とスタイル
  const isRoot = level === 0;
  const isLeaf = !item.children || item.children.length === 0;
  
  return (
    <div className="relative">
      {/* 枝の線 */}
      <div className="absolute left-[-12px] top-0 bottom-0 w-px bg-[#2E5D4B]/20" />
      <div className="absolute left-[-12px] top-6 w-3 h-px bg-[#2E5D4B]/20" />

      {/* カード本体 */}
      <div className={`
        relative mb-3 ml-2 p-4 rounded-xl border
        ${isRoot ? "bg-white border-[#2E5D4B] shadow-md" : ""}
        ${!isRoot && !isLeaf ? "bg-white border-[#2E5D4B]/20" : ""}
        ${isLeaf ? "bg-[#F8F5E9] border-[#2E5D4B]/10" : ""}
      `}>
        <h3 className={`font-bold ${isRoot ? "text-lg text-[#2E5D4B]" : "text-sm text-[#2E5D4B]"}`}>
          {item.name}
        </h3>
      </div>

      {/* 子要素がある場合は再帰表示 */}
      {item.children && (
        <div className="pl-6 border-l border-[#2E5D4B]/20 ml-6">
          {item.children.map((child, idx) => (
            <TreeBranch key={idx} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}