"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

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
