import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PatchInstanceExperimentalSettings } from "@penclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

export function InstanceExperimentalSettings() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("Instance Settings", { defaultValue: "Instance Settings" }) },
      { label: t("Experimental", { defaultValue: "Experimental" }) },
    ]);
  }, [setBreadcrumbs, t]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (patch: PatchInstanceExperimentalSettings) =>
      instanceSettingsApi.updateExperimental(patch),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
      ]);
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : t("Failed to update experimental settings.", { defaultValue: "Failed to update experimental settings." }),
      );
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("Loading experimental settings...", { defaultValue: "Loading experimental settings..." })}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : t("Failed to load experimental settings.", { defaultValue: "Failed to load experimental settings." })}
      </div>
    );
  }

  const enableEnvironments = experimentalQuery.data?.enableEnvironments === true;
  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;
  const enableIssueGraphLivenessAutoRecovery =
    experimentalQuery.data?.enableIssueGraphLivenessAutoRecovery === true;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("Experimental", { defaultValue: "Experimental" })}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            "Opt into features that are still being evaluated before they become default behavior.",
            { defaultValue: "Opt into features that are still being evaluated before they become default behavior." },
          )}
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("Enable Environments", { defaultValue: "Enable Environments" })}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t(
                "Show environment management in company settings and allow project and agent environment assignment controls.",
                {
                  defaultValue:
                    "Show environment management in company settings and allow project and agent environment assignment controls.",
                },
              )}
            </p>
          </div>
          <ToggleSwitch
            checked={enableEnvironments}
            onCheckedChange={() => toggleMutation.mutate({ enableEnvironments: !enableEnvironments })}
            disabled={toggleMutation.isPending}
            aria-label={t("Toggle environments experimental setting", { defaultValue: "Toggle environments experimental setting" })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("Enable Isolated Workspaces", { defaultValue: "Enable Isolated Workspaces" })}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t(
                "Show execution workspace controls in project configuration and allow isolated workspace behavior for new and existing issue runs.",
                {
                  defaultValue:
                    "Show execution workspace controls in project configuration and allow isolated workspace behavior for new and existing issue runs.",
                },
              )}
            </p>
          </div>
          <ToggleSwitch
            checked={enableIsolatedWorkspaces}
            onCheckedChange={() => toggleMutation.mutate({ enableIsolatedWorkspaces: !enableIsolatedWorkspaces })}
            disabled={toggleMutation.isPending}
            aria-label={t("Toggle isolated workspaces experimental setting", { defaultValue: "Toggle isolated workspaces experimental setting" })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("Auto-Restart Dev Server When Idle", { defaultValue: "Auto-Restart Dev Server When Idle" })}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t(
                "In `pnpm dev:once`, wait for all queued and running local agent runs to finish, then restart the server automatically when backend changes or migrations make the current boot stale.",
                {
                  defaultValue:
                    "In `pnpm dev:once`, wait for all queued and running local agent runs to finish, then restart the server automatically when backend changes or migrations make the current boot stale.",
                },
              )}
            </p>
          </div>
          <ToggleSwitch
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={() => toggleMutation.mutate({ autoRestartDevServerWhenIdle: !autoRestartDevServerWhenIdle })}
            disabled={toggleMutation.isPending}
            aria-label={t("Toggle guarded dev-server auto-restart", { defaultValue: "Toggle guarded dev-server auto-restart" })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Auto-Create Issue Recovery Tasks</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Let the heartbeat scheduler create recovery issues for issue dependency chains that have been stalled for
              at least 24 hours.
            </p>
          </div>
          <ToggleSwitch
            checked={enableIssueGraphLivenessAutoRecovery}
            onCheckedChange={() =>
              toggleMutation.mutate({
                enableIssueGraphLivenessAutoRecovery: !enableIssueGraphLivenessAutoRecovery,
              })
            }
            disabled={toggleMutation.isPending}
            aria-label="Toggle issue graph liveness auto-recovery"
          />
        </div>
      </section>
    </div>
  );
}
