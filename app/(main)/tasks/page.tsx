"use client";

import React, { useState, useEffect } from 'react';
import { Check, Plus, Calendar, Trophy, AlertCircle, X, Target, Clock, ArrowLeft, Pencil, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useUser, useAuth } from '@clerk/nextjs';

// --- 型定義 ---
type Task = {
    id: string;
    title: string;
    deadline: string;
    isCompleted: boolean;
    completedDate?: string;
    goal_input: string;
};

type GoalGroup = {
    id: string;
    title: string;
    tasks: Task[];
};

export default function TasksPage() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();

    const [activeTab, setActiveTab] = useState<"todo" | "done">("todo");

    // モーダル・フォーム用
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDeadline, setNewTaskDeadline] = useState("");
    const [selectedGoalId, setSelectedGoalId] = useState("");
    const [isCreatingGoal, setIsCreatingGoal] = useState(false);
    const [newGoalTitle, setNewGoalTitle] = useState("");

    // 表示制御用
    const [hiddenGroupIds, setHiddenGroupIds] = useState<string[]>([]); // ToDoから隠すグループ
    const [celebratingGroupIds, setCelebratingGroupIds] = useState<string[]>([]); // 演出中のグループ

    // ★追加: アコーディオンの開閉管理（IDが入っているものが開いている）
    const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

    // データ管理
    const [goalGroups, setGoalGroups] = useState<GoalGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- 初期データ読み込み ---
    useEffect(() => {
        if (user) {
            fetchTasks();
        }
    }, [user]);

    const fetchTasks = async () => {
        if (!user) return;
        setIsLoading(true);

        const supabase = await createClerkSupabaseClient(getToken);

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tasks:', error);
            setIsLoading(false);
            return;
        }

        // データを整形してグループ化
        const groups: { [key: string]: Task[] } = {};

        data.forEach((row: any) => {
            const deadlineStr = row.due_date ? row.due_date.split('T')[0] : "";

            const task: Task = {
                id: row.id.toString(),
                title: row.title,
                deadline: deadlineStr,
                isCompleted: row.is_completed,
                completedDate: row.is_completed ? (new Date().toISOString().split('T')[0]) : undefined,
                goal_input: row.goal_input || "未分類"
            };

            if (!groups[task.goal_input]) {
                groups[task.goal_input] = [];
            }
            groups[task.goal_input].push(task);
        });

        const formattedGroups: GoalGroup[] = Object.keys(groups).map(title => ({
            id: title,
            title: title,
            tasks: groups[title]
        }));

        setGoalGroups(formattedGroups);
        setIsLoading(false);
    };

    // --- 完了演出の自動消去タイマー ---
    useEffect(() => {
        celebratingGroupIds.forEach(groupId => {
            const timer = setTimeout(() => {
                setHiddenGroupIds(prev => [...prev, groupId]);
                setCelebratingGroupIds(prev => prev.filter(id => id !== groupId));
            }, 3000);

            return () => clearTimeout(timer);
        });
    }, [celebratingGroupIds]);


    // --- 各種操作 ---

    // ★追加: アコーディオンの切り替え
    const toggleAccordion = (groupId: string) => {
        setExpandedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId) // 閉じる
                : [...prev, groupId] // 開く
        );
    };

    const openAddModal = () => {
        setEditingTaskId(null);
        if (goalGroups.length > 0) setSelectedGoalId(goalGroups[0].id);
        else setIsCreatingGoal(true);

        setIsCreatingGoal(false);
        setNewTaskTitle("");
        setNewGoalTitle("");
        setNewTaskDeadline("");
        setIsAddModalOpen(true);
    };

    const openEditModal = (groupId: string, task: Task) => {
        setEditingTaskId(task.id);
        setSelectedGoalId(groupId);
        setIsCreatingGoal(false);
        setNewTaskTitle(task.title);
        setNewTaskDeadline(task.deadline);
        setIsAddModalOpen(true);
    };

    const toggleTaskCompletion = async (goalId: string, taskId: string) => {
        // 1. 楽観的UI更新
        const currentGroups = [...goalGroups];
        let targetTask: Task | undefined;
        let newIsCompleted = false;
        let groupBecameAllDone = false;

        const newGroups = currentGroups.map(group => {
            if (group.id !== goalId) return group;

            const updatedTasks = group.tasks.map(task => {
                if (task.id !== taskId) return task;
                targetTask = task;
                newIsCompleted = !task.isCompleted;
                return {
                    ...task,
                    isCompleted: newIsCompleted,
                    completedDate: newIsCompleted ? new Date().toISOString().split('T')[0] : undefined
                };
            });

            // 全タスク完了判定
            const isAllCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.isCompleted);
            if (isAllCompleted && !group.tasks.every(t => t.isCompleted)) {
                // 今回の操作で「全て完了」になった場合
                groupBecameAllDone = true;
            }

            return { ...group, tasks: updatedTasks };
        });
        setGoalGroups(newGroups);

        if (groupBecameAllDone && newIsCompleted) {
            setCelebratingGroupIds(prev => [...prev, goalId]);
            // ★完了時は演出が見えるように強制的に開く状態を維持（必要なら）
            if (!expandedGroupIds.includes(goalId)) {
                setExpandedGroupIds(prev => [...prev, goalId]);
            }
        } else {
            setHiddenGroupIds(prev => prev.filter(id => id !== goalId));
            setCelebratingGroupIds(prev => prev.filter(id => id !== goalId));
        }

        // 2. DB更新
        if (user && targetTask) {
            const supabase = await createClerkSupabaseClient(getToken);
            const { error } = await supabase
                .from('tasks')
                .update({ is_completed: newIsCompleted })
                .eq('id', taskId);

            if (error) {
                console.error("更新エラー:", error);
                setGoalGroups(currentGroups);
                alert("更新に失敗しました");
                return;
            }
        }
    };

    const deleteTask = async (groupId: string, taskId: string) => {
        if (!confirm("本当に削除しますか？")) return;

        const prevGroups = [...goalGroups];
        setGoalGroups(prev => prev.map(group => {
            if (group.id !== groupId) return group;
            return {
                ...group,
                tasks: group.tasks.filter(t => t.id !== taskId)
            };
        }));

        const supabase = await createClerkSupabaseClient(getToken);
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);

        if (error) {
            console.error("削除エラー:", error);
            setGoalGroups(prevGroups);
            alert("削除できませんでした");
        }
    };

    const setQuickDate = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        setNewTaskDeadline(`${yyyy}-${mm}-${dd}`);
    };

    const handleSave = async () => {
        if (!user) return;

        let targetGoalTitle = selectedGoalId;

        if (isCreatingGoal) {
            if (!newGoalTitle) return alert("新しい目標のタイトルを入力してください");
            targetGoalTitle = newGoalTitle;
        } else {
            if (!selectedGoalId && goalGroups.length > 0) return alert("目標を選択してください");
            if (goalGroups.length === 0 && !isCreatingGoal) {
                return alert("まずは「新しい目標」を作成してください");
            }
        }

        if (!newTaskTitle) return alert("タスクの内容を入力してください");
        if (!newTaskDeadline) return alert("期限を設定してください");

        const due_date = new Date(newTaskDeadline).toISOString();
        const supabase = await createClerkSupabaseClient(getToken);

        if (editingTaskId) {
            const { error } = await supabase
                .from('tasks')
                .update({
                    title: newTaskTitle,
                    due_date: due_date,
                    goal_input: targetGoalTitle
                })
                .eq('id', editingTaskId);

            if (error) {
                alert("更新エラー: " + error.message);
                return;
            }
        } else {
            const { error } = await supabase
                .from('tasks')
                .insert({
                    user_id: user.id,
                    title: newTaskTitle,
                    due_date: due_date,
                    goal_input: targetGoalTitle,
                    is_completed: false
                });

            if (error) {
                alert("保存エラー: " + error.message);
                return;
            }
        }

        // 保存後はデータを再取得し、対象のグループを開く
        await fetchTasks();
        if (!expandedGroupIds.includes(targetGoalTitle)) {
            setExpandedGroupIds(prev => [...prev, targetGoalTitle]);
        }
        setIsAddModalOpen(false);
    };

    // --- 表示状態の判定 ---
    const hasTodoTasks = goalGroups.some(g => g.tasks.some(t => !t.isCompleted));
    const hasDoneTasks = goalGroups.some(g => g.tasks.some(t => t.isCompleted));
    const isCelebratingAny = celebratingGroupIds.length > 0;

    if (!isLoaded) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-white pb-40 relative">
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100">
                <div className="flex items-center justify-center h-14 px-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab("todo")}
                            className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "todo" ? "bg-white text-sky-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            ToDo
                        </button>
                        <button
                            onClick={() => setActiveTab("done")}
                            className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "done" ? "bg-white text-sky-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            完了
                        </button>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* ToDoが空の時：★演出中でない場合のみ表示★ */}
                {activeTab === "todo" && !hasTodoTasks && !isLoading && !isCelebratingAny && (
                    <div className="flex flex-col items-center justify-center pt-20 text-center text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="w-12 h-12 mb-4 text-sky-200" />
                        <p className="font-bold text-gray-500">現在タスクはありません。<br />タスクを追加して計画を立てましょう！</p>
                    </div>
                )}

                {/* 完了が空の時 */}
                {activeTab === "done" && !hasDoneTasks && !isLoading && (
                    <div className="flex flex-col items-center justify-center pt-20 text-center text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        <Trophy className="w-12 h-12 mb-4 text-gray-200" />
                        <p className="font-bold text-gray-500 whitespace-pre-wrap">まだ完了したタスクはありません。<br />まずは1つ、目標を達成しよう！</p>
                    </div>
                )}

                {goalGroups.map((group) => {
                    const visibleTasks = group.tasks.filter(t =>
                        activeTab === "todo" ? !t.isCompleted : t.isCompleted
                    );

                    const isCelebrating = celebratingGroupIds.includes(group.id);
                    // ★追加：アコーディオンが開いているかチェック
                    const isExpanded = expandedGroupIds.includes(group.id);

                    if (visibleTasks.length === 0 && !isCelebrating) return null;
                    if (activeTab === "todo" && hiddenGroupIds.includes(group.id) && !isCelebrating) return null;

                    return (
                        <div key={group.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
                            {/* ★変更: ヘッダー部分をクリック可能にし、アコーディオン化 */}
                            <div
                                onClick={() => toggleAccordion(group.id)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 bg-sky-500 rounded-full" />
                                    <h2 className="font-bold text-gray-800 text-base">{group.title}</h2>
                                    <span className="text-xs text-gray-400 font-medium ml-2 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {visibleTasks.length}
                                    </span>
                                </div>
                                <div className="text-gray-400">
                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </div>
                            </div>

                            {/* ★変更: 開いている時のみ中身を表示 */}
                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 bg-gray-50/50 pt-2 border-t border-gray-100">
                                    {activeTab === "todo" && isCelebrating && (
                                        <div className="bg-sky-50 border border-sky-100 rounded-xl p-6 text-center animate-pulse mb-3">
                                            <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                                            <p className="font-bold text-sky-700">お疲れさまでした！</p>
                                            <p className="text-xs text-sky-500 mt-1">この目標のタスクは全て完了しました。</p>
                                            <p className="text-[10px] text-sky-400 mt-2">（完了リストへ移動します...）</p>
                                        </div>
                                    )}

                                    {visibleTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`relative flex items-start gap-3 p-4 rounded-xl border transition-all group ${task.isCompleted
                                                ? "bg-gray-50 border-gray-100 opacity-80"
                                                : "bg-white border-gray-100 shadow-sm"
                                                }`}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // アコーディオンが閉じないように伝播を止める
                                                    toggleTaskCompletion(group.id, task.id);
                                                }}
                                                className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? "bg-sky-500 border-sky-500" : "bg-white border-gray-300"
                                                    }`}
                                            >
                                                {task.isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium leading-relaxed truncate pr-16 ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800"
                                                    }`}>
                                                    {task.title}
                                                </p>

                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className={`flex items-center gap-1 text-xs ${task.isCompleted ? "text-gray-300" : "text-sky-500"
                                                        }`}>
                                                        <Calendar className="w-3 h-3" />
                                                        <span>期限: {task.deadline}</span>
                                                    </div>
                                                </div>

                                                {task.isCompleted && task.completedDate && (
                                                    <div className="text-[10px] text-green-600 font-bold mt-1">
                                                        完了日: {task.completedDate}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="absolute right-3 top-3 flex gap-2">
                                                {!task.isCompleted && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditModal(group.id, task);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                                                        title="編集"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteTask(group.id, task.id);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="削除"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {activeTab === "todo" && (
                    <div className="relative z-10 pt-4">
                        <button
                            onClick={openAddModal}
                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50 transition-all cursor-pointer active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            <span>タスクを手動で追加</span>
                        </button>
                    </div>
                )}
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl h-[85vh] sm:h-auto overflow-y-auto flex flex-col">
                        <div className="flex items-center justify-between mb-6 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingTaskId ? "タスクを編集" : (isCreatingGoal ? "新しい目標とタスク" : "タスクを追加")}
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6 flex-1 overflow-y-auto pb-20 sm:pb-0">

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3">
                                    <Target className="w-4 h-4" />
                                    どの目標のタスクですか？ <span className="text-red-500 text-sm ml-1">*</span>
                                </label>
                                {isCreatingGoal ? (
                                    <div className="animate-in fade-in slide-in-from-right duration-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => setIsCreatingGoal(false)}
                                                className="text-xs text-sky-500 font-bold flex items-center hover:bg-sky-50 px-2 py-1 rounded"
                                            >
                                                <ArrowLeft className="w-3 h-3 mr-1" />
                                                一覧に戻る
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="新しい目標のタイトル"
                                            value={newGoalTitle}
                                            onChange={(e) => setNewGoalTitle(e.target.value)}
                                            className="w-full p-4 bg-sky-50 border-2 border-sky-100 rounded-xl outline-none text-base font-bold text-sky-900 placeholder-sky-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {goalGroups.map(g => (
                                                <div
                                                    key={g.id}
                                                    onClick={() => setSelectedGoalId(g.id)}
                                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center group ${selectedGoalId === g.id
                                                        ? "border-sky-500 bg-sky-50 text-sky-900"
                                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <span className="font-bold text-sm">{g.title}</span>
                                                    {selectedGoalId === g.id && <Check className="w-4 h-4 text-sky-500" />}
                                                </div>
                                            ))}
                                        </div>
                                        {!editingTaskId && (
                                            <button
                                                onClick={() => setIsCreatingGoal(true)}
                                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-xs font-bold hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                新しい目標を作成する
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3">
                                    <Check className="w-4 h-4" />
                                    タスクの内容 <span className="text-red-500 text-sm ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="例：参考書 P.10〜20"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none text-base focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-3">
                                    <Clock className="w-4 h-4" />
                                    いつまでにやりますか？ <span className="text-red-500 text-sm ml-1">*</span>
                                </label>
                                <div className="flex gap-2 mb-3">
                                    <button onClick={() => setQuickDate(0)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-sky-100 hover:text-sky-600 transition-colors">今日</button>
                                    <button onClick={() => setQuickDate(1)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-sky-100 hover:text-sky-600 transition-colors">明日</button>
                                    <button onClick={() => setQuickDate(7)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-sky-100 hover:text-sky-600 transition-colors">1週間後</button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={newTaskDeadline}
                                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                                        className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl outline-none text-base text-gray-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all cursor-pointer"
                                    />
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                                </div>
                            </div>

                        </div>
                        <div className="pt-4 mt-auto border-t border-gray-100 bg-white">
                            <button
                                onClick={handleSave}
                                className="w-full bg-sky-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-200 hover:bg-sky-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {editingTaskId ? (
                                    <>
                                        <Pencil className="w-5 h-5" />
                                        <span>変更を保存する</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        <span>リストに追加する</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}