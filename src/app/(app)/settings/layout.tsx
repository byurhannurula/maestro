import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Settings"
        subtitle="Account, library, and system — at a glance."
        actions={<SettingsTabs />}
      />
      <div className="px-6 pb-10">{children}</div>
    </div>
  );
}
