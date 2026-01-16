"use client";

import React, { useState, useEffect } from 'react';
import { Check, Plus, Calendar, Trophy, AlertCircle, X, Target, Clock, ArrowLeft, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useUser, useAuth } from '@clerk/nextjs';

type Task = {
    id: string;
    title: string;
    deadline: string;
    isCompleted: boolean;
    completedDate?: string;
    goal_title: string; // "Goal: Element > SubElement"
};

type SubElementGroup = {
    title: string;
    fullTitle: string; // Mapping back to goal_title for database calls
    tasks: Task[];
};

type ElementGroup = {
    title: string;
    subElements: SubElementGroup[];
};

type GoalGroup = {
    goalName: string;
    elements: ElementGroup[];
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
    const [hiddenGroupIds, setHiddenGroupIds] = useState<string[]>([]); // fullTitle
    const [celebratingGroupIds, setCelebratingGroupIds] = useState<string[]>([]); // fullTitle
    const [expandedGoals, setExpandedGoals] = useState<string[]>([]);
    const [expandedElements, setExpandedElements] = useState<string[]>([]); // "Goal-Element"
    const [expandedSubElements, setExpandedSubElements] = useState<string[]>([]); // fullTitle

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

        // 階層構造の構築
        const hierarchy: { [goalName: string]: { [elementName: string]: { [subElementName: string]: Task[] } } } = {};

        data.forEach((row: any) => {
            const deadlineStr = row.deadline ? row.deadline.split('T')[0] : "";
            const fullTitle = row.goal_title || "未分類";

            let goalName = "未分類";
            let elementName = "その他";
            let subElementName = "全般";

            if (fullTitle.includes(": ")) {
                const [g, rest] = fullTitle.split(": ");
                goalName = g;
                if (rest.includes(" > ")) {
                    const [e, se] = rest.split(" > ");
                    elementName = e;
                    subElementName = se;
                } else {
                    elementName = rest;
                }
            } else {
                goalName = fullTitle;
            }

            const task: Task = {
                id: row.id.toString(),
                title: row.title,
                deadline: deadlineStr,
                isCompleted: row.is_completed,
                completedDate: row.is_completed ? (new Date(row.updated_at || Date.now()).toISOString().split('T')[0]) : undefined,
                goal_title: fullTitle
            };

            if (!hierarchy[goalName]) hierarchy[goalName] = {};
            if (!hierarchy[goalName][elementName]) hierarchy[goalName][elementName] = {};
            if (!hierarchy[goalName][elementName][subElementName]) hierarchy[goalName][elementName][subElementName] = [];

            hierarchy[goalName][elementName][subElementName].push(task);
        });

        const formattedGroups: GoalGroup[] = Object.keys(hierarchy).map(goalName => ({
            goalName,
            elements: Object.keys(hierarchy[goalName]).map(elementName => ({
                title: elementName,
                subElements: Object.keys(hierarchy[goalName][elementName]).map(subElementName => ({
                    title: subElementName,
                    fullTitle: `${goalName}: ${elementName}${subElementName !== '全般' ? ' > ' + subElementName : ''}`,
                    tasks: hierarchy[goalName][elementName][subElementName]
                }))
            }))
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

    const toggleGoal = (goalName: string) => {
        setExpandedGoals(prev =>
            prev.includes(goalName) ? prev.filter(g => g !== goalName) : [...prev, goalName]
        );
    };

    const toggleElement = (goalName: string, elementName: string) => {
        const key = `${goalName}-${elementName}`;
        setExpandedElements(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const toggleSubElement = (fullTitle: string) => {
        setExpandedSubElements(prev =>
            prev.includes(fullTitle) ? prev.filter(ft => ft !== fullTitle) : [...prev, fullTitle]
        );
    };

    const openAddModal = () => {
        setEditingTaskId(null);
        if (goalGroups.length > 0) setSelectedGoalId(goalGroups[0].goalName);
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

    const toggleTaskCompletion = async (fullTitle: string, taskId: string) => {
        // 楽観的UI更新
        const currentGroups = [...goalGroups];
        let targetTask: Task | undefined;
        let newIsCompleted = false;
        let groupBecameAllDone = false;

        const newGroups = currentGroups.map(goalGroup => {
            return {
                ...goalGroup,
                elements: goalGroup.elements.map(elementGroup => {
                    return {
                        ...elementGroup,
                        subElements: elementGroup.subElements.map(subGroup => {
                            if (subGroup.fullTitle !== fullTitle) return subGroup;

                            const updatedTasks = subGroup.tasks.map(task => {
                                if (task.id !== taskId) return task;
                                targetTask = task;
                                newIsCompleted = !task.isCompleted;
                                return {
                                    ...task,
                                    isCompleted: newIsCompleted,
                                    completedDate: newIsCompleted ? new Date().toISOString().split('T')[0] : undefined
                                };
                            });

                            const isAllCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.isCompleted);
                            if (isAllCompleted && !subGroup.tasks.every(t => t.isCompleted)) {
                                groupBecameAllDone = true;
                            }

                            return { ...subGroup, tasks: updatedTasks };
                        })
                    }
                })
            }
        });
        setGoalGroups(newGroups);

        if (groupBecameAllDone && newIsCompleted) {
            setCelebratingGroupIds(prev => [...prev, fullTitle]);
            if (!expandedSubElements.includes(fullTitle)) {
                setExpandedSubElements(prev => [...prev, fullTitle]);
            }
        } else {
            setHiddenGroupIds(prev => prev.filter(id => id !== fullTitle));
            setCelebratingGroupIds(prev => prev.filter(id => id !== fullTitle));
        }

        // DB更新
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
            }
        }
    };

    const deleteTask = async (fullTitle: string, taskId: string) => {
        if (!confirm("本当に削除しますか？")) return;

        const prevGroups = [...goalGroups];
        setGoalGroups(prev => prev.map(goalGroup => ({
            ...goalGroup,
            elements: goalGroup.elements.map(elGroup => ({
                ...elGroup,
                subElements: elGroup.subElements.map(subGroup => {
                    if (subGroup.fullTitle !== fullTitle) return subGroup;
                    return {
                        ...subGroup,
                        tasks: subGroup.tasks.filter(t => t.id !== taskId)
                    };
                })
            }))
        })));

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

        const dateToSave = new Date(newTaskDeadline).toISOString();
        const supabase = await createClerkSupabaseClient(getToken);

        if (editingTaskId) {
            // ★修正: ここも deadline に変更しました
            const { error } = await supabase
                .from('tasks')
                .update({
                    title: newTaskTitle,
                    deadline: dateToSave,
                    goal_title: targetGoalTitle
                })
                .eq('id', editingTaskId);

            if (error) {
                alert("更新エラー: " + error.message);
                return;
            }
        } else {
            // ★修正: ここも deadline に変更しました
            const { error } = await supabase
                .from('tasks')
                .insert({
                    user_id: user.id,
                    title: newTaskTitle,
                    deadline: dateToSave,
                    goal_title: targetGoalTitle,
                    is_completed: false
                });

            if (error) {
                alert("保存エラー: " + error.message);
                return;
            }
        }

        // 保存後はデータを再取得し、対象のグループを開く
        await fetchTasks();
        if (!expandedGoals.includes(targetGoalTitle)) {
            setExpandedGoals(prev => [...prev, targetGoalTitle]);
        }
        setIsAddModalOpen(false);
    };

    // --- 表示状態の判定 ---
    const hasTodoTasks = goalGroups.some(g => g.elements.some(e => e.subElements.some(se => se.tasks.some(t => !t.isCompleted))));
    const hasDoneTasks = goalGroups.some(g => g.elements.some(e => e.subElements.some(se => se.tasks.some(t => t.isCompleted))));
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
                {activeTab === "todo" && !hasTodoTasks && !isLoading && !isCelebratingAny && (
                    <div className="flex flex-col items-center justify-center pt-20 text-center text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="w-12 h-12 mb-4 text-sky-200" />
                        <p className="font-bold text-gray-500">現在タスクはありません。<br />タスクを追加して計画を立てましょう！</p>
                    </div>
                )}

                {activeTab === "done" && !hasDoneTasks && !isLoading && (
                    <div className="flex flex-col items-center justify-center pt-20 text-center text-gray-400 animate-in fade-in slide-in-from-bottom-2">
                        <Trophy className="w-12 h-12 mb-4 text-gray-200" />
                        <p className="font-bold text-gray-500 whitespace-pre-wrap">まだ完了したタスクはありません。<br />まずは1つ、目標を達成しよう！</p>
                    </div>
                )}

                {goalGroups.map((goalGroup) => {
                    const isGoalExpanded = expandedGoals.includes(goalGroup.goalName);

                    // このゴールのタスクがあるかチェック
                    const goalVisibleTasks = goalGroup.elements.flatMap(e => e.subElements.flatMap(se =>
                        se.tasks.filter(t => activeTab === "todo" ? !t.isCompleted : t.isCompleted)
                    ));

                    if (goalVisibleTasks.length === 0) return null;

                    return (
                        <div key={goalGroup.goalName} className="animate-in fade-in slide-in-from-bottom-2 duration-300 border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white mb-4">
                            {/* 第1階層: 目標 (Goal) */}
                            <div
                                onClick={() => toggleGoal(goalGroup.goalName)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none bg-sky-50/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-8 bg-sky-500 rounded-full" />
                                    <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                        <Target className="w-4 h-4 text-sky-500" />
                                        {goalGroup.goalName}
                                    </h2>
                                    <span className="text-[10px] text-gray-400 font-bold bg-white px-2 py-0.5 rounded-full border border-gray-100">
                                        {goalVisibleTasks.length}
                                    </span>
                                </div>
                                <div className="text-gray-400">
                                    {isGoalExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </div>
                            </div>

                            {isGoalExpanded && (
                                <div className="p-4 space-y-4 bg-white border-t border-gray-50">
                                    {goalGroup.elements.map((elementGroup) => {
                                        const elKey = `${goalGroup.goalName}-${elementGroup.title}`;
                                        const isElementExpanded = expandedElements.includes(elKey);

                                        const elementVisibleTasks = elementGroup.subElements.flatMap(se =>
                                            se.tasks.filter(t => activeTab === "todo" ? !t.isCompleted : t.isCompleted)
                                        );

                                        if (elementVisibleTasks.length === 0) return null;

                                        return (
                                            <div key={elementGroup.title} className="border border-gray-50 rounded-lg overflow-hidden border-l-4 border-l-blue-400">
                                                {/* 第2階層: 要素 (Element) */}
                                                <div
                                                    onClick={() => toggleElement(goalGroup.goalName, elementGroup.title)}
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/30"
                                                >
                                                    <h3 className="font-bold text-gray-700 text-sm">{elementGroup.title}</h3>
                                                    <div className="text-gray-400">
                                                        {isElementExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                </div>

                                                {isElementExpanded && (
                                                    <div className="p-3 space-y-3 bg-white">
                                                        {elementGroup.subElements.map((subGroup) => {
                                                            const isSubExpanded = expandedSubElements.includes(subGroup.fullTitle);
                                                            const isCelebrating = celebratingGroupIds.includes(subGroup.fullTitle);
                                                            const isHidden = activeTab === "todo" && hiddenGroupIds.includes(subGroup.fullTitle) && !isCelebrating;

                                                            const visibleTasks = subGroup.tasks.filter(t =>
                                                                activeTab === "todo" ? !t.isCompleted : t.isCompleted
                                                            );

                                                            if ((visibleTasks.length === 0 && !isCelebrating) || isHidden) return null;

                                                            return (
                                                                <div key={subGroup.title} className="rounded-lg border border-gray-100 overflow-hidden border-l-4 border-l-orange-400">
                                                                    {/* 第3階層: 中項目 (SubElement) */}
                                                                    <div
                                                                        onClick={() => toggleSubElement(subGroup.fullTitle)}
                                                                        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/20"
                                                                    >
                                                                        <h4 className="font-bold text-gray-600 text-xs">{subGroup.title}</h4>
                                                                        <div className="text-gray-400 rotate-0">
                                                                            {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </div>
                                                                    </div>

                                                                    {isSubExpanded && (
                                                                        <div className="p-2 space-y-2 bg-gray-50/10">
                                                                            {activeTab === "todo" && isCelebrating && (
                                                                                <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 text-center animate-pulse mb-2">
                                                                                    <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                                                                                    <p className="text-xs font-bold text-sky-700">お疲れさまでした！</p>
                                                                                </div>
                                                                            )}

                                                                            {visibleTasks.map((task) => (
                                                                                <div
                                                                                    key={task.id}
                                                                                    className={`relative flex items-start gap-2 p-3 rounded-lg border transition-all group ${task.isCompleted
                                                                                        ? "bg-gray-50 border-gray-100 opacity-80"
                                                                                        : "bg-white border-gray-100 shadow-sm border-l-4 border-l-green-400"
                                                                                        }`}
                                                                                >
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            toggleTaskCompletion(subGroup.fullTitle, task.id);
                                                                                        }}
                                                                                        className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? "bg-sky-500 border-sky-500" : "bg-white border-gray-300"
                                                                                            }`}
                                                                                    >
                                                                                        {task.isCompleted && <Check className="w-3 h-3 text-white" />}
                                                                                    </button>

                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className={`text-xs font-bold leading-relaxed truncate pr-16 ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800"
                                                                                            }`}>
                                                                                            {task.title}
                                                                                        </p>

                                                                                        <div className="flex items-center gap-3 mt-1.5">
                                                                                            <div className={`flex items-center gap-1 text-[10px] ${task.isCompleted ? "text-gray-300" : "text-sky-500 font-bold"
                                                                                                }`}>
                                                                                                <Calendar className="w-3 h-3" />
                                                                                                <span>{task.deadline}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="absolute right-2 top-2 flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity translate-y-[-2px]">
                                                                                        {!task.isCompleted && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    openEditModal(subGroup.fullTitle, task);
                                                                                                }}
                                                                                                className="p-1 text-gray-400 hover:text-sky-500 hover:bg-sky-50 rounded"
                                                                                            >
                                                                                                <Pencil className="w-3 h-3" />
                                                                                            </button>
                                                                                        )}
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                deleteTask(subGroup.fullTitle, task.id);
                                                                                            }}
                                                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
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
                                                    key={g.goalName}
                                                    onClick={() => setSelectedGoalId(g.goalName)}
                                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center group ${selectedGoalId === g.goalName
                                                        ? "border-sky-500 bg-sky-50 text-sky-900"
                                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <span className="font-bold text-sm">{g.goalName}</span>
                                                    {selectedGoalId === g.goalName && <Check className="w-4 h-4 text-sky-500" />}
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