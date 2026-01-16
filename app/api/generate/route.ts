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
      # Role
      あなたは、目標達成のための「学習ロードマップ設計のプロ」です。
      ユーザーの巨大な目標を、管理可能な「構成要素」に分解し、それぞれの「到達すべき状態（マイルストーン）」を定義してください。

      # User Profile
      - 最終目標: ${goal}
      - 現在のレベル: ${currentLevel || "不明（ゼロベースから想定）"}
      - 期間: ${todayStr} から ${targetStr} まで（計 ${totalDays} 日間）
      - 1日の学習時間: ${studyHours}

      # Critical Instruction (最も重要な指示)
      タスク（Level 3）を作成する際、**「具体的な行動（Do）」を書かないでください。**
      代わりに、**「習得した状態（Be）」** を書いてください。
      
      ユーザーは「何をすればいいか（How）」を自分で考えることで成長します。あなたは「何ができるようになっているべきか（What）」だけを提示してください。

      ### 良い例 vs 悪い例
      - ❌ 悪い例（行動指示）: 「単語帳を10ページ進める」「YouTubeで解説動画を見る」
      - ⭕️ 良い例（到達状態）: 「高校基礎レベルの単語（約1000語）の意味が即座に分かる」「仮定法過去と過去完了の違いを他人に説明できる」

      # Steps
      1. **要素分解 (Level 2):**
         目標を達成するために不可欠な「スキル」「知識」「分野」を3〜4つに因数分解してください。
         （例：英語なら「語彙力」「文法理解」「聴解力」など）

      2. **マイルストーン設定 (Level 3):**
         各要素について、期限内に達成すべき「状態」を段階的にリストアップしてください。
         期限は ${todayStr} から ${targetStr} の間で、基礎→応用へとステップアップするように日付を割り振ってください。

      # Output Format (JSON Only)
      回答は必ず以下のJSON形式のみで行ってください。余計な挨拶やMarkdownは不要です。

      {
        "roadmap": [
          {
            "elementTitle": "要素名（例：基礎文法力）",
            "tasks": [
              {
                "title": "到達状態の定義（例：中学レベルの文型を網羅的に理解している）",
                "description": "なぜこの状態が必要なのか？達成の判定基準は？（例：例文を見て即座にSVO等の文型が振れる状態）",
                "deadline": "YYYY-MM-DD",
                "priority": "High",
                "estimatedHours": 2
              }
            ]
          }
        ]
      }
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