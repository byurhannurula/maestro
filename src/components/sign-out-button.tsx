"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }
  return (
    <Button size="sm" variant="outline" onClick={signOut}>
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}
