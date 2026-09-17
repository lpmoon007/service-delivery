import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Be Legendary Service Delivery",
  description:
    "Program templates that generate engagement tasks, reverse timelines and the logistics and coordination doc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
