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
      ) as has_contact_unlock_events_table,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'linkedin_verification_snapshots'
      ) as has_linkedin_verification_snapshots_table,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'linkedin_share_intents'
      ) as has_linkedin_share_intents_table,
      exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'linkedin_share_events'
      ) as has_linkedin_share_events_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_preferences') as has_ai_news_preferences_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_sources') as has_ai_news_sources_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_drafts') as has_ai_news_drafts_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_draft_events') as has_ai_news_draft_events_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_input_sessions') as has_ai_news_input_sessions_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_presets') as has_ai_news_presets_table,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_preset_runs') as has_ai_news_preset_runs_table,
      exists (select 1 from information_schema.columns where table_schema=current_schema() and table_name='ai_news_drafts' and column_name='preset_run_id') as ai_news_drafts_has_preset_run_id,
      exists (select 1 from information_schema.tables where table_schema=current_schema() and table_name='ai_news_provider_usage_events') as has_ai_news_provider_usage_events_table,
      exists (select 1 from information_schema.columns where table_schema=current_schema() and table_name='ai_news_drafts' and column_name='openai_total_tokens') as ai_news_drafts_has_openai_usage,
      exists (select 1 from information_schema.columns where table_schema=current_schema() and table_name='ai_news_sources' and column_name='source_authority_score') as ai_news_sources_has_quality_metadata,
      exists (select 1 from information_schema.columns where table_schema=current_schema() and table_name='linkedin_share_intents' and column_name='source_kind') as linkedin_share_has_source_kind
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
    hasContactUnlockEventsTable: Boolean(result.rows[0]?.has_contact_unlock_events_table),
    hasLinkedInVerificationSnapshotsTable: Boolean(result.rows[0]?.has_linkedin_verification_snapshots_table),
    hasLinkedInShareIntentsTable: Boolean(result.rows[0]?.has_linkedin_share_intents_table),
    hasLinkedInShareEventsTable: Boolean(result.rows[0]?.has_linkedin_share_events_table),
    hasAiNewsPreferencesTable: Boolean(result.rows[0]?.has_ai_news_preferences_table),
    hasAiNewsSourcesTable: Boolean(result.rows[0]?.has_ai_news_sources_table),
    hasAiNewsDraftsTable: Boolean(result.rows[0]?.has_ai_news_drafts_table),
    hasAiNewsDraftEventsTable: Boolean(result.rows[0]?.has_ai_news_draft_events_table),
    hasAiNewsInputSessionsTable: Boolean(result.rows[0]?.has_ai_news_input_sessions_table),
    hasAiNewsPresetsTable: Boolean(result.rows[0]?.has_ai_news_presets_table),
    hasAiNewsPresetRunsTable: Boolean(result.rows[0]?.has_ai_news_preset_runs_table),
    aiNewsDraftsHasPresetRunId: Boolean(result.rows[0]?.ai_news_drafts_has_preset_run_id),
    hasAiNewsProviderUsageEventsTable: Boolean(result.rows[0]?.has_ai_news_provider_usage_events_table),
    aiNewsDraftsHasOpenAiUsage: Boolean(result.rows[0]?.ai_news_drafts_has_openai_usage),
    aiNewsSourcesHasQualityMetadata: Boolean(result.rows[0]?.ai_news_sources_has_quality_metadata),
    linkedInShareHasSourceKind: Boolean(result.rows[0]?.linkedin_share_has_source_kind)
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
