import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { goal } = await req.json();

    if (!goal || typeof goal !== 'string' || goal.trim() === '') {
      return NextResponse.json(
        { error: "目標が入力されていません" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("★GEMINI_API_KEYが環境変数に設定されていません");
      return NextResponse.json(
        { error: "API Key not found" },
        { status: 500 }
      );
    }

    // プロンプトを改善
    const prompt = `
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

ユーザーの目標: ${goal}
`;

    // ライブラリ(GoogleGenerativeAI)を使わず、fetchで直接通信します
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("★Google API エラー:", response.status, errorData);
      return NextResponse.json(
        {
          error: "AI API呼び出しに失敗しました",
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // レスポンス構造の検証
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      console.error("★予期しないレスポンス構造:", data);
      return NextResponse.json(
        { error: "AIからの応答形式が不正です" },
        { status: 500 }
      );
    }

    const text = data.candidates[0].content.parts[0].text;

    if (!text) {
      console.error("★AIからのテキストが空です");
      return NextResponse.json(
        { error: "AIからの応答が空です" },
        { status: 500 }
      );
    }

    // JSONの整形（```jsonや```を削除）
    let jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("★JSONが見つかりません。テキスト:", text);
      return NextResponse.json(
        { error: "AIが正しいJSON形式で応答しませんでした", rawText: text },
        { status: 500 }
      );
    }

    jsonStr = jsonMatch[0];

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("★JSONパースエラー:", parseError, "テキスト:", jsonStr);
      return NextResponse.json(
        { error: "JSONの解析に失敗しました", rawText: jsonStr },
        { status: 500 }
      );
    }

    // 結果の検証
    if (!result.children || !Array.isArray(result.children)) {
      console.error("★結果にchildrenがありません:", result);
      return NextResponse.json(
        { error: "AIが正しいデータ構造を返しませんでした", received: result },
        { status: 500 }
      );
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("★サーバー内部エラー:", error);
    return NextResponse.json(
      {
        error: "サーバー内部エラーが発生しました",
        message: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}