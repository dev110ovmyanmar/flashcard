import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Noto_Sans_JP, Noto_Sans_Myanmar, Noto_Serif_JP } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const sansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-jp",
  display: "swap",
  preload: false,
});

const serifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif-jp",
  display: "swap",
  preload: false,
});

const myanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "600", "700"],
  variable: "--font-myanmar-face",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Sumi — Japanese flashcards",
  description:
    "Turn a scanned vocabulary page into a flip deck. Kanji on the front. Hiragana and Myanmar on the back.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#161821" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrument.variable} ${sansJP.variable} ${serifJP.variable} ${myanmar.variable} h-full`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
