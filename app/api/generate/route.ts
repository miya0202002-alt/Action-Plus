import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { goal } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // ▼▼▼ この行を追加してください ▼▼▼
    console.log("★APIキーの確認:", apiKey ? "読み込み成功" : "読み込み失敗(空っぽ)");

    if (!apiKey) {
      return NextResponse.json({ error: "API Key not found" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      // JSONモードを強制しない（テキストで受け取って自分で掃除する方が安定するため）
    });

    const systemPrompt = `
あなたはAction.plusの核心機能を担う「要素分解AI」です。
ユーザーの目標を、習得すべき最小単位の知識やスキルまで、樹形図形式で分解してください。

# 出力形式（厳守）
必ず以下のJSON形式の**文字列のみ**を出力してください。
Markdownのコードブロック（\`\`\`jsonなど）は絶対に含めないでください。

{
  "goal": "目標名",
  "children": [
    {
      "name": "大項目",
      "children": [
        { "name": "小項目" }
      ]
    }
  ]
}
`;

    const result = await model.generateContent([systemPrompt, `ユーザーの目標: ${goal}`]);
    const response = result.response;
    let text = response.text();

    // 【ここが修正ポイント】
    // AIが勝手につける ```json や ``` を削除して、純粋なJSONにする
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return NextResponse.json(JSON.parse(text));

  } catch (error) {
    console.error("Generate Error:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}