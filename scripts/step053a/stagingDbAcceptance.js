import { strict as assert } from 'node:assert';
import {
  authorizeContactUnlockCheckout,
  createOrGetContactUnlockRequest,
  decideContactUnlockRequest,
  markContactUnlockRequestPaymentConfirmed
} from '../../src/db/contactUnlockRepo.js';
import {
  authorizeDmCheckout,
  createOrGetDmThreadDraft,
  decideDmThread,
  markDmThreadPaymentConfirmed,
  saveDmFirstMessageDraft
} from '../../src/db/dmRepo.js';
import {
  activateOrExtendProSubscription,
  createConfirmedPurchaseReceipt,
  findPurchaseReceiptByPaymentCharge,
  getProOutreachAllowance
} from '../../src/db/monetizationRepo.js';
import { getContactPolicyConfig, getPricingConfig } from '../../src/config/env.js';
import { CONTACT_POLICY_SNAPSHOT, PAID_CONTACT_MODE, TELEGRAM_STARS_CURRENCY } from '../../src/lib/contact/contract.js';
import {
  assertStagingTarget,
  createAcceptancePool,
  createEvidenceRecorder,
  getNodeRuntimeState,
  normalizeError,
  requireAcceptanceArtifactSha,
  withTransaction
} from './runtimeAcceptanceLib.js';

const pricingConfig = getPricingConfig();
const policyConfig = getContactPolicyConfig();
const CONTACT_PRICE = pricingConfig.contactUnlockPriceStars;
const DM_PRICE = pricingConfig.dmOpenPriceStars;
const PRO_LIMIT = policyConfig.proOutreachDailyLimit;
const COOLDOWN_DAYS = policyConfig.retryCooldownDays;
const CHECKOUT_RETRY_LOCK_SECONDS = policyConfig.checkoutRetryLockSeconds;
const CHECKOUT_TTL_MINUTES = policyConfig.checkoutAuthorizationTtlMinutes;

function fixturePrefix(runId) {
  return `step053a_${runId.replace(/[^a-zA-Z0-9]/g, '').slice(-20)}`.toLowerCase();
}

function fixtureTelegramId(runSeed, index) {
  return String(8_000_000_000_000_000n + BigInt(runSeed) * 100n + BigInt(index));
}

async function createFixtureMember(client, { runId, telegramUserId, label, contactMode = PAID_CONTACT_MODE }) {
  const username = `${fixturePrefix(runId)}_${label}`;
  const userResult = await client.query(
    `insert into users (telegram_user_id, telegram_username) values ($1, $2) returning id`,
    [telegramUserId, username]
  );
  const userId = userResult.rows[0].id;
  await client.query(
    `insert into linkedin_accounts (user_id, linkedin_sub, full_name, email_verified) values ($1, $2, $3, true)`,
    [userId, `step053a:${runId}:${label}`, `STEP053A ${label}`]
  );
  const profileResult = await client.query(
    `
      insert into member_profiles (
        user_id, display_name, headline_user, industry_user, about_user,
        telegram_username_hidden, visibility_status, contact_mode, profile_state
      )
      values ($1, $2, 'Staging acceptance fixture', 'Testing', 'STEP053A isolated fixture', $3, 'listed', $4, 'active')
      returning id
    `,
    [userId, `STEP053A ${label}`, `@${username}`, contactMode]
  );
  return { userId, profileId: profileResult.rows[0].id, telegramUserId, username };
}

async function seedFixtures(pool, runId) {
  const seed = Number(String(Date.now()).slice(-10));
  return withTransaction(pool, async (client) => {
    const requester = await createFixtureMember(client, { runId, telegramUserId: fixtureTelegramId(seed, 1), label: 'requester' });
    const introOnly = await createFixtureMember(client, { runId, telegramUserId: fixtureTelegramId(seed, 2), label: 'intro_only', contactMode: 'intro_request' });
    const paidTargets = [];
    const targetCount = Math.max(16, PRO_LIMIT + 6);
    for (let index = 0; index < targetCount; index += 1) {
      paidTargets.push(await createFixtureMember(client, {
        runId,
        telegramUserId: fixtureTelegramId(seed, 10 + index),
        label: `target_${index + 1}`
      }));
    }
    const proRequester = await createFixtureMember(client, { runId, telegramUserId: fixtureTelegramId(seed, 90), label: 'pro_requester' });
    await activateOrExtendProSubscription(client, { userId: proRequester.userId, durationDays: 1, source: 'step053a_fixture' });
    return { requester, introOnly, paidTargets, proRequester };
  });
}

async function cleanupFixtures(pool, runId) {
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `delete from users where left(telegram_username, length($1)) = $1 returning id`,
      [fixturePrefix(runId)]
    );
    return result.rowCount;
  });
}

async function createPaidContact(pool, requester, target, suffix) {
  const created = await withTransaction(pool, (client) => createOrGetContactUnlockRequest(client, {
    requesterUserId: requester.userId,
    targetProfileId: target.profileId,
    priceStars: CONTACT_PRICE,
    retryCooldownDays: COOLDOWN_DAYS
  }));
  assert.equal(created.created, true, `${suffix}: direct-contact request must be created`);
  const requestId = created.request.contact_unlock_request_id;
  const authorized = await withTransaction(pool, (client) => authorizeContactUnlockCheckout(client, {
    requestId,
    requesterUserId: requester.userId,
    retryCooldownDays: COOLDOWN_DAYS,
    checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
    currency: TELEGRAM_STARS_CURRENCY,
    totalAmount: CONTACT_PRICE
  }));
  assert.equal(authorized.authorized, true, `${suffix}: direct-contact checkout must authorize`);
  return { requestId, created, authorized };
}

async function createPaidDm(pool, requester, target, suffix) {
  const created = await withTransaction(pool, (client) => createOrGetDmThreadDraft(client, {
    initiatorUserId: requester.userId,
    targetProfileId: target.profileId,
    priceStars: DM_PRICE,
    retryCooldownDays: COOLDOWN_DAYS
  }));
  assert.equal(created.created, true, `${suffix}: DM draft must be created`);
  const threadId = created.thread.dm_thread_id;
  const drafted = await withTransaction(pool, (client) => saveDmFirstMessageDraft(client, {
    threadId,
    initiatorUserId: requester.userId,
    messageText: `STEP053A ${suffix} permission request`
  }));
  assert.equal(drafted.changed, true, `${suffix}: DM first message must be saved`);
  const authorized = await withTransaction(pool, (client) => authorizeDmCheckout(client, {
    threadId,
    initiatorUserId: requester.userId,
    retryCooldownDays: COOLDOWN_DAYS,
    checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
    currency: TELEGRAM_STARS_CURRENCY,
    totalAmount: DM_PRICE
  }));
  assert.equal(authorized.authorized, true, `${suffix}: DM checkout must authorize`);
  return { threadId, created, drafted, authorized };
}

async function deliverProContact(client, requester, target) {
  const allowance = await getProOutreachAllowance(client, { userId: requester.userId, dailyLimit: PRO_LIMIT, acquireLock: true });
  if (!allowance.allowed) return { allowance, delivered: false };
  const created = await createOrGetContactUnlockRequest(client, {
    requesterUserId: requester.userId,
    targetProfileId: target.profileId,
    priceStars: CONTACT_PRICE,
    retryCooldownDays: COOLDOWN_DAYS
  });
  assert.equal(created.created, true);
  const confirmed = await markContactUnlockRequestPaymentConfirmed(client, {
    requestId: created.request.contact_unlock_request_id,
    requesterUserId: requester.userId,
    telegramPaymentChargeId: null,
    providerPaymentChargeId: null,
    proCovered: true,
    checkoutAuthorizationTtlMinutes: CHECKOUT_TTL_MINUTES,
    retryCooldownDays: COOLDOWN_DAYS
  });
  assert.equal(confirmed.changed, true);
  return { allowance, delivered: true, type: 'contact', id: created.request.contact_unlock_request_id };
}

async function deliverProDm(client, requester, target, label) {
  const allowance = await getProOutreachAllowance(client, { userId: requester.userId, dailyLimit: PRO_LIMIT, acquireLock: true });
  if (!allowance.allowed) return { allowance, delivered: false };
  const created = await createOrGetDmThreadDraft(client, {
    initiatorUserId: requester.userId,
    targetProfileId: target.profileId,
    priceStars: DM_PRICE,
    retryCooldownDays: COOLDOWN_DAYS
  });
  assert.equal(created.created, true);
  const threadId = created.thread.dm_thread_id;
  const drafted = await saveDmFirstMessageDraft(client, {
    threadId,
    initiatorUserId: requester.userId,
    messageText: `STEP053A Pro ${label}`
  });
  assert.equal(drafted.changed, true);
  const confirmed = await markDmThreadPaymentConfirmed(client, {
    threadId,
    initiatorUserId: requester.userId,
    telegramPaymentChargeId: null,
    providerPaymentChargeId: null,
    proCovered: true,
    checkoutAuthorizationTtlMinutes: CHECKOUT_TTL_MINUTES,
    retryCooldownDays: COOLDOWN_DAYS
  });
  assert.equal(confirmed.changed, true);
  return { allowance, delivered: true, type: 'dm', id: threadId };
}

async function main() {
  const recorder = createEvidenceRecorder({ phase: 'database-runtime' });
  let pool = null;
  let fixtures = null;
  let mutationAuthorized = false;
  let databaseFingerprint = null;
  let artifactSha = null;
  try {
    const target = assertStagingTarget({ mutating: true });
    databaseFingerprint = target.fingerprint;
    artifactSha = requireAcceptanceArtifactSha();
    recorder.record('artifact_anchor', 'PASS', { summary: `Acceptance artifact ${artifactSha}`, artifactSha });
    recorder.record('mutation_guard', 'PASS', { summary: `Explicit staging mutation ACK accepted for ${target.fingerprint}`, database: target.identity });

    const runtime = getNodeRuntimeState();
    recorder.record('node20', runtime.canonical ? 'PASS' : 'FAIL', {
      summary: runtime.canonical ? `Canonical Node ${runtime.version}` : `Node ${runtime.version}; repository requires Node 20.x`
    });
    if (!runtime.canonical) throw new Error(`Node 20.x required; current runtime is ${runtime.version}`);

    mutationAuthorized = true;
    pool = createAcceptancePool({ max: 8 });

    fixtures = await seedFixtures(pool, recorder.runId);
    recorder.record('fixture_seed', 'PASS', { summary: `${2 + fixtures.paidTargets.length + 1} isolated members created`, runId: recorder.runId });

    const introContact = await withTransaction(pool, (client) => createOrGetContactUnlockRequest(client, {
      requesterUserId: fixtures.requester.userId,
      targetProfileId: fixtures.introOnly.profileId,
      priceStars: CONTACT_PRICE,
      retryCooldownDays: COOLDOWN_DAYS
    }));
    const introDm = await withTransaction(pool, (client) => createOrGetDmThreadDraft(client, {
      initiatorUserId: fixtures.requester.userId,
      targetProfileId: fixtures.introOnly.profileId,
      priceStars: DM_PRICE,
      retryCooldownDays: COOLDOWN_DAYS
    }));
    assert.equal(introContact.reason, 'target_profile_not_paid_unlock_mode');
    assert.equal(introDm.reason, 'target_profile_not_paid_unlock_mode');
    recorder.record('intro_only_authoritative', 'PASS', { summary: 'Both paid rails rejected by canonical repositories' });

    const contactCreated = await withTransaction(pool, (client) => createOrGetContactUnlockRequest(client, {
      requesterUserId: fixtures.requester.userId,
      targetProfileId: fixtures.paidTargets[0].profileId,
      priceStars: CONTACT_PRICE,
      retryCooldownDays: COOLDOWN_DAYS
    }));
    assert.equal(contactCreated.created, true);
    const contactRequestId = contactCreated.request.contact_unlock_request_id;

    const wrongCurrency = await withTransaction(pool, (client) => authorizeContactUnlockCheckout(client, {
      requestId: contactRequestId,
      requesterUserId: fixtures.requester.userId,
      retryCooldownDays: COOLDOWN_DAYS,
      checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
      currency: 'USD',
      totalAmount: CONTACT_PRICE
    }));
    assert.equal(wrongCurrency.reason, 'payment_currency_mismatch');
    const wrongAmount = await withTransaction(pool, (client) => authorizeContactUnlockCheckout(client, {
      requestId: contactRequestId,
      requesterUserId: fixtures.requester.userId,
      retryCooldownDays: COOLDOWN_DAYS,
      checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
      currency: TELEGRAM_STARS_CURRENCY,
      totalAmount: CONTACT_PRICE - 1
    }));
    assert.equal(wrongAmount.reason, 'payment_amount_mismatch');
    recorder.record('precheckout_currency_amount', 'PASS', { summary: 'Wrong currency and amount rejected before authorization' });

    const concurrentAuth = await Promise.all([
      withTransaction(pool, (client) => authorizeContactUnlockCheckout(client, {
        requestId: contactRequestId,
        requesterUserId: fixtures.requester.userId,
        retryCooldownDays: COOLDOWN_DAYS,
        checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
        currency: TELEGRAM_STARS_CURRENCY,
        totalAmount: CONTACT_PRICE
      })),
      withTransaction(pool, (client) => authorizeContactUnlockCheckout(client, {
        requestId: contactRequestId,
        requesterUserId: fixtures.requester.userId,
        retryCooldownDays: COOLDOWN_DAYS,
        checkoutRetryLockSeconds: CHECKOUT_RETRY_LOCK_SECONDS,
        currency: TELEGRAM_STARS_CURRENCY,
        totalAmount: CONTACT_PRICE
      }))
    ]);
    assert.equal(concurrentAuth.filter((item) => item.authorized).length, 1);
    assert.equal(concurrentAuth.filter((item) => item.reason === 'contact_checkout_already_in_progress').length, 1);
    recorder.record('concurrent_precheckout_serialization', 'PASS', { summary: 'Exactly one of two concurrent checkout callbacks authorized', results: concurrentAuth.map((item) => item.reason) });

    const contactCharge = `step053a-contact-${recorder.runId}`;
    const contactConfirmed = await withTransaction(pool, async (client) => {
      const confirmed = await markContactUnlockRequestPaymentConfirmed(client, {
        requestId: contactRequestId,
        requesterUserId: fixtures.requester.userId,
        telegramPaymentChargeId: contactCharge,
        providerPaymentChargeId: `provider-${contactCharge}`,
        currency: TELEGRAM_STARS_CURRENCY,
        totalAmount: CONTACT_PRICE,
        checkoutAuthorizationTtlMinutes: CHECKOUT_TTL_MINUTES,
        retryCooldownDays: COOLDOWN_DAYS
      });
      assert.equal(confirmed.changed, true);
      const receipt = await createConfirmedPurchaseReceipt(client, {
        userId: fixtures.requester.userId,
        receiptType: 'contact_unlock',
        productCode: 'contact_unlock_request_delivery',
        amountStars: CONTACT_PRICE,
        relatedEntityType: 'contact_unlock_request',
        relatedEntityId: contactRequestId,
        telegramPaymentChargeId: contactCharge,
        providerPaymentChargeId: `provider-${contactCharge}`,
        rawPayloadSnapshot: { acceptanceRunId: recorder.runId, feePolicy: CONTACT_POLICY_SNAPSHOT }
      });
      assert.equal(receipt.created, true);
      return confirmed;
    });
    assert.equal(contactConfirmed.reason, 'contact_unlock_payment_confirmed');
    recorder.record('contact_payment_transition', 'PASS', { summary: 'Paid request and canonical receipt created once' });

    const firstDecline = await withTransaction(pool, (client) => decideContactUnlockRequest(client, {
      userId: fixtures.paidTargets[0].userId,
      requestId: contactRequestId,
      decision: 'dec'
    }));
    const duplicateDecline = await withTransaction(pool, (client) => decideContactUnlockRequest(client, {
      userId: fixtures.paidTargets[0].userId,
      requestId: contactRequestId,
      decision: 'dec'
    }));
    assert.equal(firstDecline.changed, true);
    assert.equal(duplicateDecline.duplicate, true);
    const crossRailAfterDecline = await withTransaction(pool, (client) => createOrGetDmThreadDraft(client, {
      initiatorUserId: fixtures.requester.userId,
      targetProfileId: fixtures.paidTargets[0].profileId,
      priceStars: DM_PRICE,
      retryCooldownDays: COOLDOWN_DAYS
    }));
    assert.equal(crossRailAfterDecline.reason, 'dm_request_cooldown_active');
    recorder.record('decline_idempotency_and_cross_rail_cooldown', 'PASS', { summary: 'Duplicate decline is idempotent and DM bypass is blocked' });

    const paidDm = await createPaidDm(pool, fixtures.requester, fixtures.paidTargets[1], 'block-path');
    const dmCharge = `step053a-dm-${recorder.runId}`;
    await withTransaction(pool, async (client) => {
      const confirmed = await markDmThreadPaymentConfirmed(client, {
        threadId: paidDm.threadId,
        initiatorUserId: fixtures.requester.userId,
        telegramPaymentChargeId: dmCharge,
        providerPaymentChargeId: `provider-${dmCharge}`,
        currency: TELEGRAM_STARS_CURRENCY,
        totalAmount: DM_PRICE,
        checkoutAuthorizationTtlMinutes: CHECKOUT_TTL_MINUTES,
        retryCooldownDays: COOLDOWN_DAYS
      });
      assert.equal(confirmed.changed, true);
      const receipt = await createConfirmedPurchaseReceipt(client, {
        userId: fixtures.requester.userId,
        receiptType: 'dm_open',
        productCode: 'dm_permission_request_delivery',
        amountStars: DM_PRICE,
        relatedEntityType: 'dm_thread',
        relatedEntityId: paidDm.threadId,
        telegramPaymentChargeId: dmCharge,
        providerPaymentChargeId: `provider-${dmCharge}`,
        rawPayloadSnapshot: { acceptanceRunId: recorder.runId, feePolicy: CONTACT_POLICY_SNAPSHOT }
      });
      assert.equal(receipt.created, true);
    });
    const blocked = await withTransaction(pool, (client) => decideDmThread(client, {
      userId: fixtures.paidTargets[1].userId,
      threadId: paidDm.threadId,
      decision: 'blk'
    }));
    assert.equal(blocked.changed, true);
    const contactAfterBlock = await withTransaction(pool, (client) => createOrGetContactUnlockRequest(client, {
      requesterUserId: fixtures.requester.userId,
      targetProfileId: fixtures.paidTargets[1].profileId,
      priceStars: CONTACT_PRICE,
      retryCooldownDays: COOLDOWN_DAYS
    }));
    assert.equal(contactAfterBlock.reason, 'contact_path_blocked');
    recorder.record('block_closes_both_paid_rails', 'PASS', { summary: 'Recipient DM block prevents a new direct-contact request' });

    const replayTarget = fixtures.paidTargets[2];
    const replayContact = await createPaidContact(pool, fixtures.requester, replayTarget, 'replay-path');
    let replayError = null;
    try {
      await withTransaction(pool, (client) => markContactUnlockRequestPaymentConfirmed(client, {
        requestId: replayContact.requestId,
        requesterUserId: fixtures.requester.userId,
        telegramPaymentChargeId: contactCharge,
        providerPaymentChargeId: `provider-replay-${recorder.runId}`,
        currency: TELEGRAM_STARS_CURRENCY,
        totalAmount: CONTACT_PRICE,
        checkoutAuthorizationTtlMinutes: CHECKOUT_TTL_MINUTES,
        retryCooldownDays: COOLDOWN_DAYS
      }));
    } catch (error) {
      replayError = error;
    }
    assert.equal(replayError?.code, '23505');
    const canonicalReceipt = await withTransaction(pool, (client) => findPurchaseReceiptByPaymentCharge(client, { telegramPaymentChargeId: contactCharge }));
    assert.equal(String(canonicalReceipt.relatedEntityId), String(contactRequestId));
    const duplicateReceipt = await withTransaction(pool, (client) => createConfirmedPurchaseReceipt(client, {
      userId: fixtures.requester.userId,
      receiptType: 'contact_unlock',
      productCode: 'contact_unlock_request_delivery',
      amountStars: CONTACT_PRICE,
      relatedEntityType: 'contact_unlock_request',
      relatedEntityId: replayContact.requestId,
      telegramPaymentChargeId: contactCharge
    }));
    assert.equal(duplicateReceipt.duplicate, true);
    assert.equal(String(duplicateReceipt.receipt.relatedEntityId), String(contactRequestId));
    recorder.record('payment_charge_replay_guards', 'PASS', { summary: 'Entity unique index and canonical receipt both preserve original charge ownership', sqlState: replayError.code });

    const prefillCount = PRO_LIMIT - 1;
    for (let index = 0; index < prefillCount; index += 1) {
      const targetMember = fixtures.paidTargets[3 + index];
      await withTransaction(pool, (client) => index % 2 === 0
        ? deliverProContact(client, fixtures.proRequester, targetMember)
        : deliverProDm(client, fixtures.proRequester, targetMember, String(index + 1)));
    }
    const allowanceBeforeRace = await withTransaction(pool, (client) => getProOutreachAllowance(client, {
      userId: fixtures.proRequester.userId,
      dailyLimit: PRO_LIMIT,
      acquireLock: false
    }));
    assert.equal(allowanceBeforeRace.used, prefillCount);
    const raceTargetIndex = 3 + prefillCount;
    const proRace = await Promise.all([
      withTransaction(pool, (client) => deliverProContact(client, fixtures.proRequester, fixtures.paidTargets[raceTargetIndex])),
      withTransaction(pool, (client) => deliverProDm(client, fixtures.proRequester, fixtures.paidTargets[raceTargetIndex + 1], 'race'))
    ]);
    assert.equal(proRace.filter((item) => item.delivered).length, 1);
    assert.equal(proRace.filter((item) => item.allowance.reason === 'pro_outreach_daily_limit_reached').length, 1);
    const allowanceAfterRace = await withTransaction(pool, (client) => getProOutreachAllowance(client, {
      userId: fixtures.proRequester.userId,
      dailyLimit: PRO_LIMIT,
      acquireLock: false
    }));
    assert.deepEqual({ used: allowanceAfterRace.used, remaining: allowanceAfterRace.remaining, allowed: allowanceAfterRace.allowed }, { used: PRO_LIMIT, remaining: 0, allowed: false });
    recorder.record('pro_combined_allowance_concurrency', 'PASS', { summary: `Combined contact/DM allowance stopped at ${PRO_LIMIT} under concurrent limit/N+1 requests`, race: proRace.map((item) => ({ delivered: item.delivered, reason: item.allowance.reason })) });

    const auditCounts = await pool.query(
      `
        select
          (select count(*)::int from contact_unlock_events e join contact_unlock_requests r on r.id = e.request_id join users u on u.id = r.requester_user_id where left(u.telegram_username, length($1)) = $1) as contact_events,
          (select count(*)::int from member_dm_events e join member_dm_threads t on t.id = e.thread_id join users u on u.id = t.initiator_user_id where left(u.telegram_username, length($1)) = $1) as dm_events,
          (select count(*)::int from purchase_receipts pr join users u on u.id = pr.user_id where left(u.telegram_username, length($1)) = $1) as receipts
      `,
      [fixturePrefix(recorder.runId)]
    );
    const audit = auditCounts.rows[0] || {};
    assert.ok(Number(audit.contact_events) > 0);
    assert.ok(Number(audit.dm_events) > 0);
    assert.equal(Number(audit.receipts), 2);
    recorder.record('audit_trail_persisted', 'PASS', { summary: `${audit.contact_events} contact events, ${audit.dm_events} DM events, ${audit.receipts} receipts`, counts: audit });
  } catch (error) {
    recorder.record('database_runtime_exception', 'FAIL', { summary: error?.message || String(error), error: normalizeError(error) });
  } finally {
    if (mutationAuthorized && pool) {
      try {
        const deleted = await cleanupFixtures(pool, recorder.runId);
        const residual = await pool.query(`select count(*)::int as count from users where left(telegram_username, length($1)) = $1`, [fixturePrefix(recorder.runId)]);
        const clean = Number(residual.rows[0]?.count || 0) === 0;
        recorder.record('fixture_cleanup', clean ? 'PASS' : 'FAIL', { summary: `${deleted} fixture users deleted; residual=${residual.rows[0]?.count || 0}` });
      } catch (error) {
        recorder.record('fixture_cleanup', 'FAIL', { summary: error?.message || String(error), error: normalizeError(error) });
      }
    } else {
      recorder.record('fixture_cleanup', 'INFO', { summary: 'Not attempted because staging mutation guard was not satisfied' });
    }
    if (pool) await pool.end().catch(() => {});
    const output = recorder.write({ target: 'staging', databaseFingerprint, artifactSha });
    console.log(JSON.stringify({ verdict: output.payload.verdict, evidence: output.jsonPath }, null, 2));
    if (output.payload.verdict !== 'PASS') process.exitCode = 1;
  }
}

await main();
