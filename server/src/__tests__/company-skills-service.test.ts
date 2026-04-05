import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  companySkills,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@penclipai/db";
import { companySkillService } from "../services/company-skills.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company-skills service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companySkillService company guards", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companySkillService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-skills-service-");
    db = createDb(tempDb.connectionString);
    svc = companySkillService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(companySkills);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("returns not found when listing skills for a missing company", async () => {
    const missingCompanyId = randomUUID();

    await expect(svc.list(missingCompanyId)).rejects.toMatchObject({
      status: 404,
      message: "Company not found",
    });

    const rows = await db.select().from(companySkills);
    expect(rows).toEqual([]);
  });
});
