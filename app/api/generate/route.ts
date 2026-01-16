import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    // データ受け取り
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "No Data" }, { status: 400 });

    const { goal, targetDate, currentLevel, studyHours } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキー未設定" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // モデル設定
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    // --- 日付計算 ---
    const today = new Date();
    const target = targetDate ? new Date(targetDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const todayStr = today.toLocaleDateString('ja-JP');
    const targetStr = target.toLocaleDateString('ja-JP');
    const diffTime = Math.abs(target.getTime() - today.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // --- プロンプト作成 ---
    const prompt = `
      あなたは、目標達成アプリ「Action.plus」の核心機能を担う「要素分解AI」です。
      ユーザーが掲げた巨大な目標を、習得すべき最小単位の知識やスキル（学習要素）へと、階層的に分解して提示することが任務です。

      【基本方針】
      1. 行動ではなく要素を提示する
         - ❌「単語帳を買う」「過去問を解く」といった具体的アクションは書かない。
         - ⭕️「中学レベルの英文法の理解」「600点レベルの頻出語彙の習得」など、習得すべき中身（コンテンツ）や「到達状態」を提示してください。
         - ユーザー自身に「どうやるか」を考えさせるためです。
      2. 4段階の構成（目標を親とし、以下3つの階層で分解）
         - 第1階層：目標（ユーザーが入力済み: ${goal}）
         - 第2階層：大項目/要素（習得すべき主要スキル。3つ目安）
         - 第3階層：中項目/対策（その要素を構成する具体的な対策・分野。1要素につき2〜3個）
         - 第4階層：小項目/タスク（その対策における具体的な到達目標・状態。1中項目につき2〜3個）

      【プロジェクト概要】
      - 目標: ${goal}
      - 現在地: ${currentLevel || "初心者"}
      - 期間: ${totalDays}日間 (${todayStr} 〜 ${targetStr})
      - 学習ペース: ${studyHours || "標準"}

      【出力ルール】
      必ず以下のJSON形式の配列で出力してください。

      [
        {
          "elementTitle": "大項目名（例：リスニングスキル）",
          "subElements": [
            {
              "subElementTitle": "中項目名（例：パート1対策）",
              "tasks": [
                {
                  "title": "到達状態タスク（例：写真描写の頻出語彙を理解している状態）",
                  "deadline": "YYYY-MM-DD",
                  "priority": "High",
                  "estimatedHours": 2
                }
              ]
            }
          ]
        }
      ]

      【禁止事項】
      - ユーザーを励ますなどの情緒的な対話は一切不要です。構造の提示に集中してください。
      - 「努力が必要」などの抽象的な表現を避け、具体的な学習対象を明示してください。
      - deadlineは ${todayStr} から ${targetStr} の間で分散させてください。
    `;

    // AI生成実行
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI Response:", text); // デバッグ用

    // --- JSONパース処理（配列として受け取る） ---
    let json;
    try {
      // 余計なマークダウン記号を削除
      const cleanedText = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      json = JSON.parse(cleanedText);
    } catch (e) {
      console.error("JSON Parse Error:", text);
      return NextResponse.json({ error: "AIの生成形式エラー" }, { status: 500 });
    }

    // 配列そのものが返ってくるはずだが、念のため整形
    // もし { roadmap: [...] } で返ってきてしまっても対応できるようにしておく
    const roadmap = Array.isArray(json) ? json : (json.roadmap || []);

    return NextResponse.json({ roadmap });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}