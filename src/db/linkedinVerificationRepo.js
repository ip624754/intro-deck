export async function upsertLinkedInVerificationSnapshot(client, { linkedinAccountId, snapshot }) {
  const result = await client.query(
    `
      insert into linkedin_verification_snapshots (
        linkedin_account_id,
        api_member_id,
        verification_categories,
        identity_verified,
        workplace_verified,
        verification_state,
        verification_url_offered,
        source_tier,
        identity_api_version,
        report_api_version,
        profile_last_refreshed_at,
        synced_at,
        updated_at
      )
      values (
        $1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, $11, $12, now()
      )
      on conflict (linkedin_account_id)
      do update set
        api_member_id = excluded.api_member_id,
        verification_categories = excluded.verification_categories,
        identity_verified = excluded.identity_verified,
        workplace_verified = excluded.workplace_verified,
        verification_state = excluded.verification_state,
        verification_url_offered = excluded.verification_url_offered,
        source_tier = excluded.source_tier,
        identity_api_version = excluded.identity_api_version,
        report_api_version = excluded.report_api_version,
        profile_last_refreshed_at = excluded.profile_last_refreshed_at,
        synced_at = excluded.synced_at,
        updated_at = now()
      returning *
    `,
    [
      linkedinAccountId,
      snapshot.apiMemberId,
      snapshot.verificationCategories,
      Boolean(snapshot.identityVerified),
      Boolean(snapshot.workplaceVerified),
      snapshot.verificationState,
      Boolean(snapshot.verificationUrlOffered),
      snapshot.sourceTier,
      snapshot.identityApiVersion,
      snapshot.reportApiVersion,
      snapshot.profileLastRefreshedAt,
      snapshot.syncedAt
    ]
  );

  return result.rows[0];
}

export async function getLinkedInVerificationSnapshotByAccountId(client, linkedinAccountId) {
  const result = await client.query(
    `
      select *
      from linkedin_verification_snapshots
      where linkedin_account_id = $1
      limit 1
    `,
    [linkedinAccountId]
  );

  return result.rows[0] || null;
}
