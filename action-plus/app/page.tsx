"use client";
import { useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [formData, setFormData] = useState({ worry: "", dream: "", personality: "" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6" /> ActionPlus
          </h1>
        </div>
        <div className="p-8">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">今の悩み</label>
                <input type="text" className="w-full p-3 border rounded-lg" 
                  value={formData.worry} onChange={(e) => setFormData({...formData, worry: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">将来の夢</label>
                <input type="text" className="w-full p-3 border rounded-lg" 
                  value={formData.dream} onChange={(e) => setFormData({...formData, dream: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">性格</label>
                <input type="text" className="w-full p-3 border rounded-lg" 
                  value={formData.personality} onChange={(e) => setFormData({...formData, personality: e.target.value})} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg">
                {loading ? "AIが考え中..." : "診断する"}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <p className="bg-indigo-50 p-4 rounded-lg">{result.message}</p>
              <div className="space-y-3">
                {result.tasks && result.tasks.map((task: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />{task}
                  </div>
                ))}
              </div>
              <button onClick={() => setResult(null)} className="w-full text-indigo-600 mt-4">もう一度</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}