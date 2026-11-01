import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice & Transcript Studio",
  description:
    "Create AI narration, clone a reference voice, and transcribe audio in one focused workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
