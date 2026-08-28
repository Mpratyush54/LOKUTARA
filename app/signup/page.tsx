import type { Metadata } from "next";
import { AuthForm } from "@/components/app/AuthForm";

export const metadata: Metadata = {
  title: "Start a trial · Lokutara",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
