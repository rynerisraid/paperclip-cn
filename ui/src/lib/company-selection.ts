export type CompanySelectionSource = "manual" | "route_sync" | "bootstrap";

interface AutoSelectableCompany {
  id: string;
  status?: string;
}

type AutoSelectedCompanyParams = {
  companies: readonly AutoSelectableCompany[];
  selectedCompanyId: string | null;
  storedCompanyId: string | null;
  isFetching: boolean;
};

export function shouldSyncCompanySelectionFromRoute(params: {
  selectionSource: CompanySelectionSource;
  selectedCompanyId: string | null;
  routeCompanyId: string;
}): boolean {
  const { selectionSource, selectedCompanyId, routeCompanyId } = params;

  if (selectedCompanyId === routeCompanyId) return false;

  // Let manual company switches finish their remembered-path navigation first.
  if (selectionSource === "manual" && selectedCompanyId) {
    return false;
  }

  return true;
}

export function resolveAutoSelectedCompanyId(params: {
  companies: readonly AutoSelectableCompany[];
  selectedCompanyId: string | null;
  storedCompanyId: string | null;
  isFetching: boolean;
}): string | null {
  const { companies, selectedCompanyId, storedCompanyId, isFetching } = params;

  if (companies.length === 0) return null;

  const activeCompanies = companies.filter((company) => company.status !== "archived");
  const selectableCompanies = activeCompanies.length > 0 ? activeCompanies : companies;
  const requestedCompanyId = selectedCompanyId ?? storedCompanyId;

  if (storedCompanyId && selectableCompanies.some((company) => company.id === storedCompanyId)) {
    return null;
  }

  if (selectedCompanyId && selectableCompanies.some((company) => company.id === selectedCompanyId)) {
    return null;
  }

  // After creating a company we can briefly have a fresh selected id but stale company data.
  // Keep the requested selection stable until the refetch settles instead of snapping to a fallback.
  if (isFetching && requestedCompanyId) {
    return null;
  }

  return selectableCompanies[0]!.id;
}

export function shouldClearSelectedCompanyId(params: AutoSelectedCompanyParams): boolean {
  const { companies, selectedCompanyId, storedCompanyId, isFetching } = params;

  if (isFetching || companies.length > 0) return false;
  return Boolean(selectedCompanyId || storedCompanyId);
}
