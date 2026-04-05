import { describe, expect, it } from "vitest";
import {
  resolveAutoSelectedCompanyId,
  shouldClearSelectedCompanyId,
  shouldSyncCompanySelectionFromRoute,
} from "./company-selection";

describe("shouldSyncCompanySelectionFromRoute", () => {
  it("does not resync when selection already matches the route", () => {
    expect(
      shouldSyncCompanySelectionFromRoute({
        selectionSource: "route_sync",
        selectedCompanyId: "pap",
        routeCompanyId: "pap",
      }),
    ).toBe(false);
  });

  it("defers route sync while a manual company switch is in flight", () => {
    expect(
      shouldSyncCompanySelectionFromRoute({
        selectionSource: "manual",
        selectedCompanyId: "pap",
        routeCompanyId: "ret",
      }),
    ).toBe(false);
  });

  it("syncs back to the route company for non-manual mismatches", () => {
    expect(
      shouldSyncCompanySelectionFromRoute({
        selectionSource: "route_sync",
        selectedCompanyId: "pap",
        routeCompanyId: "ret",
      }),
    ).toBe(true);
  });
});

describe("resolveAutoSelectedCompanyId", () => {
  it("keeps a pending selected company while the companies query is refreshing", () => {
    expect(
      resolveAutoSelectedCompanyId({
        companies: [
          { id: "archived-1", status: "archived" },
          { id: "archived-2", status: "archived" },
        ],
        selectedCompanyId: "new-company",
        storedCompanyId: "new-company",
        isFetching: true,
      }),
    ).toBeNull();
  });

  it("falls back once refresh settles and the selected company is still missing", () => {
    expect(
      resolveAutoSelectedCompanyId({
        companies: [
          { id: "archived-1", status: "archived" },
          { id: "archived-2", status: "archived" },
        ],
        selectedCompanyId: "missing-company",
        storedCompanyId: "missing-company",
        isFetching: false,
      }),
    ).toBe("archived-1");
  });

  it("does not replace a valid active selection", () => {
    expect(
      resolveAutoSelectedCompanyId({
        companies: [
          { id: "archived-1", status: "archived" },
          { id: "active-1", status: "active" },
        ],
        selectedCompanyId: "active-1",
        storedCompanyId: "active-1",
        isFetching: false,
      }),
    ).toBeNull();
  });
});

describe("shouldClearSelectedCompanyId", () => {
  it("clears a remembered selection after the company list settles empty", () => {
    expect(
      shouldClearSelectedCompanyId({
        companies: [],
        selectedCompanyId: "missing-company",
        storedCompanyId: "missing-company",
        isFetching: false,
      }),
    ).toBe(true);
  });

  it("keeps a remembered selection while the company list is still loading", () => {
    expect(
      shouldClearSelectedCompanyId({
        companies: [],
        selectedCompanyId: "missing-company",
        storedCompanyId: "missing-company",
        isFetching: true,
      }),
    ).toBe(false);
  });

  it("does not clear when there is nothing remembered", () => {
    expect(
      shouldClearSelectedCompanyId({
        companies: [],
        selectedCompanyId: null,
        storedCompanyId: null,
        isFetching: false,
      }),
    ).toBe(false);
  });
});
