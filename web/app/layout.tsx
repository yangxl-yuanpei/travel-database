import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "赣行志 · 江西旅行知识地图", template: "%s · 赣行志" },
  description: "面向 2026 国庆江西旅行的结构化文化节点地图。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
