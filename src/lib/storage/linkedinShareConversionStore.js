import { isDatabaseConfigured, withDbClient } from '../../db/pool.js';
import { getSchemaCompat } from '../../db/schemaCompat.js';
import {
  listOwnerLinkedInShareConversionPosts,
  loadAdminLinkedInShareConversionSummary,
  loadOwnerLinkedInShareConversionPost,
  loadOwnerLinkedInShareConversionSummary
} from '../../db/linkedinShareConversionRepo.js';

function num(value) { return Number(value || 0) || 0; }
function rate(numerator, denominator) {
  const n = num(numerator); const d = num(denominator);
  return d > 0 ? Math.min(100, Math.round((n / d) * 1000) / 10) : 0;
}
function normalizeMetrics(row = {}) {
  const metrics = {
    publishedPosts: num(row.published_posts), totalOpens: num(row.total_opens), uniqueOpens: num(row.unique_opens),
    uniqueStarted: num(row.unique_started), submittedRequests: num(row.submitted_requests), uniqueSubmitted: num(row.unique_submitted),
    approvedRequests: num(row.approved_requests), uniqueApproved: num(row.unique_approved),
    publishedPosts7d: num(row.published_posts_7d), uniqueOpens7d: num(row.unique_opens_7d),
    uniqueSubmitted7d: num(row.unique_submitted_7d), uniqueApproved7d: num(row.unique_approved_7d),
    lastPublishedAt: row.last_published_at || null, lastEventAt: row.last_event_at || null
  };
  return { ...metrics, openToRequestPct: rate(metrics.uniqueSubmitted, metrics.uniqueOpens), requestToApprovalPct: rate(metrics.uniqueApproved, metrics.uniqueSubmitted) };
}
function normalizePost(row = {}) {
  const post = {
    publicToken: row.public_token || null, providerPostId: row.provider_post_id || null, publishedAt: row.published_at || null,
    totalOpens: num(row.total_opens), uniqueOpens: num(row.unique_opens), uniqueStarted: num(row.unique_started),
    submittedRequests: num(row.submitted_requests), uniqueSubmitted: num(row.unique_submitted),
    approvedRequests: num(row.approved_requests), uniqueApproved: num(row.unique_approved), lastEventAt: row.last_event_at || null,
    ownerName: row.owner_name || null,
    recentEvents: Array.isArray(row.recent_events) ? row.recent_events.map((event) => ({ eventType: event.event_type, createdAt: event.created_at })) : []
  };
  return { ...post, openToRequestPct: rate(post.uniqueSubmitted, post.uniqueOpens), requestToApprovalPct: rate(post.uniqueApproved, post.uniqueSubmitted) };
}
function unavailable(reason = 'DATABASE_URL is not configured') { return { persistenceEnabled: false, ready: false, metrics: normalizeMetrics(), posts: [], reason }; }

export async function loadLinkedInShareConversionDashboardForTelegramUser({ telegramUserId, limit = 5 }) {
  if (!isDatabaseConfigured()) return unavailable();
  try {
    return await withDbClient(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) return { ...unavailable('migration_038_required'), persistenceEnabled: true };
      const [summary, posts] = await Promise.all([
        loadOwnerLinkedInShareConversionSummary(client, telegramUserId),
        listOwnerLinkedInShareConversionPosts(client, { telegramUserId, limit })
      ]);
      return { persistenceEnabled: true, ready: true, metrics: normalizeMetrics(summary), posts: posts.map(normalizePost), reason: 'linkedin_share_conversion_dashboard_loaded' };
    });
  } catch (error) {
    console.warn('[linkedin share conversion] dashboard load failed', error?.message || error);
    return { ...unavailable('linkedin_share_conversion_dashboard_failed'), persistenceEnabled: true };
  }
}

export async function loadLinkedInShareConversionPostForTelegramUser({ telegramUserId, publicToken }) {
  if (!isDatabaseConfigured()) return unavailable();
  try {
    return await withDbClient(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) return { ...unavailable('migration_038_required'), persistenceEnabled: true };
      const post = await loadOwnerLinkedInShareConversionPost(client, { telegramUserId, publicToken });
      return { persistenceEnabled: true, ready: true, post: post ? normalizePost(post) : null, reason: post ? 'linkedin_share_conversion_post_loaded' : 'linkedin_share_conversion_post_not_found' };
    });
  } catch (error) {
    console.warn('[linkedin share conversion] post load failed', error?.message || error);
    return { ...unavailable('linkedin_share_conversion_post_failed'), persistenceEnabled: true, post: null };
  }
}

export async function loadAdminLinkedInShareConversionDashboard() {
  if (!isDatabaseConfigured()) return unavailable();
  try {
    return await withDbClient(async (client) => {
      const compat = await getSchemaCompat(client);
      if (!compat.linkedInShareAttributionReady) return { ...unavailable('migration_038_required'), persistenceEnabled: true };
      const state = await loadAdminLinkedInShareConversionSummary(client, { limit: 5 });
      const metrics = normalizeMetrics(state.summary);
      metrics.publishingOwners = num(state.summary?.publishing_owners);
      return { persistenceEnabled: true, ready: true, metrics, posts: state.recent_posts.map(normalizePost), reason: 'admin_linkedin_share_conversion_dashboard_loaded' };
    });
  } catch (error) {
    console.warn('[linkedin share conversion] admin dashboard load failed', error?.message || error);
    return { ...unavailable('admin_linkedin_share_conversion_dashboard_failed'), persistenceEnabled: true };
  }
}
