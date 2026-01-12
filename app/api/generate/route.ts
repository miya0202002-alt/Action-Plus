import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { goal, targetDate, currentLevel, studyHours } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキー未設定" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      あなたはAction.plusの「AIロードマップ作成機能」です。
      ユーザーの目標に対して、それを達成するために必要な要素（学習項目・タスク）を網羅的に洗い出し、
      実行可能なタスクシート（ロードマップ）を作成してください。

      【ユーザー入力情報】
      1. 目標: ${goal}
      2. 達成期限: ${targetDate || "指定なし（標準的な期間で設定）"}
      3. 現在のスタート位置: ${currentLevel || "未入力（初心者と仮定）"}
      4. 1日の確保可能時間: ${studyHours || "平日1時間、休日2時間程度"}
      5. 今日: ${new Date().toLocaleDateString('ja-JP')} (これより前の日付は設定しないこと)

      【命令】
      目標達成に必要なプロセスを論理的に分解し、以下の要件に従ってタスクリストを作成してください。
      
      1. **網羅性**: 必要な知識・スキルを漏れなくリストアップする。
      2. **要素ベース**: 「本を買う」などの単純行動ではなく、「〇〇の文法を理解する」「過去問で〇点を取る」など、習得・達成すべき要素を書く。
      3. **期限設定（最重要）**:
         - スタート日: 今日（${new Date().toLocaleDateString('ja-JP')}）
         - ゴール日: ユーザーの達成期限（${targetDate}）
         - **制約**: 全てのタスクの期限は、必ずこの期間内に収めてください。**ゴール日より後の日付は絶対に出力禁止**です。期間が短い場合は、タスク数を減らして調整してください。
      4. **優先順位**: 必須項目はHigh、推奨はMedium、余裕があればLow。

      出力は必ず以下のJSON形式のリストにしてください（ルートは配列）。
      
      [
        {
          "title": "タスク名（具体的かつ完結に）",
          "description": "何をするのか、達成基準など（短く）",
          "deadline": "YYYY-MM-DD",
          "priority": "High" | "Medium" | "Low",
          "estimatedHours": 数字（想定所要時間h）
        },
        ...
      ]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = JSON.parse(text);

    // 配列であることを保証
    const roadmap = Array.isArray(json) ? json : (json.roadmap || []);

    return NextResponse.json({ roadmap });


  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ title: "分解に失敗しました", days: 0 }, { status: 500 });
  }
}