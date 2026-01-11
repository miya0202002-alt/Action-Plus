"use client";
import { useState, useEffect } from "react";
import { Loader2, Sparkles, Network, Calendar, Clock, Target, CheckCircle2, AlertCircle, Save, History, FileText, X, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useUser, useAuth } from '@clerk/nextjs';

// --- 型定義 ---
type TaskItem = {
  title: string;
  description: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  estimatedHours: number;
};

type AiLog = {
  id: string;
  goal_input: string;
  ai_response: { roadmap: TaskItem[] };
  created_at: string;
};

export default function PlanPage() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  // 入力ステート
  const [goal, setGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [weekdayTime, setWeekdayTime] = useState(1);
  const [weekendTime, setWeekendTime] = useState(1);

  // アプリ状態
  const [isLoading, setIsLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<TaskItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 履歴表示用
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null);

  // --- 30分間の一時保存 (Draft) ---
  useEffect(() => {
    const savedDraft = localStorage.getItem("plan_draft_data");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        const now = new Date().getTime();
        // 30分 (30 * 60 * 1000 ms) 以内なら復元
        if (now - parsed.timestamp < 30 * 60 * 1000) {
          setGoal(parsed.goal || "");
          setTargetDate(parsed.targetDate || "");
          setCurrentLevel(parsed.currentLevel || "");
          setWeekdayTime(parsed.weekdayTime ?? 1);
          setWeekendTime(parsed.weekendTime ?? 1);
        } else {
          localStorage.removeItem("plan_draft_data");
        }
      } catch (e) {
        localStorage.removeItem("plan_draft_data");
      }
    }
  }, []);

  // 入力が変わるたびに保存
  useEffect(() => {
    if (goal || targetDate || currentLevel) {
      const data = {
        goal, targetDate, currentLevel, weekdayTime, weekendTime,
        timestamp: new Date().getTime()
      };
      localStorage.setItem("plan_draft_data", JSON.stringify(data));
    }
  }, [goal, targetDate, currentLevel, weekdayTime, weekendTime]);

  // --- 履歴の取得 & 古いログの自動削除 ---
  const fetchAndCleanupLogs = async () => {
    if (!user) return;
    try {
      const supabase = await createClerkSupabaseClient(getToken);

      // 1. 30分以上前のログをデータベースから削除
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { error: deleteError } = await supabase
        .from('ai_logs')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', thirtyMinsAgo);

      if (deleteError) {
        console.error("古いログの削除に失敗:", deleteError);
      }

      // 2. 最新のログを取得
      const { data, error } = await supabase
        .from('ai_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("履歴取得エラー:", error);
      } else if (data) {
        setLogs(data);
      }
    } catch (err) {
      console.error("システムエラー:", err);
    }
  };

  useEffect(() => {
    if (user) fetchAndCleanupLogs();
  }, [user]);

  // --- AI呼び出し ---
  const handleGenerate = async () => {
    if (!goal) return;
    setIsLoading(true);
    setRoadmap(null);
    setErrorMsg(null);

    const timeLabels = ["30分程度", "1〜2時間", "3時間以上"];
    const studyHoursStr = `平日: ${timeLabels[weekdayTime]}, 休日: ${timeLabels[weekendTime]}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, targetDate, currentLevel, studyHours: studyHoursStr }),
      });

      if (!res.ok) throw new Error("AIサーバーとの通信に失敗しました");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const sortedRoadmap = (data.roadmap || []).sort((a: TaskItem, b: TaskItem) => {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });

      setRoadmap(sortedRoadmap);

      // AIログ保存
      if (user) {
        const supabase = await createClerkSupabaseClient(getToken);
        const { error: logError } = await supabase.from('ai_logs').insert({
          user_id: user.id,
          goal_input: goal,
          ai_response: { roadmap: sortedRoadmap }
        });

        if (logError) {
          console.error("ログ保存エラー:", logError);
        } else {
          fetchAndCleanupLogs();
          localStorage.removeItem("plan_draft_data");
        }
      }

    } catch (error: any) {
      console.error("エラー:", error);
      setErrorMsg("計画の作成に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  // --- タスク保存 ---
  const handleSaveAll = async () => {
    if (!roadmap || !user) return;
    if (!confirm("この計画をタスク一覧に追加しますか？")) return;

    try {
      const supabase = await createClerkSupabaseClient(getToken);
      const tasksToInsert = roadmap.map(task => ({
        user_id: user.id,
        title: task.title,
        due_date: new Date(task.deadline).toISOString(),
        goal_input: goal,
        is_completed: false
      }));

      const { error } = await supabase.from('tasks').insert(tasksToInsert);

      if (error) {
        console.error("タスク保存エラー詳細:", JSON.stringify(error, null, 2));
        alert(`保存に失敗しました。\nメッセージ: ${error.message}\n詳細: ${error.details || 'なし'}\nヒント: ${error.hint || 'なし'}`);
      } else {
        alert("タスクを保存しました！タスクページで確認できます。");
        router.push("/tasks");
      }
    } catch (err) {
      console.error(err);
      alert("予期せぬエラーが発生しました");
    }
  };

  const handleTaskChange = (index: number, field: keyof TaskItem, value: string) => {
    if (!roadmap) return;
    const newRoadmap = [...roadmap];
    newRoadmap[index] = { ...newRoadmap[index], [field]: value };
    setRoadmap(newRoadmap);
  };

  const getBorderColor = (priority: string) => {
    switch (priority) {
      case "High": return "border-l-4 border-l-red-400";
      case "Medium": return "border-l-4 border-l-yellow-400";
      case "Low": return "border-l-4 border-l-green-400";
      default: return "border-gray-100";
    }
  };

  if (!roadmap) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 h-14 flex items-center justify-center">
          <h1 className="font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-500" />
            AIロードマップ
          </h1>
        </div>

        <div className="max-w-md mx-auto p-6 space-y-8 animate-in fade-in duration-500">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              目標を入力して<br />
              <span className="text-sky-500">あなただけの計画</span>を作成
            </h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">目標 <span className="text-red-500">*</span></label>
              <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例：3ヶ月で英語を話せるようになる" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-sky-200 outline-none transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">いつまでに？</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">今のレベル</label>
                <input type="text" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} placeholder="例：初心者" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
              <label className="flex items-center gap-1 text-sm font-bold text-gray-700 mb-2">
                <Clock className="w-4 h-4 text-sky-500" />
                1日の作業・学習時間
              </label>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500">平日</span>
                <div className="flex bg-gray-200 rounded-full p-1 h-10 relative">
                  {["少ない", "普通", "多い"].map((label, idx) => (
                    <button
                      key={label}
                      onClick={() => setWeekdayTime(idx)}
                      className={`flex-1 rounded-full text-xs font-bold z-10 transition-colors ${weekdayTime === idx ? "text-white" : "text-gray-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                  <div
                    className="absolute top-1 bottom-1 bg-sky-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{
                      left: `${weekdayTime * 33.3}%`,
                      width: '33.3%'
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500">休日</span>
                <div className="flex bg-gray-200 rounded-full p-1 h-10 relative">
                  {["少ない", "普通", "多い"].map((label, idx) => (
                    <button
                      key={label}
                      onClick={() => setWeekendTime(idx)}
                      className={`flex-1 rounded-full text-xs font-bold z-10 transition-colors ${weekendTime === idx ? "text-white" : "text-gray-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                  <div
                    className="absolute top-1 bottom-1 bg-green-500 rounded-full transition-all duration-300 shadow-sm"
                    style={{
                      left: `${weekendTime * 33.3}%`,
                      width: '33.3%'
                    }}
                  />
                </div>
              </div>
            </div>

            {errorMsg && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-lg flex gap-2"><AlertCircle className="w-4 h-4" />{errorMsg}</div>}

            <button onClick={handleGenerate} disabled={isLoading || !goal} className="w-full bg-sky-500 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-200 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isLoading ? <><Loader2 className="animate-spin" /> AIが分析中...</> : <><Network className="w-5 h-5" /> 計画を生成する</>}
            </button>
          </div>

          {/* 履歴リスト */}
          {logs.length > 0 && (
            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><History className="w-4 h-4" /> 最近の履歴 (30分以内)</h3>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} onClick={() => setSelectedLog(log)} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-sky-200 cursor-pointer transition-all">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{log.goal_input}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleTimeString('ja-JP')} 作成</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 詳細モーダル (文字で見やすく表示) */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 max-h-[80vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText className="w-5 h-5 text-sky-500" /> 計画の詳細</h3>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="overflow-y-auto space-y-6 flex-1 pr-2 custom-scrollbar">
                <div className="bg-sky-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-sky-600 mb-1">達成したい目標</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{selectedLog.goal_input}</p>
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-bold text-gray-400 border-b pb-1">AIが提案するロードマップ</p>
                  {selectedLog.ai_response.roadmap.map((item, i) => (
                    <div key={i} className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-100 last:before:hidden">
                      <div className="absolute left-[-4px] top-1.5 w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800">{item.title}</p>
                          <span className="text-[10px] font-bold text-gray-400">{item.deadline}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded-lg">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { setRoadmap(selectedLog.ai_response.roadmap); setGoal(selectedLog.goal_input); setSelectedLog(null); }} className="mt-6 w-full py-3 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-100">この計画を編集・保存する</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ロードマップ表示画面 ---
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 h-14 flex items-center justify-between shadow-sm">
        <button onClick={() => setRoadmap(null)} className="text-gray-500 text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-lg">戻る</button>
        <h1 className="font-bold text-gray-800 text-sm">生成結果</h1>
        <button onClick={handleSaveAll} className="text-white text-xs font-bold bg-sky-500 px-3 py-1.5 rounded-lg flex items-center gap-1"><Save className="w-3 h-3" /> 保存</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4 animate-in slide-in-from-bottom-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed italic">
            目標: <span className="text-gray-900 font-bold ml-1">{goal}</span>
          </p>
        </div>

        <div className="space-y-3">
          {roadmap.map((task, index) => (
            <div key={index} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-50 ${getBorderColor(task.priority)}`}>
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={task.title} onChange={(e) => handleTaskChange(index, "title", e.target.value)} className="flex-1 font-bold text-gray-800 bg-transparent border-b border-gray-100 focus:border-sky-500 outline-none text-sm py-1" />
              </div>
              <div className="mb-3">
                <textarea value={task.description} onChange={(e) => handleTaskChange(index, "description", e.target.value)} className="w-full text-xs text-gray-500 bg-gray-50 p-2 rounded-lg outline-none resize-none" rows={2} />
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-3 h-3 text-sky-400" />
                  <input type="date" value={task.deadline} onChange={(e) => handleTaskChange(index, "deadline", e.target.value)} className="outline-none bg-transparent" />
                </div>
                <div className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500">{task.estimatedHours}h</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleSaveAll} className="w-full bg-sky-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-200 mt-6 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> 計画を確定して開始
        </button>
      </div>
    </div>
  );
}