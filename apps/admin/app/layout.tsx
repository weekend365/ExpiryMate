import type { Metadata } from "next";
import { appBrand, cssVariableBlock } from "@expirymate/shared";
import "./globals.css";
import { AppShell } from "../src/components/app-shell";
import { Providers } from "../src/components/providers";

export const metadata: Metadata = {
  title: `${appBrand.appNameKo} Admin`,
  description: `${appBrand.appNameEn} (${appBrand.appNameKo}) internal management dashboard`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <style
          // Sync admin CSS vars with @expirymate/shared semantic tokens.
          dangerouslySetInnerHTML={{ __html: cssVariableBlock() }}
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
