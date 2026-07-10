import type { Metadata } from "next";
import { appBrand } from "@expirymate/shared";
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
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
