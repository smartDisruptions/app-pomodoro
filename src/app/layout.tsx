import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { AchievementToast } from "@/components/ui/achievement-toast";
import { TouchGlowBackground } from "@/components/ui/touch-glow-background";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6366f1",
};

export const metadata: Metadata = {
  title: {
    default: "Pomodoro Timer — Focus & Productivity",
    template: "%s | Pomodoro Timer",
  },
  description:
    "A visually premium Pomodoro timer with task tracking, stats, achievements, and ambient focus modes. Stay productive with customizable work sessions.",
  keywords: [
    "pomodoro",
    "timer",
    "productivity",
    "focus",
    "time management",
    "task tracker",
  ],
  authors: [{ name: "Pomodoro App" }],
  metadataBase: new URL("https://app-pomodoro-blush.vercel.app"),
  openGraph: {
    title: "Pomodoro Timer — Focus & Productivity",
    description:
      "A visually premium Pomodoro timer with task tracking, stats, and achievements.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pomodoro Timer — Focus & Productivity",
    description:
      "A visually premium Pomodoro timer with task tracking, stats, and achievements.",
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
        <TooltipProvider>
          <AmbientBackground />
          <TouchGlowBackground />
          <AchievementToast />
          <div className="flex flex-col min-h-screen">
            <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-border">
              <h1 className="text-lg font-semibold tracking-tight">Pomodoro</h1>
              <Navigation variant="desktop" />
            </header>
            <main className="flex-1 flex flex-col pb-16 md:pb-0">
              {children}
            </main>
            <Navigation variant="mobile" />
          </div>
        </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
