import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/lib/actions";
import { currentProfile } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Be Legendary Service Delivery",
  description:
    "Program templates that generate engagement tasks, reverse timelines and the logistics and coordination doc.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await currentProfile();

  return (
    <html lang="en">
      <body>
        <div className="wrap">
          {profile && (
            <div className="topbar">
              <Link href="/">Service Delivery</Link>
              <span className="det">
                {profile.email} · {profile.role}
              </span>
              <form action={signOut}>
                <button type="submit" className="linkish">
                  Sign out
                </button>
              </form>
            </div>
          )}
          {children}
        </div>
      </body>
    </html>
  );
}
