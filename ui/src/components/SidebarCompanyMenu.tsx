import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { useSidebar } from "../context/SidebarContext";

export function SidebarCompanyMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { isMobile, setSidebarOpen } = useSidebar();
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: async () => {
      setOpen(false);
      if (isMobile) setSidebarOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
  });

  function closeNavigationChrome() {
    setOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto flex-1 justify-start gap-1 px-2 py-1.5 text-left"
          aria-label={selectedCompany
            ? t("Open {{name}} menu", {
              defaultValue: "Open {{name}} menu",
              name: selectedCompany.name,
            })
            : t("Open company menu", { defaultValue: "Open company menu" })}
          disabled={!selectedCompany}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selectedCompany?.brandColor ? (
              <span
                className="size-4 shrink-0 rounded-sm"
                style={{ backgroundColor: selectedCompany.brandColor }}
              />
            ) : null}
            <span className="truncate text-sm font-bold text-foreground">
              {selectedCompany?.name ?? t("Select company", { defaultValue: "Select company" })}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="truncate">
          {selectedCompany?.name ?? t("Company", { defaultValue: "Company" })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/company/settings/invites" onClick={closeNavigationChrome}>
            <UserPlus className="size-4" />
            <span className="truncate">
              {selectedCompany
                ? t("Invite people to {{name}}", {
                  defaultValue: "Invite people to {{name}}",
                  name: selectedCompany.name,
                })
                : t("Invite people", { defaultValue: "Invite people" })}
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/company/settings" onClick={closeNavigationChrome}>
            <Settings className="size-4" />
            <span>{t("Company settings", { defaultValue: "Company settings" })}</span>
          </Link>
        </DropdownMenuItem>
        {session?.session ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOutMutation.mutate()}
              disabled={signOutMutation.isPending}
            >
              <LogOut className="size-4" />
              <span>
                {signOutMutation.isPending
                  ? t("Signing out...", { defaultValue: "Signing out..." })
                  : t("Sign out", { defaultValue: "Sign out" })}
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
