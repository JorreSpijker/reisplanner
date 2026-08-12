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
  // Het favicon komt uit `src/app/icon.png`; Next zet daar zelf de link voor.
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#fece14",
  // De app vult het scherm; inzoomen zou de tabbalk buiten beeld duwen.
  viewportFit: "cover",
  // Het toetsenbord verkleint de layout in plaats van hem te bedekken: anders
  // valt het invoerveld waar je in typt achter het toetsenbord.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${poppins.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      {/*
        `dvh` en niet `h-full`: honderd procent rekent met het scherm alsof de
        browserbalken ingeklapt zijn, waardoor de tabbalk erachter valt en er
        door `overflow-hidden` niet meer bij te komen is.
      */}
      <body className="h-dvh overflow-hidden flex flex-col">
        <OfflineSupport />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
