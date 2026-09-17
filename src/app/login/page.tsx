import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (!isSupabaseConfigured) {
    return (
      <main>
        <h1>Sign in</h1>
        <p className="band">
          Supabase is not configured for this deployment, so there is nothing to sign in to.
          The app is running in fixture-preview mode. Set{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to enable accounts.
        </p>
      </main>
    );
  }
  return (
    <main>
      <h1>Sign in</h1>
      <p className="sub">
        Enter the email address James used to add you. You will get a link that signs you in.
        No password.
      </p>
      <LoginForm />
    </main>
  );
}
