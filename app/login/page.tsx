import type { Metadata } from "next";
import { AuthForm } from "@/components/app/AuthForm";

export const metadata: Metadata = {
  title: "Sign in · Lokutara",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
