import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { worry, dream, personality } = await req.json();
    const apiKey = process.env.Gemini_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not found" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      あなたは大学生の自走支援アプリ「ActionPlus」のAIコーチです。
      以下のユーザーに対して、今日やるべき「極限までハードルを下げた3つの具体的アクション」を提案してください。
      
      ユーザー情報:
      ・悩み: ${worry}
      ・将来の志望: ${dream}
      ・性格: ${personality}

      出力は以下のJSON形式のみで返してください（Markdown記法は不要）:
      {
        "message": "共感と励ましのメッセージ（100文字以内）",
        "tasks": ["タスク1", "タスク2", "タスク3"]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}