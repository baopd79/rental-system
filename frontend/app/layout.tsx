import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VnRental — Quản lý nhà trọ",
  description: "Hệ thống quản lý nhà trọ cho thuê",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#2563EB",
    colorText: "#0F172A",
    colorTextSecondary: "#475569",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0F172A",
    borderRadius: "8px",
    fontFamily: "var(--font-geist-sans)",
    fontSize: "14px",
  },
  elements: {
    card: { boxShadow: "0 4px 12px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.04)", border: "1px solid #E5E9F0" },
    headerTitle: { fontSize: "20px", fontWeight: "600", letterSpacing: "-0.018em" },
    headerSubtitle: { fontSize: "13.5px", color: "#64748B" },
    formButtonPrimary: { backgroundColor: "#2563EB", fontSize: "14px", fontWeight: "500" },
    footerActionLink: { color: "#2563EB" },
    identityPreviewText: { color: "#0F172A" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="vi"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
