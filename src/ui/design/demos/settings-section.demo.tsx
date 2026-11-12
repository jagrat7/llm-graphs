import { Button } from "#/ui/components/ui/button"
import { Switch } from "#/ui/components/ui/switch"
import { SettingsSection } from "#/ui/components/settings-section"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = {
  title: "Settings section",
  components: [],
  custom: { file: "src/ui/components/settings-section.tsx", exports: "SettingsSection" },
}

export default function SettingsSectionDemo() {
  return (
    <div className="max-w-sm">
      <SettingsSection
        title="Chart"
        description="What the chart draws"
        action={
          <Button size="xs" variant="ghost">
            Reset
          </Button>
        }
      >
        <label className="text-control flex items-center justify-between py-1">
          Pareto frontier
          <Switch defaultChecked />
        </label>
      </SettingsSection>
      <SettingsSection title="Providers">
        <label className="text-control flex items-center justify-between py-1">
          Only open weights
          <Switch />
        </label>
      </SettingsSection>
    </div>
  )
}
