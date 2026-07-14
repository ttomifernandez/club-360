import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Club de Beneficios | Plataforma Agropecuaria 360 | Productos Ultrapremium",
  description:
    "Club de Beneficios de Plataforma Agropecuaria 360. Mates y yerberas, bolsos de cuero y cuchillos con mango de ciervo, todo ultrapremium con precios especiales para socios.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Club de Beneficios | Plataforma Agropecuaria 360",
    description:
      "Piezas artesanales ultrapremium con precios especiales para socios. Mates, cuero y cuchillería.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${plusJakarta.variable}`}>
      <head>
        <meta name="theme-color" content="#022c22" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
