"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { GeminiStatusProvider } from "@/hooks/use-gemini-status";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <GeminiStatusProvider>
          {children}
          <Toaster position="top-center" closeButton />
        </GeminiStatusProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
