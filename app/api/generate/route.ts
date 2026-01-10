import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { goal } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key not found" }, { status: 500 });
    }

    // ライブラリを使わず、Web標準の「fetch」で直接Googleに繋ぎます
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `あなたは目標達成のコーチです。ユーザーの目標:「${goal}」を達成するための具体的なステップを、以下のJSON形式で返してください。余計なマークダウン(jsonなど)は含めないでください。
                  {
                    "goal": "目標名",
                    "children": [
                      { "name": "ステップ1", "children": [] },
                      { "name": "ステップ2", "children": [] }
                    ]
                  }`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json" // 必ずJSONで返す設定
          }
        }),
      }
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error("Google API Error:", errorDetails);
      return NextResponse.json({ error: errorDetails }, { status: 500 });
    }

    const data = await response.json();
    // Googleからの返事を取り出す
    const text = data.candidates[0].content.parts[0].text;
    
    // アプリが期待する形式（オブジェクト）に変換して返す
    const jsonResult = JSON.parse(text);
    return NextResponse.json(jsonResult);

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}