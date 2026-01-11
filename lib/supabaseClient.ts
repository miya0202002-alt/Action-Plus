import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabaseの環境変数が設定されていません。.env.localを確認してください。\n" +
    "必須: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// 普通のクライアント作成（ログインなし用）
export const supabase = createClient(supabaseUrl, supabaseKey);

// Clerkのトークンを使ってSupabaseクライアントを作成する関数
export const createClerkSupabaseClient = async (getToken: any) => {
  const token = await getToken({ template: 'supabase' });

  if (!token) {
    // トークンがない場合（未ログインなど）は通常のクライアントを返す
    return supabase;
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};
