import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import { OfflineSupport } from "@/components/offline-support";
import { SessionProvider } from "@/lib/auth/session";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Reisplanner",
  description: "Plan je reis met kaart en dagindeling naast elkaar.",
  appleWebApp: { capable: true, title: "Reisplanner", statusBarStyle: "default" },
  icons: { icon: "/icon-512.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#fece14",
  // De app vult het scherm; inzoomen zou de tabbalk buiten beeld duwen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${poppins.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      {/* Exact schermhoogte: zo blijft de tabbalk op mobiel altijd in beeld. */}
      <body className="h-full overflow-hidden flex flex-col">
        <OfflineSupport />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
