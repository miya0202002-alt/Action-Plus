"use client";
import { useState, useEffect } from "react";
import { Loader2, Sparkles, Network, Calendar, Clock, CheckCircle2, AlertCircle, Save, History, FileText, X, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useUser, useAuth } from '@clerk/nextjs';
import { formatDeadlineLabel } from '@/lib/dateUtils';

// --- 型定義 ---
type TaskItem = {
  title: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  estimatedHours: number;
};

type SubElementItem = {
  subElementTitle: string;
  tasks: TaskItem[];
};

type ElementItem = {
  elementTitle: string;
  subElements: SubElementItem[];
};

type AiLog = {
  id: string;
  goal_input: string;
  ai_response: { roadmap: ElementItem[] };
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
  const [roadmap, setRoadmap] = useState<ElementItem[] | null>(null);
  const [expandedElements, setExpandedElements] = useState<number[]>([]);
  const [expandedSubElements, setExpandedSubElements] = useState<string[]>([]); // "elementIdx-subElementIdx"
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

  useEffect(() => {
    if (goal || targetDate || currentLevel) {
      const data = {
        goal, targetDate, currentLevel, weekdayTime, weekendTime,
        timestamp: new Date().getTime()
      };
      localStorage.setItem("plan_draft_data", JSON.stringify(data));
    }
  }, [goal, targetDate, currentLevel, weekdayTime, weekendTime]);

  // --- 履歴の取得 ---
  const fetchAndCleanupLogs = async () => {
    if (!user) return;
    try {
      const supabase = await createClerkSupabaseClient(getToken);

      const { data } = await supabase
        .from('ai_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setLogs(data);
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

      const generatedRoadmap = (data.roadmap || []) as ElementItem[];
      setRoadmap(generatedRoadmap);
      // 初期状態ではLevel 1のみ表示（すべて閉じている状態にする）
      setExpandedElements([]);
      setExpandedSubElements([]);

      if (user) {
        const supabase = await createClerkSupabaseClient(getToken);
        const { error: logError } = await supabase.from('ai_logs').insert({
          user_id: user.id,
          goal_input: goal,
          ai_response: { roadmap: generatedRoadmap }
        });
        if (!logError) {
          fetchAndCleanupLogs();
          localStorage.removeItem("plan_draft_data");
        }
      }

    } catch (error: any) {
      console.error("エラー:", error);
      setErrorMsg("計画の作成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskChange = (elementIndex: number, subElementIndex: number, taskIndex: number, field: keyof TaskItem, value: any) => {
    if (!roadmap) return;
    const newRoadmap = [...roadmap];
    (newRoadmap[elementIndex].subElements[subElementIndex].tasks[taskIndex] as any)[field] = value;
    setRoadmap(newRoadmap);
  };

  const handleDeleteTask = (elementIndex: number, subElementIndex: number, taskIndex: number) => {
    if (!roadmap) return;
    if (!confirm('このタスクを削除しますか?')) return;
    const newRoadmap = [...roadmap];
    newRoadmap[elementIndex].subElements[subElementIndex].tasks.splice(taskIndex, 1);
    setRoadmap(newRoadmap);
  };

  const handleDeleteSubElement = (elementIndex: number, subElementIndex: number) => {
    if (!roadmap) return;
    if (!confirm('この中項目とその配下のタスクをすべて削除しますか?')) return;
    const newRoadmap = [...roadmap];
    newRoadmap[elementIndex].subElements.splice(subElementIndex, 1);
    setRoadmap(newRoadmap);
  };

  const handleDeleteElement = (elementIndex: number) => {
    if (!roadmap) return;
    if (!confirm('この大項目とその配下のすべてを削除しますか?')) return;
    const newRoadmap = [...roadmap];
    newRoadmap.splice(elementIndex, 1);
    setRoadmap(newRoadmap);
  };

  const toggleSubElement = (eIdx: number, seIdx: number) => {
    const key = `${eIdx}-${seIdx}`;
    setExpandedSubElements(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleElement = (index: number) => {
    setExpandedElements(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // --- 保存処理 ---
  const handleSaveAll = async () => {
    if (!user) {
      alert("ログインしてください");
      return;
    }
    if (!roadmap || roadmap.length === 0) {
      alert("保存する計画がありません");
      return;
    }

    try {
      const supabase = await createClerkSupabaseClient(getToken);

      // 1. プロフィールの目標(goal)を更新
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ goal: goal })
        .eq('id', user.id);

      if (profileError) {
        console.warn("Profile Update Warning:", profileError);
      }

      // 2. tasksテーブルにタスクを一括保存
      const tasksToInsert = roadmap.flatMap((element) =>
        element.subElements.flatMap((subElement) =>
          subElement.tasks.map((task) => ({
            user_id: user.id,
            title: task.title,
            deadline: new Date(task.deadline).toISOString(),
            is_completed: false,
            estimated_hours: task.estimatedHours,
            priority: task.priority,
            // goal_title に 「目標: 要素名 > 中項目名」 の形式で入れる
            goal_title: `${goal}: ${element.elementTitle} > ${subElement.subElementTitle}`
          }))
        )
      );

      const { error: tasksError } = await supabase
        .from('tasks')
        .insert(tasksToInsert);

      if (tasksError) {
        console.error("Tasks Save Error:", tasksError);
        throw new Error(`タスクの保存に失敗: ${tasksError.message}`);
      }

      alert("タスクシートに追加しました！");
      // ★ここを変更しました：tasksページへ移動
      router.push('/tasks');

    } catch (error: any) {
      console.error("保存処理全体の失敗:", error);
      alert(`エラーが発生しました: ${error.message}`);
    }
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
                    style={{ left: `${weekdayTime * 33.3}%`, width: '33.3%' }}
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
                    style={{ left: `${weekendTime * 33.3}%`, width: '33.3%' }}
                  />
                </div>
              </div>
            </div>

            {errorMsg && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-lg flex gap-2"><AlertCircle className="w-4 h-4" />{errorMsg}</div>}

            <button onClick={handleGenerate} disabled={isLoading || !goal} className="w-full bg-sky-500 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-200 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isLoading ? <><Loader2 className="animate-spin" /> AIが分析中...</> : <><Network className="w-5 h-5" /> 計画を生成する</>}
            </button>
          </div>

          {logs.length > 0 && (
            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><History className="w-4 h-4" /> 過去の生成履歴</h3>
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
                  <p className="text-xs font-bold text-gray-400 border-b pb-1 px-1">AIが提案するロードマップ</p>
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-gray-400 border-b pb-1 px-1">AIが提案するロードマップ</p>
                    {selectedLog.ai_response.roadmap.map((element, eIdx) => {
                      const elKey = `history-${eIdx}`;
                      const isElementExpanded = expandedElements.includes(elKey);

                      return (
                        <div key={eIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-sm border-l-4 border-l-sky-500">
                          {/* 第1階層: 要素 (Element) */}
                          <div
                            onClick={() => toggleElement("history", eIdx.toString())}
                            className="p-4 bg-gray-50/30 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
                          >
                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                              <span className="text-sky-500 text-xs">●</span>
                              {element.elementTitle}
                            </h4>
                            <div className="text-gray-400">
                              {isElementExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </div>

                          {isElementExpanded && (
                            <div className="px-3 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                              {element.subElements?.map((sub, seIdx) => {
                                const subKey = `history-${eIdx}-${seIdx}`;
                                const isSubExpanded = expandedSubElements.includes(subKey);

                                return (
                                  <div key={seIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden border-l-4 border-l-orange-400">
                                    {/* 第2階層: サブ要素 (SubElement) */}
                                    <div
                                      onClick={() => toggleSubElement(subKey)}
                                      className="p-3 bg-gray-50/20 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
                                    >
                                      <h5 className="font-bold text-gray-700 text-xs">{sub.subElementTitle}</h5>
                                      <div className="text-gray-400">
                                        {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      </div>
                                    </div>

                                    {isSubExpanded && (
                                      <div className="px-2 pb-3 pt-1 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {sub.tasks.map((task, tIdx) => (
                                          <div key={tIdx} className="p-3 rounded-xl border border-gray-50 bg-gray-50/30 border-l-4 border-l-emerald-400 flex flex-col gap-1.5">
                                            {/* 第3階層: タスク (Task) */}
                                            <div className="flex items-center justify-between">
                                              <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{task.title}</p>
                                              <span className={`text-[9px] font-bold flex-shrink-0 ml-2 ${formatDeadlineLabel(task.deadline).color}`}>
                                                {formatDeadlineLabel(task.deadline).label}
                                              </span>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center space-y-2">
          <h2 className="text-xl font-black text-sky-600">
            目標: {goal}
          </h2>
          <p className="text-xs text-gray-400 font-bold">
            各項目をクリックして展開できます
          </p>
        </div>

        <div className="space-y-4">
          {roadmap.map((element, eIdx) => (
            <div key={eIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-sm border-l-4 border-l-sky-500">
              <div className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => toggleElement(eIdx)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <h3 className="font-bold text-gray-800 truncate">{element.elementTitle}</h3>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteElement(eIdx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${expandedElements.includes(eIdx) ? 'border-sky-500 bg-sky-50' : 'border-gray-200'}`}>
                    {expandedElements.includes(eIdx) ? (
                      <span className="text-sky-500 font-bold text-lg leading-none mt-[-2px]">-</span>
                    ) : (
                      <span className="text-gray-400 font-bold text-lg leading-none mt-[-1px]">+</span>
                    )}
                  </div>
                </div>
              </div>

              {expandedElements.includes(eIdx) && (
                <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="h-px bg-gray-50 mb-1" />
                  {element.subElements?.map((sub, seIdx) => (
                    <div key={seIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden border-l-4 border-l-orange-400">
                      <div className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <button
                          onClick={() => toggleSubElement(eIdx, seIdx)}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          <h4 className="font-bold text-gray-700 text-xs truncate">{sub.subElementTitle}</h4>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteSubElement(eIdx, seIdx)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="削除"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${expandedSubElements.includes(`${eIdx}-${seIdx}`) ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                            {expandedSubElements.includes(`${eIdx}-${seIdx}`) ? (
                              <span className="text-orange-500 font-bold text-md leading-none mt-[-2px]">-</span>
                            ) : (
                              <span className="text-gray-400 font-bold text-md leading-none mt-[-1px]">+</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedSubElements.includes(`${eIdx}-${seIdx}`) && (
                        <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="h-px bg-gray-50 mb-1" />
                          {sub.tasks.map((task, tIdx) => (
                            <div key={tIdx} className="p-3 rounded-xl border border-gray-50 bg-gray-50/30 border-l-4 border-l-emerald-400 relative group">
                              <button
                                onClick={() => handleDeleteTask(eIdx, seIdx, tIdx)}
                                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="削除"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <div className="flex items-center gap-2 mb-1 pr-6">
                                <input
                                  type="text"
                                  value={task.title}
                                  onChange={(e) => handleTaskChange(eIdx, seIdx, tIdx, "title", e.target.value)}
                                  className="flex-1 font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-sky-500 outline-none text-xs py-0.5"
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5 text-gray-400">
                                  <Calendar className="w-3 h-3 text-sky-400" />
                                  <input
                                    type="date"
                                    value={task.deadline}
                                    onChange={(e) => handleTaskChange(eIdx, seIdx, tIdx, "deadline", e.target.value)}
                                    className="outline-none bg-transparent"
                                  />
                                </div>
                                <div className="bg-white border border-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-400">
                                  {task.estimatedHours}h
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={handleSaveAll} className="w-full bg-sky-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-sky-100 mt-8 flex flex-col items-center justify-center gap-1 group active:scale-95 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-lg">これをやる事に追加する</span>
          </div>
          <span className="text-[10px] opacity-70 font-bold">やる事シートへ移動します</span>
        </button>
      </div>
    </div>
  );
}