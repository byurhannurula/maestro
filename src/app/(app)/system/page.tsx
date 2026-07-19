import { redirect } from "next/navigation";

// Settings moved to /settings; keep /system working for old links + shortcuts.
export default function SystemRedirect() {
  redirect("/settings/system");
}
