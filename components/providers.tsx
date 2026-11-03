"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { AppChrome } from "@/components/app-chrome";
import { Toaster } from "@/components/ui/sonner";
import { GeminiStatusProvider } from "@/hooks/use-gemini-status";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <GeminiStatusProvider>
          <AppChrome>{children}</AppChrome>
          <Toaster position="top-center" closeButton />
        </GeminiStatusProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
