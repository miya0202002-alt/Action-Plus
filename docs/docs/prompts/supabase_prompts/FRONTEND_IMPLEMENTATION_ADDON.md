# 🎨 フロントエンド実装アドオン：認証UI + データ操作

このドキュメントは `MASTER_INTEGRATION_PROMPT.md` のフェーズ 10 として追加され、
既存の React/Next.js フロントエンドに認証機能とデータベース操作の UI を統合します。

**想定：** ユーザーが既に React/Next.js でフロントエンドのデザインを作成済み

---

## 🎯 実装するもの

1. ✅ サインイン/サインアップページ
2. ✅ Protected routes（認証が必要なページ）
3. ✅ ナビゲーション（ログイン状態に応じた表示切替）
4. ✅ ユーザープロフィール表示
5. ✅ データの CRUD 操作（Server Actions）
6. ✅ カスタムフック（useSupabaseUser など）
7. ✅ リアルタイム機能の UI（必要な場合）
8. ✅ ローディング・エラー状態の UI
9. ✅ Service Role による Clerk ↔ Supabase 同期

---

## 📦 フェーズ 10: フロントエンド実装

### 10-1. 認証ページの実装

#### サインインページ

`app/sign-in/[[...sign-in]]/page.tsx`:

```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl"
          }
        }}
        routing="path"
        path="/sign-in"
      />
    </div>
  )
}
```

#### サインアップページ

`app/sign-up/[[...sign-up]]/page.tsx`:

```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl"
          }
        }}
        routing="path"
        path="/sign-up"
      />
    </div>
  )
}
```

---

### 10-2. Protected Routes の実装

#### パターン A: Server Component での保護

`app/dashboard/page.tsx`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const { userId } = await auth()
  
  // 認証チェック
  if (!userId) {
    redirect('/sign-in')
  }

  // Supabase からユーザーデータ取得
  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  // ユーザーが存在しない場合は作成
  if (!user) {
    const clerkUser = await currentUser()
    if (clerkUser) {
      await supabase.from('users').insert({
        clerk_user_id: userId,
        email: clerkUser.emailAddresses[0].emailAddress,
        full_name: `${clerkUser.firstName} ${clerkUser.lastName}`,
      })
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">ダッシュボード</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-lg">ようこそ、{user?.full_name ?? user?.email}さん</p>
      </div>
    </div>
  )
}
```

#### パターン B: Client Component での保護

`app/profile/page.tsx`:

```typescript
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">プロフィール</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <p className="text-lg">{user.emailAddresses[0].emailAddress}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            氏名
          </label>
          <p className="text-lg">{user.firstName} {user.lastName}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アカウント作成日
          </label>
          <p className="text-lg">
            {new Date(user.createdAt!).toLocaleDateString('ja-JP')}
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

### 10-3. ナビゲーションの実装

#### ヘッダーコンポーネント

`components/header.tsx`:

```typescript
import { 
  SignInButton, 
  SignUpButton, 
  SignedIn, 
  SignedOut, 
  UserButton 
} from '@clerk/nextjs'
import Link from 'next/link'

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* ロゴとナビゲーション */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              YourApp
            </Link>
            
            <SignedIn>
              <nav className="hidden md:flex space-x-6">
                <Link 
                  href="/dashboard" 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  ダッシュボード
                </Link>
                <Link 
                  href="/profile" 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  プロフィール
                </Link>
              </nav>
            </SignedIn>
          </div>

          {/* 認証ボタン */}
          <div className="flex items-center space-x-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                  ログイン
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                  新規登録
                </button>
              </SignUpButton>
            </SignedOut>
            
            <SignedIn>
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 rounded-full"
                  }
                }}
              />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  )
}
```

#### モバイル対応ナビゲーション

`components/mobile-nav.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2"
        aria-label="メニュー"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg">
          <nav className="container mx-auto px-4 py-4 space-y-4">
            <SignedIn>
              <Link 
                href="/dashboard" 
                className="block py-2 hover:text-primary"
                onClick={() => setIsOpen(false)}
              >
                ダッシュボード
              </Link>
              <Link 
                href="/profile" 
                className="block py-2 hover:text-primary"
                onClick={() => setIsOpen(false)}
              >
                プロフィール
              </Link>
            </SignedIn>
            
            <SignedOut>
              <SignInButton mode="modal">
                <button className="block w-full text-left py-2">
                  ログイン
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="block w-full text-left py-2 text-primary font-medium">
                  新規登録
                </button>
              </SignUpButton>
            </SignedOut>
          </nav>
        </div>
      )}
    </>
  )
}
```

#### Layout への統合

`app/layout.tsx` を更新：

```typescript
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/toaster"; // オプション
import "./globals.css";

export const metadata: Metadata = {
  title: "Your App",
  description: "Your app description",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className="min-h-screen bg-gray-50">
          <Header />
          <main>{children}</main>
          <Toaster /> {/* オプション: トースト通知 */}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

---

### 10-4. カスタムフックの実装

#### useSupabaseUser フック

`hooks/use-supabase-user.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type User = Database['public']['Tables']['users']['Row']

export function useSupabaseUser() {
  const { user: clerkUser, isLoaded } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!clerkUser) {
      setUser(null)
      setLoading(false)
      return
    }

    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('clerk_user_id', clerkUser.id)
          .single()

        if (error) throw error
        setUser(data)
      } catch (err) {
        console.error('Error fetching Supabase user:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [clerkUser, isLoaded])

  return { user, loading, error, refetch: () => setLoading(true) }
}
```

#### useSupabaseQuery フック（汎用）

`hooks/use-supabase-query.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostgrestFilterBuilder } from '@supabase/postgrest-js'

export function useSupabaseQuery<T>(
  query: (client: ReturnType<typeof createClient>) => PostgrestFilterBuilder<any, any, T[]>
) {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await query(supabase)

        if (error) throw error
        setData(data)
      } catch (err) {
        console.error('Query error:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [query])

  const refetch = () => {
    setLoading(true)
  }

  return { data, loading, error, refetch }
}
```

---

### 10-5. CRUD 操作の実装

#### Server Actions の作成

設計ドキュメントに基づいて主要テーブルの操作を実装。

`app/actions/[table-name].ts` （例：posts）:

```typescript
'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { ensureSupabaseUser } from '@/lib/supabase/auth-helpers'

// バリデーションスキーマ
const createPostSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200),
  content: z.string().min(1, '内容は必須です'),
})

const updatePostSchema = createPostSchema.extend({
  published: z.boolean().optional(),
})

// 投稿作成
export async function createPost(formData: FormData) {
  try {
    const { userId } = await auth()
    if (!userId) throw new Error('認証が必要です')

    // バリデーション
    const validated = createPostSchema.parse({
      title: formData.get('title'),
      content: formData.get('content'),
    })

    const supabase = createServiceRoleClient()
    const user = await ensureSupabaseUser()

    if (!user) throw new Error('ユーザーが見つかりません')

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: validated.title,
        content: validated.content,
        published: false
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/dashboard')
    return { success: true, data }
  } catch (error) {
    console.error('Create post error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '投稿の作成に失敗しました' 
    }
  }
}

// 投稿更新
export async function updatePost(postId: string, formData: FormData) {
  try {
    const { userId } = await auth()
    if (!userId) throw new Error('認証が必要です')

    // バリデーション
    const validated = updatePostSchema.parse({
      title: formData.get('title'),
      content: formData.get('content'),
      published: formData.get('published') === 'true',
    })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('posts')
      .update({
        title: validated.title,
        content: validated.content,
        published: validated.published,
      })
      .eq('id', postId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath(`/posts/${postId}`)
    return { success: true, data }
  } catch (error) {
    console.error('Update post error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '投稿の更新に失敗しました' 
    }
  }
}

// 投稿削除
export async function deletePost(postId: string) {
  try {
    const { userId } = await auth()
    if (!userId) throw new Error('認証が必要です')

    const supabase = await createClient()
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) throw error

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Delete post error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '投稿の削除に失敗しました' 
    }
  }
}

// 投稿取得（単一）
export async function getPost(postId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('posts')
      .select('*, users(full_name, email)')
      .eq('id', postId)
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Get post error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '投稿の取得に失敗しました' 
    }
  }
}

// 投稿リスト取得
export async function getPosts() {
  try {
    const { userId } = await auth()
    if (!userId) throw new Error('認証が必要です')

    const supabase = await createClient()
    
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!user) throw new Error('ユーザーが見つかりません')

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Get posts error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '投稿の取得に失敗しました' 
    }
  }
}
```

#### フォームコンポーネント

`components/post-form.tsx`:

```typescript
'use client'

import { useTransition, useState } from 'react'
import { createPost, updatePost } from '@/app/actions/posts'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast' // オプション

interface PostFormProps {
  post?: {
    id: string
    title: string
    content: string
    published: boolean
  }
}

export function PostForm({ post }: PostFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast() // オプション

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const result = post 
          ? await updatePost(post.id, formData)
          : await createPost(formData)

        if (result.success) {
          toast?.({ // オプション
            title: post ? '投稿を更新しました' : '投稿を作成しました',
          })
          router.push('/dashboard')
          router.refresh()
        } else {
          setError(result.error || '操作に失敗しました')
        }
      } catch (err) {
        setError('予期しないエラーが発生しました')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      <div>
        <label 
          htmlFor="title" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          defaultValue={post?.title}
          required
          maxLength={200}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={isPending}
        />
      </div>

      <div>
        <label 
          htmlFor="content" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          defaultValue={post?.content}
          required
          rows={12}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
          disabled={isPending}
        />
      </div>

      {post && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="published"
            name="published"
            value="true"
            defaultChecked={post.published}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            disabled={isPending}
          />
          <label htmlFor="published" className="text-sm font-medium text-gray-700">
            この投稿を公開する
          </label>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? '保存中...' : post ? '更新する' : '作成する'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
```

#### リスト表示コンポーネント

`components/posts-list.tsx`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DeletePostButton } from './delete-post-button'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

export async function PostsList() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClient()
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!user) return null

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            投稿がありません
          </h3>
          <p className="text-gray-600 mb-6">
            最初の投稿を作成しましょう
          </p>
          <Link
            href="/dashboard/posts/new"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            投稿を作成
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article 
          key={post.id} 
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <Link
                href={`/dashboard/posts/${post.id}`}
                className="group"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
              </Link>
              <p className="text-gray-600 line-clamp-3 mb-4">
                {post.content}
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  post.published 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {post.published ? '公開中' : '下書き'}
                </span>
                <span>
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: ja,
                  })}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-2 ml-4">
              <Link
                href={`/dashboard/posts/${post.id}/edit`}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                編集
              </Link>
              <DeletePostButton postId={post.id} postTitle={post.title} />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
```

#### 削除ボタン（Client Component）

`components/delete-post-button.tsx`:

```typescript
'use client'

import { useTransition, useState } from 'react'
import { deletePost } from '@/app/actions/posts'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeletePostButton({ 
  postId, 
  postTitle 
}: { 
  postId: string
  postTitle: string 
}) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePost(postId)
      
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error || '削除に失敗しました')
      }
    })
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-2">投稿を削除</h3>
          <p className="text-gray-600 mb-4">
            「{postTitle}」を削除してもよろしいですか？この操作は取り消せません。
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? '削除中...' : '削除する'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
```

---

### 10-6. リアルタイム機能のUI（必要な場合）

#### リアルタイムメッセージコンポーネント

`components/realtime-messages.tsx`:

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@clerk/nextjs'
import { Send } from 'lucide-react'

interface Message {
  id: string
  content: string
  user_id: string
  user?: {
    full_name: string
  }
  created_at: string
}

export function RealtimeMessages({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useUser()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 初期メッセージの読み込み
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, users(full_name)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (data) {
        setMessages(data as any)
        scrollToBottom()
      }
      setIsLoading(false)
    }

    fetchMessages()
  }, [roomId, supabase])

  // リアルタイム購読
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}:messages`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
        scrollToBottom()
      })
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        setMessages((prev) => 
          prev.filter((msg) => msg.id !== payload.old.id)
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    const { error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        content: newMessage.trim(),
        user_id: user.id
      })

    if (!error) {
      setNewMessage('')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg border">
      {/* メッセージリスト */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.user_id === user?.id
          
          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {!isOwnMessage && (
                  <p className="text-xs font-medium mb-1 opacity-75">
                    {message.user?.full_name}
                  </p>
                )}
                <p className="break-words">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  isOwnMessage ? 'text-white/75' : 'text-gray-500'
                }`}>
                  {new Date(message.created_at).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSend} className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
```

---

### 10-7. ローディングとエラー状態

#### Loading UI

`app/dashboard/loading.tsx`:

```typescript
export default function DashboardLoading() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="space-y-4">
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}
```

#### Error UI

`app/dashboard/error.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          エラーが発生しました
        </h2>
        <p className="text-gray-600 mb-6">
          {error.message || '予期しないエラーが発生しました。'}
        </p>
        <div className="flex space-x-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### Not Found UI

`app/dashboard/posts/[id]/not-found.tsx`:

```typescript
import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function PostNotFound() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          投稿が見つかりません
        </h2>
        <p className="text-gray-600 mb-6">
          この投稿は削除されたか、存在しません。
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  )
}
```

---

### 10-8. Clerk ↔ Supabase 同期（Service Role）

Clerk Webhook の代わりに、アプリ内で `ensureSupabaseUser()` を呼び出して同期する。

1. `lib/supabase/service-role.ts`（Server Actions 専用）を作成
2. `lib/supabase/auth-helpers.ts` に `ensureSupabaseUser()` と `getSupabaseUserByClerkId()` を実装
3. Protected Layout や Server Actions の冒頭で `await ensureSupabaseUser()` を実行

`app/(protected)/layout.tsx` 例：

```typescript
import { PropsWithChildren } from 'react'
import { ensureSupabaseUser } from '@/lib/supabase/auth-helpers'

export default async function ProtectedLayout({ children }: PropsWithChildren) {
  await ensureSupabaseUser()

  return (
    <section className="min-h-screen bg-neutral-50">
      {children}
    </section>
  )
}
```

> `ensureSupabaseUser()` は service role で upsert するため、RLS を意識せず Supabase の `users` テーブルと Clerk を同期できる。

---

## 📝 実装完了後のユーザー指示事項

- `.env.local.example` を `.env.local` にコピーし、Clerk/Supabase のキーを設定
- `SUPABASE_SERVICE_ROLE_KEY` は Vercel の環境変数にも設定（クライアントには公開しない）
- 最初のアクセスで Protected Layout が読み込まれると自動同期される旨を共有

### 動作確認

1. **認証フロー**
   - サインアップ/サインイン/サインアウトが問題なく動作
2. **データ操作**
   - Server Actions 経由で CRUD が動作
3. **Protected Routes**
   - 未認証アクセスはリダイレクトされる
4. **リアルタイム機能（該当する場合）**
   - broadcast が期待通り動作

### トラブルシューティング

**問題：同期されない**
- `ensureSupabaseUser()` を呼ぶ箇所が実行されているか確認
- `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認

**問題：データが表示されない**
- Browser コンソールと Server Logs を確認
- Supabase Dashboard でレコードが存在するか確認
- RLS ポリシーの条件を確認

**問題：Server Actions で失敗**
- `createServiceRoleClient()` をサーバーでのみ import しているか確認
- フォームバリデーションエラー / DB 制約違反を確認

---

## ✅ フロントエンド実装チェックリスト

- [ ] 認証ページ（sign-in, sign-up）を作成
- [ ] Protected routes を実装
- [ ] Header / Layout へ統合
- [ ] Server Actions を作成（設計に基づく）
- [ ] フォームコンポーネントを作成
- [ ] リスト表示コンポーネントを作成
- [ ] カスタムフックを作成
- [ ] Loading / Error UI を作成
- [ ] リアルタイム機能を実装（必要な場合）
- [ ] `ensureSupabaseUser()` をアプリ内で呼び出す
- [ ] エラーハンドリング / バリデーションを実装
- [ ] レスポンシブデザインに対応
- [ ] ユーザー向け指示を生成

---

**このアドオンを MASTER_INTEGRATION_PROMPT.md のフェーズ 10 として使用し、
完全な認証付きアプリケーションを自動生成してください。**
