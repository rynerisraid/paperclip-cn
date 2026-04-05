import {
  cleanupStaleEmbeddedPostgresTestRegistrations,
  prepareEmbeddedPostgresTestSupport,
} from "./embedded-postgres-manager.js";

export default async function globalSetup() {
  await cleanupStaleEmbeddedPostgresTestRegistrations();
  await prepareEmbeddedPostgresTestSupport();
}
