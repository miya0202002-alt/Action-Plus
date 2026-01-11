import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // 👈 これが超重要！デザインの読み込み
import { ClerkProvider } from '@clerk/nextjs';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ActionPlus",
  description: "迷う時間を、動く時間へ。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}