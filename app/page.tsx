export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#2c3e50' }}>
        ActionPlus
      </h1>
      <section>
        <h2 style={{ marginBottom: '1rem', color: '#34495e' }}>
          プロジェクト概要
        </h2>
        <p style={{ marginBottom: '1rem' }}>
          AIが目標からタスクを自動生成・管理するWebアプリ
        </p>
        <p>
          ActionPlusは、ユーザーが設定した目標からAIが自動的にタスクを生成し、
          効率的に管理・実行をサポートするタスク管理アプリケーションです。
        </p>
      </section>
    </main>
  );
}
