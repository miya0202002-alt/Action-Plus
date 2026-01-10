import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { goal } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key not found" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // 高速で安価なモデルを使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } 
    });

    // あなたのプロンプト + JSON形式の強制指示
    const systemPrompt = `
あなたはAction.plusの核心機能を担う「要素分解AI」です。
ユーザーが掲げた巨大な目標を、習得すべき最小単位の知識やスキル（学習要素）まで、樹形図形式で分解して提示することが任務です。

# 基本方針
1. 行動ではなく要素を提示する: 「単語帳を買う」ではなく「600点レベルの頻出語彙」のように、習得すべき中身（コンテンツ）を提示してください。
2. 3段階以上の深掘り: 目標を大項目、中項目、小項目へと、最低3レベル以上掘り下げてください。
3. 禁止事項: 情緒的な対話は不要です。

# 重要：出力形式
以下のJSONフォーマットで出力してください。ツリー構造を視覚化するために必須です。
{
  "goal": "目標名",
  "children": [
    {
      "name": "大項目名",
      "children": [
        {
          "name": "中項目名",
          "children": [
            { "name": "小項目(最小単位)" },
            { "name": "小項目(最小単位)" }
          ]
        }
      ]
    }
  ]
}
`;

    const result = await model.generateContent([systemPrompt, `ユーザーの目標: ${goal}`]);
    const response = result.response;
    const text = response.text();

    return NextResponse.json(JSON.parse(text));

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
