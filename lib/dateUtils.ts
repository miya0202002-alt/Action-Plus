export const formatDeadlineLabel = (deadlineStr: string) => {
    if (!deadlineStr) return { label: "未設定", color: "text-gray-400" };

    const deadline = new Date(deadlineStr);
    const now = new Date();

    // 時間をリセットして日付のみで比較
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { label: "今日", color: "text-rose-500 font-black" };
    } else if (diffDays === 1) {
        return { label: "明日", color: "text-orange-500 font-bold" };
    } else if (diffDays > 1 && diffDays <= 3) {
        return { label: `あと${diffDays}日`, color: "text-amber-500 font-bold" };
    } else if (diffDays < 0) {
        return { label: "期限切れ", color: "text-gray-400 line-through" };
    } else {
        // 4日以上先
        return {
            label: `${deadline.getMonth() + 1}/${deadline.getDate()}`,
            color: "text-sky-500 font-bold"
        };
    }
};
