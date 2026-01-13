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
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    // --- 日付と期間の計算ロジック ---
    const today = new Date();
    const target = new Date(targetDate || Date.now() + 30 * 24 * 60 * 60 * 1000); // 指定なければ30日後

    // 期間（日数）を計算
    const diffTime = Math.abs(target.getTime() - today.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const todayStr = today.toLocaleDateString('ja-JP');
    const targetStr = target.toLocaleDateString('ja-JP');

    // --- プロンプト作成 ---
    const prompt = `
      あなたは、目標達成のプロフェッショナルコーチです。
      ユーザーの目標に対し、期限から逆算した「完璧な学習ロードマップ」を作成してください。

      【プロジェクト概要】
      - 目標: ${goal}
      - 現在地: ${currentLevel || "初心者"}
      - 開始日: ${todayStr}
      - 完了期限: ${targetStr}
      - **持ち時間: ${totalDays}日間**
      - 1日の学習時間: ${studyHours || "標準"}

      【重要：スケジューリングのルール】
      この ${totalDays}日間 を以下の3つのフェーズに分け、タスクを配置してください。
      
      1. **基礎・インプット期（最初の30%の期間）**
         - まず何を知るべきか？全体像の把握や基礎知識の習得。
      2. **実践・定着期（中盤の50%の期間）**
         - 具体的な演習、アウトプット、弱点の発見と克服。
      3. **仕上げ・調整期（最後の20%の期間）**
         - 最終目標レベルへの到達確認、総仕上げ。

      【タスク出力の制約】
      1. **言葉づかい**: 難しい専門用語は使わず、**高校生でも直感的にわかる言葉**に噛み砕くこと。
      2. **内容**: 単なる「本を読む」という行動ではなく、「〇〇の概念を理解する」「〇〇ができるようになる」という**「到達状態（成果）」**を書くこと。
      3. **期限設定**: 
         - 全てのタスクのdeadlineは、${todayStr} から ${targetStr} の間に配置すること。
         - **最初の日付に詰め込みすぎないこと。** 最後の期限ギリギリまでを使って、均等に、または段階的に配置すること。

      【出力フォーマット（JSON配列のみ）】
      [
        {
          "title": "フェーズ名入りタスク名（例：【基礎】〇〇の仕組みを知る）",
          "description": "何のためにこれをするのか？達成するとどうなるか？（易しい言葉で）",
          "deadline": "YYYY-MM-DD",
          "priority": "High" | "Medium",
          "estimatedHours": 数字
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON整形処理
    let json;
    try {
      const cleanedText = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      json = JSON.parse(cleanedText);
    } catch (e) {
      json = JSON.parse(text);
    }

    const roadmap = Array.isArray(json) ? json : (json.roadmap || []);

    return NextResponse.json({ roadmap });

  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: "計画の作成に失敗しました。" }, { status: 500 });
  }
}