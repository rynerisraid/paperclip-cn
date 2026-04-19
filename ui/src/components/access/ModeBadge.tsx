import type { DeploymentExposure, DeploymentMode } from "@penclipai/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function ModeBadge({
  deploymentMode,
  deploymentExposure,
}: {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
}) {
  const { t } = useTranslation();
  if (!deploymentMode) return null;

  const label =
    deploymentMode === "local_trusted"
      ? t("modeBadge.localTrusted", { defaultValue: "Local trusted" })
      : deploymentExposure === "public"
        ? t("modeBadge.authenticatedPublic", { defaultValue: "Authenticated public" })
        : t("modeBadge.authenticatedPrivate", { defaultValue: "Authenticated private" });

  return <Badge variant="outline">{label}</Badge>;
}
