const schemaCompatCache = new WeakMap();

export async function getSchemaCompat(client) {
  if (schemaCompatCache.has(client)) {
    return schemaCompatCache.get(client);
  }

  const result = await client.query(`
    select
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'member_profiles'
          and column_name = 'telegram_username_hidden'
      ) as member_profiles_has_hidden_telegram_username,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'contact_unlock_requests'
      ) as has_contact_unlock_requests_table,
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'contact_unlock_requests'
          and column_name = 'pro_covered'
      ) as contact_unlock_has_pro_covered,
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'contact_unlock_requests'
          and column_name = 'checkout_authorized_at'
      ) as contact_unlock_has_checkout_authorized_at,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'member_dm_threads'
      ) as has_member_dm_threads_table,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'member_dm_events'
      ) as has_member_dm_events_table,
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'member_dm_threads'
          and column_name = 'contact_policy_snapshot'
      ) as dm_threads_has_contact_policy_snapshot,
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'member_dm_threads'
          and column_name = 'pro_covered'
      ) as dm_threads_has_pro_covered,
      exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'member_dm_threads'
          and column_name = 'checkout_authorized_at'
      ) as dm_threads_has_checkout_authorized_at,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'contact_unlock_events'
      ) as has_contact_unlock_events_table
  `);

  const compat = {
    memberProfilesHasHiddenTelegramUsername: Boolean(result.rows[0]?.member_profiles_has_hidden_telegram_username),
    hasContactUnlockRequestsTable: Boolean(result.rows[0]?.has_contact_unlock_requests_table),
    contactUnlockHasProCovered: Boolean(result.rows[0]?.contact_unlock_has_pro_covered),
    contactUnlockHasCheckoutAuthorizedAt: Boolean(result.rows[0]?.contact_unlock_has_checkout_authorized_at),
    hasMemberDmThreadsTable: Boolean(result.rows[0]?.has_member_dm_threads_table),
    hasMemberDmEventsTable: Boolean(result.rows[0]?.has_member_dm_events_table),
    dmThreadsHasContactPolicySnapshot: Boolean(result.rows[0]?.dm_threads_has_contact_policy_snapshot),
    dmThreadsHasProCovered: Boolean(result.rows[0]?.dm_threads_has_pro_covered),
    dmThreadsHasCheckoutAuthorizedAt: Boolean(result.rows[0]?.dm_threads_has_checkout_authorized_at),
    hasContactUnlockEventsTable: Boolean(result.rows[0]?.has_contact_unlock_events_table)
  };

  schemaCompatCache.set(client, compat);
  return compat;
}

export function selectHiddenTelegramUsername(alias, compat) {
  if (compat?.memberProfilesHasHiddenTelegramUsername) {
    return `${alias}.telegram_username_hidden`;
  }

  return `null::text`;
}
