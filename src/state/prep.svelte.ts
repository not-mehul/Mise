// Keeps the prep-ahead reminders in step with the plan: rescheduled a
// moment after the plan, the recipes or the setting change.

import { prepReminders } from "../domain/prep";
import { t } from "../i18n/index.svelte";
import { setPrepReminders } from "../platform/notify";
import { library } from "./library.svelte";
import { plan } from "./plan.svelte";
import { settings } from "./settings.svelte";

export function keepPrepRemindersCurrent(): void {
  let last = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect.root(() => {
    $effect(() => {
      const due = settings.current.prepReminders
        ? prepReminders(plan.list, library.recipes)
        : [];
      const notices = due.map((r) => ({
        id: r.id,
        at: r.at,
        recipeId: r.recipeId,
        title: r.overnight
          ? t("prep.tonight", { title: r.title })
          : t("prep.today", { title: r.title }),
        body: r.step,
      }));
      const key = JSON.stringify(notices);
      if (key === last) return;
      last = key;
      clearTimeout(timer);
      timer = setTimeout(
        () => void setPrepReminders(notices, t("prep.channel")),
        1000,
      );
    });
  });
}
