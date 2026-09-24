import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthDisplayPreHydrationHead } from "@/components/auth/auth-display";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const title = "California Legislative Information";
const description =
  "AI legal research for California law — the complete California Codes, 2025-26 bills, Rules of Court, and case law.";

function resolveMetadataBase() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!configuredUrl) {
    return new URL("http://localhost:3000");
  }

  return new URL(configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`);
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title,
  description,
  applicationName: title,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title,
    description,
    siteName: title,
    type: "website",
  },
};

const themeScript = `
(() => {
  try {
    const theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  } catch {
    const root = document.documentElement;
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }
})();
`;

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html
      className={inter.variable}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} id="theme-init" />
        <AuthDisplayPreHydrationHead />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
