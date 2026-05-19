const RATE_LIMIT_BUCKET_RETENTION_MS = 24 * 60 * 60 * 1000;

type MaintenanceResult = {
  authLoginTokensDeleted: number;
  authSessionsDeleted: number;
  rateLimitBucketsDeleted: number;
};

function getChangedRows(result: D1Result | undefined) {
  const metaChanges = result?.meta && "changes" in result.meta
    ? Number(result.meta.changes)
    : 0;

  return Number.isFinite(metaChanges) ? metaChanges : 0;
}

export async function runScheduledMaintenance(
  db: Pick<D1Database, "prepare" | "batch">,
  scheduledTime = Date.now(),
): Promise<MaintenanceResult> {
  const staleBucketCutoff = scheduledTime - RATE_LIMIT_BUCKET_RETENTION_MS;
  const results = await db.batch([
    db
      .prepare("delete from auth_login_tokens where expires_at <= ?")
      .bind(scheduledTime),
    db
      .prepare(
        "delete from auth_sessions where expires_at <= ? or revoked_at is not null",
      )
      .bind(scheduledTime),
    db
      .prepare("delete from rate_limit_buckets where updated_at <= ?")
      .bind(staleBucketCutoff),
  ]);

  return {
    authLoginTokensDeleted: getChangedRows(results[0]),
    authSessionsDeleted: getChangedRows(results[1]),
    rateLimitBucketsDeleted: getChangedRows(results[2]),
  };
}
