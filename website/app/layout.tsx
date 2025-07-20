import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Remote Claude - AI Development in the Cloud",
  description: "Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2. Save and reuse tasks, manage multiple projects, and get notified when tasks complete.",
  keywords: ["Claude", "AI", "development", "cloud", "GitHub Codespaces", "AWS EC2", "automation"],
  authors: [{ name: "Remote Claude Team" }],
  openGraph: {
    title: "Remote Claude - AI Development in the Cloud",
    description: "Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2",
    type: "website",
    url: "https://remote-claude.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "Remote Claude",
    description: "AI Development in the Cloud",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-gray-900 text-gray-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
