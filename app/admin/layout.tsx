import type { Metadata, Viewport } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin · Lokutara",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
