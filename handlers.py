#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обработчики команд и callback запросов для Telegram бота
"""

import logging
import re
import os
from urllib.parse import urlencode
from telegram import Update, Bot, ChatMemberAdministrator, ChatMemberOwner, InlineQueryResultArticle, InputTextMessageContent, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.error import BadRequest, Forbidden
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta, timezone
import asyncio
from functools import wraps
from cryptopay import create_ton_invoice, get_invoice_status
import math
import inspect
from html import escape
from rate_limiter import rate_limit, check_rate_limit
import database
from services.share_preview import (
    append_preview_link,
    build_preview_url,
    link_preview_api_kwargs,
)


def render_progress_bar(progress: int, width: int = 10) -> str:
    """Премиум прогресс-бар с оранжевым цветом (как у топовых приложений)."""
    if not isinstance(progress, (int, float)):
        logger.warning(f"render_progress_bar: non-numeric progress value {progress!r}, defaulting to 0")
        progress = 0
    else:
        progress = int(progress)
    progress = max(0, min(100, progress))
    filled = max(0, min(width, progress // 10))
    empty = width - filled
    return "🟧" * filled + "⬜" * empty


from database import (
    cleanup_expired_user_runtime_states, clear_user_runtime_state, create_or_update_user,
    get_connection, get_room_message_id, get_setting, get_user_balance,
    get_user_runtime_state, get_user_stats, get_waiting_games, get_active_game, get_game_by_id,
    set_room_message_id, set_user_runtime_state, update_game_roll, update_user_balance,
    get_user_menu_mode, set_user_menu_mode,
    get_last_bet, save_last_bet, get_waiting_games_with_range,
    get_user_language, set_user_language,
)


def get_t(user_id: int):
    """Return a translator for *user_id* — for use in background tasks without context.user_data.
    Reads language from DB; falls back to 'en' on any error.
    """
    from services.i18n import get_translator
    try:
        lang = get_user_language(user_id)
    except Exception:
        lang = "en"
    return get_translator(lang or "en")

from services.games import (
    create_game_with_reservation,
    join_game_with_reservation,
    cancel_waiting_game,
    cancel_active_game_by_user,
    settle_game,
    settle_timeout_game,
    is_tournament_no_payout_game,
)
from services.duel_timeout_policy import (
    ACTIVE_ROLL_SECONDS,
    DEMO_ACTIVE_SECONDS,
    DEMO_WAITING_SECONDS,
    ROLL_REMINDER_AFTER_SECONDS,
    as_utc,
    format_mm_ss,
    seconds_remaining,
    utcnow,
)
from services.payments import create_invoice_record, apply_paid_invoice, update_invoice_status, get_invoice_credit_state, get_active_unpaid_invoice_for_user
from services.quick_duel import quick_duel_match
from services.duel_series import (
    DUEL_FORMAT_BEST_OF_3,
    DUEL_FORMAT_SINGLE,
    is_series_format,
    normalize_duel_format,
    record_series_roll,
)
from services.practice_series import (
    get_practice_series_rounds,
    record_practice_series_roll,
)
from services import tournaments as tournament_service
from services import settings as platform_settings, risk as risk_service
from services.withdrawals import create_withdrawal_request, approve_withdrawal, reject_withdrawal, mark_withdrawal_processing, get_withdrawal_request, get_effective_gram_withdrawal_minimum
from services.referrals import (
    attempt_referral_attribution, get_referral_snapshot, parse_share_start_param,
    get_referral_dashboard, get_referral_list, get_invite_link
)
from services import acquisition as acquisition_service
from services.acquisition import parse_acquisition_start_param, record_start_touch
from services.workspaces import (
    WorkspaceError,
    activate_connect_request,
    create_connect_request,
    disconnect_workspace,
    get_workspace_detail,
    list_workspaces_for_user,
    publish_open_duel_to_default_workspace,
    publish_result_to_default_workspaces,
    publish_test_post,
    set_default_workspace,
    set_workspace_default_scope,
    toggle_workspace_setting,
)
from services.workspace_publish import WorkspacePublishError, publish_workspace_leaderboard_post
from services.leaderboards import get_leaderboard_snapshot
from services.giveaways import (
    GiveawayError,
    activate_giveaway,
    cancel_giveaway,
    create_giveaway_draft,
    draw_giveaway_winners,
    end_giveaway,
    get_giveaway_by_id,
    get_giveaway_owner_snapshot,
    get_giveaway_public_snapshot,
    get_public_giveaways_list,
    get_workspace_giveaway_for_owner,
    join_giveaway_public,
    mark_giveaway_post_published,
    mark_results_published,
    set_giveaway_public,
    update_giveaway_core,
    update_giveaway_launch_rules,
    check_user_subscriptions,
    evaluate_giveaway_entry_eligibility,
    finalize_giveaway_with_notify,
    get_user_giveaway_participations,
    notify_winners,
    list_giveaway_workspace_overview,
    list_workspace_giveaway_history,
)
from services.practice import (
    PRACTICE_MIN_STAKE,
    PRACTICE_START_BALANCE,
    can_restore_practice_balance,
    cancel_active_practice_game_by_user,
    cancel_waiting_practice_game,
    create_or_join_practice_rematch,
    create_practice_game,
    expire_waiting_practice_game,
    get_active_practice_game,
    get_practice_balance,
    get_practice_game_by_id,
    get_practice_join_preview,
    get_practice_room_message_id,
    get_practice_result_share_payload,
    get_practice_share_payload,
    get_practice_stats,
    get_recoverable_practice_games,
    get_waiting_practice_games,
    join_practice_game,
    restore_practice_balance,
    set_practice_room_message_id,
    store_pending_demo_mode_start,
    store_pending_practice_start,
    settle_practice_game,
    update_practice_game_roll,
)
from services.real_mode import get_balance_snapshot, get_real_mode_readiness
from services.start_intents import clear_start_intent, pop_start_intent
from services.social import get_duel_history, get_duel_share_payload, get_profile_snapshot, get_result_share_payload
from admin import read_models as admin_read_models
from services import broadcasts as broadcast_service, notices as notice_service, comms_callbacks
from game_logic import (
    validate_bet_amount, determine_winner, format_game_result,
    get_dice_emoji, format_balance_display, get_random_game_message,
    generate_roll_commit, reveal_and_verify
)
from keyboards import (
    get_main_menu_keyboard, get_game_keyboard, get_bet_amount_keyboard, get_duel_format_keyboard, get_practice_duel_format_keyboard,
    get_waiting_games_keyboard, get_game_created_keyboard,
    get_game_confirmation_keyboard, get_balance_keyboard, get_stats_keyboard,
    remove_reply_keyboard, get_back_button, get_back_to_main_keyboard,
    get_admin_panel_keyboard, get_admin_shortcuts_keyboard, get_admin_user_keyboard, get_admin_users_back_keyboard,
    get_admin_broadcast_detail_keyboard, get_admin_notice_detail_keyboard, get_notice_view_keyboard,
    get_admin_settings_keyboard, get_yes_no_keyboard,
    get_help_keyboard, get_support_keyboard, get_support_entry_keyboard, get_support_active_keyboard,
    get_community_keyboard,
    get_referral_keyboard, get_profile_keyboard,
    get_open_app_keyboard, get_workspace_list_keyboard, get_workspace_settings_keyboard,
    get_workspace_connect_keyboard, get_workspace_disconnect_confirm_keyboard,
    get_giveaway_detail_keyboard, get_giveaway_confirm_keyboard, get_giveaway_edit_prompt_keyboard,
    get_giveaway_dashboard_keyboard, get_giveaway_group_dashboard_keyboard, get_giveaway_history_keyboard,
    get_public_giveaway_join_keyboard, get_public_giveaway_result_keyboard,
    get_leaderboard_keyboard, get_open_bot_keyboard,
    get_practice_balance_keyboard, get_practice_bet_amount_keyboard,
    get_practice_game_confirmation_keyboard, get_practice_game_created_keyboard,
    get_practice_result_actions_keyboard,
    get_practice_menu_keyboard, get_waiting_practice_games_keyboard,
    get_insufficient_balance_keyboard, get_duel_history_keyboard, get_result_actions_keyboard,
    get_deposit_invoice_keyboard,
    get_existing_unpaid_invoice_keyboard,
    get_invite_card_keyboard, get_invite_main_keyboard,
)

logger = logging.getLogger(__name__)

class PersistentUserStates:
    """DB-backed runtime state storage with dict-like ergonomics."""

    def get(self, user_id: int, default=None):
        row = get_user_runtime_state(user_id)
        if not row:
            return default
        return row.get("state_key") or default

    def __setitem__(self, user_id: int, state_key: str) -> None:
        set_user_runtime_state(user_id, state_key, ttl_seconds=_state_ttl_seconds(state_key))

    def pop(self, user_id: int, default=None):
        existing = self.get(user_id, default)
        clear_user_runtime_state(user_id)
        return existing


def _state_ttl_seconds(state_key: str | None) -> int:
    key = str(state_key or "")
    if key.startswith("admin_waiting_broadcast") or key.startswith("admin_bc_") or key.startswith("admin_notice_"):
        return 15 * 60
    if key.startswith("admin_waiting_"):
        return 20 * 60
    if key.startswith("gw_edit_"):
        return 2 * 60 * 60
    if key.startswith("waiting_"):
        return 30 * 60
    return 45 * 60


user_states = PersistentUserStates()

# Словарь для хранения локальных job-ссылок: timers[scope_key][user_id] = {'reminder': job, 'timeout': job}
timers = {}
scheduler = AsyncIOScheduler()
_broadcast_runtime_bot: Bot | None = None

# ============================================================================
# ADMIN PANEL CACHE (FIX #1: Prevent menu jumping)
# ============================================================================
import time
_admin_cache = {}

def invalidate_admin_overview_cache(user_id: int) -> None:
    """Drop one operator overview cache entry before explicit refresh."""
    _admin_cache.pop(f"overview:{int(user_id)}", None)


def get_admin_overview_cached(user_id: int, *, force_refresh: bool = False) -> str:
    """Returns cached admin overview text (refreshed every 5 seconds).

    FIX: Prevents menu from jumping on every click by caching the
    rendered text for a short period. Explicit refresh bypasses the cache.
    """
    now = time.time()
    cache_key = f"overview:{int(user_id)}"
    cached = _admin_cache.get(cache_key)

    # Return cache if fresh (TTL = 5 seconds), unless operator asked for refresh.
    if not force_refresh and cached and (now - cached['ts']) < 5:
        return cached['text']

    # Generate new text
    text = _render_tg_admin_overview_text(user_id)

    # Update cache per admin to avoid cross-operator cache leakage.
    _admin_cache[cache_key] = {
        'text': text,
        'ts': now
    }

    return text


async def _process_broadcast_delivery_tick() -> None:
    # STEP_SCHEDULER_SINGLE_LEADER_GUARD_097: guards against duplicate
    # execution if this ever runs on more than one Railway replica.
    # No-op on SQLite (dev/test); real advisory lock on Postgres.
    with database.scheduler_job_lock("broadcast-delivery-tick") as acquired:
        if not acquired:
            return
        if _broadcast_runtime_bot is None:
            return
        try:
            await broadcast_service.process_active_broadcasts(
                _broadcast_runtime_bot,
                batch_size=max(1, min(int(os.getenv("ADMIN_BROADCAST_BATCH_SIZE", "25") or "25"), 50)),
            )
        except Exception:
            logger.exception("Broadcast delivery tick failed")


def init_runtime_scheduler(bot: Bot | None = None) -> None:
    global _broadcast_runtime_bot
    if bot is not None:
        _broadcast_runtime_bot = bot
        from services.community_duel_feed import register_runtime_bot
        register_runtime_bot(bot)
    if not scheduler.running:
        scheduler.start()
        logger.info("Runtime scheduler started")
    if scheduler.get_job("broadcast-delivery-tick") is None:
        scheduler.add_job(
            _process_broadcast_delivery_tick,
            trigger="interval",
            minutes=15,  # было seconds=15 → теперь 15 минут
            id="broadcast-delivery-tick",
            replace_existing=True,
        )

    # Отложенная активация giveaways
    if scheduler.get_job("giveaway-scheduled-activation") is None:
        scheduler.add_job(
            _activate_scheduled_giveaways_tick,
            trigger="interval",
            minutes=30,  # было 5 → теперь 30 минут
            id="giveaway-scheduled-activation",
            replace_existing=True,
        )

    # ── Tournament reconciliation (Stage 3B) ──
    # STEP-FAST-RUNTIME-JOBS-EVENT-DRIVEN-WAKEUP-001: was minutes=5, which
    # NEON_RULES.md's own rule ("новые scheduled jobs — минимум 10 минут")
    # never covered (added after that table was last updated). At 5 min,
    # this alone would have kept Neon compute awake even after removing the
    # fast loop's 20s polling. Bumped to 15 min to match the sibling
    # slow-reconciliation-tick/broadcast-delivery-tick jobs.
    #
    # SLA change, accepted explicitly (this job cancels stale forming
    # tournaments and releases participant reservations -- money-adjacent):
    #   forming timeout:  up to 60 min configured deadline + up to 15 min
    #                      scheduler lag (was: + up to 5 min lag)
    #   match timeout:     up to 30 min configured deadline + up to 15 min
    #                      scheduler lag (was: + up to 5 min lag)
    if scheduler.get_job("tournament-reconciliation") is None:
        scheduler.add_job(
            _tournament_reconciliation_tick,
            trigger="interval",
            minutes=15,
            id="tournament-reconciliation",
            replace_existing=True,
        )

    # ── VIP subscription expiry (Stage 3C) ──
    if scheduler.get_job("vip-expiry-check") is None:
        scheduler.add_job(
            _vip_expiry_tick,
            trigger="interval",
            minutes=30,
            id="vip-expiry-check",
            replace_existing=True,
        )

    # ── Slow reconciliation loop (STEP-107F) ──
    # invoice_reconcile (rare webhook-backup poll + STEP-107D4 give-up),
    # Jetton deposit check, and practice-game cleanup -- moved off the 20s
    # fast reconciliation_worker() loop per live Neon evidence (STEP-107E):
    # these were the primary driver of background compute cost, with no
    # real latency benefit (invoice_reconcile completed only 12 times ever
    # via this backup path; webhook is the primary, near-instant path).
    # 15-minute interval per NEON_RULES.md ("новые scheduled jobs —
    # минимум 10 минут интервал, предпочтительно 15-30").
    if scheduler.get_job("slow-reconciliation-tick") is None:
        scheduler.add_job(
            _slow_reconciliation_tick,
            trigger="interval",
            minutes=15,
            id="slow-reconciliation-tick",
            replace_existing=True,
        )


async def _activate_scheduled_giveaways_tick(context=None) -> None:
    """Background task: activate scheduled giveaways + auto-draw expired ones with winner notifications."""
    with database.scheduler_job_lock("giveaway-scheduled-activation") as acquired:
        if not acquired:
            return
        try:
            from services.giveaways import activate_scheduled_giveaways, check_and_auto_draw_giveaways
            activated = activate_scheduled_giveaways()
            if activated > 0:
                logger.info("Auto-activated %d scheduled giveaways", activated)
            bot = context.bot if context and hasattr(context, "bot") else None
            drawn = await check_and_auto_draw_giveaways(bot=bot)
            if drawn > 0:
                logger.info("Auto-drew %d expired giveaways", drawn)
        except Exception:
            logger.exception("Scheduled giveaway tick failed")


async def _tournament_reconciliation_tick(context=None) -> None:
    """Background task: reconcile stale tournaments (Stage 3B).

    Auto-cancels forming tournaments past their deadline_at.
    Auto-progresses stale in_progress matches via coin flip.
    Runs every 15 minutes (STEP-FAST-RUNTIME-JOBS-EVENT-DRIVEN-WAKEUP-001;
    was 5 minutes).
    """
    with database.scheduler_job_lock("tournament-reconciliation") as acquired:
        if not acquired:
            return
        try:
            from services.tournaments import reconcile_stale_tournaments
            result = reconcile_stale_tournaments()
            if result.get("cancelled_forming", 0) > 0 or result.get("progressed_matches", 0) > 0:
                logger.info(
                    "Tournament reconciliation: cancelled=%d forming, progressed=%d matches",
                    result.get("cancelled_forming", 0),
                    result.get("progressed_matches", 0),
                )
            if result.get("errors"):
                for err in result["errors"][:3]:
                    logger.warning("Tournament reconciliation error: %s", err)
        except Exception:
            logger.exception("Tournament reconciliation tick failed")


async def _vip_expiry_tick(context=None) -> None:
    """Background task: expire VIP subscriptions past their expiry date (Stage 3C).

    Runs every 30 minutes.
    """
    with database.scheduler_job_lock("vip-expiry-check") as acquired:
        if not acquired:
            return
        try:
            from services.vip import expire_vip_subscriptions
            result = expire_vip_subscriptions()
            if result.get("expired_count", 0) > 0:
                logger.info("VIP expiry tick: expired %d subscriptions", result["expired_count"])
        except Exception:
            logger.exception("VIP expiry tick failed")


async def _slow_reconciliation_tick(context=None) -> None:
    """Background task: non-latency-sensitive reconciliation (STEP-107F).

    Runs services.reconciliation.process_slow_runtime_jobs() -- invoice
    backup-poll/give-up, Jetton deposit check, practice-game cleanup.
    Runs every 15 minutes. Deliberately separate from the 20-second
    reconciliation_worker() fast loop (withdrawal_reconcile,
    duel_timeout_check, stuck_game_reconcile), which remains unchanged.
    """
    with database.scheduler_job_lock("slow-reconciliation-tick") as acquired:
        if not acquired:
            return
        try:
            from services.reconciliation import process_slow_runtime_jobs
            result = await process_slow_runtime_jobs()
            if result.get("processed", 0) or result.get("failures", 0):
                logger.info(
                    "Slow reconciliation tick: processed=%d failures=%d",
                    result.get("processed", 0),
                    result.get("failures", 0),
                )
        except Exception:
            logger.exception("Slow reconciliation tick failed")


def shutdown_runtime_scheduler() -> None:
    global _broadcast_runtime_bot
    try:
        from services.community_duel_feed import unregister_runtime_bot
        unregister_runtime_bot(_broadcast_runtime_bot)
    except Exception:
        logger.exception("Failed to unregister community runtime bot cleanly")
    _broadcast_runtime_bot = None
    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            logger.exception("Failed to stop runtime scheduler cleanly")


async def restore_active_game_timers(bot: Bot):
    """Restore authoritative DB-deadline timers after a process restart.

    ``games.deadline_at`` is the source of truth. The ``started_at`` fallback
    exists only for legacy rows. Trade-off: already-overdue games are staggered
    by up to 30 seconds to avoid a DB/Telegram storm during process startup.
    """
    from database import get_connection

    _STAGGER_PER_GAME = 2
    _STAGGER_CAP = 30
    now = utcnow()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT game_id, player1_id, player2_id, started_at, deadline_at
            FROM games
            WHERE status = 'active'
              AND player2_id IS NOT NULL
            """
        ).fetchall()

    overdue_index = 0
    for row in rows:
        game_id = int(row["game_id"])
        p1 = int(row["player1_id"])
        p2 = int(row["player2_id"])
        try:
            deadline = as_utc(row["deadline_at"])
            if deadline is None:
                started_at = as_utc(row["started_at"])
                if started_at is None:
                    logger.warning(
                        "restore_active_game_timers: no deadline/start time for game %s; skipping",
                        game_id,
                    )
                    continue
                deadline = started_at + timedelta(seconds=ACTIVE_ROLL_SECONDS)
        except Exception as exc:
            logger.warning(
                "restore_active_game_timers: invalid deadline for game %s: %s",
                game_id,
                exc,
            )
            continue

        _clear_timer_scope(game_id)
        if deadline <= now:
            stagger = min(overdue_index * _STAGGER_PER_GAME, _STAGGER_CAP)
            overdue_index += 1
            timeout_job = scheduler.add_job(
                handle_timeout,
                "date",
                run_date=now + timedelta(seconds=stagger),
                args=[None, game_id, p1, p2],
                id=f"timeout_{game_id}_overdue_restore",
                replace_existing=True,
            )
            _store_timer_job(game_id, 0, "timeout", timeout_job)
            logger.info(
                "restore_active_game_timers: scheduled overdue timeout for game %s "
                "(DB deadline %s, stagger +%ds)",
                game_id,
                deadline.isoformat(),
                stagger,
            )
            continue

        reminder_at = deadline - timedelta(seconds=ROLL_REMINDER_AFTER_SECONDS)
        if reminder_at > now:
            reminder_p1 = scheduler.add_job(
                send_reminder,
                "date",
                run_date=reminder_at,
                args=[None, game_id, p1],
                id=f"reminder_{game_id}_{p1}_restore",
                replace_existing=True,
            )
            reminder_p2 = scheduler.add_job(
                send_reminder,
                "date",
                run_date=reminder_at,
                args=[None, game_id, p2],
                id=f"reminder_{game_id}_{p2}_restore",
                replace_existing=True,
            )
            _store_timer_job(game_id, p1, "reminder", reminder_p1)
            _store_timer_job(game_id, p2, "reminder", reminder_p2)

        timeout_job = scheduler.add_job(
            handle_timeout,
            "date",
            run_date=deadline,
            args=[None, game_id, p1, p2],
            id=f"timeout_{game_id}_restore",
            replace_existing=True,
        )
        _store_timer_job(game_id, 0, "timeout", timeout_job)
        logger.info(
            "restore_active_game_timers: restored game %s with %ss remaining",
            game_id,
            seconds_remaining(deadline, now=now),
        )

    # Demo Mode parity: restore both waiting-lobby expiry and active roll timers.
    practice_rows = get_recoverable_practice_games()
    for practice_game in practice_rows:
        practice_game_id = int(practice_game["practice_game_id"])
        status = str(practice_game.get("status") or "")
        deadline_at = practice_game.get("deadline_at")
        if status == "waiting":
            await start_practice_waiting_timer(
                None,
                practice_game_id,
                int(practice_game["player1_id"]),
                deadline_at=deadline_at,
            )
            continue
        player2_id = practice_game.get("player2_id")
        if status == "settling" and player2_id is not None:
            from types import SimpleNamespace
            synthetic = {
                "series_complete": True,
                "series_draw": practice_game.get("winner_id") is None,
                "winner_id": practice_game.get("winner_id"),
                "player1_wins": int(practice_game.get("player1_round_wins") or 0),
                "player2_wins": int(practice_game.get("player2_round_wins") or 0),
                "round_number": int(practice_game.get("current_round") or 1),
            }
            await _handle_practice_series_round_progress(
                SimpleNamespace(bot=bot),
                practice_game,
                synthetic,
            )
            continue
        if status == "active" and player2_id is not None:
            await start_practice_timers(
                None,
                practice_game_id,
                int(practice_game["player1_id"]),
                int(player2_id),
                deadline_at=deadline_at,
            )
    if practice_rows:
        logger.info("Restored %d Demo Duel timer set(s) after restart", len(practice_rows))


def _remove_scheduled_job(job) -> None:
    if job is None:
        return
    try:
        if scheduler.get_job(job.id) is None:
            return
        scheduler.remove_job(job.id)
    except Exception as e:
        # Timer jobs are best-effort. Missing/expired jobs should not break duel settlement UX.
        logger.debug("Ignoring timer cleanup miss for job %s: %s", getattr(job, "id", "unknown"), e)


def _store_timer_job(scope_key, user_id, job_key, job) -> None:
    timers.setdefault(scope_key, {}).setdefault(user_id, {})[job_key] = job


def _clear_timer_scope(scope_key, user_ids=None) -> None:
    bucket = timers.get(scope_key)
    if not bucket:
        timers.pop(scope_key, None)
        return
    if user_ids is None:
        user_ids = list(bucket.keys())
    for uid in list(user_ids):
        for job in list(bucket.get(uid, {}).values()):
            _remove_scheduled_job(job)
        bucket.pop(uid, None)
    if not bucket:
        timers.pop(scope_key, None)


def _clear_timer_user(scope_key, user_id) -> None:
    bucket = timers.get(scope_key)
    if not bucket:
        return
    for job in list(bucket.get(user_id, {}).values()):
        _remove_scheduled_job(job)
    bucket.pop(user_id, None)
    if not bucket:
        timers.pop(scope_key, None)

def _parse_admin_id_list(raw: str) -> list[int]:
    values: list[int] = []
    for chunk in str(raw or "").split(","):
        chunk = chunk.strip()
        if chunk.isdigit():
            values.append(int(chunk))
    return values


ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "0").strip()) if os.getenv("ADMIN_CHAT_ID", "0").strip().isdigit() else 0
TG_OPERATOR_IDS = _parse_admin_id_list(os.getenv("TG_OPERATOR_IDS", ""))
LEGACY_ADMIN_IDS = _parse_admin_id_list(os.getenv("ADMIN_IDS", ""))
ADMIN_IDS = sorted({*( [ADMIN_CHAT_ID] if ADMIN_CHAT_ID else [] ), *TG_OPERATOR_IDS, *LEGACY_ADMIN_IDS})
FOUNDER_ADMIN_IDS = {ADMIN_CHAT_ID} if ADMIN_CHAT_ID else set()
async def _is_allowed_in_chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Разрешает команду в группе только администраторам или владельцу workspace."""
    chat = update.effective_chat
    user = update.effective_user
    if chat.type == "private":
        return True
    # В группе – сначала проверяем права администратора
    try:
        member = await context.bot.get_chat_member(chat.id, user.id)
        if isinstance(member, (ChatMemberAdministrator, ChatMemberOwner)):
            return True
    except Exception:
        pass
    # Если не админ – проверяем владельца workspace (с кэшем)
    owner = _get_workspace_owner_cached(chat.id)
    if owner is not None and owner == user.id:
        return True
    return False

MIN_DEPOSIT_AMOUNT = 0.1
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "rollduelbot").strip().lstrip("@") or "rollduelbot"
_raw_support_handle = os.getenv("SUPPORT_TELEGRAM_HANDLE", "").strip()
if not _raw_support_handle or "durovcube" in _raw_support_handle.lower():
    SUPPORT_TELEGRAM_HANDLE = f"@{BOT_USERNAME}"
else:
    SUPPORT_TELEGRAM_HANDLE = _raw_support_handle if _raw_support_handle.startswith("@") else f"@{_raw_support_handle.lstrip('@')}"
SUPPORT_TON_ADDRESS = os.getenv("SUPPORT_TON_ADDRESS", "").strip()
SUPPORT_CHAT_ID = int(os.getenv("SUPPORT_CHAT_ID", "0"))  # Private support group chat ID


def _is_admin_user(user_id: int | None) -> bool:
    return bool(user_id and user_id in ADMIN_IDS)


def _show_admin_button(user_id: int | None) -> bool:
    if not user_id:
        return False
    if FOUNDER_ADMIN_IDS and user_id in FOUNDER_ADMIN_IDS:
        return True
    return _is_admin_user(user_id)


def _is_demo_mode_enabled() -> bool:
    """Operator-controlled visibility/entry guard for Demo Mode.

    Internal services keep the historical practice_* names; this setting controls
    only the user-facing Demo Mode entry points. If settings are unavailable,
    fail open to avoid hiding an onboarding feature during transient DB issues.
    """
    try:
        return bool(platform_settings.get_bool("demo_mode_enabled"))
    except Exception:
        logger.exception("demo_mode_enabled: failed to read platform setting; falling back to enabled")
        return True


def _demo_mode_disabled_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return t(
        "practice.disabled",
        default="🧪 Demo Mode is currently disabled. You can still play real GRAM duels from the main menu.",
    )


async def _reject_if_demo_mode_disabled_for_query(query, t=None) -> bool:
    if _is_demo_mode_enabled():
        return False
    await safe_answer_callback(query, _demo_mode_disabled_text(t), show_alert=True)
    return True


def _main_menu_markup(user_id: int | None, t=None):
    show_browse = False
    browse_count = 0
    private_count = 0
    menu_mode = get_cached_menu_mode(user_id) if user_id else "full"
    if user_id:
        try:
            # Cache giveaway counts for 3 minutes — they change rarely
            # and this function is called on every menu render
            _now = _time.monotonic()
            _gw_cached = _giveaway_count_cache.get(user_id)
            if _gw_cached and _now - _gw_cached[2] < _GW_COUNT_CACHE_TTL:
                show_browse, browse_count, private_count = _gw_cached[0], _gw_cached[1], _gw_cached[3]
            else:
                from services.giveaways import count_giveaways_created_by_user, count_public_giveaways, count_private_giveaways_by_user
                created = count_giveaways_created_by_user(user_id)
                show_browse = created > 0
                if show_browse:
                    browse_count = count_public_giveaways()
                    private_count = count_private_giveaways_by_user(user_id)
                _giveaway_count_cache[user_id] = (show_browse, browse_count, _now, private_count)
        except Exception:
            show_browse = False
            browse_count = 0
            private_count = 0
    return get_main_menu_keyboard(
        t=t,
        show_admin=_show_admin_button(user_id),
        show_notice=notice_service.has_active_notice_for_user(user_id),
        show_browse_giveaways=show_browse,
        browse_count=browse_count,
        private_count=private_count,
        menu_mode=menu_mode,
        user_id=user_id,
        demo_mode_enabled=_is_demo_mode_enabled(),
    )


def _admin_web_url(section_suffix: str = "") -> str:
    base_url = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        public_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip().strip("/")
        if public_domain:
            base_url = f"https://{public_domain}"
    if not base_url:
        return ""
    admin_prefix = os.getenv("ADMIN_WEB_PREFIX", "/admin").strip() or "/admin"
    if not admin_prefix.startswith("/"):
        admin_prefix = f"/{admin_prefix}"
    base = f"{base_url}{admin_prefix.rstrip('/')}"
    suffix = (section_suffix or "").strip()
    if not suffix:
        return base
    if suffix.startswith(("http://", "https://")):
        return suffix
    if not suffix.startswith("/"):
        suffix = f"/{suffix}"
    return f"{base}{suffix}"


def _format_admin_alert_lines(alerts: list[dict], *, limit: int = 3) -> list[str]:
    lines: list[str] = []
    for item in alerts[:limit]:
        title = escape(str(item.get("title") or "Алерт"))
        detail = escape(str(item.get("detail") or item.get("msg") or item.get("message") or ""))
        level = str(item.get("level") or "neutral").lower()
        icon = "🔴" if level in {"bad", "critical", "error"} else "🟡" if level == "warn" else "ℹ️"
        lines.append(f"• {icon} <b>{title}</b> — {detail}")
    return lines


def _tg_admin_status_label(status: str) -> tuple[str, str]:
    normalized = str(status or "unknown").lower()
    if normalized == "ok":
        return "✅ OK", "ok"
    if normalized == "attention":
        return "🟡 ВНИМАНИЕ", "attention"
    if normalized == "action_required":
        return "🔴 НУЖНО ДЕЙСТВИЕ", "action_required"
    return f"⚪ {escape(normalized.upper())}", normalized


def _tg_admin_coverage_label(status: str) -> str:
    return {
        'covered': '✅ покрытие OK',
        'underfunded': '🔴 недостаточно покрытия',
        'provider_unavailable': '🟡 нужна сверка CryptoBot',
    }.get(str(status or '').lower(), escape(str(status or 'unknown')))


def _render_tg_admin_overview_text(user_id: int) -> str:
    snapshot = admin_read_models.tg_admin_cockpit_snapshot() if hasattr(admin_read_models, 'tg_admin_cockpit_snapshot') else {}
    status_label, _status_key = _tg_admin_status_label(str(snapshot.get('status') or 'unknown'))
    founder_note = "Founder-вход виден в главном меню." if _show_admin_button(user_id) else "Fallback-вход: /admin для allowlist-операторов."
    alert_lines = _format_admin_alert_lines(snapshot.get("alerts") or [], limit=3)
    if not alert_lines:
        alert_lines = ["• ✅ Активных алертов нет."]

    runtime_warnings = snapshot.get('runtime_warnings') if isinstance(snapshot.get('runtime_warnings'), list) else []
    kill = snapshot.get('kill_switches') if isinstance(snapshot.get('kill_switches'), dict) else {}
    kills = []
    if kill:
        if kill.get('maintenance_mode'):
            kills.append('maintenance')
        for key, label in (("duels_enabled", "дуэли"), ("deposits_enabled", "депозиты"), ("withdrawals_enabled", "выводы")):
            if key in kill and not bool(kill.get(key)):
                kills.append(f"{label} выкл")
    kills_label = ", ".join(kills) if kills else "нет активных стопов"

    lines = [
        "👑 <b>Roll Duel Ops Cockpit</b>",
        f"Статус: <b>{status_label}</b>",
        f"Источник: <code>{escape(str(snapshot.get('source') or 'db/runtime/read_models'))}</code>",
        "",
        "<b>Следующий шаг</b>",
        f"• {escape(str(snapshot.get('next_step') or 'Открыть Веб-админку и проверить состояние.'))}",
        "",
        "<b>💰 Учёт и касса</b>",
        "Деньги / покрытие",
        f"• Покрытие: <b>{_tg_admin_coverage_label(str(snapshot.get('coverage_status') or 'unknown'))}</b>",
        f"• CryptoBot status: <code>{escape(str(snapshot.get('provider_status') or 'unknown'))}</code>",
        f"• Обязательства: <b>{_format_admin_gram(snapshot.get('total_customer_liability'))} GRAM</b>",
        f"• Баланс CryptoBot: <b>{_format_admin_gram(snapshot.get('provider_hot_balance'))} GRAM</b>",
        f"• Нужно долить: <b>{_format_admin_gram(snapshot.get('required_top_up_user_coverage'))} GRAM</b>",
        f"• Безопасно вывести: <b>{_format_admin_gram(snapshot.get('safe_owner_cashout'))} GRAM</b>",
        "",
        "<b>📌 Оперативный обзор</b>",
        "Рантайм / read/drilldown-экран",
        f"• 💸 Выводы: <b>{int(snapshot.get('requested_withdrawals') or 0)}</b> ожидают / <b>{int(snapshot.get('processing_withdrawals') or 0)}</b> в обработке / <b>{int(snapshot.get('failed_withdrawals') or 0)}</b> проблемные",
        f"• ⚔️ Дуэли: <b>{int(snapshot.get('open_duels') or 0)}</b> открыто / <b>{int(snapshot.get('active_duels') or 0)}</b> активно / <b>{int(snapshot.get('stuck_duels') or 0)}</b> зависли",
        f"• 🎁 Розыгрыши: <b>{int(snapshot.get('active_giveaways') or 0)}</b> активны / <b>{int(snapshot.get('public_active_giveaways') or 0)}</b> публичны",
        f"• ⚠️ Риски: <b>{int(snapshot.get('manual_review_users') or 0)}</b> ручная проверка / <b>{int(snapshot.get('frozen_users') or 0)}</b> заморожены",
        f"• 🚨 Проблемы: <b>{int(snapshot.get('total_problems') or 0)}</b> всего / jobs <b>{int(snapshot.get('failed_jobs') or 0)}</b> / payments <b>{int(snapshot.get('unprocessed_payment_events') or 0)}</b>",
        f"• 📈 Привлечение 7д: <b>{int((snapshot.get('acquisition_7d') or {}).get('starts') or 0)}</b> starts / <b>{int((snapshot.get('acquisition_7d') or {}).get('real_players') or 0)}</b> real players",
        "",
        "<b>🧭 Рантайм</b>",
        f"• Stop flags: <b>{escape(kills_label)}</b>",
        f"• Warnings: <b>{len(runtime_warnings)}</b>",
        "",
        "<b>⚠️ Алерты</b>",
        *alert_lines,
        "",
        "<b>Контракт навигации</b>",
        f"• {founder_note}",
        "• Telegram cockpit — быстрый read-only обзор и переходы.",
        "• Каждая метрика ведёт в безопасный read/drilldown-экран.",
        "• Деньги, причины, typed-confirm и audit-safe действия — в Web Admin.",
    ]
    return "\n".join(lines)


def _pct(value: int | float, base: int | float) -> str:
    try:
        denominator = float(base or 0)
        return f"{(float(value or 0) / denominator * 100.0):.1f}%" if denominator > 0 else "0.0%"
    except (TypeError, ValueError, ZeroDivisionError):
        return "0.0%"


def _render_tg_acquisition_text(period_days: int = 7) -> tuple[str, dict]:
    snapshot = acquisition_service.tg_acquisition_snapshot(period_days=period_days, limit=5)
    totals = snapshot.get("totals") if isinstance(snapshot.get("totals"), dict) else {}
    starts = int(totals.get("starts") or 0)
    clicks = int(totals.get("human_clicks") or 0)
    practice = int(totals.get("practice") or 0)
    depositors = int(totals.get("depositors") or 0)
    real_players = int(totals.get("real_players") or 0)
    repeat = int(totals.get("repeat_real_players") or 0)
    period = int(snapshot.get("period_days") or 7)
    lines = [
        f"📈 <b>Привлечение — {period} дней</b>",
        "",
        "<b>Воронка</b>",
        f"• Клики: <b>{clicks}</b>",
        f"• Запуски бота: <b>{starts}</b> · click→start {_pct(starts, clicks)}",
        f"• Practice завершили: <b>{practice}</b> · {_pct(practice, starts)} от start",
        f"• Депозиторы: <b>{depositors}</b> · {_pct(depositors, starts)} от start",
        f"• Первые реальные игроки: <b>{real_players}</b> · {_pct(real_players, starts)} от start",
        f"• Повторные игроки: <b>{repeat}</b>",
        f"• D1 / D7: <b>{int(totals.get('d1_retained') or 0)}</b> / <b>{int(totals.get('d7_retained') or 0)}</b>",
        "",
        "<b>Лучшие кампании</b>",
    ]
    top = snapshot.get("top_campaigns") if isinstance(snapshot.get("top_campaigns"), list) else []
    if top:
        for row in top:
            code = escape(str(row.get("code") or "—"))
            lines.append(
                f"• <code>{code}</code> — starts <b>{int(row.get('starts') or 0)}</b>, "
                f"practice <b>{int(row.get('practice') or 0)}</b>, real <b>{int(row.get('real_players') or 0)}</b>"
            )
    else:
        lines.append("• Кампаний или данных за период пока нет.")
    alerts = snapshot.get("alerts") if isinstance(snapshot.get("alerts"), list) else []
    lines.extend(["", "<b>Диагностика</b>"])
    if alerts:
        for item in alerts[:5]:
            lines.append(f"• 🟡 <code>{escape(str(item.get('code') or ''))}</code> — {escape(str(item.get('message') or ''))}")
    else:
        lines.append("• ✅ Явных провалов воронки по текущим порогам нет.")
    lines.extend([
        "",
        "Web Admin остаётся местом создания, редактирования, CSV и подробной аналитики.",
    ])
    return "\n".join(lines), snapshot


def _render_tg_acquisition_campaign_text(code: str, period_days: int = 7) -> tuple[str, dict]:
    normalized = acquisition_service.normalize_campaign_code(code)
    funnel = acquisition_service.campaign_funnel(normalized, period_days=period_days)
    campaign = funnel.get("campaign") if isinstance(funnel.get("campaign"), dict) else {}
    starts = int(funnel.get("starts") or 0)
    clicks = int(funnel.get("human_clicks") or 0)
    lines = [
        f"📈 <b>{escape(str(campaign.get('name') or normalized))}</b>",
        f"Код: <code>{escape(normalized)}</code> · статус <b>{escape(str(campaign.get('status') or 'unknown').upper())}</b>",
        f"Источник: {escape(str(campaign.get('source') or '—'))}",
        "",
        f"• Клики: <b>{clicks}</b>",
        f"• Starts: <b>{starts}</b> · {_pct(starts, clicks)}",
        f"• Terms: <b>{int(funnel.get('terms') or 0)}</b>",
        f"• Practice: <b>{int(funnel.get('practice') or 0)}</b> · {_pct(int(funnel.get('practice') or 0), starts)}",
        f"• Депозиторы: <b>{int(funnel.get('depositors') or 0)}</b> / {float(funnel.get('deposit_volume') or 0):.3f} GRAM",
        f"• Реальные игроки: <b>{int(funnel.get('real_players') or 0)}</b>",
        f"• Repeat: <b>{int(funnel.get('repeat_real_players') or 0)}</b>",
        f"• D1 / D7: <b>{int(funnel.get('d1_retained') or 0)}</b> / <b>{int(funnel.get('d7_retained') or 0)}</b>",
        "",
        "<b>Ссылки</b>",
        f"Tracked: <code>{escape(acquisition_service.build_redirect_link(normalized))}</code>",
        f"Landing: <code>{escape(acquisition_service.build_landing_link(normalized))}</code>",
        f"Bot: <code>{escape(acquisition_service.build_bot_start_link(normalized))}</code>",
    ]
    return "\n".join(lines), funnel


def _tg_acquisition_keyboard(snapshot: dict, *, period_days: int = 7) -> InlineKeyboardMarkup:
    rows = [[
        InlineKeyboardButton("• 7 дней" if period_days == 7 else "7 дней", callback_data="admin_acquisition_7"),
        InlineKeyboardButton("• 30 дней" if period_days == 30 else "30 дней", callback_data="admin_acquisition_30"),
    ]]
    for item in (snapshot.get("top_campaigns") or [])[:5]:
        code = str(item.get("code") or "")
        if code:
            rows.append([InlineKeyboardButton(f"📌 {code}", callback_data=f"admin_acq:{code}")])
    rows.append([InlineKeyboardButton("🌐 Открыть Web Acquisition", url=_admin_web_url('/acquisition'))])
    rows.append([InlineKeyboardButton("◀️ Назад в Админку", callback_data="admin_panel")])
    return InlineKeyboardMarkup(rows)


def _tg_acquisition_campaign_keyboard(code: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 Карточка в Web Admin", url=_admin_web_url(f"/acquisition/{code}"))],
        [InlineKeyboardButton("📈 К списку кампаний", callback_data="admin_acquisition_7")],
        [InlineKeyboardButton("◀️ Назад в Админку", callback_data="admin_panel")],
    ])

def _render_tg_admin_withdrawals_text() -> str:
    snapshot = admin_read_models.dashboard_snapshot()
    queue = admin_read_models.list_withdrawals(limit=5, offset=0)
    lines = [
        "💸 <b>Выводы</b>",
        "",
        f"• Запрошено: <b>{int(snapshot.get('requested_withdrawals') or 0)}</b>",
        f"• В обработке / резерве: <b>{int(snapshot.get('processing_withdrawals') or 0)}</b>",
        f"• Ошибка / отклонено: <b>{int(snapshot.get('failed_withdrawals') or 0)}</b>",
        "",
        "<b>Последняя очередь</b>",
    ]
    if queue:
        for item in queue[:5]:
            username = str(item.get('username') or item.get('first_name') or item.get('user_id'))
            wid = item.get('withdrawal_id')
            lines.append(
                f"• <code>{wid}</code> — {float(item.get('amount') or 0):.2f} GRAM — {item.get('status')} / {item.get('review_status')} — {escape(username)}"
            )
    else:
        lines.append("• Сейчас очередь пуста.")
    if int(snapshot.get('failed_withdrawals') or 0) > 0:
        lines.extend(["", "<b>Квитанция</b>", "• Есть ошибочные / отклонённые выводы. открой Веб-админку или Failed Items для глубокой проверки."])
    else:
        lines.extend(["", "<b>Квитанция</b>", "• Сейчас очередь выглядит спокойно. Для полной карточки и заметок используй Веб-админку."])
    return "\n".join(lines)


def _render_tg_admin_runtime_text() -> str:
    runtime = admin_read_models.runtime_snapshot()
    kill = runtime.get('kill_switches') or {}
    sanity = runtime.get('settings_sanity') or {}
    warnings = runtime.get('warnings') or []
    lines = [
        "🧭 <b>Рантайм</b>",
        "",
        f"• Бэкенд БД: <b>{escape(str(runtime.get('database_backend') or '—'))}</b>",
        f"• Веб-админка: <b>{'включено' if runtime.get('admin_web_enabled') else 'выключено'}</b>",
        f"• Рантайм Mini App: <b>{'включено' if runtime.get('miniapp_runtime_enabled') else 'выключено'}</b>",
        f"• Telegram webhook: <code>{escape(str(runtime.get('telegram_webhook_path') or '—'))}</code>",
        f"• Crypto Pay webhook: <code>{escape(str(runtime.get('cryptopay_webhook_path') or '—'))}</code>",
        "",
        "<b>Стоп-переключатели</b>",
        f"• Дуэли: <b>{'включено' if kill.get('duels_enabled') else 'выключено'}</b>",
        f"• Депозиты: <b>{'включено' if kill.get('deposits_enabled') else 'выключено'}</b>",
        f"• Выводы: <b>{'включено' if kill.get('withdrawals_enabled') else 'выключено'}</b>",
        f"• Maintenance: <b>{'включено' if kill.get('maintenance_mode') else 'выключено'}</b>",
        "",
        "<b>Проверка настроек</b>",
        f"• Строк: <b>{int(sanity.get('rows') or 0)}</b>",
        f"• Native JSON-строк: <b>{int(sanity.get('native_rows') or 0)}</b>",
        f"• Битых строк: <b>{int(sanity.get('malformed_rows') or 0)}</b>",
        f"• Fallback-режим: <b>{'включено' if sanity.get('fallback_mode') else 'выключено'}</b>",
    ]
    if warnings:
        lines.extend(["", "<b>Предупреждения</b>"] + [f"• {escape(str(item))}" for item in warnings[:5]])
        lines.extend(["", "<b>Квитанция</b>", "• Рантайм читается, но есть предупреждения. Для полного sanity-среза открой Runtime в Веб-админке."])
    else:
        lines.extend(["", "✅ Сейчас предупреждений по рантайму нет.", "", "<b>Квитанция</b>", "• Runtime-переключатели остаются в Веб-админке, чтобы этот экран был быстрым и безопасным."])
    return "\n".join(lines)


def _format_admin_gram(value) -> str:
    if value is None:
        return "—"
    try:
        return f"{float(value):.4f}".rstrip("0").rstrip(".")
    except Exception:
        return str(value)


def _render_tg_admin_liabilities_text() -> str:
    snap = admin_read_models.liabilities_snapshot()
    alert_lines = _format_admin_alert_lines(snap.get('alerts') or [], limit=4)
    if not alert_lines:
        alert_lines = ["• ✅ Сейчас активных алертов нет."]
    coverage_status = str(snap.get('provider_coverage_status') or 'provider_unavailable')
    coverage_label = {
        'covered': 'МОЖНО ПРОВЕРИТЬ SURPLUS',
        'underfunded': 'КАЗНУ НЕ ВЫВОДИТЬ',
        'provider_unavailable': 'СНАЧАЛА СВЕРИТЬ CRYPTOBOT',
    }.get(coverage_status, coverage_status.upper())
    provider_diag = ""
    source = str(snap.get("provider_balance_source") or "api")
    if source == "manual_override":
        manual = snap.get("provider_manual_balance") or {}
        provider_diag = (
            "• Источник баланса: <b>ручная сверка</b>\n"
            f"• Ручная сверка: <code>{escape(str(manual.get('updated_at') or '—'))}</code>\n"
            f"• Заметка: <code>{escape(str(manual.get('note') or '')[:160])}</code>\n"
        )
    elif coverage_status == "provider_unavailable":
        available_assets = ", ".join(str(x) for x in (snap.get("provider_available_assets") or [])) or "—"
        provider_diag = (
            f"• Статус провайдера: <code>{escape(str(snap.get('provider_balance_status') or 'unknown'))}</code>\n"
            f"• Активы провайдера: <code>{escape(available_assets)}</code>\n"
            f"• Ошибка провайдера: <code>{escape(str(snap.get('provider_balance_error') or 'no diagnostic')[:160])}</code>\n"
        )
    provider_diag += f"• Полная диагностика CryptoBot (token/getMe/getBalance/getTransfers/webhook): {_admin_web_url('/provider-diagnostics')}\n"
    component_lines = [
        f"• Доступные балансы: <b>{_format_admin_gram(snap.get('total_user_balances'))} GRAM</b>",
        f"• Активные резервы: <b>{_format_admin_gram(snap.get('active_reservations'))} GRAM</b>",
        f"• Выводы в пути: <b>{_format_admin_gram(snap.get('active_withdrawal_amount'))} GRAM</b>",
    ]
    top_rows = admin_read_models.list_user_liability_breakdown(limit=4)
    top_lines = []
    for item in top_rows:
        if item.get('_error'):
            top_lines.append(f"• ⚠️ {escape(str(item.get('_error'))[:120])}")
            continue
        top_lines.append(
            f"• <code>{escape(str(item.get('user_id')))}</code> — {escape(str(item.get('display_name') or 'User'))}: "
            f"<b>{_format_admin_gram(item.get('total_exposure'))} GRAM</b> "
            f"(баланс {_format_admin_gram(item.get('available_balance'))}, резерв {_format_admin_gram(item.get('active_reservations'))})"
        )
    if not top_lines:
        top_lines = ["• Нет пользовательских средств на балансах."]
    return (
        "🏦 <b>Пользовательские средства / покрытие</b>\n\n"
        "<b>Учёт и касса</b>\n"
        f"• Обязательства перед пользователями: <b>{_format_admin_gram(snap.get('total_customer_liability'))} GRAM</b>\n"
        f"• Баланс CryptoBot (провайдер): <b>{_format_admin_gram(snap.get('provider_hot_balance'))} GRAM</b>\n"
        f"• Требуемое покрытие: <b>{_format_admin_gram(snap.get('required_hot_coverage'))} GRAM</b>\n"
        f"• Дефицит покрытия: <b>{_format_admin_gram(snap.get('provider_coverage_gap'))} GRAM</b>\n"
        f"• Свободно к выводу: <b>{_format_admin_gram(snap.get('provider_surplus_before_buffer'))} GRAM</b>\n"
        f"• Решение по казне: <b>{escape(coverage_label)}</b>\n"
        f"• Внутренний баланс казны (ledger): <b>{_format_admin_gram(snap.get('internal_treasury_balance', snap.get('treasury_balance')))} GRAM</b> — это не баланс CryptoBot\n"
        + "\n<b>Из чего состоят пользовательские средства</b>\n"
        + "\n".join(component_lines)
        + "\n"
        + provider_diag
        + "\n"
        "<b>Правило оператора</b>\n"
        "• НЕДОСТАТОЧНО ПОКРЫТИЯ / БАЛАНС НЕДОСТУПЕН = казну не выводить. Сначала пополнить баланс CryptoBot или разобраться с тестовыми обязательствами.\n\n"
        + "<b>Топ балансов / резервов по пользователям</b>\n"
        + "\n".join(top_lines)
        + "\n\n"
        + "<b>Алерты / квитанции</b>\n"
        + "\n".join(alert_lines)
        + "\n\nИспользуй Telegram для быстрого среза, а для глубокой операторской работы переходи в Веб-админку."
    )




def _render_tg_admin_provider_text() -> str:
    snap = admin_read_models.liabilities_snapshot()
    diagnostics = snap.get('provider_diagnostics') or {}
    status = str(snap.get('provider_balance_status') or diagnostics.get('status') or 'unknown')
    coverage = str(snap.get('provider_coverage_status') or 'provider_unavailable')
    source = str(snap.get('provider_balance_source') or 'api')
    provider_ok = diagnostics.get('ok')
    diag_lines = []
    if isinstance(diagnostics, dict) and diagnostics:
        for key in ('token', 'http_client', 'get_me', 'get_balance', 'get_transfers', 'create_invoice'):
            if key in diagnostics:
                diag_lines.append(f"• {escape(str(key))}: <code>{escape(str(diagnostics.get(key)))}</code>")
    if not diag_lines:
        diag_lines.append("• Детальная диагностика доступна в Web Admin.")
    lines = [
        "🧪 <b>Provider / CryptoBot</b>",
        "Read-only сверка провайдера. Из Telegram ничего не создаём и не отправляем.",
        "",
        f"• Баланс status: <code>{escape(status)}</code>",
        f"• Покрытие: <b>{_tg_admin_coverage_label(coverage)}</b>",
        f"• Источник баланса: <code>{escape(source)}</code>",
        f"• Hot balance: <b>{_format_admin_gram(snap.get('provider_hot_balance'))} GRAM</b>",
        f"• Required coverage: <b>{_format_admin_gram(snap.get('required_hot_coverage'))} GRAM</b>",
        f"• Gap: <b>{_format_admin_gram(snap.get('provider_coverage_gap'))} GRAM</b>",
        "",
        "<b>Diagnostics sample</b>",
        *diag_lines[:8],
        "",
        "<b>Квитанция</b>",
        "• Полный token/getMe/getBalance/getTransfers/createInvoice drilldown — только в Web Admin.",
    ]
    if provider_ok is False and diagnostics.get('error'):
        lines.append(f"• Ошибка: <code>{escape(str(diagnostics.get('error'))[:180])}</code>")
    return "\n".join(lines)


def _render_tg_admin_problems_text() -> str:
    problems = admin_read_models.failed_items_snapshot() if hasattr(admin_read_models, 'failed_items_snapshot') else {}
    failed_withdrawals = int(problems.get('failed_withdrawals') or 0)
    stuck_duels = int(problems.get('stuck_duels') or 0)
    unprocessed_payments = int(problems.get('unprocessed_payment_events') or 0)
    failed_jobs = int(problems.get('failed_jobs') or 0)
    total = failed_withdrawals + stuck_duels + unprocessed_payments + failed_jobs
    if total > 0:
        next_step = "Открыть Web Admin → Проблемы и разобрать самый высокий риск: выводы → payments → duels → jobs."
    else:
        next_step = "Критичных failed items сейчас не видно; оставить мониторинг и сверить Live Ops перед релизом."
    lines = [
        "🚨 <b>Проблемы</b>",
        "Read-only triage из тех же read models, что использует Web Admin.",
        "",
        f"• Всего проблем: <b>{total}</b>",
        f"• Неудачные выводы: <b>{failed_withdrawals}</b>",
        f"• Платежи без обработки: <b>{unprocessed_payments}</b>",
        f"• Зависшие дуэли: <b>{stuck_duels}</b>",
        f"• Фоновые задачи с ошибками: <b>{failed_jobs}</b>",
        "",
        "<b>Следующий шаг</b>",
        f"• {next_step}",
        "",
        "<b>Квитанция</b>",
        "• Telegram не повторяет recovery/action forms. Разбор и audit-safe действия остаются в Web Admin.",
    ]
    if problems.get('error'):
        lines.extend(["", f"⚠️ Read model warning: <code>{escape(str(problems.get('error'))[:180])}</code>"])
    return "\n".join(lines)


def _render_tg_admin_help_text() -> str:
    return (
        "❓ <b>Помощь по Telegram-админке</b>\n\n"
        "Эта поверхность специально сделана узкой и быстрой.\n\n"
        "<b>Что удобно делать здесь</b>\n"
        "• быстрый обзор\n"
        "• быстрый срез по выводам\n"
        "• быстрый срез по рантайму/readiness\n"
        "• быстрый срез по пользовательским средствам, покрытию и алертам\n"
        "• быстро открывать пользователя по ID\n\n"
        "<b>Что остаётся в Веб-админке</b>\n"
        "• изменение kill switch'ей\n"
        "• переводы вывода по статусам\n"
        "• полные write-действия в карточке пользователя\n"
        "• глубокая работа в audit / failed items\n\n"
        "Держим один источник правды: Telegram — для скорости и чтения, Веб-админка — для тяжёлой операторской работы."
    )


def _render_tg_admin_broadcasts_text() -> str:
    active = broadcast_service.get_active_broadcast()
    recent = broadcast_service.list_recent_broadcasts(limit=5)
    lines = [
        "📣 <b>Рассылки</b>",
        "",
        "Рассылка = активный push из Telegram admin через backend/runtime truth.",
        "Продакшен-коридор: исходное сообщение → кнопки → реальный предпросмотр → тест → запуск.",
        "",
    ]
    if active:
        started_at = _format_timestamp(active.get('started_at'))
        finished_at = _format_timestamp(active.get('completed_at') or active.get('stopped_at'))
        lines.extend([
            "<b>Активная рассылка</b>",
            f"• ID: <code>{escape(str(active.get('broadcast_id') or '—'))}</code>",
            f"• Статус: <b>{escape(broadcast_service.broadcast_status_label(active.get('status')))}</b>",
            f"• Аудитория: <b>{escape(broadcast_service.audience_label(active.get('audience')))}</b>",
            f"• Тип источника: <b>{escape(broadcast_service.source_type_label(active.get('source_message_type')))}</b>",
            f"• Кнопки: <b>{len(active.get('buttons') or [])}</b>",
            f"• Старт: <b>{escape(started_at)}</b>",
            f"• Финал: <b>{escape(finished_at)}</b>",
            f"• Доставлено / всего: <b>{int(active.get('sent_count') or 0)}</b> / <b>{int(active.get('total_count') or 0)}</b>",
            f"• Ожидают ретрая: <b>{int(active.get('retry_pending') or 0)}</b>",
            f"• Ошибок: <b>{int(active.get('failed_count') or 0)}</b>",
            "",
        ])
    else:
        lines.extend(["<b>Активная рассылка</b>", "• Сейчас нет.", ""])
    lines.append("<b>Последние черновики / запуски</b>")
    if recent:
        for item in recent[:5]:
            finished_at = _format_timestamp(item.get('completed_at') or item.get('stopped_at') or item.get('updated_at'))
            lines.append(
                f"• <code>{escape(str(item.get('broadcast_id') or '—'))}</code> — {escape(broadcast_service.broadcast_status_label(item.get('status')))} — {escape(broadcast_service.audience_label(item.get('audience')))} — {escape(broadcast_service.source_type_label(item.get('source_message_type')))} — {int(item.get('sent_count') or 0)}/{int(item.get('total_count') or 0)} — ретрай {int(item.get('retry_pending') or 0)} — ошибок {int(item.get('failed_count') or 0)} — {escape(finished_at)}"
            )
    else:
        lines.append("• Пока нет строк рассылок.")
    lines.extend([
        "",
        "<b>Что важно</b>",
        "• До запуска нужен реальный предпросмотр и тест.",
        "• Для founder-smoke используйте когорту <code>founder_test</code> или тест на allowlist.",
        "• Если launch пишет про пустую аудиторию — сначала проверьте ADMIN_CHAT_ID / TG_OPERATOR_IDS.",
        "• Запуск идёт из Telegram admin, но доставка живёт в backend/runtime truth.",
        "• Источник может быть текстом или реальным Telegram-сообщением с медиа.",
    ])
    return "\n".join(lines)


def _render_tg_admin_broadcast_detail_text(row: dict | None) -> str:
    if not row:
        return "📣 <b>Рассылка</b>\n\nЧерновик не найден."
    estimate = broadcast_service.count_recipients(str(row.get('audience') or 'founder_test'))
    preview = escape(str(row.get('preview_text') or row.get('message_text') or '')) or '—'
    source_ref = (
        f"<code>{escape(str(row.get('source_chat_id')))}:{escape(str(row.get('source_message_id')))}</code>"
        if row.get('source_chat_id') and row.get('source_message_id')
        else 'ещё не задано'
    )
    button_lines = broadcast_service.buttons_preview_lines(row.get('buttons') or [])
    status_label = broadcast_service.broadcast_status_label(row.get('status'))
    audience_label = broadcast_service.audience_label(row.get('audience'))
    source_type_label = broadcast_service.source_type_label(row.get('source_message_type'))
    created_at = _format_timestamp(row.get('created_at'))
    started_at = _format_timestamp(row.get('started_at'))
    finished_at = _format_timestamp(row.get('completed_at') or row.get('stopped_at'))
    total_count = int(row.get('total_count') or 0)
    sent_count = int(row.get('sent_count') or 0)
    retry_pending = int(row.get('retry_pending') or 0)
    failed_count = int(row.get('failed_count') or 0)
    return (
        "📣 <b>Черновик рассылки</b>\n\n"
        f"• ID: <code>{escape(str(row.get('broadcast_id') or '—'))}</code>\n"
        f"• Статус: <b>{escape(status_label)}</b>\n"
        f"• Аудитория: <b>{escape(audience_label)}</b>\n"
        f"• Оценка получателей: <b>{estimate}</b>\n"
        f"• Тип источника: <b>{escape(source_type_label)}</b>\n"
        f"• Источник: {source_ref}\n"
        f"• Создана: <b>{escape(created_at)}</b>\n"
        f"• Запущена: <b>{escape(started_at)}</b>\n"
        f"• Завершена: <b>{escape(finished_at)}</b>\n\n"
        "<b>Результат доставки</b>\n"
        f"• Доставлено / всего: <b>{sent_count}</b> / <b>{total_count}</b>\n"
        f"• Ожидают ретрая: <b>{retry_pending}</b>\n"
        f"• Ошибок: <b>{failed_count}</b>\n\n"
        "<b>Предпросмотр текста / подписи</b>\n"
        f"{preview}\n\n"
        "<b>Кнопки</b>\n"
        + "\n".join(button_lines)
        + "\n\n"
        + "<b>Что дальше</b>\n"
        + "• выберите аудиторию\n"
        + "• задайте исходное сообщение\n"
        + "• при необходимости соберите кнопки\n"
        + "• сделайте реальный предпросмотр и тест\n"
        + "• только потом запускайте\n"
        + "• после запуска откройте «Результаты» или Outbox"
    )


def _render_tg_admin_notice_text() -> str:
    active = notice_service.get_active_notice()
    recent = notice_service.list_recent_notices(limit=5)
    lines = [
        "📢 <b>Объявления</b>",
        "",
        "Объявление = пассивное системное сообщение с versioned publish/deactivate flow.",
        "",
    ]
    if active:
        lines.extend([
            "<b>Текущее активное объявление</b>",
            f"• ID: <code>{escape(str(active.get('notice_id') or '—'))}</code>",
            f"• Статус: <b>{escape(notice_service.notice_status_label(active.get('status')))}</b>",
            f"• Серьёзность: <b>{escape(notice_service.severity_label(active.get('severity')))}</b>",
            f"• Таргет: <b>{escape(notice_service.target_label(active.get('target')))}</b>",
            f"• Версия: <b>{int(active.get('version') or 0)}</b>",
            "",
        ])
    else:
        lines.extend(["<b>Текущее активное объявление</b>", "• Сейчас нет.", ""])
    lines.append("<b>Последние объявления</b>")
    if recent:
        for item in recent[:5]:
            lines.append(
                f"• <code>{escape(str(item.get('notice_id') or '—'))}</code> — {escape(notice_service.notice_status_label(item.get('status')))} — {escape(notice_service.severity_label(item.get('severity')))} — версия {int(item.get('version') or 0)}"
            )
    else:
        lines.append("• Пока нет строк объявлений.")
    lines.extend([
        "",
        "<b>Квитанция</b>",
        "• Публикуйте новую версию, когда нужен пассивный системный месседж без шумной массовой рассылки.",
    ])
    return "\n".join(lines)


def _render_tg_admin_notice_detail_text(row: dict | None) -> str:
    if not row:
        return "📢 <b>Объявления</b>\n\nЧерновик не найден."
    cta_label = notice_service.cta_label(str(row.get('cta_key') or 'none'))
    expires_at = _format_timestamp(row.get('expires_at')) if row.get('expires_at') else 'Без срока'
    body = escape(str(row.get('body_text') or '')) or '—'
    return (
        "📢 <b>Карточка объявления</b>\n\n"
        f"• ID: <code>{escape(str(row.get('notice_id') or '—'))}</code>\n"
        f"• Статус: <b>{escape(notice_service.notice_status_label(row.get('status')))}</b>\n"
        f"• Серьёзность: <b>{escape(notice_service.severity_label(row.get('severity')))}</b>\n"
        f"• Таргет: <b>{escape(notice_service.target_label(row.get('target')))}</b>\n"
        f"• CTA: <b>{escape(cta_label)}</b>\n"
        f"• Срок: <b>{escape(expires_at)}</b>\n"
        f"• Версия: <b>{int(row.get('version') or 0)}</b>\n\n"
        "<b>Предпросмотр объявления</b>\n"
        f"{body}"
    )


def _render_user_notice_text(row: dict | None) -> str:
    if not row:
        return "📣 <b>Current Notice</b>\n\nThere is no active notice right now."
    severity = str(row.get('severity') or 'info').lower()
    badge = 'ℹ️' if severity == 'info' else '⚠️' if severity == 'warning' else '🚨'
    expires_at = _format_timestamp(row.get('expires_at')) if row.get('expires_at') else 'Без expiry'
    body = escape(str(row.get('body_text') or '')) or '—'
    return (
        f"{badge} <b>Current Notice</b>\n\n"
        f"<b>Severity:</b> {escape(severity.title())}\n"
        f"<b>Version:</b> {int(row.get('version') or 0)}\n"
        f"<b>Expiry:</b> {escape(expires_at)}\n\n"
        f"{body}"
    )


def _notice_cta_payload(row: dict | None) -> tuple[str | None, str | None]:
    if not row:
        return None, None
    label, callback_data = notice_service.CTA_CHOICES.get(str(row.get('cta_key') or 'none'), (None, None))
    return label, callback_data


def _extract_broadcast_source_from_message(message) -> tuple[str, str] | None:
    if not message:
        return None
    if getattr(message, "photo", None):
        return "photo", str(getattr(message, "caption", "") or "")
    if getattr(message, "video", None):
        return "video", str(getattr(message, "caption", "") or "")
    if getattr(message, "animation", None):
        return "animation", str(getattr(message, "caption", "") or "")
    if getattr(message, "document", None):
        return "document", str(getattr(message, "caption", "") or "")
    if getattr(message, "text", None):
        return "text", str(getattr(message, "text", "") or "")
    return None


def _parse_broadcast_button_input(raw: str | None) -> tuple[str | None, str | None]:
    text = str(raw or "").strip()
    if "|" not in text:
        return None, None
    label, url = [part.strip() for part in text.split("|", 1)]
    return label or None, url or None


def _render_tg_admin_broadcast_outbox_text() -> str:
    snap = broadcast_service.outbox_snapshot(limit=8)
    summary = snap.get("summary") or {}
    items = snap.get("items") or []
    lines = [
        "📤 <b>Outbox рассылок</b>",
        "",
        "Короткий readout по черновикам, активным и завершённым рассылкам.",
        "",
        "<b>Сводка</b>",
        f"• Черновики: <b>{int(summary.get('draft') or 0)}</b>",
        f"• Идут сейчас: <b>{int(summary.get('running') or 0)}</b>",
        f"• Завершены: <b>{int(summary.get('completed') or 0)}</b>",
        f"• Остановлены: <b>{int(summary.get('stopped') or 0)}</b>",
        f"• Ожидают ретрая: <b>{int(summary.get('retry_pending') or 0)}</b>",
        f"• Ошибок доставки: <b>{int(summary.get('failed_deliveries') or 0)}</b>",
        "",
        "<b>Последние строки</b>",
    ]
    if items:
        for item in items[:8]:
            finished_at = item.get('completed_at') or item.get('stopped_at') or item.get('updated_at') or item.get('created_at')
            lines.append(
                f"• <code>{escape(str(item.get('broadcast_id') or '—'))}</code> — {escape(broadcast_service.broadcast_status_label(item.get('status')))} — {escape(broadcast_service.audience_label(item.get('audience')))} — {escape(broadcast_service.source_type_label(item.get('source_message_type')))} — доставлено {int(item.get('sent_count') or 0)}/{int(item.get('total_count') or 0)} — ретрай {int(item.get('retry_pending') or 0)} — ошибок {int(item.get('failed_count') or 0)} — {escape(_format_timestamp(finished_at))}"
            )
    else:
        lines.append("• История рассылок пока пустая.")
    lines.extend(["", "<b>Следующее действие</b>", f"• {escape(str(snap.get('next_action') or '—'))}"])
    return "\n".join(lines)


def _render_tg_admin_user_lookup_receipt(user_card: dict) -> str:
    active_flags = user_card.get("active_risk_flags") or []
    return (
        "👤 <b>Квитанция по пользователю</b>\n\n"
        f"• Пользователь: <b>{int(user_card.get('user_id') or 0)}</b> @{escape(str(user_card.get('username') or '-'))}\n"
        f"• Имя: <b>{escape(str(user_card.get('first_name') or '-'))}</b>\n"
        f"• Баланс / резерв: <b>{float(user_card.get('balance') or 0):.2f} GRAM</b> / <b>{float(user_card.get('reserved_amount') or 0):.2f} GRAM</b>\n"
        f"• Риск / freeze: <b>{escape(str(user_card.get('risk_level') or 'normal'))}</b> / <b>{'да' if user_card.get('is_frozen') else 'нет'}</b>\n"
        f"• Активные флаги: <b>{len(active_flags)}</b>\n"
        f"• Последние выводы: <b>{len(user_card.get('recent_withdrawals') or [])}</b>\n"
        f"• Последние депозиты: <b>{len(user_card.get('recent_deposits') or [])}</b>\n\n"
        "Для полной истории и всех действий откройте карточку пользователя в Web Admin."
    )


async def _enforce_admin_callback(query, *, user_id: int, callback_data: str) -> bool:
    if _is_admin_user(user_id):
        return True
    logger.warning("Blocked admin callback from non-admin user %s: %s", user_id, callback_data)
    await safe_answer_callback(query, "Требуется доступ оператора.", show_alert=True)
    return False


def require_admin_callback(handler):
    @wraps(handler)
    async def wrapper(query, context, *, user_id: int, callback_data: str):
        if not await _enforce_admin_callback(query, user_id=user_id, callback_data=callback_data):
            return
        return await handler(query, context, user_id=user_id, callback_data=callback_data)

    return wrapper


def _allow_admin_message_state(user_id: int, state_key: str | None) -> bool:
    if _is_admin_user(user_id):
        return True
    if str(state_key or "").startswith(("admin_waiting_", "admin_bc_", "admin_notice_")):
        user_states.pop(user_id, None)
    logger.warning("Blocked admin runtime state from non-admin user %s: %s", user_id, state_key)
    return False


def require_admin_command(handler):
    @wraps(handler)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user = update.effective_user
        user_id = user.id if user else 0
        if not _is_admin_user(user_id):
            logger.warning("Blocked admin command from non-admin user %s", user_id)
            return
        return await handler(update, context, *args, **kwargs)

    return wrapper


def require_login(handler):
    """Декоратор для колбэк-обработчиков, требующих регистрации."""
    @wraps(handler)
    async def wrapper(query, context):
        user = query.from_user
        if not user:
            return
        user_id = user.id
        create_or_update_user(user_id, user.username, user.first_name)
        # проверка блокировки
        from database import get_connection
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_blocked FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
        if row and row["is_blocked"]:
            return  # молча игнорируем заблокированных
        return await handler(query, context)
    return wrapper


# ---------------------------------------------------------------------------
# TTL cache: blocked users (5-minute TTL, reduces DB calls dramatically)
# ---------------------------------------------------------------------------
import time as _time

_blocked_cache: dict[int, tuple[bool, float]] = {}
_BLOCKED_TTL = 300  # 5 minutes


def is_user_blocked(user_id: int) -> bool:
    """Return True if user is blocked. Result is cached for 5 minutes."""
    now = _time.monotonic()
    cached = _blocked_cache.get(user_id)
    if cached and cached[1] > now:
        return cached[0]
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT is_blocked FROM users WHERE user_id = ?", (user_id,)
            ).fetchone()
        blocked = bool(row and row["is_blocked"])
    except Exception:
        blocked = False
    _blocked_cache[user_id] = (blocked, now + _BLOCKED_TTL)
    return blocked


def invalidate_blocked_cache(user_id: int) -> None:
    """Call after admin ban/unban to clear stale cache entry."""
    _blocked_cache.pop(user_id, None)


# ---------------------------------------------------------------------------
# TTL cache: workspace owner per chat (60-second TTL)
# ---------------------------------------------------------------------------
_workspace_owner_cache: dict[int, tuple[int | None, float]] = {}
_WORKSPACE_OWNER_TTL = 60  # seconds


def _get_workspace_owner_cached(chat_id: int) -> int | None:
    now = _time.monotonic()
    cached = _workspace_owner_cache.get(chat_id)
    if cached and cached[1] > now:
        return cached[0]
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT owner_user_id FROM workspaces WHERE telegram_chat_id = ? AND status = 'active'",
                (str(chat_id),),
            ).fetchone()
        owner = int(row["owner_user_id"]) if row else None
    except Exception:
        owner = None
    _workspace_owner_cache[chat_id] = (owner, now + _WORKSPACE_OWNER_TTL)
    return owner


def invalidate_workspace_owner_cache(chat_id: int) -> None:
    """Call after workspace connect/disconnect to clear stale cache."""
    _workspace_owner_cache.pop(chat_id, None)


# ---------------------------------------------------------------------------
# TTL cache: menu_mode ('play' or 'full', 5-minute TTL)
# ---------------------------------------------------------------------------

_menu_mode_cache: dict[int, tuple[str, float]] = {}
_MENU_MODE_CACHE_TTL = 300  # seconds

# Giveaway counts cache — 3 min TTL, prevents 3 DB hits on every menu render
_giveaway_count_cache: dict[int, tuple[bool, int, float, int]] = {}
_GW_COUNT_CACHE_TTL = 180  # seconds


def get_cached_menu_mode(user_id: int) -> str:
    """Return user's menu mode with 5-minute in-memory cache."""
    now = _time.monotonic()
    entry = _menu_mode_cache.get(user_id)
    if entry and now - entry[1] < _MENU_MODE_CACHE_TTL:
        return entry[0]
    mode = get_user_menu_mode(user_id)
    _menu_mode_cache[user_id] = (mode, now)
    return mode


def invalidate_menu_mode_cache(user_id: int) -> None:
    """Call after toggling mode to ensure next access reads fresh DB value."""
    _menu_mode_cache.pop(user_id, None)


# ---------------------------------------------------------------------------
# @guarded decorator — blocks banned users AND enforces _is_allowed_in_chat
# ---------------------------------------------------------------------------

def guarded(handler):
    """Decorator for command handlers:
    - silently drops requests from blocked users
    - enforces _is_allowed_in_chat (group admin / workspace owner check)
    """
    @wraps(handler)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user = update.effective_user
        if not user:
            return
        if is_user_blocked(user.id):
            return  # silently ignore banned users
        if not await _is_allowed_in_chat(update, context):
            return
        return await handler(update, context, *args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Safe (idempotent) publish helpers — prevent double publishing
# ---------------------------------------------------------------------------

async def safe_publish_result(bot, game_id: int) -> None:
    """Publish duel result to workspace feeds with an atomic at-most-once claim.

    The DB flag is claimed before the Telegram network call on purpose. This
    prevents duplicate result posts under concurrent callers. The trade-off is
    at-most-once delivery: if Telegram publishing fails after the claim, Roll
    Duel may skip that public result post instead of risking chat spam.
    """
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT player1_id, player2_id FROM games WHERE game_id = ?",
                (game_id,),
            ).fetchone()
            if not row:
                return
            player1_id = row["player1_id"]
            player2_id = row["player2_id"]

            # Atomic claim: only one concurrent caller may flip the publish flag.
            cursor = conn.execute(
                """
                UPDATE games
                   SET result_published = 1
                 WHERE game_id = ?
                   AND COALESCE(result_published, 0) = 0
                """,
                (game_id,),
            )
            if cursor.rowcount != 1:
                logger.info("safe_publish_result: game %s already published, skipping", game_id)
                conn.rollback()
                return
            conn.commit()
    except Exception as exc:
        logger.exception("safe_publish_result: DB error for game %s: %s", game_id, exc)
        return
    try:
        await publish_result_to_default_workspaces(
            bot, participant_user_ids=[player1_id, player2_id], game_id=game_id
        )
    except Exception as exc:
        logger.exception("safe_publish_result: publish failed for game %s: %s", game_id, exc)


async def safe_finish_publish(context, game_id: int) -> None:
    """Wrapper around safe_publish_result for use inside handle_game_finish."""
    await safe_publish_result(context.bot, game_id)


def _format_timestamp(value) -> str:
    if value is None:
        return "—"
    text = str(value).replace("T", " ")
    if "+" in text:
        text = text.split("+")[0]
    if "." in text:
        text = text.split(".")[0]
    return f"{text} UTC"



def _clip_admin_text(value: str | None, limit: int = 140) -> str:
    text = str(value or "").strip()
    if len(text) <= max(1, limit):
        return text
    return text[: max(1, limit) - 3] + "..."


def _render_allowlist_sources_lines(sources: list[dict] | None) -> list[str]:
    rows = sources or []
    if not rows:
        return ["• Источники env: не найдены."]
    lines = []
    for item in rows:
        used_ids = [str(value) for value in (item.get("used_ids") or item.get("ids") or []) if str(value)]
        rendered_ids = ", ".join(used_ids[:10]) if used_ids else "—"
        lines.append(f"• <code>{escape(str(item.get('name') or '—'))}</code>: <code>{escape(rendered_ids)}</code>")
    return lines


def _render_broadcast_delivery_row_line(item: dict) -> str:
    user_id = int(item.get("user_id") or 0)
    username = str(item.get("username") or "").strip()
    first_name = str(item.get("first_name") or "").strip()
    who = f"@{username}" if username else (first_name or "—")
    updated_at = item.get("next_retry_at") or item.get("last_attempt_at") or item.get("delivered_at") or item.get("sent_at")
    meta_parts = [
        f"попыток <b>{int(item.get('attempt_count') or 0)}</b>",
        f"код <code>{escape(str(item.get('last_result_code') or '—'))}</code>",
        f"обновлено <b>{escape(_format_timestamp(updated_at))}</b>",
    ]
    if str(item.get("status") or "").lower() == "retry_pending" and item.get("next_retry_at"):
        meta_parts.append(f"след. ретрай <b>{escape(_format_timestamp(item.get('next_retry_at')))}</b>")
    details = " · ".join(meta_parts)
    error_text = _clip_admin_text(str(item.get("error_text") or ""), 160)
    line = (
        f"• <code>{user_id}</code> — <b>{escape(str(who))}</b> — <b>{escape(str(item.get('status_label') or '—'))}</b>\n"
        f"  └ {details}"
    )
    if error_text:
        line += f"\n  └ ошибка: <code>{escape(error_text)}</code>"
    return line


def _render_tg_admin_broadcast_results_text(row: dict | None) -> str:
    if not row:
        return "📍 <b>Результаты доставки</b>\n\nРассылка не найдена."
    delivery_rows = broadcast_service.list_broadcast_delivery_rows(str(row.get("broadcast_id") or ""), limit=8)
    status_label = broadcast_service.broadcast_status_label(row.get("status"))
    lines = [
        "📍 <b>Результаты доставки</b>",
        "",
        f"• ID: <code>{escape(str(row.get('broadcast_id') or '—'))}</code>",
        f"• Статус: <b>{escape(status_label)}</b>",
        f"• Аудитория: <b>{escape(broadcast_service.audience_label(row.get('audience')))}</b>",
        f"• Доставлено / всего: <b>{int(row.get('sent_count') or 0)}</b> / <b>{int(row.get('total_count') or 0)}</b>",
        f"• Ожидают ретрая: <b>{int(row.get('retry_pending') or 0)}</b>",
        f"• Ошибок: <b>{int(row.get('failed_count') or 0)}</b>",
        "",
        "<b>Последние delivery rows</b>",
    ]
    if delivery_rows:
        lines.extend(_render_broadcast_delivery_row_line(item) for item in delivery_rows)
    else:
        lines.append("• Пока нет delivery rows. Они появятся после реального запуска или ретрая.")
    lines.extend(["", "<b>Следующий шаг</b>"])
    if int(row.get("retry_pending") or 0) > 0:
        lines.append("• Откройте «Повторить ошибки» или дождитесь следующего backend retry tick.")
    elif str(row.get("status") or "").lower() == "running":
        lines.append("• Обновите этот экран через несколько секунд, чтобы увидеть реальные delivery rows.")
    elif int(row.get("failed_count") or 0) > 0:
        lines.append("• Проверьте коды и тексты ошибок, затем при необходимости откройте повтор ошибок.")
    else:
        lines.append("• Коридор чистый: можно вернуться в карточку рассылки или Outbox.")
    return "\n".join(lines)


def _render_allowlist_preflight_text(preflight: dict) -> str:
    target_count = int(preflight.get("target_count") or 0)
    target_ids = [str(value) for value in (preflight.get("target_ids") or []) if str(value)]
    lines = [
        "🧪 <b>Тест на allowlist</b>",
        "",
        "Бот отправит сообщение только founder/operator allowlist и не затронет пользовательскую аудиторию.",
        "",
        "<b>Preflight</b>",
        f"• Найдено целей: <b>{target_count}</b>",
        f"• Preview ID: <code>{escape(', '.join(target_ids) if target_ids else '—')}</code>",
        f"• Источников env с ID: <b>{int(preflight.get('source_count') or 0)}</b>",
        "",
        "<b>Сборка allowlist</b>",
    ]
    lines.extend(_render_allowlist_sources_lines(preflight.get("sources") or []))
    lines.extend(["", "<b>Что дальше</b>"])
    if target_count > 0:
        lines.append("• Проверьте IDs выше и только потом подтверждайте отправку.")
    else:
        lines.append("• Сначала задайте ADMIN_CHAT_ID / TG_OPERATOR_IDS / ADMIN_IDS и перезапустите бота.")
    return "\n".join(lines)


def render_main_menu_text(user_id: int = None, t=None) -> str:
    """Main menu text — compact product copy for the user-facing bot home screen."""
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")

    header = t("menu.title", default="🎲 Roll Duel")
    balance_line = ""
    if user_id:
        try:
            balance = get_user_balance(user_id) or 0.0
            balance_line = "\n\n" + t(
                "menu.balance_line",
                default="💰 Balance: <b>{balance} GRAM</b>",
                balance=f"{balance:.2f}",
            )
        except Exception as e:
            logger.exception(f"render_main_menu_text balance failed for user {user_id}: {e}")

    mode_hint = _render_menu_mode_hint(user_id, t) if user_id else ""
    invite_footer = t(
        "menu.invite_footer",
        default="👥 Invite friends and earn bonuses from their games.\n➡️ Share your link in Profile.",
    )

    return (
        f"{header}{balance_line}\n\n"
        + t(
            "menu.body",
            default="⚔️ Duels, balance, stats, groups, giveaways. All in Telegram.",
        )
        + f"\n\n{mode_hint.strip()}\n\n"
        + f"{invite_footer}\n\n"
        + t("menu.cta", default="What do you want to do?")
    )

def _render_menu_mode_hint(user_id: int | None, t=None) -> str:
    """Return a short contextual line for the current menu mode."""
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    if not user_id:
        return ""
    mode = get_cached_menu_mode(user_id)
    if mode == "play":
        return t(
            "menu.hint_play",
            default=(
                "\n🎮 <i>Play Mode — duels &amp; essentials only.\n"
                "Tap «🧩 Full Suite →» for all features.</i>"
            ),
        )
    return t(
        "menu.hint_full",
        default=(
            "\n💡 <i>Want a simpler view?\n"
            "Try <b>🎮 Play Mode</b> — just duels &amp; essentials.</i>"
        ),
    )

def render_open_app_text() -> str:
    return (
        "🧪 <b>Mini App</b>\n\n"
        "The main Roll Duel flow now runs in the bot.\n\n"
        "Open the Mini App only if you need to check the older experimental surface."
    )

def render_help_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return (
        t("screen.help.title", default="🎲 <b>Roll Duel — quick guide</b>") + "\n\n"
        + t("screen.help.how_title", default="<b>How duels work</b>") + "\n"
        + t("screen.help.how_body",
            default=(
                "1. Create a duel and choose a GRAM stake.\n"
                "2. Wait for another player or join an open duel.\n"
                "3. Each player sends one fresh 🎲 dice message in the bot chat.\n"
                "4. The higher roll wins the pot."
            )) + "\n\n"
        + t("screen.help.money_title", default="<b>Money flow</b>") + "\n"
        + t("screen.help.money_deposit", default="• <b>Deposits:</b> Only via CryptoBot invoice.") + "\n"
        + t("screen.help.money_withdraw", default="• <b>Withdrawals:</b> Only to your connected TON wallet (via TON Connect).") + "\n"
        + "\u2022 " + t('screen.help.min_deposit', default='Minimum deposit: {amount} GRAM.', amount=f'{MIN_DEPOSIT_AMOUNT:.1f}') + "\n"
        + "\u2022 " + t('screen.help.min_withdraw', default='Minimum withdrawal: {amount} GRAM.', amount="{:.1f}".format(float(get_effective_gram_withdrawal_minimum()))) + "\n\n"
        + t("screen.help.tips_title", default="<b>Useful tips</b>") + "\n"
        + t("screen.help.tips_body",
            default=(
                "• Demo Mode uses Demo GRAM and never touches your real balance.\n"
                "• Use My Chats to manage connected groups and leaderboard posting.\n"
                "• Use only fresh dice rolls — forwarded dice do not count.\n"
                "• If a player times out, the duel is settled by backend truth."
            )) + "\n\n"
        + t("screen.help.ton_connect_note",
            default="💡 <b>TON Connect ≠ Deposits</b> — it's only for withdrawals and future features.")
    )

def render_support_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    lines = [
        t("screen.support.title", default="🛟 <b>Roll Duel — Support</b>"),
        "",
        t("screen.support.intro", default="Questions, bug reports, and product feedback are welcome."),
        "",
        t("screen.support.contact_title", default="<b>Contact</b>"),
        t("screen.support.contact_tg", default="• Telegram: {handle}", handle=SUPPORT_TELEGRAM_HANDLE),
        t("screen.support.contact_bot", default="• You can also continue in this bot chat if something looks stuck."),
        "",
        t("screen.support.payments_title", default="<b>Payments</b>"),
        t("screen.support.payments_deposits", default="• Deposits and withdrawals use CryptoBot."),
        t("screen.support.payments_balance", default="• Your Roll Duel balance is used for duel stakes and payouts."),
    ]
    if SUPPORT_TON_ADDRESS:
        lines.extend([
            "",
            t("screen.support.ton_title", default="<b>GRAM support address</b>"),
            f"• <code>{SUPPORT_TON_ADDRESS}</code>",
        ])
    lines.extend([
        "",
        t("screen.support.notes_title", default="<b>Notes</b>"),
        t("screen.support.notes_stale", default="• If something looks stale, refresh and try again."),
        t("screen.support.notes_group", default="• If a group looks disconnected, open My Chats and recheck it there."),
    ])
    return "\n".join(lines)


def render_community_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return "\n\n".join([
        t("community.title", default="🌐 <b>Roll Duel Community</b>"),
        t(
            "community.intro",
            default="Follow official updates, find open duels, meet players, and get community support.",
        ),
        t(
            "community.language_note",
            default="Open Duels and player chat open in your selected language. Every public duel is open to all Roll Duel players.",
        ),
        t(
            "community.safety",
            default=(
                "🔒 <b>Safety</b>\n"
                "• 18+ only. Play responsibly.\n"
                "• Admins never contact users first.\n"
                "• Never share seed phrases, private keys, or private payment details.\n"
                "• Use only links published by the official bot and channel."
            ),
        ),
    ])


def _community_topic_url(name: str, default: str) -> str:
    return str(os.getenv(name, default) or default).strip()


def _community_private_link(target: str) -> str:
    return f"https://t.me/{BOT_USERNAME}?start={target}"


def _community_ephemeral_keyboard(kind: str, *, t, language: str) -> InlineKeyboardMarkup:
    lang = (language or "en")[:2]
    open_duels = _community_topic_url(
        "COMMUNITY_OPEN_DUELS_RU_URL" if lang == "ru" else "COMMUNITY_OPEN_DUELS_EN_URL",
        "https://t.me/rollduelchat/37" if lang == "ru" else "https://t.me/rollduelchat/35",
    )
    chat_url = _community_topic_url(
        "COMMUNITY_CHAT_RU_URL" if lang == "ru" else "COMMUNITY_CHAT_EN_URL",
        "https://t.me/rollduelchat/41" if lang == "ru" else "https://t.me/rollduelchat/39",
    )
    support_url = _community_topic_url("COMMUNITY_SUPPORT_URL", "https://t.me/rollduelchat/45")
    feedback_url = _community_topic_url("COMMUNITY_FEEDBACK_URL", "https://t.me/rollduelchat/47")

    if kind == "balance":
        rows = [
            [InlineKeyboardButton(t("community.ephemeral.btn.open_balance", default="💰 Open Balance"), url=_community_private_link("community_balance"))],
            [InlineKeyboardButton(t("community.ephemeral.btn.play", default="🎮 Play"), url=_community_private_link("community_play"))],
        ]
    elif kind == "tournament":
        rows = [
            [InlineKeyboardButton(t("community.ephemeral.btn.open_tournaments", default="🏆 Open Tournaments"), url=_community_private_link("community_tournament"))],
            [InlineKeyboardButton(t("community.ephemeral.btn.play", default="🎮 Play"), url=_community_private_link("community_play"))],
        ]
    elif kind == "help":
        rows = [
            [InlineKeyboardButton(t("community.btn.open_duels", default="🎲 Open Duels"), url=open_duels), InlineKeyboardButton(t("community.btn.players_chat", default="💬 Players Chat"), url=chat_url)],
            [InlineKeyboardButton(t("community.btn.support", default="🛠 Support & Bugs"), url=support_url), InlineKeyboardButton(t("community.btn.feedback", default="💡 Ideas & Feedback"), url=feedback_url)],
            [InlineKeyboardButton(t("community.ephemeral.btn.open_bot", default="🎮 Open Roll Duel"), url=_community_private_link("community_play"))],
        ]
    else:
        rows = [
            [InlineKeyboardButton(t("community.ephemeral.btn.open_bot", default="🎮 Open Roll Duel"), url=_community_private_link("community_play"))],
            [InlineKeyboardButton(t("community.ephemeral.btn.demo", default="🧪 Demo"), url=_community_private_link("practice")), InlineKeyboardButton(t("community.ephemeral.btn.tournaments", default="🏆 Tournaments"), url=_community_private_link("community_tournament"))],
            [InlineKeyboardButton(t("community.btn.open_duels", default="🎲 Open Duels"), url=open_duels)],
        ]
    return InlineKeyboardMarkup(rows)


def _render_community_ephemeral_play(*, t) -> str:
    return t(
        "community.ephemeral.play",
        default=(
            "🎮 <b>Roll Duel in this community</b>\n\n"
            "This menu is visible only to you.\n\n"
            "⚡ <b>Quick Duel</b> — one round\n"
            "🎯 <b>Best of 3</b> — first to two wins\n"
            "🧪 <b>Demo</b> — no real GRAM"
        ),
    )


def _render_community_ephemeral_tournaments(*, t) -> str:
    lang = getattr(t, "lang", "en")
    tournaments = tournament_service.get_forming_tournaments(limit=3)
    lines = [t("community.ephemeral.tournament_title", default="🏆 <b>Tournaments</b>")]
    if not tournaments:
        lines.extend(["", t("community.ephemeral.tournament_empty", default="No open tournament is forming right now.")])
    else:
        lines.extend(["", t("community.ephemeral.tournament_open", default="Open registrations:")])
        for item in tournaments:
            tid = int(item.get("tournament_id") or 0)
            stake = float(item.get("stake_amount") or item.get("stake") or 0)
            current = int(item.get("participant_count") or 0)
            size = int(item.get("max_participants") or item.get("size") or item.get("max_players") or 0)
            fmt = str(item.get("match_format") or "single")
            format_label = t("community.ephemeral.format_bo3", default="Best of 3") if fmt == "best_of_3" else t("community.ephemeral.format_single", default="Single Round")
            lines.append(f"• <b>#{tid}</b> · {format_balance_display(stake)} · {current}/{size} · {format_label}")
    lines.extend(["", t("community.ephemeral.private_note", default="Open the bot to join or create a tournament. This group reply is private.")])
    return "\n".join(lines)


def _render_community_ephemeral_help(*, t) -> str:
    return t(
        "community.ephemeral.help",
        default=(
            "🌐 <b>Roll Duel Players</b>\n\n"
            "Use this group for open challenges, chat, highlights, support and feedback.\n\n"
            "Commands <code>/play</code>, <code>/balance</code>, <code>/tournament</code> and <code>/help</code> return private menus inside the group."
        ),
    )


async def _delete_visible_group_command_best_effort(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None or not getattr(message, "message_id", None):
        return
    try:
        await context.bot.delete_message(chat_id=message.chat_id, message_id=message.message_id)
    except Exception:
        # Commands configured as ephemeral are already invisible. This cleanup
        # is only for manually typed legacy/public commands.
        pass


async def _send_community_ephemeral(update: Update, context: ContextTypes.DEFAULT_TYPE, *, kind: str) -> None:
    chat = update.effective_chat
    user = update.effective_user
    message = update.effective_message
    if chat is None or user is None or message is None or chat.type not in {"group", "supergroup"}:
        return

    from services.telegram_ephemeral import is_chat_allowed, send_ephemeral_or_private
    if not is_chat_allowed(chat_id=chat.id, username=getattr(chat, "username", None)):
        return
    if is_user_blocked(user.id):
        return

    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    language = get_user_language(user.id) or ((user.language_code or "en")[:2])
    if language not in {"en", "ru"}:
        language = "en"
    t = get_translator(language)

    if kind == "balance":
        text = render_balance_screen_text(user.id, t=t) + "\n\n" + t("community.ephemeral.private_note", default="This response is visible only to you.")
    elif kind == "tournament":
        text = _render_community_ephemeral_tournaments(t=t)
    elif kind == "help":
        text = _render_community_ephemeral_help(t=t)
    else:
        text = _render_community_ephemeral_play(t=t)

    await send_ephemeral_or_private(
        context.bot,
        chat_id=chat.id,
        chat_username=getattr(chat, "username", None),
        receiver_user_id=user.id,
        text=text,
        message_thread_id=getattr(message, "message_thread_id", None),
        reply_markup=_community_ephemeral_keyboard(kind, t=t, language=language),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    await _delete_visible_group_command_best_effort(update, context)


async def community_play_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _send_community_ephemeral(update, context, kind="play")


async def community_balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _send_community_ephemeral(update, context, kind="balance")


async def community_tournament_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _send_community_ephemeral(update, context, kind="tournament")


async def community_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _send_community_ephemeral(update, context, kind="help")


@require_admin_command
async def community_ephemeral_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    message = update.effective_message
    if chat is None or user is None or message is None or chat.type not in {"group", "supergroup"}:
        return
    from services.telegram_ephemeral import configured_allowlist, get_chat_raw, is_chat_allowed, is_enabled, send_ephemeral_or_private
    community_state = "unknown"
    try:
        raw_chat = await get_chat_raw(context.bot, chat.id)
        community_state = "linked" if raw_chat.get("community") else "not linked / not visible to Bot API"
    except Exception as exc:
        community_state = f"probe failed: {type(exc).__name__}"
    try:
        member = await context.bot.get_chat_member(chat.id, context.bot.id)
        bot_admin = isinstance(member, (ChatMemberAdministrator, ChatMemberOwner))
    except Exception:
        bot_admin = False
    allowed = is_chat_allowed(chat_id=chat.id, username=getattr(chat, "username", None))
    text = (
        "🧪 <b>Roll Duel Community / Ephemeral Status</b>\n\n"
        f"Feature flag: <b>{'ON' if is_enabled() else 'OFF'}</b>\n"
        f"This chat allowed: <b>{'YES' if allowed else 'NO'}</b>\n"
        f"Bot is admin: <b>{'YES' if bot_admin else 'NO'}</b>\n"
        f"Community: <b>{escape(community_state)}</b>\n"
        f"Chat ID: <code>{chat.id}</code>\n"
        f"Username: <code>@{escape(str(getattr(chat, 'username', '') or '—'))}</code>\n"
        f"Topic ID: <code>{getattr(message, 'message_thread_id', None) or 0}</code>\n"
        f"Allowlist: <code>{escape(', '.join(configured_allowlist()) or 'empty')}</code>\n\n"
        "If this card arrived privately inside the topic, Bot API ephemeral delivery is working."
    )
    await send_ephemeral_or_private(
        context.bot,
        chat_id=chat.id,
        chat_username=getattr(chat, "username", None),
        receiver_user_id=user.id,
        text=text,
        message_thread_id=getattr(message, "message_thread_id", None),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    await _delete_visible_group_command_best_effort(update, context)


@require_admin_command
async def bind_duel_feed_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bind the current Telegram forum topic as the EN or RU open-duel feed."""
    message = update.effective_message
    chat = update.effective_chat
    user = update.effective_user
    if message is None or chat is None or user is None:
        return
    language = str(context.args[0] if context.args else "").strip().lower()
    if language not in {"en", "ru"}:
        await message.reply_text("Usage: /bind_duel_feed en  or  /bind_duel_feed ru")
        return
    thread_id = getattr(message, "message_thread_id", None)
    if chat.type == "private" or not getattr(chat, "is_forum", False) or not thread_id:
        await message.reply_text("Run this command inside the target forum topic, not in private chat or General.")
        return
    try:
        from services.community_duel_feed import bind_topic
        topic_name = "🎲 Open Duels — English" if language == "en" else "🎲 Открытые дуэли — Русский"
        binding = bind_topic(
            language=language,
            chat_id=int(chat.id),
            message_thread_id=int(thread_id),
            operator_id=int(user.id),
            chat_title=str(getattr(chat, "title", "") or ""),
            topic_name=topic_name,
        )
    except Exception as exc:
        logger.exception("bind_duel_feed failed: %s", exc)
        await message.reply_text(f"❌ Binding failed: {escape(str(exc))}", parse_mode=ParseMode.HTML)
        return
    label = "English" if language == "en" else "Русский"
    await message.reply_text(
        "✅ <b>Duel feed bound</b>\n\n"
        f"Language: <b>{label}</b>\n"
        f"Chat: <code>{binding['chat_id']}</code>\n"
        f"Topic ID: <code>{binding['message_thread_id']}</code>\n\n"
        "New public real GRAM duels in this language will be posted here automatically.",
        parse_mode=ParseMode.HTML,
    )


@require_admin_command
async def community_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show topic bindings and publication health for operators."""
    message = update.effective_message
    if message is None:
        return
    try:
        from services.community_duel_feed import status_snapshot
        snapshot = status_snapshot()
    except Exception as exc:
        logger.exception("community_status failed: %s", exc)
        await message.reply_text(f"❌ Community status failed: {escape(str(exc))}", parse_mode=ParseMode.HTML)
        return

    lines = [
        "🌐 <b>Community Duel Feed</b>",
        "",
        f"Runtime bot: <b>{'registered' if snapshot.get('bot_registered') else 'not registered'}</b>",
    ]
    for lang, label in (("en", "English"), ("ru", "Русский")):
        binding = (snapshot.get("bindings") or {}).get(lang)
        if binding:
            lines.append(
                f"{label}: ✅ <code>{binding['chat_id']}</code> / topic <code>{binding['message_thread_id']}</code>"
            )
        else:
            lines.append(f"{label}: ❌ not bound")
    counts = snapshot.get("counts") or {}
    if counts:
        lines.extend(["", "<b>Publication states</b>"])
        for key in sorted(counts):
            lines.append(f"• {escape(str(key))}: <b>{int(counts[key])}</b>")
    else:
        lines.extend(["", "No publication rows yet."])
    await message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)

def render_practice_menu_text(user_id: int, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    balance = get_practice_balance(user_id)
    stats = get_practice_stats(user_id)
    stats_text = ""
    if stats["played"] > 0:
        stats_text = t(
            "practice.stats_line",
            default="📊 <b>Demo stats:</b> {played} played • {won} won • {draws} draws ({rate}% win rate)\n",
            played=stats["played"],
            won=stats["won"],
            draws=stats["draws"],
            rate=stats["win_rate"],
        )
    refill_note = ""
    if can_restore_practice_balance(user_id):
        refill_note = t(
            "practice.balance.restore_available",
            default="\n♻️ Your Demo balance is below the minimum stake. Open Demo Balance to restore it to {amount} Demo GRAM.\n",
            amount=f"{PRACTICE_START_BALANCE:.0f}",
        )
    return (
        t("practice.menu.title", default="🧪 <b>Demo Mode</b>") + "\n\n"
        + t("practice.menu.intro", default="Use Demo GRAM to learn the full duel flow before your first real duel.") + "\n\n"
        + t("practice.menu.balance_line", default="<b>Demo balance:</b> {amount} Demo GRAM\n", amount=f"{balance:.2f}")
        + stats_text
        + refill_note
        + t(
            "practice.menu.note",
            default=(
                "<b>Demo Mode never affects:</b> real balance, real leaderboards, or community posts.\n"
                "Demo settlement uses the same fee logic as a real duel, but no real GRAM moves."
            ),
        )
    )


def render_practice_balance_text(user_id: int, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    balance = get_practice_balance(user_id)
    restore_line = ""
    if can_restore_practice_balance(user_id):
        restore_line = "\n" + t(
            "practice.balance.restore_hint",
            default="Your balance is below the minimum Demo stake. Use <b>Restore Demo Balance</b> to return to the training balance.",
        )
    return (
        t("practice.balance.title", default="💎 <b>Demo Balance</b>") + "\n\n"
        + t("practice.balance.available", default="<b>Available:</b> {amount} Demo GRAM\n", amount=f"{balance:.2f}") + "\n"
        + t(
            "practice.balance.note",
            default="Demo balance is only for Demo Duels. It cannot be withdrawn or used in real GRAM duels.",
        )
        + restore_line
    )


def render_practice_about_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return (
        t("practice.about.title", default="ℹ️ <b>How Demo Mode works</b>") + "\n\n"
        + t("practice.about.body",
            default=(
                "• Practice duels use Demo GRAM only.\n"
                "• Your real GRAM balance is never touched here.\n"
                "• Practice results do not enter real leaderboards or group posts.\n"
                "• Use practice to test invite, join, roll, result, and rematch flows before your first deposit.\n"
                "• When you are ready, switch to Real Balance and deposit GRAM for live duels."
            ))
    )



def _get_active_duel_context(user_id: int) -> tuple[str | None, dict | None]:
    real_game = get_active_game(user_id)
    if real_game:
        return "real", real_game
    practice_game = get_active_practice_game(user_id)
    if practice_game:
        return "practice", practice_game
    return None, None


def _safe_positive_float(value, default: float) -> float:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return float(default)
    if not math.isfinite(amount) or amount <= 0:
        return float(default)
    return amount


def _normalize_real_duel_stake(raw_amount, *, user_id: int, balance: float, t=None) -> tuple[bool, float, str | None]:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    min_stake = float(platform_settings.get_float("min_stake_ton") or 0.1)
    max_stake = float(platform_settings.get_float("max_stake_ton") or 1000.0)
    amount = _safe_positive_float(raw_amount, min_stake)
    if amount < min_stake:
        amount = min_stake
    if amount > max_stake:
        amount = max_stake
    is_valid, error_message = validate_bet_amount(amount, balance, t=t, user_id=user_id)
    if not is_valid:
        return False, amount, error_message
    return True, amount, None


def _human_duel_status(status: str | None, *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    key = str(status or "active").strip().lower()
    mapping = {
        "waiting": t("duel.status.waiting", default="Ожидание соперника"),
        "active": t("duel.status.active", default="Активна"),
        "rolling": t("duel.status.rolling", default="Ожидаем броски кубиков"),
        "settling": t("duel.status.settling", default="Завершается"),
        "finished": t("duel.status.finished", default="Завершена"),
        "cancelled": t("duel.status.cancelled", default="Отменена"),
        "timed_out": t("duel.status.timed_out", default="Истекла"),
    }
    return mapping.get(key, key.replace("_", " ").title())


def _friendly_game_error(error: str | None, *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    raw = str(error or "").strip()
    normalized = raw.lower()
    if "active duel" in normalized:
        return t("duel.error.already_active_short", default="У вас уже есть активная дуэль. Сначала завершите или отмените её.")
    if "insufficient" in normalized or "balance" in normalized:
        return t("duel.error.insufficient_balance_short", default="Не хватает GRAM на балансе для этой дуэли.")
    return t("error.generic_short", default="Что-то пошло не так. Попробуйте ещё раз.")


def get_active_duel_conflict_keyboard(kind: str | None, active_game: dict | None = None, *, t=None) -> InlineKeyboardMarkup:
    """Action card for users who tap Create while a duel is already open.

    This is a UX-only router helper: it reuses existing callbacks and does not touch
    settlement, balance, refund, or reservation logic.
    """
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    status = str((active_game or {}).get("status") or "").lower()
    rows: list[list[InlineKeyboardButton]] = []
    if kind == "practice":
        game_id = (active_game or {}).get("practice_game_id")
        if status == "waiting" and game_id:
            rows.append([
                InlineKeyboardButton(
                    t("practice.btn.share", default="📨 Share Demo Duel"),
                    switch_inline_query=f"practice_{int(game_id)}",
                )
            ])
            rows.append([InlineKeyboardButton(t("duel.action.cancel_demo", default="❌ Cancel demo duel"), callback_data=f"pcancel_game_{game_id}")])
        else:
            rows.append([InlineKeyboardButton(t("btn.roll_dice", default="🎲 Roll Dice"), callback_data="game_status")])
            rows.append([InlineKeyboardButton(t("duel.action.leave_demo", default="❌ Leave demo duel"), callback_data="leave_game")])
        rows.append([InlineKeyboardButton(t("practice.btn.menu", default="🧪 Demo Mode"), callback_data="practice_mode")])
    else:
        game_id = (active_game or {}).get("game_id")
        if status == "waiting" and game_id:
            rows.append([InlineKeyboardButton(t("btn.cancel_duel", default="❌ Cancel duel"), callback_data=f"cancel_game_{game_id}")])
            rows.append([InlineKeyboardButton(t("btn.share_duel", default="📤 Share duel"), callback_data="ref_share_duel")])
            rows.append([InlineKeyboardButton(t("duel.action.check_status", default="📊 Duel status"), callback_data=f"check_game_{game_id}")])
        else:
            rows.append([InlineKeyboardButton(t("btn.roll_dice", default="🎲 Roll Dice"), callback_data="game_status")])
            rows.append([InlineKeyboardButton(t("duel.action.status", default="📊 Duel status"), callback_data="game_status")])
            rows.append([InlineKeyboardButton(t("duel.action.leave", default="❌ Leave duel"), callback_data="leave_game")])
    rows.append([InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")])
    return InlineKeyboardMarkup(rows)


def _active_duel_next_step(kind: str | None, status: str | None, *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    status_key = str(status or "active").strip().lower()
    if kind == "practice":
        if status_key == "waiting":
            return t(
                "duel.conflict.next_step.practice_waiting",
                default="Next step: wait for another player, or cancel this demo duel with the button below.",
            )
        return t(
            "duel.conflict.next_step.practice_active",
            default="Next step: send a fresh 🎲 dice roll in this chat. If you already rolled, wait for the opponent.",
        )
    if status_key == "waiting":
        return t(
            "duel.conflict.next_step.real_waiting",
            default="Next step: wait for an opponent, share this duel, or cancel it with the buttons below.",
        )
    if status_key == "settling":
        return t(
            "duel.conflict.next_step.real_settling",
            default="Next step: the result is being recorded. Wait a moment, then refresh your balance or open duel status.",
        )
    return t(
        "duel.conflict.next_step.real_active",
        default="Next step: send a fresh 🎲 dice roll in this chat. If you already rolled, wait for the opponent.",
    )


def _describe_active_duel_conflict(kind: str | None, active_game: dict | None = None, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    if kind == "practice":
        game_id = active_game.get("practice_game_id") if active_game else None
        stake = active_game.get("stake_amount") if active_game else None
        if stake is None and active_game:
            stake = active_game.get("bet_amount")
        status = active_game.get("status") if active_game else "active"
        status_label = _human_duel_status(status, t=t)
        return t(
            "duel.conflict.practice_detail",
            default=(
                "🧪 <b>You already have an active demo duel.</b>\n\n"
                "Duel: <b>#{game_id}</b>\n"
                "Stake: <b>{amount} Demo GRAM</b>\n"
                "Status: <b>{status}</b>\n\n"
                "{next_step}"
            ),
            game_id=game_id or "—",
            amount=f"{float(stake or 0):.2f}",
            status=status_label,
            next_step=_active_duel_next_step(kind, status, t=t),
        )
    game_id = active_game.get("game_id") if active_game else None
    stake = active_game.get("bet_amount") if active_game else None
    status = active_game.get("status") if active_game else "active"
    status_label = _human_duel_status(status, t=t)
    return t(
        "duel.conflict.real_detail",
        default=(
            "⚔️ <b>You already have an active duel.</b>\n\n"
            "Duel: <b>#{game_id}</b>\n"
            "Stake: <b>{amount} GRAM</b>\n"
            "Status: <b>{status}</b>\n\n"
            "{next_step}"
        ),
        game_id=game_id or "—",
        amount=f"{float(stake or 0):.2f}",
        status=status_label,
        next_step=_active_duel_next_step(kind, status, t=t),
    )



def _format_practice_amount(amount: float) -> str:
    return f"{float(amount):.2f} Demo GRAM"



def _format_practice_result_text(
    player1_name: str,
    player1_roll: int,
    player2_name: str,
    player2_roll: int,
    winner: str,
    stake_amount: float,
    *,
    payout_amount: float = 0.0,
    fee_amount: float = 0.0,
    fee_bps: int = 0,
    t=None,
) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    base = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t)
    if winner == "draw":
        return f"{base}\n{t('practice.result.stakes_returned', default='💎 Demo stakes returned: {amount}', amount=_format_practice_amount(stake_amount))}"
    return (
        f"{base}\n"
        + t(
            "practice.result.payout",
            default="🏆 Demo payout: {amount}",
            amount=_format_practice_amount(payout_amount),
        )
        + "\n"
        + t(
            "practice.result.fee",
            default="💸 Demo platform fee: {amount} ({percent:.2f}%)",
            amount=_format_practice_amount(fee_amount),
            percent=float(fee_bps) / 100,
        )
    )


def _format_leaderboard_row(item: dict, *, scope: str = "global", t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    rank = int(item.get('rank') or 0)
    name = item.get('displayName') or t("leaderboard.player_fallback", default="Player")
    wins = int(item.get('wins') or 0)
    if scope == "elo":
        elo_val = int(item.get('eloRating') or item.get('elo_rating') or 0)
        return t(
            "leaderboard.row.elo",
            default="#{rank} {name} — ELO {elo} • {wins} wins",
            rank=rank,
            name=name,
            elo=elo_val,
            wins=wins,
        )
    return t(
        "leaderboard.row.standard",
        default="#{rank} {name} — {wins} wins • {amount} GRAM won",
        rank=rank,
        name=name,
        wins=wins,
        amount=f"{float(item.get('totalTonWon') or 0):.2f}",
    )


def render_leaderboard_text(snapshot: dict, *, scope: str, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    normalized_scope = str(scope or 'global').strip().lower()
    leaderboards = snapshot.get('leaderboards') or {}
    workspace_meta = snapshot.get('workspace') or {}
    stats = snapshot.get('playerStats') or {}
    ranks = snapshot.get('currentUserRanks') or {}

    if normalized_scope == 'weekly':
        board = leaderboards.get('weekly') or {}
        title = t("leaderboard.title.weekly", default="🏆 <b>Weekly Leaderboard</b>")
        rank_value = ranks.get('weekly')
        subtitle = t("leaderboard.window", default="<b>Window:</b> last {days} days", days=int(board.get('windowDays') or 7))
    elif normalized_scope == 'workspace':
        board = leaderboards.get('workspace') or {}
        workspace_title = workspace_meta.get('title') or t("leaderboard.this_chat_title", default="Этот чат")
        title = f"💬 <b>{workspace_title}</b>"
        rank_value = ranks.get('workspace')
        subtitle = t("leaderboard.workspace_note", default="Only duels published to this group are counted here.")
    elif normalized_scope == 'elo':
        board = leaderboards.get('elo') or {}
        title = t("leaderboard.title.elo", default="🏆 <b>ELO Rating Leaderboard</b>")
        rank_value = ranks.get('elo')
        subtitle = t("leaderboard.scope_elo", default="<b>Scope:</b> ELO rating — skill-based ranking (K=32)")
    else:
        board = leaderboards.get('global') or {}
        title = t("leaderboard.title.global", default="🌐 <b>Global Leaderboard</b>")
        rank_value = ranks.get('global')
        subtitle = t("leaderboard.scope_all", default="<b>Scope:</b> all valid completed duels")

    lines = [title, '', subtitle]
    if rank_value:
        lines.append(t("leaderboard.your_rank", default="<b>Your rank:</b> #{rank}", rank=int(rank_value)))
    lines.extend([
        '',
        t("leaderboard.your_stats", default="<b>Your stats</b>"),
        t("leaderboard.stat_wins", default="• Wins: <b>{n}</b>", n=int(stats.get('wins') or 0)),
        t("leaderboard.stat_winrate", default="• Win rate: <b>{rate}%</b>", rate=f"{float(stats.get('winRate') or 0):.1f}"),
    ])
    if normalized_scope == 'elo':
        elo_rating = int(stats.get('eloRating') or stats.get('elo_rating') or 0)
        elo_rank_name = stats.get('eloRankName') or ''
        lines.append(t("leaderboard.stat_elo", default="• ELO: <b>{rating}</b> ({rank})", rating=elo_rating, rank=elo_rank_name))
    else:
        lines.append(t("leaderboard.stat_ton_won", default="• GRAM won: <b>{amount}</b>", amount=f"{float(stats.get('totalTonWon') or 0):.2f}"))
        lines.append(t("leaderboard.stat_streak", default="• Best streak: <b>{n}</b>", n=int(stats.get('bestStreak') or 0)))
    lines.extend([
        '',
        t("leaderboard.top_players", default="<b>Top players</b>"),
    ])

    items = board.get('items') or []
    if items:
        for item in items:
            prefix = '👉 ' if item.get('isCurrentUser') else '• '
            lines.append(prefix + _format_leaderboard_row(item, scope=normalized_scope, t=t))
    else:
        lines.append(t("leaderboard.no_results", default="No ranked duel results yet. Play more to build this leaderboard."))

    if normalized_scope == 'workspace' and not workspace_meta.get('available'):
        lines.extend(['', t("leaderboard.connect_group", default="Connect a group in <b>My Chats</b> to unlock this chat leaderboard.")])

    return '\n'.join(lines)

def render_balance_screen_text(user_id: int, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    snapshot = get_balance_snapshot(user_id)
    real_balance = float(snapshot["realBalance"])
    practice_balance = snapshot.get("practiceBalance")
    min_stake = float(snapshot["minStakeTon"])
    can_create = bool(snapshot.get("duelsEnabled")) and real_balance >= min_stake
    withdraw_note = (
        t("screen.balance.withdraw_from",
          default="• Withdraw from {min} GRAM to your @CryptoBot balance.",
          min=f"{float(snapshot['withdrawalMinTon']):.1f}")
        if snapshot.get("withdrawalsEnabled")
        else t("screen.balance.withdraw_paused",
               default="• Withdrawals are currently paused.")
    )
    demo_mode_enabled = bool(snapshot.get("demoModeEnabled", True))
    if not demo_mode_enabled:
        practice_line = ""
    elif practice_balance is None:
        practice_line = t(
            "screen.balance.practice_none",
            default="<b>Demo balance:</b> not opened yet — enter Demo Mode to unlock {seed} Demo GRAM",
            seed=f"{float(snapshot['practiceSeedAmount']):.0f}",
        )
    else:
        practice_line = t(
            "screen.balance.practice",
            default="<b>Demo balance:</b> {amount} Demo GRAM",
            amount=f"{float(practice_balance):.2f}",
        )
    readiness_line = (
        t("screen.balance.ready",
          default="✅ You can play real GRAM duels.\nMinimum stake — {min_stake} GRAM.",
          min_stake=f"{min_stake:.1f}")
        if can_create
        else t("screen.balance.not_ready",
               default="⚠️ You need at least {min_stake} GRAM for a real duel.",
               min_stake=f"{min_stake:.1f}")
    )
    balance_lines = [
        t("screen.balance.real", default="<b>You have:</b>") + f" {format_balance_display(real_balance)}"
    ]
    if practice_line:
        balance_lines.append(practice_line)

    flow_lines = [
        t("screen.balance.how_it_works", default="<b>How it works</b>"),
        t("screen.balance.deposit_note", default="• Deposit via CryptoBot invoice."),
        t("screen.balance.real_note", default="• Your GRAM balance is used for duel stakes and payouts."),
        withdraw_note,
    ]

    return "\n\n".join([
        t("screen.balance.title", default="💰 <b>Balance</b>"),
        "\n".join(balance_lines),
        readiness_line,
        "\n".join(flow_lines),
    ])


def render_balance_wallet_line(wallet: dict | None, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    wallet = wallet or {}
    if wallet.get("status") == "connected":
        return t(
            "screen.balance.wallet_connected",
            default="🔗 <b>TON wallet:</b> ✅ {addr}",
            addr=wallet.get("shortAddress", "connected"),
        )
    return t(
        "screen.balance.wallet_disconnected",
        default="🔗 <b>TON wallet:</b> not connected.\nYou do not need it for CryptoBot duels. You can connect it from Wallet.",
    )


def render_insufficient_balance_text(user_id: int, *, required_amount: float | None = None, action_label: str = "start this duel", t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    readiness = get_real_mode_readiness(user_id, required_amount=required_amount)
    real_balance = float(readiness["realBalance"])
    required = float(readiness["requiredAmount"])
    missing = max(float(readiness["missingAmount"]), 0.0)
    practice_balance = readiness.get("practiceBalance")
    if practice_balance is None:
        practice_line = t("balance.not_enough.practice_locked",
                          default="<b>Demo balance:</b> not opened yet — enter Demo Mode to unlock {seed:.0f} Demo GRAM",
                          seed=float(readiness["practiceSeedAmount"]))
    else:
        practice_line = t("balance.not_enough.practice_available",
                          default="<b>Demo balance:</b> {amount:.2f} Demo GRAM",
                          amount=float(practice_balance))
    return (
        t("balance.not_enough.title",    default="⚠️ <b>Not enough GRAM for real mode</b>") + "\n\n"
        + t("balance.not_enough.need",   default="You need <b>{required:.2f} GRAM</b> to {action}.", required=required, action=action_label) + "\n"
        + t("balance.not_enough.real",   default="<b>Real balance:</b> {bal:.2f} GRAM", bal=real_balance) + "\n"
        + t("balance.not_enough.missing",default="<b>Missing:</b> {miss:.2f} GRAM", miss=missing) + "\n\n"
        + practice_line + "\n\n"
        + t("balance.not_enough.next_step",
            default="Next step:\n• deposit GRAM to enter real duels, or\n• go back to Demo Mode and keep testing the full loop.")
    )
def render_invite_main_text(snapshot: dict, t=None) -> str:
    """Canonical Invite Friends screen — one clear entry point."""
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    invite_link = str(snapshot.get("inviteLink") or "").strip()
    invite_code = str(snapshot.get("inviteCode") or "").strip()
    invited_count = int(snapshot.get("invitedCount") or 0)
    activated_count = int(snapshot.get("activatedCount") or snapshot.get("activeInvited") or 0)

    short_link = snapshot.get("botDeepLink") or f"https://t.me/{BOT_USERNAME}?start=i_{invite_code}"
    long_link = invite_link or short_link
    link_for_copy = long_link if long_link else "—"

    copy_variants = "\n".join([
        "💬 <i>" + t("invite.copy_1", default="I found a useful Telegram bot for playing GRAM dice duels. Try it: {link}", link=link_for_copy) + "</i>",
        "💬 <i>" + t("invite.copy_2", default="This bot is handy for fast dice duels on GRAM. You can use it right in Telegram. Join: {link}", link=link_for_copy) + "</i>",
        "💬 <i>" + t("invite.copy_3", default="If you want a cleaner way to bet on dice and win GRAM, try this bot. Open it: {link}", link=link_for_copy) + "</i>",
    ])

    lines = [
        t("invite.contacts_title", default="📨 <b>Invite Friends</b>"),
        "",
        t("invite.share_text", default="Choose the link format that fits where you want to share Roll Duel."),
        t("invite.use_share", default="Use <b>Share invite</b> for the fastest Telegram-native flow."),
        "",
        t("invite.short_link_label", default="<b>Short link (DM / X / fast share):</b>"),
        f"<code>{escape(short_link)}</code>",
        t("invite.short_link_hint", default="Compact format — best when you just need the link itself."),
        "",
        t("invite.long_link_label", default="<b>Preview link (groups / chats):</b>"),
        f"<code>{escape(long_link)}</code>",
        t("invite.long_link_hint", default="Telegram will show the large preview card with image and text."),
        "",
        t("invite.invited_label", default="👥 <b>Invited:</b> {invited}    ✅ <b>Activated:</b> {activated}", invited=invited_count, activated=activated_count),
        t("invite.activated_hint", default="<i>«Activated» = an invited friend who has completed at least 3 real duels. Your tier bonus counts only activated friends.</i>"),
        "",
        t("invite.ready_messages_label", default="<b>Ready invite messages:</b>"),
        copy_variants,
    ]
    return "\n".join(lines)


def render_referral_text(snapshot: dict, t=None) -> str:
    return render_invite_main_text(snapshot, t=t)


def render_invite_card_text(snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    invite_link = str(snapshot.get("inviteLink") or "").strip()
    join_label = t("btn.join_roll_duel", default="🎲 Join Roll Duel")
    join_link = f'<a href="{escape(invite_link, quote=True)}">{escape(join_label)}</a>' if invite_link else escape(join_label)
    return "\n".join([
        t("invite.card_title", default="🎲 <b>Join me on Roll Duel!</b>"),
        "",
        t("invite.card_play", default="⚔️ Play fast GRAM dice duels in Telegram"),
        t("invite.card_win", default="🏆 Win real GRAM, climb the leaderboard"),
        t("invite.card_bonuses", default="🎁 Get bonuses for inviting friends"),
        "",
        t("invite.card_join", default="👇 {link}", link=join_link),
        "",
        t("invite.card_forward", default="Or forward this message to your friends!"),
    ])


def render_invite_link_text(snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    invite_link = str(snapshot.get("inviteLink") or "").strip()
    invite_link_code = escape(invite_link) if invite_link else "—"
    return (
        t("invite.link_title", default="🔗 <b>Your invite link</b>") + "\n\n"
        + t("invite.link_hint", default="Tap to copy, then paste into any Telegram chat, group, or DM.") + "\n\n"
        + f"<code>{invite_link_code}</code>"
    )


def render_inline_invite_share_text(snapshot: dict, t=None) -> str:
    # Use inviteLink (web OG URL if configured, else t.me) for message body.
    # Telegram will crawl this URL and show og:image preview.
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    invite_link = str(snapshot.get("inviteLink") or "").strip()
    join_label = t("btn.join_roll_duel", default="🎲 Join Roll Duel")
    join_link = f'<a href="{escape(invite_link, quote=True)}">{escape(join_label)}</a>' if invite_link else escape(join_label)
    return "\n".join([
        t("invite.card_title", default="🎲 <b>Join me on Roll Duel!</b>"),
        "",
        t("invite.card_play", default="⚔️ Fast GRAM dice duels in Telegram"),
        t("invite.card_win", default="🏆 Win real GRAM instantly"),
        "",
        t("invite.card_join", default="👉 {link}", link=join_link),
    ])



def _profile_league_from_rating(rating: int) -> dict:
    """Return display-only league metadata for player profile. Does not change rating logic."""
    tiers = [
        (1800, "master", "👑"),
        (1600, "diamond", "💎"),
        (1400, "platinum", "💠"),
        (1250, "gold", "🥇"),
        (1100, "silver", "🥈"),
        (0, "bronze", "🥉"),
    ]
    next_targets = {
        "bronze": 1100,
        "silver": 1250,
        "gold": 1400,
        "platinum": 1600,
        "diamond": 1800,
        "master": None,
    }
    for floor, key, icon in tiers:
        if rating >= floor:
            target = next_targets[key]
            return {
                "key": key,
                "icon": icon,
                "next_target": target,
                "points_to_next": max(0, target - rating) if target else None,
            }
    return {"key": "bronze", "icon": "🥉", "next_target": 1100, "points_to_next": max(0, 1100 - rating)}

def render_profile_text(snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    stats = snapshot.get("stats") or {}
    invite = snapshot.get("invite") or {}
    rating = int(stats.get('eloRating') or 1000)
    league = _profile_league_from_rating(rating)
    league_name = t(f"screen.profile.league.{league['key']}", default=league['key'].title())
    next_line = (
        t(
            "screen.profile.next_league",
            default="• Next league: <b>{points}</b> rating points away",
            points=int(league["points_to_next"]),
        )
        if league.get("points_to_next") is not None
        else t("screen.profile.top_league", default="• Top league reached")
    )
    return (
        t("screen.profile.title", default="👤 <b>Roll Duel Player Card</b>") + "\n\n"
        + t("screen.profile.identity_title", default="<b>Player</b>") + "\n"
        + t("screen.profile.name", default="Name: {name}", name=snapshot.get('displayName') or '—') + "\n"
        + t("screen.profile.username", default="Username: @{username}", username=escape(str(snapshot.get('username') or '—'))) + "\n"
        + t("screen.profile.balance", default="Balance: <b>{balance}</b>", balance=format_balance_display(float(snapshot.get('balance') or 0))) + "\n\n"
        + t("screen.profile.progress_title", default="🏅 <b>Player rating</b>") + "\n"
        + t("screen.profile.league_line", default="• League: <b>{icon} {league}</b>", icon=league["icon"], league=league_name) + "\n"
        + t("screen.profile.rating", default="• Rating: <b>{rating}</b>", rating=rating) + "\n"
        + next_line + "\n\n"
        + t("screen.profile.real_stats_title", default="⚔️ <b>Game stats</b>") + "\n"
        + t("screen.profile.total_duels", default="• Duels played: <b>{n}</b>", n=int(stats.get('totalDuels') or 0)) + "\n"
        + t("screen.profile.wld", default="• Wins / losses / draws: <b>{w}</b> / <b>{l}</b> / <b>{d}</b>",
            w=int(stats.get('wins') or 0), l=int(stats.get('losses') or 0), d=int(stats.get('draws') or 0)) + "\n"
        + t("screen.profile.winrate", default="• Win rate: <b>{rate}%</b>", rate=f"{float(stats.get('winRate') or 0):.1f}") + "\n"
        + t("screen.profile.streak_cur", default="• Current streak: <b>{n}</b>", n=int(stats.get('currentStreak') or 0)) + "\n"
        + t("screen.profile.streak_best", default="• Best streak: <b>{n}</b>", n=int(stats.get('bestStreak') or 0)) + "\n"
        + t("screen.profile.ton_won", default="• Total won: <b>{amount} GRAM</b>", amount=f"{float(stats.get('totalTonWon') or 0):.2f}") + "\n"
        + t("screen.profile.friends", default="• Friends invited: <b>{n}</b>", n=int(stats.get('inviteCount') or 0)) + "\n\n"
        + t("screen.profile.giveaways_title", default="🎁 <b>Giveaways</b>") + "\n"
        + t("screen.profile.giveaways_stats",
            default="• Created: <b>{created}</b> • Joined: <b>{joined}</b> • Won: <b>{won}</b>",
            created=int(stats.get('giveawaysCreated') or 0),
            joined=int(stats.get('giveawaysJoined') or 0),
            won=int(stats.get('giveawaysWon') or 0)) + "\n\n"
        + t("screen.profile.invite_code", default="<b>Your invite code:</b> <code>{code}</code>",
            code=invite.get('inviteCode') or '—')
    )

def render_duel_history_text(snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    import re
    from datetime import datetime

    items = snapshot.get('items') or []
    if not items:
        return (
            t("history.title", default="📜 <b>My Duels</b>") + "\n\n"
            + t("history.empty", default="No duels yet.\nStart a real duel or open Demo Mode to build your history.")
        )

    def _short_time(ts: str | None) -> str:
        if not ts:
            return "—"
        m = re.match(r"(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})", str(ts))
        if m:
            try:
                dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                              int(m.group(4)), int(m.group(5)))
                return dt.strftime("%d.%m %H:%M")
            except:
                pass
        return str(ts)[:16]

    status_emoji = {
        "Win": "✅", "Loss": "❌", "Draw": "🤝",
        "Cancelled": "⏹️", "Timeout": "⏰", "Expired": "⌛",
        "Active": "🔄", "Waiting": "⏳",
    }
    # Translate status labels for the user's language
    status_labels_i18n = {
        "Win":       t("history.status.win",       default="Win"),
        "Loss":      t("history.status.loss",      default="Loss"),
        "Draw":      t("history.status.draw",      default="Draw"),
        "Cancelled": t("history.status.cancelled", default="Cancelled"),
        "Timeout":   t("history.status.timeout",   default="Timeout"),
        "Expired":   t("history.status.expired",   default="Expired"),
        "Active":    t("history.status.active",    default="Active"),
        "Waiting":   t("history.status.waiting",   default="Waiting"),
    }

    lines = [t("history.title", default="📜 <b>My Duels</b>"), "", t("history.subtitle", default="Your latest duel activity:")]

    for item in items:
        is_practice = item.get('isPractice')
        mode = (
            "🧪 <b>" + t("history.mode.practice", default="Practice") + "</b>"
            if is_practice else
            "💎 <b>" + t("history.mode.real", default="Real") + "</b>"
        )
        status_label = item.get('statusLabel') or 'Unknown'
        emoji = status_emoji.get(status_label, "•")

        opponent = item.get('opponent') or ''
        if opponent == "Waiting for opponent":
            opponent = t("history.opponent.waiting", default="Waiting for opponent")
        elif opponent == "Unknown":
            opponent = t("history.opponent.unknown", default="Unknown player")
        hide_opponent = status_label in ("Cancelled", "Timeout") and (
            not opponent or opponent == t("history.opponent.waiting", default="Waiting for opponent")
        )

        stake = item.get('stakeDisplay') or '—'
        delta = item.get('deltaDisplay') or '—'

        if delta.startswith(('+', '-', '±')) or delta == '—':
            outcome = f"💵 {delta}"
        else:
            outcome = f"💵 +{delta}"

        lines.append("")
        status_label_i18n = status_labels_i18n.get(status_label, status_label)
        lines.append(f"{mode} · {emoji} <b>{status_label_i18n}</b>")
        if not hide_opponent:
            lines.append(t("history.item.vs", default="🆚 vs <b>{opponent}</b>", opponent=escape(str(opponent))))
        lines.append(t("history.item.stake", default="💰 Stake: {stake} {outcome}", stake=stake, outcome=outcome))
        lines.append(f"🕒 {_short_time(item.get('timestamp'))}")

    return "\n".join(lines)


def _workspace_posts_enabled(settings_or_row: dict) -> bool:
    return any(
        bool(int(settings_or_row.get(key) or 0)) if isinstance(settings_or_row.get(key), (int, bool)) or str(settings_or_row.get(key)).isdigit() else bool(settings_or_row.get(key))
        for key in ("post_duel_created_enabled", "post_duel_result_enabled", "leaderboard_posts_enabled", "weekly_summary_enabled")
    ) or any(
        bool(settings_or_row.get(key))
        for key in ("postDuelCreatedEnabled", "postDuelResultEnabled", "leaderboardPostsEnabled", "weeklySummaryEnabled")
    )


def _workspace_surface_state(item: dict) -> tuple[str, str]:
    status = str(item.get("status") or "").strip().lower()
    settings_active_raw = item.get("is_active")
    if settings_active_raw is None:
        settings_active_raw = item.get("settings", {}).get("isActive") if isinstance(item.get("settings"), dict) else None
    settings_active = True if settings_active_raw is None else bool(int(settings_active_raw)) if isinstance(settings_active_raw, int) else bool(settings_active_raw)
    posts_enabled = _workspace_posts_enabled(item.get("settings") or item)
    if status != "active" or not settings_active:
        return "offline", "🔴 Disconnected"
    if posts_enabled:
        return "ready", "🟢 Publish-ready"
    return "attention", "🟡 Setup needed"


def render_workspace_list_text(user_id: int, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    items = list_workspaces_for_user(user_id)
    lines = [
        t("workspace.list.title", default="👥 <b>Мои группы</b>"),
        "",
        t("workspace.list.intro", default="Здесь подключаются группы и настраиваются публикации: дуэли, результаты, лидерборды и розыгрыши."),
    ]
    if not items:
        lines.extend([
            "",
            t("workspace.list.empty", default="Пока нет подключённых групп."),
            t("workspace.list.empty_giveaway", default="🎁 Подключите группу, чтобы создавать розыгрыши и публиковать результаты."),
            "",
            t("workspace.list.connect_hint", default="Нажмите <b>➕ Подключить группу</b>, добавьте Roll Duel в группу и отправьте одноразовый код внутри группы."),
        ])
        return "\n".join(lines)

    ready_count = 0
    attention_count = 0
    for item in items:
        state, _ = _workspace_surface_state(item)
        if state == "ready":
            ready_count += 1
        elif state == "attention":
            attention_count += 1

    _on = t("workspace.status.on", default="ВКЛ")
    _off = t("workspace.status.off", default="ВЫКЛ")
    lines.extend([
        "",
        t("workspace.list.count", default="<b>Подключённых групп:</b> {n}", n=len(items)),
        t("workspace.list.ready_count", default="<b>Готовы к публикации:</b> {ready} · <b>Требуют настройки:</b> {setup}", ready=ready_count, setup=attention_count),
    ])
    for item in items[:8]:
        title = str(item.get("title") or t("workspace.untitled", default="Группа"))
        default_mark = " ⭐" if bool(int(item.get("is_default") or 0)) else ""
        _, state_label = _workspace_surface_state(item)
        dp = _on if bool(int(item.get("post_duel_created_enabled") or 0)) else _off
        rp = _on if bool(int(item.get("post_duel_result_enabled") or 0)) else _off
        lp = _on if bool(int(item.get("leaderboard_posts_enabled") or 0)) else _off
        ws = _on if bool(int(item.get("weekly_summary_enabled") or 0)) else _off
        lines.append(f"• <b>{title}</b>{default_mark} — {state_label}")
        lines.append(t("workspace.list.row_settings", default="  дуэли {d} · результаты {r} · лидерборд {l} · еженедельно {w}", d=dp, r=rp, l=lp, w=ws))
    lines.extend([
        "",
        t("workspace.list.open_hint", default="Откройте группу для настроек публикаций или перейдите в <b>Розыгрыши групп</b> для управления giveaway."),
    ])
    return "\n".join(lines)

def _giveaway_status_short(status: str | None, *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    normalized = str(status or "").upper()
    return {
        "DRAFT": t("giveaway.status.draft", default="📝 Черновик"),
        "ACTIVE": t("giveaway.status.active", default="🟢 Активен"),
        "ENDED": t("giveaway.status.ended", default="🛑 Завершён"),
        "WINNERS_DRAWN": t("giveaway.status.winners_drawn", default="🏅 Победители выбраны"),
        "RESULTS_PUBLISHED": t("giveaway.status.results_published", default="📣 Результаты опубликованы"),
        "CANCELLED": t("giveaway.status.cancelled", default="⚪ Отменён"),
    }.get(normalized, normalized or "—")


def render_giveaway_dashboard_text(overviews: list[dict], *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    lines = [
        t("giveaway.dashboard.title", default="🎁 <b>Управление розыгрышами</b>"),
        "",
        t("giveaway.dashboard.intro", default="Здесь вы управляете розыгрышами в подключённых группах: текущие, черновики, история и публикация."),
    ]
    if not overviews:
        lines.extend([
            "",
            t("giveaway.dashboard.empty", default="Пока нет подключённых групп для розыгрышей."),
            t("giveaway.dashboard.empty_hint", default="Сначала подключите группу через «Мои чаты»."),
        ])
        return "\n".join(lines)
    lines.append("")
    for item in overviews[:8]:
        title = escape(str(item.get("title") or t("workspace.untitled", default="Группа")))
        lines.append(f"⭐ <b>{title}</b>")
        lines.append(t(
            "giveaway.dashboard.counts",
            default="• Черновики: <b>{drafts}</b> · Активные: <b>{active}</b> · Завершённые: <b>{finished}</b>",
            drafts=int(item.get("draft_count") or 0),
            active=int(item.get("active_count") or 0),
            finished=int(item.get("finished_count") or 0),
        ))
    lines.extend(["", t("giveaway.dashboard.select_hint", default="Выберите группу ниже, чтобы открыть текущий розыгрыш, историю или создать новый.")])
    return "\n".join(lines)


def render_giveaway_group_dashboard_text(overview: dict, current: dict | None, *, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    title = escape(str(overview.get("title") or t("workspace.untitled", default="Группа")))
    lines = [
        t("giveaway.dashboard.group_title", default="🎁 <b>Розыгрыши группы</b>"),
        "",
        t("giveaway.dashboard.group_name", default="<b>Группа:</b> {title}", title=title),
        t(
            "giveaway.dashboard.group_counts",
            default="Черновики: <b>{drafts}</b> · Активные: <b>{active}</b> · Завершённые: <b>{finished}</b>",
            drafts=int(overview.get("draft_count") or 0),
            active=int(overview.get("active_count") or 0),
            finished=int(overview.get("finished_count") or 0),
        ),
    ]
    if current:
        lines.extend([
            "",
            t("giveaway.dashboard.current_block", default="<b>Текущий слот</b>"),
            f"• {_giveaway_status_short(current.get('status'), t=t)} — <b>{escape(str(current.get('title') or t('giveaway.untitled', default='Без названия')))}</b>",
            t(
                "giveaway.dashboard.current_stats",
                default="• Заявок: <b>{entries}</b> · Победителей: <b>{winners}</b>",
                entries=int(current.get("entries_count") or current.get("entriesCount") or 0),
                winners=int(current.get("winners_selected_count") or current.get("winnersSelectedCount") or 0),
            ),
        ])
    else:
        lines.extend(["", t("giveaway.dashboard.no_current", default="Текущего розыгрыша нет. Можно создать новый.")])
    lines.extend([
        "",
        t("giveaway.dashboard.lifecycle_hint", default="Черновик — настройка. Активен — можно публиковать и принимать участников. Завершён — выбираем/публикуем результаты."),
    ])
    return "\n".join(lines)


def render_giveaway_history_text(workspace_title: str, rows: list[dict], *, t=None, page: int = 0, page_size: int = 7, has_more: bool = False, status_filter: str = "all") -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    lines = [
        t("giveaway.history.title", default="📜 <b>История розыгрышей</b>"),
        "",
        t("giveaway.history.group", default="<b>Группа:</b> {title}", title=escape(workspace_title or t("workspace.untitled", default="Группа"))),
    ]
    if not rows:
        lines.extend(["", t("giveaway.history.empty", default="Пока нет розыгрышей в этой группе.")])
        return "\n".join(lines)
    filter_label = t(f"giveaway.history.filter_label.{str(status_filter or 'all').lower()}", default=str(status_filter or "all"))
    lines.extend([
        "",
        t("giveaway.history.filter_hint", default="Фильтр: <b>{filter}</b>", filter=filter_label),
        t("giveaway.history.page_hint", default="Показаны {start}-{end}. Новые розыгрыши сверху.", start=page * page_size + 1, end=page * page_size + len(rows)),
        "",
    ])
    for row in rows[:page_size]:
        lines.append(
            t(
                "giveaway.history.row",
                default="• {status} — <b>{title}</b> · заявок {entries} · победителей {winners}",
                status=_giveaway_status_short(row.get("status"), t=t),
                title=escape(str(row.get("title") or t("giveaway.untitled", default="Без названия"))),
                entries=int(row.get("entries_count") or 0),
                winners=int(row.get("winners_selected_count") or 0),
            )
        )
    return "\n".join(lines)



def render_workspace_connect_text(payload: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return t(
        "workspace.connect.text",
        default=(
            "👥 <b>Connect Group</b>\n\n"
            "1. Add <b>Roll Duel</b> to your Telegram group.\n"
            "2. Make sure <b>you</b> are a group admin.\n"
            "3. Send this command inside that group within the token window:\n\n"
            "<code>{command}</code>\n\n"
            "The connect token is one-time and bound to your user.\n"
            "It expires in about <b>{ttl} minutes</b>."
        ),
        command=payload["command"],
        ttl=payload["ttlMinutes"],
    )

def _format_chat_member_status(value: str | None) -> str:
    normalized = str(value or "unknown").strip().lower()
    labels = {
        "creator": "creator",
        "administrator": "administrator",
        "member": "member",
        "restricted": "restricted",
        "left": "left",
        "kicked": "removed",
        "unknown": "unknown",
    }
    return labels.get(normalized, normalized or "unknown")


async def get_workspace_runtime_status(bot: Bot | None, *, user_id: int, detail: dict) -> dict:
    settings = detail.get("settings") or {}
    status = {
        "health": "attention",
        "healthLabel": "🟡 Needs attention",
        "botStatus": None,
        "userStatus": None,
        "botIsAdmin": False,
        "userIsAdmin": False,
        "issues": [],
        "warnings": [],
        "nextAction": "Use the controls below to finish setup or recheck the connection.",
    }

    if str(detail.get("status") or "").strip().lower() != "active" or not settings.get("isActive", True):
        status.update({
            "health": "offline",
            "healthLabel": "🔴 Disconnected",
            "issues": ["This group is currently disconnected inside Roll Duel."],
            "nextAction": "Reconnect the group from My Chats before publishing again.",
        })
        return status

    if bot is None:
        if _workspace_posts_enabled(settings):
            status.update({
                "health": "ready",
                "healthLabel": "🟢 Connected",
                "nextAction": "You can recheck the connection or publish from this surface.",
            })
        else:
            status["issues"].append("No posting surfaces are enabled yet.")
            status["nextAction"] = "Enable at least one post type below before publishing."
        return status

    chat_id = int(detail["chatId"])
    try:
        me = await bot.get_me()
        bot_member = await bot.get_chat_member(chat_id, me.id)
        bot_status = str(bot_member.status)
        status["botStatus"] = bot_status
        status["botIsAdmin"] = bot_status in {"administrator", "creator"}
        if bot_status not in {"administrator", "creator", "member"}:
            status.update({
                "health": "offline",
                "healthLabel": "🔴 Group unavailable",
                "issues": ["Roll Duel is no longer an active member of this group."],
                "nextAction": "Add Roll Duel back to the group, then reconnect it from My Chats.",
            })
            return status
        if bot_status == "member":
            status["warnings"].append("Roll Duel is a normal group member. Publishing can work, but some groups may still require stronger rights.")
    except (BadRequest, Forbidden) as exc:
        status.update({
            "health": "offline",
            "healthLabel": "🔴 Group unavailable",
            "issues": [f"Roll Duel cannot reach this group right now: {exc}"],
            "nextAction": "Make sure the bot is still inside the group, then reconnect or recheck the chat.",
        })
        return status
    except Exception as exc:
        status.update({
            "health": "offline",
            "healthLabel": "🔴 Group unavailable",
            "issues": [f"Live group check failed: {exc}"],
            "nextAction": "Recheck the connection after the group becomes reachable again.",
        })
        return status

    try:
        user_member = await bot.get_chat_member(chat_id, int(user_id))
        user_status = str(user_member.status)
        status["userStatus"] = user_status
        status["userIsAdmin"] = user_status in {"administrator", "creator"}
        if user_status in {"left", "kicked"}:
            status["issues"].append("You are no longer an active member of this group.")
        elif not status["userIsAdmin"]:
            status["issues"].append("You are not a group admin right now.")
    except Exception as exc:
        status["issues"].append(f"Could not verify your current group admin status: {exc}")

    if not _workspace_posts_enabled(settings):
        status["issues"].append("No posting surfaces are enabled yet.")

    if status["issues"]:
        status["health"] = "attention" if status["health"] != "offline" else status["health"]
        status["healthLabel"] = "🟡 Needs attention" if status["health"] != "offline" else status["healthLabel"]
        if any("No posting surfaces" in issue for issue in status["issues"]):
            status["nextAction"] = "Enable at least one post type below, then send a test post or publish a preview."
        elif any("group admin" in issue.lower() for issue in status["issues"]):
            status["nextAction"] = "Make sure you still have group admin rights, then tap Recheck status."
        else:
            status["nextAction"] = "Resolve the issue above, then recheck the group before publishing."
    else:
        status.update({
            "health": "ready",
            "healthLabel": "🟢 Ready to publish",
            "nextAction": "This group looks ready. You can send a test post, publish a leaderboard, or fine-tune the settings below.",
        })
    return status


def render_workspace_disconnect_confirm_text(detail: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return t(
        "workspace.disconnect.confirm_text",
        default=(
            "🔌 <b>Disconnect group</b>\n\n"
            "<b>Group:</b> {title}\n\n"
            "This removes the group from your active My Chats surface and turns off posting for this connection.\n\n"
            "You can connect the same group again later with a new connect token."
        ),
        title=detail.get('title') or t("workspace.untitled", default="Untitled Group"),
    )


def render_workspace_detail_text(detail: dict, runtime_status: dict | None = None, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    settings = detail.get("settings") or {}
    _on  = t("workspace.status.on",  default="ON")
    _off = t("workspace.status.off", default="OFF")
    _yes = t("workspace.status.yes", default="Yes")
    _no  = t("workspace.status.no",  default="No")
    status_val = runtime_status.get("healthLabel") if runtime_status else str(detail.get("status") or "unknown").title()
    scope_raw  = str(settings.get("defaultLeaderboardScope") or "chat")
    scope_label = t(f"workspace.scope.{scope_raw}", default=scope_raw.title())
    lines = [
        t("workspace.detail.title",          default="👥 <b>Group settings</b>"),
        "",
        t("workspace.detail.group_title",    default="<b>Title:</b> {title}", title=detail.get("title") or t("workspace.untitled", default="Untitled Group")),
        t("workspace.detail.status",         default="<b>Status:</b> {status}", status=status_val),
        t("workspace.detail.default_target", default="<b>Default target:</b> {val}",
          val=(_yes if detail.get("isDefault") else _no))
        + "  " + t("workspace.detail.default_target_hint",
                    default="(This group receives results when no specific group is selected)"),
        "",
        t("workspace.detail.posting_title",    default="<b>Posting settings</b>"),
        t("workspace.detail.duel_posts",       default="• Duel posts: {val}",        val=(_on if settings.get("postDuelCreatedEnabled")  else _off)),
        t("workspace.detail.result_posts",     default="• Result posts: {val}",      val=(_on if settings.get("postDuelResultEnabled")   else _off)),
        t("workspace.detail.leaderboard_posts",default="• Chat leaderboard: {val}",  val=(_on if settings.get("leaderboardPostsEnabled") else _off))
        + "  " + t("workspace.detail.leaderboard_posts_hint", default="(auto-post leaderboard to group)"),
        t("workspace.detail.weekly_summary",   default="• Weekly leaders: {val}",    val=(_on if settings.get("weeklySummaryEnabled")    else _off))
        + "  " + t("workspace.detail.weekly_summary_hint", default="(weekly top-3 digest every Monday)"),
        t("workspace.detail.lb_scope",         default="• Default leaderboard scope: {scope}", scope=scope_label),
    ]

    if runtime_status:
        lines.extend([
            "",
            t("workspace.detail.live_checks", default="<b>Live checks</b>"),
            t("workspace.detail.bot_in_group", default="• Bot in group: {val}",  val=_format_chat_member_status(runtime_status.get("botStatus"))),
            t("workspace.detail.your_status",  default="• Your status: {val}",   val=_format_chat_member_status(runtime_status.get("userStatus"))),
            t("workspace.detail.posting_surface", default="• Posting surface: {val}",
              val=(t("workspace.detail.configured",  default="Configured")
                   if _workspace_posts_enabled(settings)
                   else t("workspace.detail.setup_needed", default="Setup needed"))),
        ])
        if runtime_status.get("issues"):
            lines.extend(["", t("workspace.detail.action_needed", default="<b>Action needed</b>")])
            lines.extend([f"• {issue}" for issue in runtime_status.get("issues") or []])
        if runtime_status.get("warnings"):
            lines.extend(["", t("workspace.detail.heads_up", default="<b>Heads-up</b>")])
            lines.extend([f"• {warning}" for warning in runtime_status.get("warnings") or []])
        lines.extend(["", runtime_status.get("nextAction") or t("workspace.detail.use_controls", default="Use the controls below to manage this group.")])
    else:
        lines.extend(["", t("workspace.detail.manual_hint", default="Manual leaderboard publishing is live here. Use Recheck status before publishing if this group changed recently.")])

    return "\n".join(lines)




def _format_giveaway_status(status: str | None, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    normalized = str(status or "").upper()
    labels = {
        "DRAFT":             t("giveaway.status.draft",             default="📝 Черновик"),
        "ACTIVE":            t("giveaway.status.active",            default="🟢 Активен"),
        "ENDED":             t("giveaway.status.ended",             default="🛑 Завершён"),
        "WINNERS_DRAWN":     t("giveaway.status.winners_drawn",     default="🎉 Победители выбраны"),
        "RESULTS_PUBLISHED": t("giveaway.status.results_published", default="📣 Результаты опубликованы"),
        "CANCELLED":         t("giveaway.status.cancelled",         default="⚪ Отменён"),
    }
    return labels.get(normalized, normalized.title() or "Unknown")



def _format_giveaway_deadline(value, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    if not value:
        return t("giveaway.not_set", default="Not set")
    return _format_timestamp(value)



def _parse_giveaway_deadline_input(raw: str, *, min_future_minutes: int = 5):
    value = str(raw or "").strip().lower()
    if not value:
        raise GiveawayError("missing_giveaway_deadline", "Send a deadline in UTC, for example 24h or 2026-04-20 18:00.", 400)
    now = datetime.utcnow()
    if re.fullmatch(r"\d+\s*m", value):
        minutes = int(re.sub(r"\D", "", value))
        dt = now + timedelta(minutes=minutes)
    elif re.fullmatch(r"\d+\s*h", value):
        hours = int(re.sub(r"\D", "", value))
        dt = now + timedelta(hours=hours)
    elif re.fullmatch(r"\d+\s*d", value):
        days = int(re.sub(r"\D", "", value))
        dt = now + timedelta(days=days)
    else:
        cleaned = value.replace("utc", "").strip()
        dt = None
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(cleaned, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            raise GiveawayError("invalid_giveaway_deadline", "Use 30m, 24h, 7d, or YYYY-MM-DD HH:MM in UTC.", 400)
    if min_future_minutes > 0 and dt <= now + timedelta(minutes=min_future_minutes):
        raise GiveawayError("invalid_giveaway_deadline", "Deadline must be at least 5 minutes in the future.", 400)
    return dt.replace(microsecond=0)



def render_giveaway_text(snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    workspace = snapshot.get("workspace") or {}
    giveaway  = snapshot.get("giveaway")  or {}
    stats     = snapshot.get("stats")     or {}
    winners   = snapshot.get("winners")   or []

    if not giveaway:
        return (
            "🎁 <b>" + t("giveaway.title", default="Розыгрыш") + "</b>\n\n"
            + "<b>" + t("giveaway.field.group", default="Группа") + ":</b> "
            + escape(str(workspace.get("title") or t("giveaway.untitled_group", default="Без названия")))
            + "\n\n"
            + t("giveaway.not_setup", default="Розыгрыш для этой группы ещё не создан.")
            + "\n\n"
            + t("giveaway.setup_hint",
                default="Создайте черновик, заполните основные данные, активируйте и запустите — когда будете готовы.")
        )

    field_group    = t("giveaway.field.group",    default="Группа")
    field_title    = t("giveaway.field.title",    default="Название")
    field_prize    = t("giveaway.field.prize",    default="Приз")
    field_winners  = t("giveaway.field.winners",  default="Победители")
    field_deadline = t("giveaway.field.deadline", default="Дедлайн")
    field_starts   = t("giveaway.field.starts",   default="Начало")
    field_status   = t("giveaway.field.status",   default="Статус")
    field_vis      = t("giveaway.field.visibility",default="Видимость")
    field_live     = t("giveaway.field.live_post", default="Публикация")
    field_results  = t("giveaway.field.results_post", default="Результаты")
    vis_public     = t("giveaway.visibility.public",  default="🌐 Публичный")
    vis_private    = t("giveaway.visibility.private", default="🔒 Приватный")
    label_pub      = t("giveaway.published",       default="Опубликовано")
    label_not_pub  = t("giveaway.not_published",   default="Не опубликовано")
    label_immed    = t("giveaway.starts_immediately", default="Сразу")
    label_not_set  = t("giveaway.not_set",         default="Не задано")

    group_title = escape(str(workspace.get("title") or giveaway.get("workspace_id") or
                             t("giveaway.untitled_group", default="Без названия")))
    gw_title = escape(str(giveaway.get("title") or t("giveaway.untitled", default="Без названия")))
    gw_prize = escape(str(giveaway.get("prize_text") or label_not_set))
    starts_val = _format_giveaway_deadline(giveaway.get("starts_at"), t=t) if giveaway.get("starts_at") else label_immed
    vis_label = vis_public if giveaway.get("is_public") else vis_private
    live_label = label_pub if giveaway.get("published_message_id") else label_not_pub
    res_label  = label_pub if giveaway.get("results_message_id")   else label_not_pub

    status_label = _format_giveaway_status(giveaway.get('status'), t=t)
    if str(giveaway.get('status') or '').upper() == 'DRAFT' and giveaway.get('starts_at'):
        status_label += " · " + t("giveaway.status.scheduled_note", default="🕓 старт запланирован")
    lines = [
        "🎁 <b>" + t("giveaway.title", default="Розыгрыш") + "</b>",
        "",
        t("giveaway.block.basic", default="<b>Основное</b>"),
        f"<b>{field_group}:</b> {group_title}",
        f"<b>{field_title}:</b> {gw_title}",
        f"<b>{field_prize}:</b> {gw_prize}",
        f"<b>{field_winners}:</b> {int(giveaway.get('winners_count') or 0)}",
        "",
        t("giveaway.block.timing", default="<b>Тайминг</b>"),
        f"<b>{field_starts}:</b> {starts_val}",
        f"<b>{field_deadline}:</b> {_format_giveaway_deadline(giveaway.get('ends_at'), t=t)}",
        "",
        t("giveaway.block.state", default="<b>Состояние</b>"),
        f"<b>{field_status}:</b> {status_label}",
        f"<b>{field_vis}:</b> {vis_label}",
        f"<b>{field_live}:</b> {live_label}",
        f"<b>{field_results}:</b> {res_label}",
        "",
        "📊 <b>" + t("giveaway.stats.title", default="Статистика") + "</b>",
        "• " + t("giveaway.stats.entries",   default="Заявок")   + f": {int(stats.get('entriesCount') or 0)}",
        "• " + t("giveaway.stats.eligible",  default="Допущено") + f": {int(stats.get('eligibleCount') or 0)}",
        "• " + t("giveaway.stats.ineligible",default="Отклонено")+ f": {int(stats.get('ineligibleCount') or 0)}",
        "• " + t("giveaway.stats.winners",   default="Победителей выбрано") + f": {int(stats.get('winnersSelectedCount') or 0)}",
    ]

    status = str(giveaway.get("status") or "").upper()
    if status == "DRAFT":
        lines.extend([
            "",
            "⏳ <b>" + t("giveaway.hint.draft_title", default="Внимание") + ":</b> "
            + t("giveaway.hint.draft_activation",
                default="Активация может занять до 30 минут после нажатия «Активировать». Пожалуйста, подождите."),
            t("giveaway.hint.draft_action",
              default="Заполните основные данные и активируйте розыгрыш, когда будете готовы."),
        ])
    elif status == "ACTIVE":
        lines.extend([
            "",
            t("giveaway.hint.active",
              default="Розыгрыш запущен. Опубликуйте его в группе, собирайте заявки, затем завершите вручную перед выбором победителей."),
        ])
    elif status == "ENDED":
        if int(stats.get("entriesCount") or 0) > 0:
            lines.extend(["", t("giveaway.hint.ended_has_entries", default="Приём заявок закрыт. Можно выбрать победителей.")])
        else:
            lines.extend([
                "",
                t("giveaway.hint.ended_no_entries", default="Заявок не поступало."),
                t("giveaway.hint.ended_no_entries_action",
                  default="Отмените этот этап или опубликуйте результат без победителей, затем запустите следующий."),
            ])
    elif status == "WINNERS_DRAWN":
        lines.extend(["", "<b>" + t("giveaway.field.winners", default="Победители") + "</b>"])
        if winners:
            for row in winners[:10]:
                lines.append(f"• #{int(row.get('place') or 0)} — user {int(row.get('user_id') or 0)}")
            lines.extend(["", t("giveaway.hint.publish_results", default="Опубликуйте результаты в группе, когда будете готовы.")])
        else:
            lines.append("• " + t("giveaway.hint.no_winners_selected", default="Победители не выбраны."))
            lines.extend(["", t("giveaway.hint.publish_no_winner", default="Опубликуйте результат без победителей, чтобы закрыть этот этап.")])
    elif status == "RESULTS_PUBLISHED":
        if int(stats.get("entriesCount") or 0) == 0:
            lines.extend(["", t("giveaway.hint.results_no_entries", default="Этот этап завершён без заявок. Запустите следующий, когда будете готовы.")])
        else:
            lines.extend(["", t("giveaway.hint.results_done", default="Розыгрыш завершён. Запустите следующий, когда будете готовы.")])
    elif status == "CANCELLED":
        lines.extend(["", t("giveaway.hint.cancelled", default="Розыгрыш отменён. Можно запустить новый для этой группы.")])

    return "\n".join(lines)

def render_giveaway_edit_prompt(
    field_name: str,
    giveaway_title: str | None = None,
    t=None,
    *,
    snapshot: dict | None = None,
) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    giveaway = (snapshot or {}).get("giveaway") or {}
    title = escape(str(giveaway_title or giveaway.get("title") or t("giveaway.untitled", default="Untitled giveaway")))
    deadline_label = _format_giveaway_deadline(giveaway.get("ends_at"), t=t) if giveaway else t("giveaway.not_set", default="Not set")
    start_label = _format_giveaway_deadline(giveaway.get("starts_at"), t=t) if giveaway.get("starts_at") else t("giveaway.starts_immediately", default="Immediately")
    prompts = {
        "title": t("giveaway.edit_prompt.title", default="🎁 <b>Edit title</b>\n\nCurrent giveaway: <b>{title}</b>\n\nSend the new title in one message.", title=title),
        "prize": t("giveaway.edit_prompt.prize", default="🎁 <b>Edit prize</b>\n\nCurrent giveaway: <b>{title}</b>\n\nSend the new prize text.", title=title),
        "winners": t("giveaway.edit_prompt.winners", default="🎁 <b>Edit winners count</b>\n\nCurrent giveaway: <b>{title}</b>\n\nSend a number like <b>1</b>, <b>3</b>, or <b>5</b>.", title=title),
        "deadline": t(
            "giveaway.edit_prompt.deadline",
            default=(
                "🎁 <b>Edit deadline</b>\n\n"
                "Current giveaway: <b>{title}</b>\n\n"
                "When should entries close?\n"
                "Use quick buttons below or send UTC time. Examples:\n"
                "• <code>30m</code>  • <code>1h</code>  • <code>24h</code>  • <code>2026-04-20 18:00</code>"
            ),
            title=title,
        ),
        "starts": t(
            "giveaway.edit_prompt.starts",
            default=(
                "🎁 <b>Edit start time</b>\n\n"
                "Current giveaway: <b>{title}</b>\n"
                "Current start: <b>{start}</b>\n"
                "Current deadline: <b>{deadline}</b>\n\n"
                "When should users be able to join? Use quick buttons below or send UTC time.\n\n"
                "Important: start time must be before the deadline."
            ),
            title=title,
            start=start_label,
            deadline=deadline_label,
        ),
    }
    return prompts[field_name]


def _localize_giveaway_error(exc: GiveawayError, t=None, *, snapshot: dict | None = None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    code = str(getattr(exc, "code", "") or "")
    giveaway = (snapshot or {}).get("giveaway") or {}
    if code == "invalid_giveaway_window":
        deadline = _format_giveaway_deadline(giveaway.get("ends_at"), t=t) if giveaway else t("giveaway.not_set", default="Not set")
        return t("giveaway.error.invalid_window", default="Время старта должно быть раньше дедлайна. Текущий дедлайн: {deadline}. Выберите старт раньше дедлайна или сначала перенесите дедлайн.", deadline=deadline)
    if code == "giveaway_not_started":
        start = _format_public_giveaway_start(giveaway.get("starts_at"), t=t) if giveaway else t("giveaway.not_set", default="Не задано")
        return t("giveaway.error.giveaway_not_started", default="Розыгрыш ещё не начался. Старт: {start}.", start=start)
    if code == "empty_giveaway_patch":
        return t("giveaway.error.patch_empty", default="Изменений нет.")
    key = f"giveaway.error.{code}" if code else ""
    if key:
        translated = t(key, default="")
        if translated:
            return translated
    return str(getattr(exc, "message", "") or exc)


def render_giveaway_confirm_text(action: str, snapshot: dict, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    giveaway = snapshot.get("giveaway") or {}
    stats = snapshot.get("stats") or {}
    title = escape(str(giveaway.get("title") or t("giveaway.untitled", default="Untitled giveaway")))
    status = _format_giveaway_status(giveaway.get("status"), t=t)
    starts_at = giveaway.get("starts_at")
    is_future_start = False
    if starts_at:
        try:
            parsed_start = _parse_public_giveaway_datetime(starts_at)
            is_future_start = bool(parsed_start and parsed_start > datetime.now(timezone.utc))
        except Exception:
            is_future_start = False
    if action == "activate" and is_future_start:
        action_text = t(
            "giveaway.confirm_text.activate_scheduled",
            default=(
                "🕓 <b>Запланировать розыгрыш?</b>\n\n"
                "Участники смогут вступать после: <b>{start}</b>.\n"
                "До старта публичная кнопка покажет: <b>⏳ Ещё не начался</b>.\n\n"
                "Важно: автоактивация выполняется периодически. Для точного запуска можно вернуться и выбрать «Сразу»."
            ),
            start=_format_giveaway_deadline(starts_at, t=t),
        )
    else:
        mapping = {
            "activate": t("giveaway.confirm_text.activate", default="✅ <b>Активировать розыгрыш?</b>\n\nПосле активации участники смогут вступать сразу, если розыгрыш опубликован."),
            "end": t("giveaway.confirm_text.end", default="End this giveaway now? New entries will stop immediately."),
            "draw": t("giveaway.confirm_text.draw", default="Draw winners now? This action is final for this giveaway."),
            "results": t("giveaway.confirm_text.results", default="Mark results as published now?"),
            "cancel": t("giveaway.confirm_text.cancel", default="Cancel this giveaway now? This cannot be undone from the bot."),
        }
        if action == "cancel" and str(giveaway.get("status") or "").upper() == "ENDED" and int(stats.get("entriesCount") or 0) == 0:
            mapping["cancel"] = t("giveaway.confirm.cancel_empty", default="Cancel this empty giveaway and clear the slot for the next round?")
        action_text = mapping[action]
    return f"🎁 <b>{title}</b>\n\n<b>{t('giveaway.field.status', default='Status')}:</b> {status}\n\n{action_text}"



def _public_giveaway_t():
    """Translator used for group/channel giveaway posts.

    Public posts should be stable and RU-facing by default. Owner/private bot UI
    still uses the user's language via get_t()/context.user_data.
    """
    from services.i18n import get_translator
    public_t = get_translator("ru")
    return public_t


def _parse_public_giveaway_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value).strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(raw)
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _giveaway_not_started_yet(giveaway: dict) -> bool:
    starts_at = _parse_public_giveaway_datetime((giveaway or {}).get("starts_at"))
    return bool(starts_at and starts_at > datetime.now(timezone.utc))


def _giveaway_has_started(giveaway: dict) -> bool:
    # Compatibility marker for static QA: is_started=_giveaway_has_started(giveaway)
    return not _giveaway_not_started_yet(giveaway)


def _format_public_giveaway_start(value, t=None) -> str:
    if t is None:
        t = _public_giveaway_t()
    return _format_giveaway_deadline(value, t=t) if value else t("giveaway.starts_immediately", default="Сразу")

def _format_giveaway_public_deadline(value, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return _format_giveaway_deadline(value, t=t) if value else t("giveaway.public.tbd", default="TBD")


def _format_winner_public_label(row: dict) -> str:
    username = str(row.get("username") or "").strip()
    if username:
        return f"@{username}"
    first_name = str(row.get("first_name") or "").strip()
    if first_name:
        return first_name
    return f"user {int(row.get('user_id') or 0)}"


def _format_public_user_label(user) -> str:
    """Safe public label for group-facing giveaway notifications."""
    username = str(getattr(user, "username", "") or "").strip()
    if username:
        return f"@{username}"
    first_name = str(getattr(user, "first_name", "") or "").strip()
    if first_name:
        return escape(first_name)
    return f"user {int(getattr(user, 'id', 0) or 0)}"


async def _notify_public_giveaway_join_once(query, context, giveaway_id: str, snapshot: dict | None = None, *, t=None) -> None:
    """Send one visible group confirmation after a first successful public join.

    The service is idempotent, so this is only called for outcome=joined.
    Repeated clicks use callback alerts only and do not spam the group.
    """
    if t is None:
        t = _public_giveaway_t()
    try:
        snapshot = snapshot or get_giveaway_public_snapshot(giveaway_id=giveaway_id)
        workspace = snapshot.get("workspace") or {}
        chat_id = int(workspace.get("telegram_chat_id") or 0)
        message = getattr(query, "message", None)
        current_chat_id = int(((getattr(message, "chat", None) and getattr(message.chat, "id", 0)) or getattr(message, "chat_id", 0) or 0))
        if not chat_id or not current_chat_id or chat_id != current_chat_id:
            return
        user_label = _format_public_user_label(query.from_user)
        await context.bot.send_message(
            chat_id=chat_id,
            text=t("giveaway.join.group_notice", default="✅ {user} участвует в розыгрыше.", user=user_label),
            parse_mode=ParseMode.HTML,
            reply_to_message_id=getattr(message, "message_id", None),
            disable_web_page_preview=True,
        )
    except Exception as exc:
        logger.info("Giveaway join group notice skipped for %s: %s", giveaway_id, exc)


def render_public_giveaway_post_text(snapshot: dict, t=None) -> str:
    if t is None:
        t = _public_giveaway_t()
    workspace = snapshot.get("workspace") or {}
    giveaway = snapshot.get("giveaway") or {}
    stats = snapshot.get("stats") or {}
    title = escape(str(giveaway.get("title") or t("giveaway.untitled", default="Без названия")))
    prize = escape(str(giveaway.get("prize_text") or t("giveaway.prize_tba", default="Приз будет объявлен")))
    group_title = escape(str(workspace.get("title") or t("workspace.untitled", default="эта группа")))
    entries_count = int(stats.get("entriesCount") or 0)
    require_sub = bool(int(giveaway.get("require_sponsor_subscription") or 0))
    min_real_duels = int(giveaway.get("min_completed_real_duels") or 0)
    requirement_bits = []
    if require_sub:
        requirement_bits.append(t("giveaway.public.rule.subscription", default="🔐 подписка на sponsor channel"))
    if min_real_duels > 0:
        requirement_bits.append(t("giveaway.public.rule.real_duel", default="🎲 минимум {count} завершённая real GRAM duel", count=min_real_duels))
    requirements_line = (
        t("giveaway.public.requirements", default="Условия: {rules}", rules=" · ".join(requirement_bits))
        if requirement_bits
        else t("giveaway.public.requirements_none", default="Условия: открыть бота и нажать Участвовать")
    )
    is_pending = _giveaway_not_started_yet(giveaway)
    state_line = (
        t("giveaway.public.not_started", default="⏳ Розыгрыш ещё не начался.\nСтарт: {start}.", start=_format_public_giveaway_start(giveaway.get('starts_at'), t=t))
        if is_pending
        else t("giveaway.public.live_now", default="Розыгрыш активен. Нажмите ниже для участия.")
    )
    # `giveaway.public.post_pending` is kept as a legacy locale key;
    # current renderer uses `giveaway.public.post_title` with `{state_line}`.
    default = (
        "🎁 <b>Розыгрыш</b>\n\n"
        "<b>{title}</b>\n"
        "Приз: {prize}\n"
        "Победителей: {winners}\n"
        "Дедлайн: {deadline}\n"
        "Группа: {group}\n"
        "Участников: {entries}\n"
        "{requirements}\n\n"
        "{state_line}"
    )
    return t(
        "giveaway.public.post_title",
        default=default,
        title=title,
        prize=prize,
        winners=int(giveaway.get('winners_count') or 0),
        deadline=_format_giveaway_public_deadline(giveaway.get('ends_at'), t=t),
        start=_format_public_giveaway_start(giveaway.get('starts_at'), t=t),
        group=group_title,
        entries=entries_count,
        requirements=requirements_line,
        state_line=state_line,
    )


def render_public_giveaway_result_text(snapshot: dict, t=None) -> str:
    if t is None:
        t = _public_giveaway_t()
    giveaway = snapshot.get("giveaway") or {}
    stats = snapshot.get("stats") or {}
    winners = snapshot.get("winners") or []
    title = escape(str(giveaway.get("title") or t("giveaway.untitled", default="Без названия")))
    prize = escape(str(giveaway.get("prize_text") or t("giveaway.field.prize", default="Приз")))
    total_entries = int(stats.get("entriesCount") or 0)
    requested_winners = int(giveaway.get("winners_count") or 0)
    drawn_count = len(winners)
    lines = [
        t(
            "giveaway.public.result_title",
            default=(
                "🏁 <b>Розыгрыш завершён</b>\n\n"
                "🎁 <b>{title}</b>\n"
                "🏆 Приз: {prize}\n"
                "👥 Участников: {entries}\n"
                "✅ Победителей выбрано: {drawn}/{requested}\n\n"
                "🏅 <b>Победители</b>"
            ),
            title=title,
            prize=prize,
            entries=total_entries,
            drawn=drawn_count,
            requested=requested_winners,
        )
    ]
    if winners:
        for row in winners[:10]:
            lines.append(f"• #{int(row.get('place') or 0)} — {escape(_format_winner_public_label(row))}")
    else:
        lines.append(t("giveaway.public.no_winners", default="• Победителей нет."))
    if winners and len(winners) < requested_winners:
        lines.extend(["", t("giveaway.public.not_enough_entries", default="ℹ️ Не все места заполнены: недостаточно допущенных участников.")])
    elif total_entries == 0:
        lines.extend(["", t("giveaway.public.no_entries_recorded", default="ℹ️ Заявок не было, победители не выбраны.")])
    return "\n".join(lines)


async def show_giveaway_detail(target, *, user_id: int, workspace_id: str | None = None, giveaway_id: str | None = None, edit: bool = True):
    t = get_t(user_id)
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, workspace_id=workspace_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        if hasattr(target, "edit_message_text") and edit:
            await target.edit_message_text(
                f"❌ {exc.message}",
                parse_mode=ParseMode.HTML,
                reply_markup=get_workspace_list_keyboard(list_workspaces_for_user(user_id), t=t),
            )
        else:
            await target.reply_text(
                f"❌ {exc.message}",
                parse_mode=ParseMode.HTML,
                reply_markup=get_workspace_list_keyboard(list_workspaces_for_user(user_id), t=t),
            )
        return
    text = render_giveaway_text(snapshot, t=t)
    keyboard = get_giveaway_detail_keyboard(snapshot, t=t)
    if hasattr(target, "edit_message_text") and edit:
        try:
            await target.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)
        except BadRequest as exc:
            logger.info("giveaway_detail_edit_fallback giveaway_id=%s error=%s", giveaway_id, exc)
            message = getattr(target, "message", None)
            if message is not None:
                await message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)
        return
    await target.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)


def _is_stale_callback_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "query is too old" in message
        or "response timeout expired" in message
        or "query id is invalid" in message
        or "query_id_invalid" in message
    )


async def safe_answer_callback(query, *args, **kwargs) -> bool:
    try:
        await query.answer(*args, **kwargs)
        return True
    except BadRequest as exc:
        if _is_stale_callback_error(exc):
            logger.info("Ignoring stale callback query for user %s: %s", query.from_user.id, exc)
            return False
        raise



def _check_product_access(user_id: int, action: str) -> tuple[bool, str | None]:
    if platform_settings.get_bool("maintenance_mode"):
        if action == "duel_find":      # разрешаем просмотр лобби
            pass
        else:
            return False, "🛠️ Service is temporarily unavailable while maintenance is in progress."
    if action == "duel" and not platform_settings.get_bool("duels_enabled"):
        return False, "🛠️ Creating and joining duels is temporarily unavailable."
    if action == "withdraw" and not platform_settings.get_bool("withdrawals_enabled"):
        return False, "🛠️ Withdrawals are temporarily unavailable."
    if action == "deposit" and not platform_settings.get_bool("deposits_enabled"):
        return False, "🛠️ Deposits are temporarily unavailable."
    allowed, reason = risk_service.can_user_perform(user_id, action)
    if not allowed:
        return False, f"❌ {reason}"
    return True, None


async def send_reminder(context, game_id, user_id):
    bot = context.bot if context else _broadcast_runtime_bot
    if bot is None:
        logger.warning("Cannot send reminder: no bot available")
        return
    active_game = get_active_game(user_id)
    if not active_game or active_game['game_id'] != game_id:
        return
    if (user_id == active_game['player1_id'] and active_game['player1_roll'] > 0) or \
       (user_id == active_game['player2_id'] and active_game['player2_roll'] > 0):
        return
    t = get_t(user_id)
    try:
        await bot.send_message(
            chat_id=user_id,
            text=t("duel.reminder.real", default="⏰ You have 30 seconds left to send your dice roll!"),
        )
    except Exception as e:
        logger.exception(f"send_reminder: failed to send reminder to user {user_id} for game {game_id}: {e}")

async def handle_timeout(context, game_id, player1_id, player2_id):
    bot = context.bot if context else _broadcast_runtime_bot
    if bot is None:
        logger.exception("handle_timeout: no bot available")
        return
    game = get_active_game(player1_id) or get_active_game(player2_id)
    if not game or game['game_id'] != game_id:
        return

    result = settle_timeout_game(game_id)
    if not result.get('ok'):
        logger.exception(f"handle_timeout: failed to settle timeout for game {game_id}: {result.get('error')}")
        return

    t1 = get_t(player1_id)
    t2 = get_t(player2_id)

    timeout_outcome = str(result.get('outcome') or '')
    series_timeout = is_series_format(game.get('duel_format') or DUEL_FORMAT_SINGLE)
    is_tournament_match = is_tournament_no_payout_game(game)
    tournament_progress = {"action": "none"}
    if is_tournament_match and not result.get("ignored"):
        tournament_progress = await _notify_tournament_progress(
            context, game_id, result.get("winner_id")
        )

    if timeout_outcome in {'cancelled', 'series_unprocessed_round_cancelled'}:
        cancel_text_1 = (
            t1(
                "tournament.match.timeout_review",
                default="⚠️ Турнирный матч остановлен для проверки; сетка не продвинута.",
            )
            if is_tournament_match
            else (
                t1("duel.series.timeout_refund", default="⚠️ The Best of 3 could not be recovered safely. Both stakes were returned; no fee was charged.")
                if timeout_outcome == 'series_unprocessed_round_cancelled'
                else t1("duel.timeout.cancel", default="⏰ Time expired. The duel was cancelled and both stakes were returned.")
            )
        )
        cancel_text_2 = (
            t2(
                "tournament.match.timeout_review",
                default="⚠️ Турнирный матч остановлен для проверки; сетка не продвинута.",
            )
            if is_tournament_match
            else (
                t2("duel.series.timeout_refund", default="⚠️ The Best of 3 could not be recovered safely. Both stakes were returned; no fee was charged.")
                if timeout_outcome == 'series_unprocessed_round_cancelled'
                else t2("duel.timeout.cancel", default="⏰ Time expired. The duel was cancelled and both stakes were returned.")
            )
        )
        try:
            await bot.send_message(chat_id=player1_id,
                text=cancel_text_1,
                reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player2_id,
                text=cancel_text_2,
                reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player1_id, text=render_main_menu_text(player1_id, t=t1), reply_markup=_main_menu_markup(player1_id, t=t1), parse_mode=ParseMode.HTML)
            await bot.send_message(chat_id=player2_id, text=render_main_menu_text(player2_id, t=t2), reply_markup=_main_menu_markup(player2_id, t=t2), parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.exception(f"handle_timeout: failed to notify users about cancellation for game {game_id}: {e}")
    elif timeout_outcome in {'player1_win', 'player1_series_forfeit_win'}:
        win_text = (
            t1("tournament.match.timeout_advance", default="⏰ Вы проходите дальше: соперник не бросил кубик вовремя.")
            if is_tournament_match
            else (
                t1("duel.series.timeout_win", default="⏰ You win the Best of 3 because your opponent did not roll in time.")
                if series_timeout
                else t1("duel.timeout.win", default="⏰ Time expired. You win because your opponent did not roll in time.")
            )
        )
        lose_text = (
            t2("tournament.match.timeout_eliminated", default="❌ Вы выбываете: кубик не был брошен вовремя.")
            if is_tournament_match
            else (
                t2("duel.series.timeout_lose", default="❌ You did not roll in time, so the Best of 3 was awarded to your opponent.")
                if series_timeout
                else t2("duel.timeout.lose", default="❌ You did not roll in time, so the duel was closed.")
            )
        )
        try:
            await bot.send_message(
                chat_id=player1_id,
                text=win_text,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(
                chat_id=player2_id,
                text=lose_text,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(chat_id=player2_id, text=render_main_menu_text(player2_id, t=t2), reply_markup=_main_menu_markup(player2_id, t=t2), parse_mode=ParseMode.HTML)
            await bot.send_message(chat_id=player1_id, text=render_main_menu_text(player1_id, t=t1), reply_markup=_main_menu_markup(player1_id, t=t1), parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.exception(f"handle_timeout: failed to notify users about win/lose for game {game_id}: {e}")
    elif timeout_outcome in {'player2_win', 'player2_series_forfeit_win'}:
        win_text = (
            t2("tournament.match.timeout_advance", default="⏰ Вы проходите дальше: соперник не бросил кубик вовремя.")
            if is_tournament_match
            else (
                t2("duel.series.timeout_win", default="⏰ You win the Best of 3 because your opponent did not roll in time.")
                if series_timeout
                else t2("duel.timeout.win", default="⏰ Time expired. You win because your opponent did not roll in time.")
            )
        )
        lose_text = (
            t1("tournament.match.timeout_eliminated", default="❌ Вы выбываете: кубик не был брошен вовремя.")
            if is_tournament_match
            else (
                t1("duel.series.timeout_lose", default="❌ You did not roll in time, so the Best of 3 was awarded to your opponent.")
                if series_timeout
                else t1("duel.timeout.lose", default="❌ You did not roll in time, so the duel was closed.")
            )
        )
        try:
            await bot.send_message(
                chat_id=player2_id,
                text=win_text,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(
                chat_id=player1_id,
                text=lose_text,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(chat_id=player1_id, text=render_main_menu_text(player1_id, t=t1), reply_markup=_main_menu_markup(player1_id, t=t1), parse_mode=ParseMode.HTML)
            await bot.send_message(chat_id=player2_id, text=render_main_menu_text(player2_id, t=t2), reply_markup=_main_menu_markup(player2_id, t=t2), parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.exception(f"handle_timeout: failed to notify users about win/lose for game {game_id}: {e}")

    elif timeout_outcome in {'series_completed_recovery', 'series_draw_recovery'}:
        try:
            score = f"{int(game.get('player1_round_wins') or 0)}–{int(game.get('player2_round_wins') or 0)}"
            if timeout_outcome == 'series_draw_recovery':
                text1 = t1(
                    "duel.series.finished_draw",
                    default="🤝 <b>Best of 3 finished as a draw.</b>\n\nFinal score: <b>{score}</b>\n💰 Both stakes were returned. No platform fee was charged.",
                    score=score,
                )
                text2 = t2(
                    "duel.series.finished_draw",
                    default="🤝 <b>Best of 3 finished as a draw.</b>\n\nFinal score: <b>{score}</b>\n💰 Both stakes were returned. No platform fee was charged.",
                    score=score,
                )
            else:
                winner_id = int(result.get('winner_id') or game.get('winner_id') or 0)
                try:
                    winner_chat = await bot.get_chat(winner_id)
                    winner_name = winner_chat.first_name or f"User {winner_id}"
                except Exception:
                    winner_name = f"User {winner_id}"
                text1 = t1(
                    "duel.series.finished",
                    default="🏆 <b>{winner} wins the Best of 3!</b>\n\nFinal score: <b>{score}</b>\n💰 Stake per player: <b>{amount}</b>\n✅ One final settlement was applied for the whole match.",
                    winner=escape(winner_name),
                    score=score,
                    amount=format_balance_display(game.get('bet_amount') or 0),
                )
                text2 = t2(
                    "duel.series.finished",
                    default="🏆 <b>{winner} wins the Best of 3!</b>\n\nFinal score: <b>{score}</b>\n💰 Stake per player: <b>{amount}</b>\n✅ One final settlement was applied for the whole match.",
                    winner=escape(winner_name),
                    score=score,
                    amount=format_balance_display(game.get('bet_amount') or 0),
                )
            await bot.send_message(chat_id=player1_id, text=text1, parse_mode=ParseMode.HTML, reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player2_id, text=text2, parse_mode=ParseMode.HTML, reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player1_id, text=render_main_menu_text(player1_id, t=t1), reply_markup=_main_menu_markup(player1_id, t=t1), parse_mode=ParseMode.HTML)
            await bot.send_message(chat_id=player2_id, text=render_main_menu_text(player2_id, t=t2), reply_markup=_main_menu_markup(player2_id, t=t2), parse_mode=ParseMode.HTML)
        except Exception as exc:
            logger.exception("handle_timeout: failed to notify recovered BO3 game %s: %s", game_id, exc)

    elif result.get('outcome') in {'completed', 'draw'}:
        try:
            player1_roll = int(game.get('player1_roll') or 0)
            player2_roll = int(game.get('player2_roll') or 0)
            try:
                player1_info = await bot.get_chat(player1_id)
                player2_info = await bot.get_chat(player2_id)
                player1_name = player1_info.first_name
                player2_name = player2_info.first_name
            except Exception:
                player1_name = "Player 1"
                player2_name = "Player 2"
            winner = determine_winner(player1_roll, player2_roll)
            result_text_p1 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t1)
            result_text_p2 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t2)
            if winner == "draw":
                result_text_p1 += "\n" + t1("duel.finish.stakes_returned", default="💰 Stakes returned: {amount}", amount=format_balance_display(game.get('bet_amount') or 0))
                result_text_p2 += "\n" + t2("duel.finish.stakes_returned", default="💰 Stakes returned: {amount}", amount=format_balance_display(game.get('bet_amount') or 0))
            else:
                bank = float(game.get('bet_amount') or 0) * 2
                fee_bps = platform_settings.get_int("platform_fee_bps")
                winnings = round(bank * (1 - fee_bps / 10000), 8)
                result_text_p1 += "\n" + t1("duel.finish.winner_gets", default="🏆 Winner gets: {amount}", amount=format_balance_display(winnings))
                result_text_p2 += "\n" + t2("duel.finish.winner_gets", default="🏆 Winner gets: {amount}", amount=format_balance_display(winnings))
            await bot.send_message(chat_id=player1_id, text=f"{t1('duel.finish.real', default='🏁 <b>Duel finished.</b>')}\n\n{result_text_p1}", parse_mode=ParseMode.HTML, reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player2_id, text=f"{t2('duel.finish.real', default='🏁 <b>Duel finished.</b>')}\n\n{result_text_p2}", parse_mode=ParseMode.HTML, reply_markup=remove_reply_keyboard())
            await bot.send_message(chat_id=player1_id, text=render_main_menu_text(player1_id, t=t1), reply_markup=_main_menu_markup(player1_id, t=t1), parse_mode=ParseMode.HTML)
            await bot.send_message(chat_id=player2_id, text=render_main_menu_text(player2_id, t=t2), reply_markup=_main_menu_markup(player2_id, t=t2), parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.exception(f"handle_timeout: failed to notify recovered completed duel for game {game_id}: {e}")

    try:
        await safe_publish_result(bot, game_id)
    except Exception as e:
        logger.exception(f"handle_timeout: failed to publish timeout result to workspaces for game {game_id}: {e}")

    _clear_timer_scope(game_id)

async def start_timers(context, game_id, player1_id, player2_id, deadline_at=None):
    """Schedule two reminders and one shared authoritative timeout job."""
    deadline = as_utc(deadline_at) or (utcnow() + timedelta(seconds=ACTIVE_ROLL_SECONDS))
    now = utcnow()
    reminder_at = deadline - timedelta(seconds=ROLL_REMINDER_AFTER_SECONDS)

    _clear_timer_scope(game_id)
    if reminder_at > now:
        for uid in (player1_id, player2_id):
            reminder_job = scheduler.add_job(
                send_reminder,
                "date",
                run_date=reminder_at,
                args=[context, game_id, uid],
                id=f"reminder_{game_id}_{uid}",
                replace_existing=True,
            )
            _store_timer_job(game_id, uid, "reminder", reminder_job)

    timeout_job = scheduler.add_job(
        handle_timeout,
        "date",
        run_date=max(deadline, now),
        args=[context, game_id, player1_id, player2_id],
        id=f"timeout_{game_id}",
        replace_existing=True,
    )
    _store_timer_job(game_id, 0, "timeout", timeout_job)

def _practice_deadline(value, *, fallback_seconds: int) -> datetime:
    if isinstance(value, datetime):
        deadline = value
    elif value:
        deadline = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    else:
        deadline = datetime.now(timezone.utc) + timedelta(seconds=fallback_seconds)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline.astimezone(timezone.utc)


async def send_practice_reminder(context, practice_game_id, user_id):
    bot = context.bot if context else _broadcast_runtime_bot
    if bot is None:
        logger.warning("Cannot send Demo reminder: no bot available")
        return
    game = get_practice_game_by_id(practice_game_id)
    if not game or game.get("status") != "active":
        return
    if (user_id == game["player1_id"] and int(game.get("player1_roll") or 0) > 0) or \
       (user_id == game.get("player2_id") and int(game.get("player2_roll") or 0) > 0):
        return
    t = get_t(user_id)
    try:
        await bot.send_message(
            chat_id=user_id,
            text=t("duel.reminder.practice", default="⏰ You have 30 seconds left to send your dice roll in the Demo Duel!"),
        )
    except Exception as exc:
        logger.exception("Failed to send Demo reminder for game %s user %s: %s", practice_game_id, user_id, exc)


async def handle_practice_waiting_expiry(context, practice_game_id, player1_id):
    bot = context.bot if context else _broadcast_runtime_bot
    result = expire_waiting_practice_game(practice_game_id)
    waiting_key = f"practice-waiting:{practice_game_id}"
    _clear_timer_scope(waiting_key)
    if not result.get("ok") or not result.get("expired_now") or bot is None:
        return
    t = get_t(player1_id)
    try:
        await bot.send_message(
            chat_id=player1_id,
            text=t(
                "practice.waiting.expired",
                default="⌛ The Demo Duel expired because nobody joined. Your Demo stake was returned.",
            ),
            reply_markup=get_practice_menu_keyboard(t=t),
        )
    except Exception as exc:
        logger.exception("Failed to notify Demo waiting expiry for game %s: %s", practice_game_id, exc)


async def handle_practice_timeout(context, practice_game_id, player1_id, player2_id):
    bot = context.bot if context else _broadcast_runtime_bot
    if bot is None:
        logger.warning("Cannot settle Demo timeout: no bot available")
        return
    game = get_practice_game_by_id(practice_game_id)
    if not game or game.get("status") != "active":
        return
    p1_roll = int(game.get("player1_roll") or 0)
    p2_roll = int(game.get("player2_roll") or 0)
    t1 = get_t(player1_id)
    t2 = get_t(player2_id)

    is_series = is_series_format(game.get("duel_format") or DUEL_FORMAT_SINGLE)
    if p1_roll and p2_roll:
        if is_series:
            # Both rolls should normally be resolved atomically by the Demo BO3
            # state machine. Seeing them still pending at timeout is an
            # inconsistent recovery state, so fail closed: refund both Demo
            # stakes instead of guessing a round or match winner.
            logger.error(
                "Demo BO3 timeout found unresolved paired rolls for game %s; refunding fail-closed",
                practice_game_id,
            )
            winner = "draw"
            settle_result = settle_practice_game(practice_game_id, None, reason="timeout")
        else:
            from types import SimpleNamespace
            await handle_practice_game_finish(SimpleNamespace(bot=bot), game)
            _clear_timer_scope(f"practice:{practice_game_id}")
            return
    elif p1_roll:
        winner = "player1"
        settle_result = settle_practice_game(practice_game_id, player1_id, reason="timeout")
    elif p2_roll:
        winner = "player2"
        settle_result = settle_practice_game(practice_game_id, player2_id, reason="timeout")
    else:
        winner = "draw"
        settle_result = settle_practice_game(practice_game_id, None, reason="timeout")

    if not settle_result.get("ok"):
        logger.error("Failed to settle Demo timeout %s: %s", practice_game_id, settle_result.get("error"))
        return
    if settle_result.get("already_settled"):
        _clear_timer_scope(f"practice:{practice_game_id}")
        return

    payout = float(settle_result.get("payout_amount") or 0)
    fee = float(settle_result.get("fee_amount") or 0)
    fee_bps = int(settle_result.get("fee_bps") or 0)
    payout_line_1 = t1(
        "practice.result.timeout_payout",
        default="🏆 Demo payout: {payout}\n💸 Demo platform fee: {fee} ({percent:.2f}%)",
        payout=_format_practice_amount(payout),
        fee=_format_practice_amount(fee),
        percent=fee_bps / 100,
    )
    payout_line_2 = t2(
        "practice.result.timeout_payout",
        default="🏆 Demo payout: {payout}\n💸 Demo platform fee: {fee} ({percent:.2f}%)",
        payout=_format_practice_amount(payout),
        fee=_format_practice_amount(fee),
        percent=fee_bps / 100,
    )

    try:
        if winner == "player1":
            await bot.send_message(
                chat_id=player1_id,
                text=t1("duel.timeout.practice_win", default="⏰ Demo Duel timeout. You win because your opponent did not roll in time.") + "\n" + payout_line_1,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(
                chat_id=player2_id,
                text=t2("duel.timeout.practice_lose", default="❌ Demo Duel timeout. You did not roll in time."),
                reply_markup=remove_reply_keyboard(),
            )
        elif winner == "player2":
            await bot.send_message(
                chat_id=player2_id,
                text=t2("duel.timeout.practice_win", default="⏰ Demo Duel timeout. You win because your opponent did not roll in time.") + "\n" + payout_line_2,
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(
                chat_id=player1_id,
                text=t1("duel.timeout.practice_lose", default="❌ Demo Duel timeout. You did not roll in time."),
                reply_markup=remove_reply_keyboard(),
            )
        else:
            await bot.send_message(
                chat_id=player1_id,
                text=t1("duel.timeout.practice_cancel", default="⏰ Demo Duel timed out. Demo stakes were returned."),
                reply_markup=remove_reply_keyboard(),
            )
            await bot.send_message(
                chat_id=player2_id,
                text=t2("duel.timeout.practice_cancel", default="⏰ Demo Duel timed out. Demo stakes were returned."),
                reply_markup=remove_reply_keyboard(),
            )
        await bot.send_message(
            chat_id=player1_id,
            text=t1("duel.practice_ready", default="🧪 Choose what to do next:"),
            reply_markup=get_practice_result_actions_keyboard(
                practice_game_id,
                t=t1,
                can_restore=can_restore_practice_balance(player1_id),
            ),
        )
        await bot.send_message(
            chat_id=player2_id,
            text=t2("duel.practice_ready", default="🧪 Choose what to do next:"),
            reply_markup=get_practice_result_actions_keyboard(
                practice_game_id,
                t=t2,
                can_restore=can_restore_practice_balance(player2_id),
            ),
        )
    except Exception as exc:
        logger.exception("Failed to notify Demo timeout for game %s: %s", practice_game_id, exc)
    _clear_timer_scope(f"practice:{practice_game_id}")


async def start_practice_waiting_timer(context, practice_game_id, player1_id, deadline_at=None):
    deadline = _practice_deadline(deadline_at, fallback_seconds=DEMO_WAITING_SECONDS)
    waiting_key = f"practice-waiting:{practice_game_id}"
    _clear_timer_scope(waiting_key)
    job = scheduler.add_job(
        handle_practice_waiting_expiry,
        "date",
        run_date=deadline,
        args=[context, practice_game_id, player1_id],
        id=f"practice_waiting_expiry_{practice_game_id}",
        replace_existing=True,
    )
    _store_timer_job(waiting_key, 0, "expiry", job)


async def start_practice_timers(context, practice_game_id, player1_id, player2_id, deadline_at=None):
    deadline = _practice_deadline(deadline_at, fallback_seconds=DEMO_ACTIVE_SECONDS)
    practice_key = f"practice:{practice_game_id}"
    _clear_timer_scope(practice_key)
    now = datetime.now(timezone.utc)
    reminder_at = deadline - timedelta(seconds=ROLL_REMINDER_AFTER_SECONDS)
    if reminder_at > now:
        for uid in (player1_id, player2_id):
            reminder_job = scheduler.add_job(
                send_practice_reminder,
                "date",
                run_date=reminder_at,
                args=[context, practice_game_id, uid],
                id=f"practice_reminder_{practice_game_id}_{uid}",
                replace_existing=True,
            )
            _store_timer_job(practice_key, uid, "reminder", reminder_job)
    timeout_job = scheduler.add_job(
        handle_practice_timeout,
        "date",
        run_date=max(deadline, now),
        args=[context, practice_game_id, player1_id, player2_id],
        id=f"practice_timeout_{practice_game_id}",
        replace_existing=True,
    )
    _store_timer_job(practice_key, 0, "timeout", timeout_job)


async def cancel_timers(game_id, user_id):
    _clear_timer_user(game_id, user_id)

def _render_start_landing_text(*, start_arg: str | None, attribution: dict | None, user_id: int = None, t=None) -> str:
    parsed = parse_share_start_param(start_arg)
    lines = [render_main_menu_text(user_id, t=t)]
    if attribution and attribution.get("attributionStatus") == "created":
        inviter = ((attribution.get("invitedBy") or {}).get("displayName") or "your friend")
        lines.extend([
            "",
            f"✅ <b>Invite linked:</b> you joined from {inviter}.",
        ])
    elif attribution and attribution.get("attributionStatus") == "existing":
        lines.extend([
            "",
            "ℹ️ <b>Invite already linked:</b> your referral was already recorded earlier.",
        ])
    elif attribution and str(attribution.get("attributionStatus") or "").startswith("invalid_"):
        lines.extend([
            "",
            "⚠️ <b>Invite link ignored:</b> this start link is not valid for referral credit.",
        ])

    if parsed.get("kind") == "practice":
        lines.extend([
            "",
            t(
                "practice.share.detected",
                default="🧪 <b>Demo Duel invite detected:</b> the exact training duel is opened below.",
            ),
        ])
    elif parsed.get("kind") == "duel":
        lines.extend([
            "",
            "🔗 <b>Duel share detected:</b> use <b>Find Duel</b> from the classic menu to browse open duels.",
        ])
    elif parsed.get("kind") == "result":
        lines.extend([
            "",
            "🏁 <b>Result share detected:</b> the classic bot is primary now — open <b>Find Duel</b> or <b>Create Duel</b> below.",
        ])
    return "\n".join(lines)


# STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001 (supersedes
# STEP-REFERRAL-ATTRIBUTION-TERMS-GATE-FIX-001's pending_ref/TTL mechanism —
# attribution now happens unconditionally at the top of start_command, before
# the 18+/Terms gate, so no cross-callback state needs to survive at all).
_REFERRAL_EXCLUDED_START_ARGS = {
    'menu', 'create', 'find', 'leaderboard', 'profile', 'invite',
    'groups', 'help', 'balance', 'support', 'app', 'practice', 'history',
}


def _extract_referral_start_param(start_arg: str) -> str | None:
    """Return the referral start_param to attempt attribution with, or None
    if start_arg is not referral-shaped (menu command, empty, or a pure
    tournament_<id> link with no invite code).

    Mirrors the tournament-combo split already used inline in start_command
    (i_<code>_tournament_<id> -> i_<code>) so a combo link still credits the
    referrer even though the tournament-card UI itself is only shown later.
    """
    if not start_arg:
        return None
    normalized = start_arg.lower()
    if normalized in _REFERRAL_EXCLUDED_START_ARGS:
        return None
    # Acquisition links are analytics-only and must never be interpreted as
    # referral payloads, including malformed/unknown acq_* values.
    if normalized.startswith("acq_"):
        return None
    if start_arg.startswith("tournament_"):
        return None
    if start_arg.startswith("i_") and "_tournament_" in start_arg:
        return start_arg.split("_tournament_", 1)[0]
    return start_arg


async def _attempt_referral_attribution_and_notify(context: ContextTypes.DEFAULT_TYPE, user, start_param: str):
    """Attempt referral attribution for `user` using `start_param`, and if a
    new referral record was just created, notify the referrer immediately —
    at first /start, not deferred to any later event. Shared by every call
    site so there is exactly one place that creates the row and one place
    that sends the notification (no duplicate/inline copies to drift).

    Idempotent: attempt_referral_attribution checks for an existing row
    first (attributionStatus="existing" on replay), so calling this on every
    /start (not just the first) never double-writes or double-notifies.
    """
    attribution = attempt_referral_attribution(invited_user_id=user.id, start_param=start_param)
    if attribution and attribution.get("attributionStatus") == "created":
        try:
            referrer_id = attribution.get("invitedBy", {}).get("userId")
            if referrer_id:
                invited_name = user.first_name or user.username or f"User {user.id}"
                from services.i18n import get_translator as _i18n_gt
                from services.referrals import get_max_tier_bonus_percent
                referrer_t = _i18n_gt(get_user_language(referrer_id) or "en")
                base_pct = platform_settings.get_int("referral_rake_share_bps", 2000) / 100
                max_pct = base_pct + get_max_tier_bonus_percent()
                await context.bot.send_message(
                    chat_id=referrer_id,
                    text=referrer_t(
                        "referral.notify_joined",
                        default=(
                            "🎉 <b>New referral joined!</b>\n\n"
                            "👤 {name} just registered via your link.\n"
                            "🏆 You'll earn a share of their rake on every game they play — "
                            "{base:.0f}% base, growing with your tier (up to {max:.0f}% at Legend)."
                        ),
                        # HTML-escaped: first_name is untrusted user input and
                        # this message is sent with parse_mode=HTML — an
                        # unescaped '<'/'>'/'&' would break send_message and
                        # the whole notification would be swallowed by the
                        # except below instead of reaching the referrer.
                        name=escape(invited_name),
                        base=base_pct,
                        max=max_pct,
                    ),
                    parse_mode=ParseMode.HTML,
                )
        except Exception as e:
            logger.exception(f"Failed to send referral notification: {e}")
    return attribution


@guarded
async def _send_public_duel_join_prompt(*, bot: Bot, chat_id: int, user_id: int, duel_id: int, t) -> bool:
    """Show a safe public-waiting-duel prompt with truthful remaining time."""
    try:
        with get_connection() as conn:
            row = conn.execute(
                """
                SELECT game_id, bet_amount, deadline_at
                FROM games
                WHERE game_id = ?
                  AND status = 'waiting'
                  AND COALESCE(visibility, 'public') = 'public'
                  AND COALESCE(asset, 'GRAM') = 'GRAM'
                  AND (deadline_at IS NULL OR deadline_at > CURRENT_TIMESTAMP)
                """,
                (int(duel_id),),
            ).fetchone()
        if not row:
            await bot.send_message(
                chat_id=chat_id,
                text=t(
                    "community.duel_feed.unavailable",
                    default="⌛ This open duel is no longer available. Choose another duel from the community feed.",
                ),
                reply_markup=get_community_keyboard(lang=getattr(t, "lang", "en"), t=t),
            )
            return False
        item = dict(row)
        game_id = int(item["game_id"])
        bet = float(item["bet_amount"])
        remaining = format_mm_ss(seconds_remaining(item.get("deadline_at")))
        text = t(
            "community.duel_feed.found",
            default=(
                "⚔️ <b>Open Duel Found!</b>\n\n"
                "Stake: <b>{amount} GRAM</b>\n"
                "⏳ Available for: <b>{time}</b>\n"
                "Tap below to join."
            ),
            amount=f"{bet:.2f}",
            time=remaining,
        )
        label = t(
            "community.duel_feed.join",
            default="⚔️ Join Duel #{game_id} ({amount} GRAM)",
            game_id=game_id,
            amount=f"{bet:.2f}",
        )
        await bot.send_message(
            chat_id=chat_id,
            text=text,
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(label, callback_data=f"join_game_{game_id}")],
                [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
            ]),
        )
        return True
    except Exception as exc:
        logger.exception("Public duel deep-link lookup failed for game %s: %s", duel_id, exc)
        return False


async def _send_practice_duel_join_prompt(
    *,
    bot: Bot,
    chat_id: int,
    user_id: int,
    practice_game_id: int,
    t,
) -> bool:
    """Show a fail-closed Demo Duel join prompt for a referral-aware deep link."""
    if not _is_demo_mode_enabled():
        await bot.send_message(
            chat_id=chat_id,
            text=_demo_mode_disabled_text(t),
            parse_mode=ParseMode.HTML,
            reply_markup=_main_menu_markup(user_id, t=t),
        )
        return False

    allowed, error_text = _check_product_access(user_id, "duel")
    if not allowed:
        await bot.send_message(
            chat_id=chat_id,
            text=error_text,
            parse_mode=ParseMode.HTML,
            reply_markup=_main_menu_markup(user_id, t=t),
        )
        return False

    game_info = get_practice_join_preview(int(practice_game_id))
    if not game_info:
        await bot.send_message(
            chat_id=chat_id,
            text=t(
                "practice.share.unavailable",
                default="⌛ This Demo Duel is no longer available. Open Demo Mode to create or find another one.",
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_practice_menu_keyboard(t=t),
        )
        return False

    owner_id = int(game_info["player1_id"])
    stake_amount = float(game_info["stake_amount"])
    if owner_id == int(user_id):
        payload = get_practice_share_payload(int(practice_game_id), int(user_id))
        text = (
            t("practice.share.owner_title", default="🧪 <b>Your Demo Duel is waiting.</b>")
            + "\n\n"
            + t(
                "practice.share.owner_body",
                default="Share it with a friend. Their link opens this exact Demo Duel and can attribute your referral, while Demo play never counts as real referral activation.",
            )
            + "\n\n"
            + t(
                "practice.created.stake",
                default="💎 Stake: {stake}",
                stake=_format_practice_amount(stake_amount),
            )
        )
        await bot.send_message(
            chat_id=chat_id,
            text=text,
            parse_mode=ParseMode.HTML,
            reply_markup=get_practice_game_created_keyboard(
                int(practice_game_id),
                share_payload=payload,
                t=t,
            ),
        )
        return False

    active_kind, active_game = _get_active_duel_context(int(user_id))
    if active_kind:
        await bot.send_message(
            chat_id=chat_id,
            text=_describe_active_duel_conflict(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
        )
        return False

    balance = get_practice_balance(int(user_id))
    if balance < stake_amount:
        await bot.send_message(
            chat_id=chat_id,
            text=t(
                "practice.join.insufficient",
                default="❌ Not enough Demo GRAM.\n\n💎 Available: {balance} Demo GRAM",
                balance=f"{balance:.2f}",
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_practice_balance_keyboard(
                t=t,
                can_restore=can_restore_practice_balance(int(user_id)),
            ),
        )
        return False

    opponent_name = escape(str(game_info.get("first_name") or f"Player {owner_id}"))
    text = (
        t("practice.join.title", default="🧪 <b>Join Demo Duel</b>")
        + "\n\n"
        + t("practice.join.opponent", default="👤 Opponent: {name}", name=opponent_name)
        + "\n"
        + t(
            "practice.join.stake",
            default="💎 Stake: {stake}",
            stake=_format_practice_amount(stake_amount),
        )
        + "\n"
        + t(
            "practice.join.balance",
            default="💼 Your demo balance: {balance} Demo GRAM",
            balance=f"{balance:.2f}",
        )
        + "\n\n"
        + t("practice.join.confirm", default="Confirm joining this demo duel:")
    )
    await bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode=ParseMode.HTML,
        reply_markup=get_practice_game_confirmation_keyboard(
            int(practice_game_id), stake_amount, t=t
        ),
    )
    return True


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start and show the classic bot menu."""
    cleanup_expired_user_runtime_states(best_effort=True)
    user = update.effective_user
    user_states.pop(user.id, None)
    try:
        with get_connection() as _uc:
            _user_was_new = _uc.execute(
                "SELECT 1 FROM users WHERE user_id = ?", (user.id,)
            ).fetchone() is None
    except Exception:
        logger.exception("Failed to inspect pre-start user state for %s", user.id)
        _user_was_new = None
    create_or_update_user(user.id, user.username, user.first_name)

    # ── Language detection: DB → Telegram language_code → EN ──
    from services.i18n import get_translator, SUPPORTED_LANGS
    _db_lang = get_user_language(user.id)
    if _db_lang:
        _user_lang = _db_lang
    elif user.language_code and user.language_code[:2] in SUPPORTED_LANGS:
        _user_lang = user.language_code[:2]
        set_user_language(user.id, _user_lang)   # persist for future sessions
    else:
        _user_lang = "en"
    t = get_translator(_user_lang)
    context.user_data["t"] = t
    context.user_data["lang"] = _user_lang   # safety-set: some screens read lang directly

    # start_arg must be captured before the terms gate below.
    start_arg = context.args[0].strip() if context.args else ''
    normalized_arg = start_arg.lower()

    # STEP-ACQUISITION-ATTRIBUTION-FOUNDATION-001A: campaign attribution is
    # recorded before the Terms gate, exactly like referral attribution, but
    # in a fully separate analytics-only schema. Unknown/inactive campaign
    # codes are ignored and never become referral rows. First touch is
    # immutable; repeat campaign starts update last touch and append an event.
    _acquisition = None
    if parse_acquisition_start_param(start_arg).get("kind") == "acquisition":
        try:
            _acquisition = record_start_touch(
                user_id=user.id,
                start_arg=start_arg,
                language=_user_lang,
                user_was_new=_user_was_new,
                event_key=(
                    f"telegram_update:{update.update_id}"
                    if getattr(update, "update_id", None) is not None
                    else None
                ),
            )
        except Exception:
            logger.exception("Failed to record acquisition start for user %s", user.id)

    # Preserve exact duel navigation across the first-time 18+/Terms gate.
    # Referral attribution is independent and runs below before the gate.
    _parsed_start_intent = parse_share_start_param(start_arg)
    if _parsed_start_intent.get("kind") == "practice" and _parsed_start_intent.get("practiceGameId"):
        try:
            store_pending_practice_start(
                user_id=user.id,
                start_arg=start_arg,
                practice_game_id=int(_parsed_start_intent["practiceGameId"]),
                ttl_seconds=30 * 60,
            )
        except Exception:
            logger.exception("Failed to persist Demo Duel start intent for user %s", user.id)
    elif _parsed_start_intent.get("kind") == "demo":
        try:
            store_pending_demo_mode_start(
                user_id=user.id,
                start_arg=start_arg,
                ttl_seconds=30 * 60,
            )
        except Exception:
            logger.exception("Failed to persist Demo Mode start intent for user %s", user.id)
    elif _parsed_start_intent.get("kind") == "duel" and _parsed_start_intent.get("duelId"):
        try:
            from services.community_duel_feed import store_pending_duel_start
            store_pending_duel_start(
                user_id=user.id,
                start_arg=start_arg,
                duel_id=int(_parsed_start_intent["duelId"]),
                ttl_seconds=30 * 60,
            )
        except Exception:
            logger.exception("Failed to persist public duel start intent for user %s", user.id)

    # STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001: referral attribution
    # (and the referrer notification) now runs unconditionally here, at the
    # very first /start, regardless of whether the 18+/Terms gate is about to
    # be shown. Attribution is a data link between two accounts, not a bet or
    # a charge — it does not need to wait for this user's own terms
    # acceptance, and deferring it (the previous STEP-REFERRAL-ATTRIBUTION-
    # TERMS-GATE-FIX-001 approach, via a single-slot TTL'd pending_ref in
    # user_states) added fragility for no product reason. Idempotent: safe
    # to call on every /start, not just the first.
    _ref_param = _extract_referral_start_param(start_arg)
    attribution = await _attempt_referral_attribution_and_notify(context, user, _ref_param) if _ref_param else None

    # ── 18+ / Terms check (first-time only) ──
    try:
        with get_connection() as _tc:
            _trow = _tc.execute(
                "SELECT accepted_terms_at FROM users WHERE user_id = ?",
                (user.id,),
            ).fetchone()
        if not _trow or not _trow.get("accepted_terms_at") if hasattr(_trow, 'get') else (not _trow or not _trow[0]):
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(t("legal.btn_confirm", default="✅ Подтверждаю (18+)"), callback_data="accept_terms")],
                [InlineKeyboardButton(t("legal.btn_decline", default="❌ Отклонить"), callback_data="decline_terms")],
            ])
            await update.message.reply_text(
                t("legal.notice",
                  default=(
                      "⚠️ <b>Важное уведомление</b>\n\n"
                      "Roll Duel — это игра P2P с кубиком, не казино.\n"
                      "Вам должно быть <b>18+</b> и вы берёте ответственность за соблюдение законов вашей страны.\n\n"
                      "Вы подтверждаете, что вам 18+ и принимаете Условия использования?"
                  )),
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
            )
            return  # halt until confirmed
    except Exception as _te:
        logger.warning("terms check failed for user %s: %s", user.id, _te)

    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    # Tournament deep-links must be handled before the generic menu-command
    # branches below (practice/history/group_/main-menu fallthrough).
    # Referral attribution itself already ran unconditionally above, before
    # this block, so it is NOT what this ordering is protecting anymore
    # (STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001) — what's still
    # protected here is that i_CODE_tournament_ID links show the tournament
    # card instead of falling into the plain main-menu path.
    if start_arg.startswith("tournament_") or (start_arg.startswith("i_") and "_tournament_" in start_arg):
        try:
            if start_arg.startswith("tournament_"):
                tournament_id = int(start_arg.split("_", 1)[1])
            else:
                parts = start_arg.split("_tournament_", 1)
                tournament_id = int(parts[1])
                # Attribution for the i_<code> half already happened above
                # (via _extract_referral_start_param), unconditionally at the
                # top of this function — no need to attempt it again here.

            info = tournament_service.get_tournament_status_text(tournament_id, lang=getattr(t, "lang", "ru"))
            tournament = tournament_service.get_tournament(tournament_id)
            buttons = [[InlineKeyboardButton(t("tournament.btn.join_one", default="✅ Вступить в турнир"), callback_data=f"join_tournament_{tournament_id}")]]
            if tournament and tournament.get("status") != "forming":
                buttons = [[InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")]]
            await update.message.reply_text(
                info,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
            )
            return
        except Exception as e:
            logger.warning(f"tournament deep-link parse failed for '{start_arg}': {e}")

    if normalized_arg == "community_play":
        await update.message.reply_text(
            render_main_menu_text(user.id, t=t),
            reply_markup=_main_menu_markup(user.id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if normalized_arg == "community_balance":
        await update.message.reply_text(
            render_balance_screen_text(user.id, t=t),
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if normalized_arg == "community_tournament":
        tournament_text, tournament_keyboard = _tournament_menu_content(user.id, t=t)
        await update.message.reply_text(
            tournament_text,
            reply_markup=tournament_keyboard,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if normalized_arg == "community_help":
        await update.message.reply_text(
            render_help_text(t=t),
            reply_markup=get_help_keyboard(t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return

    if normalized_arg == 'practice' or _parsed_start_intent.get("kind") == "demo":
        if not _is_demo_mode_enabled():
            await update.message.reply_text(_demo_mode_disabled_text(t), parse_mode=ParseMode.HTML)
            return
        await update.message.reply_text(
            render_practice_menu_text(user.id, t=t),
            reply_markup=get_practice_menu_keyboard(
                t=t,
                can_restore=can_restore_practice_balance(user.id),
            ),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if normalized_arg == 'history':
        snapshot = get_duel_history(user.id, limit=10)
        await update.message.reply_text(
            render_duel_history_text(snapshot, t=t),
            reply_markup=get_duel_history_keyboard(bool(snapshot.get('items')), t=t, demo_mode_enabled=_is_demo_mode_enabled()),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return

    # RD-BOT-012: Handle group deep link ?start=group_XXXX
    if start_arg.startswith("group_"):
        workspace_id = start_arg.replace("group_", "", 1)
        try:
            workspace = get_workspace_detail(user_id, workspace_id)
            if workspace:
                # Persist workspace context so duel creation picks it up
                context.user_data["active_workspace_id"] = workspace_id
                context.user_data["active_workspace_title"] = workspace.get("title", "")
                group_title = workspace.get("title") or t("group_context.unknown", default="Unknown Group")
                await update.message.reply_text(
                    t(
                        "group_context.opened",
                        default=(
                            "🎲 <b>You are playing from group:</b> {group}\n\n"
                            "Duels created now will have results published to this group (if enabled).\n\n"
                            "Choose what you want to do:"
                        ),
                        group=escape(str(group_title)),
                    ),
                    parse_mode=ParseMode.HTML,
                    reply_markup=_main_menu_markup(user.id, t=t),
                )
                return
        except Exception as e:
            logger.exception(f"Failed to load workspace for deep link: {e}")

    # ── Tournament deep-links ─────────────────────────────────────────────
    # Format 1: tournament_<id>
    if start_arg.startswith("tournament_"):
        try:
            tournament_id = int(start_arg.split("_")[1])
            info = tournament_service.get_tournament_status_text(tournament_id, lang=getattr(t, "lang", "ru"))
            tournament = tournament_service.get_tournament(tournament_id)
            buttons = [[InlineKeyboardButton(t("tournament.btn.join_one", default="✅ Вступить в турнир"), callback_data=f"join_tournament_{tournament_id}")]]
            if tournament and tournament.get("status") != "forming":
                buttons = [[InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")]]
            await update.message.reply_text(
                info,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
            )
            return
        except Exception as e:
            logger.warning(f"tournament deep-link parse failed for '{start_arg}': {e}")

    # Format 2: i_<ref_code>_tournament_<id>  (referral + tournament combo)
    if start_arg.startswith("i_") and "_tournament_" in start_arg:
        try:
            parts = start_arg.split("_tournament_")
            if len(parts) == 2:
                tournament_id = int(parts[1])
                info = tournament_service.get_tournament_status_text(tournament_id, lang=getattr(t, "lang", "ru"))
                tournament = tournament_service.get_tournament(tournament_id)
                buttons = [[InlineKeyboardButton(t("tournament.btn.join_one", default="✅ Вступить в турнир"), callback_data=f"join_tournament_{tournament_id}")]]
                if tournament and tournament.get("status") != "forming":
                    buttons = [[InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")]]
                await update.message.reply_text(
                    info,
                    parse_mode=ParseMode.HTML,
                    reply_markup=InlineKeyboardMarkup(buttons),
                )
                return
        except Exception as e:
            logger.warning(f"tournament ref deep-link parse failed for '{start_arg}': {e}")
    # ── end tournament deep-links ─────────────────────────────────────────

    # ── Private Duel deep-link: start=duel_{invite_code} ─────────────────
    if start_arg.startswith("duel_") and not start_arg.startswith("duel_0") and len(start_arg) > 5:
        invite_code = start_arg[5:]  # strip "duel_" prefix
        try:
            from services.private_duels import join_private_game
            join_result = join_private_game(invite_code=invite_code, player2_id=user.id)
            if join_result.get("ok"):
                game_id = join_result["game_id"]
                opponent_id = join_result.get("opponent_id")
                bet_amount = float(join_result.get("bet_amount") or 0)

                # ``join_game_with_reservation`` atomically sets started_at and
                # the authoritative 60-second deadline before this UX is sent.

                await update.message.reply_text(
                    t("private_duel.joined",
                      default=(
                          "⚔️ <b>You joined a private duel!</b>\n\n"
                          "💰 Stake: <b>{amount} GRAM</b>\n\n"
                          "⏱ You have <b>60 seconds</b> to roll. A reminder arrives after 30 seconds.\n"
                          "🎲 Send your dice now."
                      ),
                      amount=f"{bet_amount:.2f}"),
                    parse_mode=ParseMode.HTML,
                    reply_markup=get_game_keyboard(),
                )

                if opponent_id:
                    try:
                        t_opp = get_t(int(opponent_id))
                        game_text = t_opp(
                            "duel.started",
                            default=(
                                "🎮 <b>Duel started.</b>\n\n"
                                "🎲 Duel #{game_id}\n"
                                "💰 Stake: <b>{amount}</b>\n\n"
                                "⏱ Each player has <b>60 seconds</b> to roll. A reminder arrives after 30 seconds."
                            ),
                            game_id=game_id,
                            amount=format_balance_display(bet_amount),
                        )
                        await context.bot.send_message(
                            chat_id=int(opponent_id),
                            text=game_text,
                            parse_mode=ParseMode.HTML,
                        )
                        await context.bot.send_message(
                            chat_id=int(opponent_id),
                            text=t_opp("duel.roll_prompt", default="🎲 Send your dice roll now.\n\n⏱ You have 60 seconds from the start of the duel. A reminder arrives after 30 seconds."),
                            reply_markup=get_game_keyboard(),
                        )
                        await start_timers(context, game_id, int(opponent_id), user.id, deadline_at=join_result.get("deadline_at"))
                    except Exception as e:
                        logger.exception("private duel deep-link: failed to notify challenger for game %s: %s", game_id, e)
                return
            else:
                err = join_result.get("error", "expired")
                if err == "User already has an active duel":
                    active_kind, active_game = _get_active_duel_context(user.id)
                    await update.message.reply_text(
                        _describe_active_duel_conflict(active_kind, active_game, t=t),
                        parse_mode=ParseMode.HTML,
                        reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
                    )
                elif err in ("already_full", "already_started"):
                    await update.message.reply_text(
                        t("private_duel.already_started",
                          default="⚠️ This duel has already started or is full."),
                        parse_mode=ParseMode.HTML,
                        reply_markup=_main_menu_markup(user.id, t=t),
                    )
                else:
                    await update.message.reply_text(
                        t("private_duel.expired",
                          default="⏰ This challenge link has expired or is invalid."),
                        parse_mode=ParseMode.HTML,
                        reply_markup=_main_menu_markup(user.id, t=t),
                    )
                return
        except Exception as e:
            logger.exception("Private duel deep-link failed for code=%s: %s", invite_code, e)
    # ── end Private Duel deep-link ────────────────────────────────────────

    text = _render_start_landing_text(start_arg=start_arg, attribution=attribution, user_id=user.id, t=t)

    # If start param contains an exact duel target, navigate directly to it.
    parsed_start = parse_share_start_param(start_arg)
    practice_game_id_from_link = parsed_start.get("practiceGameId")
    duel_id_from_link = parsed_start.get("duelId")
    if practice_game_id_from_link:
        chat_id = update.message.chat_id
        await context.bot.send_dice(chat_id, emoji='🎲')
        await asyncio.sleep(1.2)
        await update.message.reply_text(
            text,
            reply_markup=_main_menu_markup(user.id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        try:
            clear_start_intent(user.id)
        except Exception:
            pass
        await _send_practice_duel_join_prompt(
            bot=context.bot,
            chat_id=chat_id,
            user_id=user.id,
            practice_game_id=int(practice_game_id_from_link),
            t=t,
        )
        return
    if duel_id_from_link:
        chat_id = update.message.chat_id
        await context.bot.send_dice(chat_id, emoji='🎲')
        await asyncio.sleep(1.2)
        await update.message.reply_text(
            text,
            reply_markup=_main_menu_markup(user.id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        try:
            clear_start_intent(user.id)
        except Exception:
            pass
        await _send_public_duel_join_prompt(
            bot=context.bot, chat_id=chat_id, user_id=user.id, duel_id=int(duel_id_from_link), t=t
        )
        return

    # Кубик перед главным меню (обычный вход)
    chat_id = update.message.chat_id
    await context.bot.send_dice(chat_id, emoji='🎲')
    await asyncio.sleep(1.2)
    await update.message.reply_text(
        text,
        reply_markup=_main_menu_markup(user.id, t=t),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )

@guarded
async def app_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a one-tap Mini App launcher from the slash-command menu."""
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    await update.message.reply_text(
        render_open_app_text(),
        reply_markup=get_open_app_keyboard(),
        parse_mode=ParseMode.HTML,
    )


@guarded
async def practice_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _is_allowed_in_chat(update, context):
        return
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator(get_user_language(user.id) or "en"))
    if not _is_demo_mode_enabled():
        await update.message.reply_text(_demo_mode_disabled_text(t), parse_mode=ParseMode.HTML)
        return
    await update.message.reply_text(
        render_practice_menu_text(user.id, t=t),
        reply_markup=get_practice_menu_keyboard(t=t, can_restore=can_restore_practice_balance(user.id)),
        parse_mode=ParseMode.HTML,
    )


async def show_workspace_list(target, *, user_id: int, edit: bool = True):
    from services.i18n import get_translator
    t = get_translator(get_user_language(user_id) or "en")
    text = render_workspace_list_text(user_id, t=t)
    keyboard = get_workspace_list_keyboard(list_workspaces_for_user(user_id), t=t)
    if edit:
        await target.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard)
    else:
        await target.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard)

async def show_workspace_detail(target, *, user_id: int, workspace_id: str, edit: bool = True, bot: Bot | None = None):
    from services.i18n import get_translator
    t = get_translator(get_user_language(user_id) or "en")
    detail = get_workspace_detail(user_id, workspace_id)
    if not detail:
        if edit:
            await target.edit_message_text(
                t("workspace.error.not_found", default="❌ Group not found."),
                reply_markup=get_back_button("my_chats", t=t),
            )
        else:
            await target.reply_text(
                t("workspace.error.not_found", default="❌ Group not found."),
                reply_markup=get_back_button("my_chats", t=t),
            )
        return
    runtime_status = await get_workspace_runtime_status(bot, user_id=user_id, detail=detail)
    text = render_workspace_detail_text(detail, runtime_status=runtime_status, t=t)
    keyboard = get_workspace_settings_keyboard(detail, t=t)
    if edit:
        await target.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)
    else:
        await target.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)


async def handle_leaderboard_callback(query, context, *, scope: str = "global"):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    snapshot = get_leaderboard_snapshot(user_id)
    normalized_scope = str(scope or "global").strip().lower()
    if normalized_scope == "leaderboard":
        normalized_scope = "global"
    if normalized_scope == "chat":
        normalized_scope = "workspace"
    await safe_edit_message(query.message,
        render_leaderboard_text(snapshot, scope=normalized_scope, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_leaderboard_keyboard(normalized_scope, workspace_available=bool((snapshot.get("workspace") or {}).get("available")), t=t),
        disable_web_page_preview=True,
    )


@guarded
async def leaderboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _is_allowed_in_chat(update, context):
        return
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    snapshot = get_leaderboard_snapshot(user.id)
    await update.message.reply_text(
        render_leaderboard_text(snapshot, scope="global", t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_leaderboard_keyboard("global", workspace_available=bool((snapshot.get("workspace") or {}).get("available")), t=t),
        disable_web_page_preview=True,
    )


def _bo3_enabled() -> bool:
    try:
        return platform_settings.get_bool("duel_series_bo3_enabled")
    except Exception:
        return False


def _practice_bo3_enabled() -> bool:
    try:
        return platform_settings.get_bool("practice_series_bo3_enabled")
    except Exception:
        return False


def _selected_practice_duel_format(context) -> str:
    try:
        return normalize_duel_format(
            context.user_data.get("practice_duel_format") or DUEL_FORMAT_SINGLE
        )
    except Exception:
        return DUEL_FORMAT_SINGLE


def _practice_duel_format_label(duel_format: str, *, t) -> str:
    if normalize_duel_format(duel_format) == DUEL_FORMAT_BEST_OF_3:
        return t("practice.format.bo3.label", default="Best of 3 · first to 2 wins")
    return t("practice.format.single.label", default="Single Round")


async def handle_practice_format_menu(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    if not _practice_bo3_enabled():
        context.user_data["practice_duel_format"] = DUEL_FORMAT_SINGLE
        balance = get_practice_balance(int(query.from_user.id))
        await safe_edit_message(
            query.message,
            _practice_create_prompt(int(query.from_user.id), t=t, duel_format=DUEL_FORMAT_SINGLE),
            reply_markup=get_practice_bet_amount_keyboard(
                t=t,
                balance=balance,
                can_restore=can_restore_practice_balance(int(query.from_user.id)),
            ),
            parse_mode=ParseMode.HTML,
        )
        return
    await safe_edit_message(
        query.message,
        t(
            "practice.format.choose",
            default=(
                "🎮 <b>Choose Demo duel format</b>\n\n"
                "🎯 <b>Best of 3</b> — recommended: first to two round wins.\n"
                "⚡ <b>Single Round</b> — quickest way to try one dice result.\n\n"
                "One Demo stake covers the whole match. No real GRAM is used."
            ),
        ),
        reply_markup=get_practice_duel_format_keyboard(t=t),
        parse_mode=ParseMode.HTML,
    )


async def handle_practice_format_selection(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    requested = str(query.data or "").replace("practice_format_", "", 1)
    try:
        duel_format = normalize_duel_format(requested)
    except ValueError:
        await safe_answer_callback(query, t("error.generic", default="❌ Invalid Demo duel format."), show_alert=True)
        return
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _practice_bo3_enabled():
        await safe_answer_callback(
            query,
            t("practice.format.bo3.disabled", default="Demo Best of 3 is currently disabled."),
            show_alert=True,
        )
        return
    context.user_data["practice_duel_format"] = duel_format
    balance = get_practice_balance(int(query.from_user.id))
    await safe_edit_message(
        query.message,
        _practice_create_prompt(int(query.from_user.id), t=t, duel_format=duel_format),
        reply_markup=get_practice_bet_amount_keyboard(
            t=t,
            balance=balance,
            can_restore=can_restore_practice_balance(int(query.from_user.id)),
            back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
        ),
        parse_mode=ParseMode.HTML,
    )


def _selected_duel_format(context) -> str:
    try:
        return normalize_duel_format(context.user_data.get("duel_format") or DUEL_FORMAT_SINGLE)
    except Exception:
        return DUEL_FORMAT_SINGLE


def _duel_format_label(duel_format: str, *, t) -> str:
    if normalize_duel_format(duel_format) == DUEL_FORMAT_BEST_OF_3:
        return t("duel.format.bo3.label", default="Best of 3 · first to 2 wins")
    return t("duel.format.single.label", default="Single round")


def _duel_stake_prompt(duel_format: str, *, t) -> str:
    return t(
        "duel.create.stake_prompt_with_format",
        default="💰 <b>Create Duel</b>\n\nFormat: <b>{format}</b>\nOne stake covers the entire match. Choose a GRAM stake:",
        format=_duel_format_label(duel_format, t=t),
    )


async def handle_duel_format_menu(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if not _bo3_enabled():
        context.user_data["duel_format"] = DUEL_FORMAT_SINGLE
        await safe_edit_message(
            query.message,
            _duel_stake_prompt(DUEL_FORMAT_SINGLE, t=t),
            reply_markup=get_bet_amount_keyboard(t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    await safe_edit_message(
        query.message,
        t(
            "duel.format.choose",
            default=(
                "🎮 <b>Choose duel format</b>\n\n"
                "⚡ <b>Single round</b> — fastest result.\n"
                "🎯 <b>Best of 3</b> — first to win two rounds.\n\n"
                "One stake and one settlement cover the entire match."
            ),
        ),
        reply_markup=get_duel_format_keyboard(t=t),
        parse_mode=ParseMode.HTML,
    )


async def handle_duel_format_selection(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    requested = query.data.replace("duel_format_", "", 1)
    try:
        duel_format = normalize_duel_format(requested)
    except ValueError:
        await safe_answer_callback(query, t("error.generic", default="❌ Invalid duel format."), show_alert=True)
        return
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _bo3_enabled():
        await safe_answer_callback(query, t("duel.format.bo3.disabled", default="Best of 3 is currently disabled."), show_alert=True)
        return
    context.user_data["duel_format"] = duel_format
    await safe_edit_message(
        query.message,
        _duel_stake_prompt(duel_format, t=t),
        reply_markup=get_bet_amount_keyboard(
            user_id=query.from_user.id,
            t=t,
            back_callback="duel_format_menu" if _bo3_enabled() else "back_to_main",
        ),
        parse_mode=ParseMode.HTML,
    )


@guarded
async def create_duel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _is_allowed_in_chat(update, context):
        return
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    allowed, error_text = _check_product_access(user.id, 'duel')
    if not allowed:
        await update.message.reply_text(error_text)
        return
    active_kind, active_game = _get_active_duel_context(user.id)
    if active_kind:
        await update.message.reply_text(
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    context.user_data["duel_format"] = DUEL_FORMAT_SINGLE
    if _bo3_enabled():
        await update.message.reply_text(
            t(
                "duel.format.choose",
                default=(
                    "🎮 <b>Choose duel format</b>\n\n"
                    "⚡ <b>Single round</b> — fastest result.\n"
                    "🎯 <b>Best of 3</b> — first to win two rounds.\n\n"
                    "One stake and one settlement cover the entire match."
                ),
            ),
            reply_markup=get_duel_format_keyboard(t=t),
            parse_mode=ParseMode.HTML,
        )
    else:
        await update.message.reply_text(
            _duel_stake_prompt(DUEL_FORMAT_SINGLE, t=t),
            reply_markup=get_bet_amount_keyboard(t=t),
            parse_mode=ParseMode.HTML,
        )


@guarded
async def find_duel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _is_allowed_in_chat(update, context):
        return
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    allowed, error_text = _check_product_access(user.id, 'duel_find')
    if not allowed:
        await update.message.reply_text(error_text)
        return
    active_kind, active_game = _get_active_duel_context(user.id)
    if active_kind:
        await update.message.reply_text(
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    waiting_games = get_waiting_games()
    text = t("duel.find.title", default="🔍 <b>Find Duel</b>") + "\n\n"
    text += (
        t("duel.find.open_duels", default="Open duels:")
        if waiting_games
        else t("duel.find.empty", default="😔 No open duels yet.\nCreate one to start the lobby.")
    )
    await update.message.reply_text(
        text,
        reply_markup=get_waiting_games_keyboard(waiting_games, user.id),
        parse_mode=ParseMode.HTML,
    )


async def handle_practice_mode_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    user_states.pop(int(query.from_user.id), None)
    await safe_edit_message(query.message,
        render_practice_menu_text(query.from_user.id, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_practice_menu_keyboard(
            t=t,
            can_restore=can_restore_practice_balance(query.from_user.id),
        ),
    )


def _practice_roll_prompt(duel_format: str, *, t, round_number: int = 1, score1: int = 0, score2: int = 0) -> str:
    if normalize_duel_format(duel_format) == DUEL_FORMAT_BEST_OF_3:
        return t(
            "practice.series.roll_prompt_current",
            default=(
                "🎯 Demo Round {round} · Best of 3\n"
                "📊 Score: {score1}–{score2}\n"
                "🎲 Send a fresh Demo dice roll now. One Demo stake covers the whole match."
            ),
            round=round_number,
            score1=score1,
            score2=score2,
        )
    return t(
        "practice.started.roll_prompt",
        default=(
            "🎲 Send your Demo dice roll now.\n"
            "⏱ You have 60 seconds from the start; a reminder arrives after 30 seconds."
        ),
    )


def _practice_create_prompt(
    user_id: int,
    *,
    t,
    duel_format: str = DUEL_FORMAT_SINGLE,
) -> str:
    balance = get_practice_balance(user_id)
    return (
        t(
            "practice.create.title_with_balance_and_format",
            default=(
                "🧪 <b>Create Demo Duel</b>\n\n"
                "Format: <b>{format}</b>\n"
                "Available: <b>{balance} Demo GRAM</b>\n"
                "One Demo stake covers the whole match. Choose your stake:"
            ),
            balance=f"{balance:.2f}",
            format=_practice_duel_format_label(duel_format, t=t),
        )
        + "\n\n"
        + t(
            "practice.create.affordable_note",
            default=(
                "Only stakes available within your current Demo balance are shown. "
                "Use <b>All Demo Balance</b> or <b>Custom Amount</b> for another value."
            ),
        )
    )


def _practice_create_error_text(error: object, *, balance: float, t) -> str:
    normalized = str(error or "").strip().lower()
    if "best of 3 is disabled" in normalized or "bo3_disabled" in normalized:
        return t(
            "practice.format.bo3.disabled",
            default="Demo Best of 3 is currently disabled.",
        )
    if "already has an active" in normalized:
        return t(
            "practice.error.active",
            default="❌ You already have an active Demo Duel.",
        )
    if "insufficient" in normalized:
        return t(
            "practice.custom.exceeds_balance",
            default="❌ This stake exceeds your available Demo balance of <b>{balance} Demo GRAM</b>.",
            balance=f"{balance:.2f}",
        )
    if "minimum" in normalized:
        return t(
            "practice.custom.minimum",
            default="❌ Minimum Demo stake is <b>{min} Demo GRAM</b>.",
            min=f"{PRACTICE_MIN_STAKE:g}",
        )
    return t(
        "practice.error.create",
        default="❌ Could not create the Demo Duel. Please try again.",
    )


def _normalize_practice_stake_input(raw_value: object, *, balance: float, t) -> tuple[bool, float | None, str | None]:
    try:
        amount = float(str(raw_value or "").strip().replace(",", "."))
    except (TypeError, ValueError):
        return False, None, t(
            "practice.custom.invalid",
            default="❌ Enter a valid number, for example <b>2.5</b>.",
        )
    if not math.isfinite(amount):
        return False, None, t(
            "practice.custom.invalid",
            default="❌ Enter a valid number, for example <b>2.5</b>.",
        )
    if amount < PRACTICE_MIN_STAKE:
        return False, None, t(
            "practice.custom.minimum",
            default="❌ Minimum Demo stake is <b>{min} Demo GRAM</b>.",
            min=f"{PRACTICE_MIN_STAKE:g}",
        )
    if amount > float(balance) + 1e-9:
        return False, None, t(
            "practice.custom.exceeds_balance",
            default="❌ This stake exceeds your available Demo balance of <b>{balance} Demo GRAM</b>.",
            balance=f"{balance:.2f}",
        )
    return True, amount, None


async def _create_practice_duel_and_render(
    *,
    message,
    context,
    user_id: int,
    stake_amount: float,
    t,
    edit_existing: bool,
    duel_format: str = DUEL_FORMAT_SINGLE,
):
    create_result = create_practice_game(user_id, stake_amount, duel_format=duel_format)
    if not create_result.get("ok"):
        balance = get_practice_balance(user_id)
        error_text = _practice_create_error_text(create_result.get("error"), balance=balance, t=t)
        markup = get_practice_bet_amount_keyboard(
            t=t,
            balance=balance,
            can_restore=can_restore_practice_balance(user_id),
            back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
        )
        if edit_existing:
            await safe_edit_message(message, error_text, reply_markup=markup, parse_mode=ParseMode.HTML)
        else:
            await message.reply_text(error_text, reply_markup=markup, parse_mode=ParseMode.HTML)
        return None

    practice_game_id = int(create_result["practice_game_id"])
    canonical_stake = float(create_result.get("stake_amount") or stake_amount)
    canonical_format = normalize_duel_format(
        create_result.get("duel_format") or duel_format or DUEL_FORMAT_SINGLE
    )
    success_text = (
        t("practice.created.title", default="✅ <b>Demo duel created.</b>") + "\n\n"
        + t("practice.created.id", default="🧪 Demo Duel ID: {id}", id=practice_game_id) + "\n"
        + t(
            "practice.created.format",
            default="🎮 Format: {format}",
            format=_practice_duel_format_label(canonical_format, t=t),
        ) + "\n"
        + t("practice.created.stake", default="💎 Stake: {stake}", stake=_format_practice_amount(canonical_stake)) + "\n"
        + t(
            "practice.created.balance",
            default="💼 Remaining demo balance: {balance} Demo GRAM",
            balance=f"{get_practice_balance(user_id):.2f}",
        ) + "\n"
        + t("practice.created.waiting", default="⏳ Waiting for another player...") + "\n\n"
        + t("practice.created.note", default="This is a demo duel: no real GRAM is used.")
    )
    share_payload = get_practice_share_payload(practice_game_id, user_id)
    markup = get_practice_game_created_keyboard(
        practice_game_id,
        share_payload=share_payload,
        t=t,
    )
    if edit_existing:
        msg = await safe_edit_message(
            message,
            success_text,
            reply_markup=markup,
            parse_mode=ParseMode.HTML,
        )
    else:
        msg = await message.reply_text(
            success_text,
            reply_markup=markup,
            parse_mode=ParseMode.HTML,
        )
    if msg is not None and getattr(msg, "message_id", None):
        set_practice_room_message_id(practice_game_id, int(msg.message_id))
    await start_practice_waiting_timer(
        context,
        practice_game_id,
        user_id,
        deadline_at=create_result.get("deadline_at"),
    )
    return create_result


async def handle_create_practice_game(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    user_id = int(query.from_user.id)
    user_states.pop(user_id, None)
    allowed, error_text = _check_product_access(user_id, "duel")
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await safe_edit_message(query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    if _practice_bo3_enabled():
        context.user_data["practice_duel_format"] = DUEL_FORMAT_BEST_OF_3
        await handle_practice_format_menu(query, context)
        return
    context.user_data["practice_duel_format"] = DUEL_FORMAT_SINGLE
    balance = get_practice_balance(user_id)
    await safe_edit_message(
        query.message,
        _practice_create_prompt(user_id, t=t, duel_format=DUEL_FORMAT_SINGLE),
        reply_markup=get_practice_bet_amount_keyboard(
            t=t,
            balance=balance,
            can_restore=can_restore_practice_balance(user_id),
        ),
        parse_mode=ParseMode.HTML,
    )


async def handle_practice_bet_selection(query, context):
    user_id = int(query.from_user.id)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return

    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        user_states.pop(user_id, None)
        await safe_edit_message(
            query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    callback_data = str(query.data or "")
    balance = get_practice_balance(user_id)
    if callback_data == "practice_bet_custom":
        if balance < PRACTICE_MIN_STAKE:
            await safe_edit_message(
                query.message,
                t(
                    "practice.custom.unavailable",
                    default="❌ Custom Demo stake is unavailable because your balance is below the minimum stake.",
                ),
                reply_markup=get_practice_bet_amount_keyboard(
                    t=t,
                    balance=balance,
                    can_restore=can_restore_practice_balance(user_id),
                    back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
                ),
                parse_mode=ParseMode.HTML,
            )
            return
        user_states[user_id] = "waiting_custom_practice_bet"
        await safe_edit_message(
            query.message,
            t(
                "practice.custom.prompt",
                default="✏️ Enter a Demo stake from <b>{min}</b> to <b>{max} Demo GRAM</b>.",
                min=f"{PRACTICE_MIN_STAKE:g}",
                max=f"{balance:.2f}",
            ),
            reply_markup=get_back_button("practice_format_menu" if _practice_bo3_enabled() else "practice_create", t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    if callback_data == "practice_bet_all":
        stake_amount = balance
    elif callback_data.startswith("pbet_"):
        ok, stake_amount, error_text = _normalize_practice_stake_input(
            callback_data.removeprefix("pbet_"),
            balance=balance,
            t=t,
        )
        if not ok or stake_amount is None:
            await safe_edit_message(
                query.message,
                error_text or t("practice.custom.invalid", default="❌ Enter a valid Demo stake."),
                reply_markup=get_practice_bet_amount_keyboard(
                    t=t,
                    balance=balance,
                    can_restore=can_restore_practice_balance(user_id),
                    back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
                ),
                parse_mode=ParseMode.HTML,
            )
            return
    else:
        await safe_edit_message(
            query.message,
            t("practice.custom.invalid", default="❌ Enter a valid Demo stake."),
            reply_markup=get_practice_bet_amount_keyboard(
                t=t,
                balance=balance,
                can_restore=can_restore_practice_balance(user_id),
                back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
            ),
            parse_mode=ParseMode.HTML,
        )
        return

    ok, normalized_stake, error_text = _normalize_practice_stake_input(
        stake_amount,
        balance=balance,
        t=t,
    )
    if not ok or normalized_stake is None:
        await safe_edit_message(
            query.message,
            error_text or t("practice.custom.invalid", default="❌ Enter a valid Demo stake."),
            reply_markup=get_practice_bet_amount_keyboard(
                t=t,
                balance=balance,
                can_restore=can_restore_practice_balance(user_id),
                back_callback="practice_format_menu" if _practice_bo3_enabled() else "practice_mode",
            ),
            parse_mode=ParseMode.HTML,
        )
        return

    user_states.pop(user_id, None)
    await _create_practice_duel_and_render(
        message=query.message,
        context=context,
        user_id=user_id,
        stake_amount=normalized_stake,
        t=t,
        edit_existing=True,
        duel_format=_selected_practice_duel_format(context),
    )


async def handle_find_practice_game(query, context):
    allowed, error_text = _check_product_access(query.from_user.id, 'duel_find')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    active_kind, active_game = _get_active_duel_context(query.from_user.id)
    if active_kind:
        await safe_edit_message(query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    waiting_games = get_waiting_practice_games()
    available_games = [
        game for game in waiting_games
        if int(game.get("player1_id") or 0) != int(query.from_user.id)
    ]
    text = t("practice.find.title", default="🔍 <b>Find Demo Duel</b>") + "\n\n"
    text += (
        t(
            "practice.find.open_count",
            default="Open Demo Duels: <b>{count}</b>\nTap a player to review the stake and join. Times show when each lobby expires.",
            count=len(available_games),
        )
        if available_games
        else t("practice.find.empty", default="😔 No open demo duels yet.\n\nCreate one — another player can join without real GRAM.")
    )
    await safe_edit_message(query.message,
        text,
        reply_markup=get_waiting_practice_games_keyboard(waiting_games, query.from_user.id, t=t),
        parse_mode=ParseMode.HTML,
    )


async def handle_join_practice_game_request(query, context):
    practice_game_id = int(query.data.replace("pjoin_game_", ""))
    user_id = query.from_user.id
    allowed, error_text = _check_product_access(user_id, 'duel')
    if not allowed:
        await safe_answer_callback(query, text=error_text, show_alert=True)
        return
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await safe_edit_message(query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    waiting_games = get_waiting_practice_games()
    game_info = next(
        (g for g in waiting_games if int(g['practice_game_id']) == practice_game_id), None
    )
    if not game_info:
        await safe_edit_message(query.message,
            t("practice.join.not_available", default="❌ This demo duel is no longer available."),
            reply_markup=get_practice_menu_keyboard(t=t),
        )
        return
    balance = get_practice_balance(user_id)
    stake_amount = float(game_info['stake_amount'])
    duel_format = normalize_duel_format(game_info.get("duel_format") or DUEL_FORMAT_SINGLE)
    if balance < stake_amount:
        await safe_edit_message(query.message,
            t("practice.join.insufficient",
              default="❌ Insufficient practice balance.\n\n💎 Available: {balance} Demo GRAM",
              balance=f"{balance:.2f}"),
            reply_markup=get_practice_balance_keyboard(t=t, can_restore=can_restore_practice_balance(user_id)),
        )
        return
    text = (
        t("practice.join.title", default="🧪 <b>Join Demo Duel</b>") + "\n\n"
        + t("practice.join.opponent", default="👤 Opponent: {name}", name=escape(str(game_info['first_name']))) + "\n"
        + t(
            "practice.join.format",
            default="🎮 Format: {format}",
            format=_practice_duel_format_label(duel_format, t=t),
        ) + "\n"
        + t("practice.join.stake", default="💎 Stake: {stake}", stake=_format_practice_amount(stake_amount)) + "\n"
        + t("practice.join.balance", default="💼 Your demo balance: {balance} Demo GRAM",
            balance=f"{balance:.2f}") + "\n\n"
        + t("practice.join.confirm", default="Confirm joining this demo duel:")
    )
    await safe_edit_message(query.message,
        text,
        reply_markup=get_practice_game_confirmation_keyboard(practice_game_id, stake_amount, t=t),
        parse_mode=ParseMode.HTML,
    )


async def handle_confirm_join_practice(query, context):
    practice_game_id = int(query.data.replace("pconfirm_join_", ""))
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    waiting_games = get_waiting_practice_games()
    game_info = None
    for game in waiting_games:
        if int(game['practice_game_id']) == practice_game_id:
            game_info = game
            break
    if not game_info:
        await safe_edit_message(query.message,
            t("practice.join.not_available", default="❌ This demo duel is no longer available."),
            reply_markup=get_waiting_practice_games_keyboard([], user_id, t=t),
        )
        return
    join_result = join_practice_game(practice_game_id, user_id)
    if not join_result.get('ok'):
        await safe_edit_message(query.message,
            f"❌ {join_result.get('error', t('practice.error.join', default='Could not join the demo duel.'))}",
            reply_markup=get_practice_menu_keyboard(t=t),
        )
        return
    _clear_timer_scope(f"practice-waiting:{practice_game_id}")
    owner_id = int(game_info["player1_id"])
    stake_display = _format_practice_amount(game_info["stake_amount"])
    duel_format = normalize_duel_format(
        join_result.get("duel_format") or game_info.get("duel_format") or DUEL_FORMAT_SINGLE
    )

    def _started_text(participant_t):
        return (
            participant_t("practice.started.title", default="🧪 <b>Demo Duel started.</b>") + "\n\n"
            + participant_t("practice.started.id", default="🧪 Demo Duel #{id}", id=practice_game_id) + "\n"
            + participant_t(
                "practice.started.format",
                default="🎮 Format: {format}",
                format=_practice_duel_format_label(duel_format, t=participant_t),
            ) + "\n"
            + participant_t("practice.started.stake", default="💎 Stake: {stake}", stake=stake_display) + "\n\n"
            + participant_t(
                "practice.started.note",
                default="No real GRAM is used. Each player has 60 seconds to roll; a reminder arrives after 30 seconds.",
            )
        )

    joiner_text = _started_text(t)
    await safe_edit_message(query.message, joiner_text, parse_mode=ParseMode.HTML)
    await context.bot.send_message(
        chat_id=user_id,
        text=_practice_roll_prompt(duel_format, t=t),
        reply_markup=get_game_keyboard(),
    )
    try:
        owner_t = get_t(owner_id)
        await context.bot.send_message(
            chat_id=owner_id,
            text=_started_text(owner_t),
            parse_mode=ParseMode.HTML,
        )
        await context.bot.send_message(
            chat_id=owner_id,
            text=_practice_roll_prompt(duel_format, t=owner_t),
            reply_markup=get_game_keyboard(),
        )
    except Exception as exc:
        logger.exception(
            "Failed to notify Demo Duel owner for game %s: %s",
            practice_game_id,
            exc,
        )
    room_message_id = get_practice_room_message_id(practice_game_id)
    if room_message_id:
        try:
            await context.bot.delete_message(chat_id=game_info['player1_id'], message_id=room_message_id)
        except Exception as e:
            logger.exception(f"handle_practice_timeout: failed to delete room message for game {practice_game_id}: {e}")
    await start_practice_timers(
        context,
        practice_game_id,
        game_info['player1_id'],
        user_id,
        deadline_at=join_result.get("deadline_at"),
    )


async def handle_cancel_practice_game(query, context):
    practice_game_id = int(query.data.replace("pcancel_game_", ""))
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    waiting_games = get_waiting_practice_games()
    game_info = next(
        (g for g in waiting_games if int(g['practice_game_id']) == practice_game_id and int(g['player1_id']) == int(user_id)),
        None
    )
    if not game_info:
        await safe_edit_message(query.message,
            t("practice.cancel.not_found", default="❌ Demo duel not found or it has already started."),
            reply_markup=get_practice_menu_keyboard(t=t),
        )
        return
    cancel_result = cancel_waiting_practice_game(practice_game_id, user_id)
    if cancel_result.get('ok'):
        _clear_timer_scope(f"practice-waiting:{practice_game_id}")
        await safe_edit_message(query.message,
            t("practice.cancel.success",
              default="✅ Practice duel cancelled.\n💎 Stake {stake} was returned to your practice balance.",
              stake=_format_practice_amount(game_info['stake_amount'])),
            reply_markup=get_practice_menu_keyboard(t=t),
        )
    else:
        await safe_edit_message(query.message,
            f"❌ {cancel_result.get('error', t('practice.cancel.error', default='Could not cancel the demo duel.'))}",
            reply_markup=get_practice_menu_keyboard(t=t),
        )


async def handle_practice_rematch(query, context):
    """Create or atomically accept a same-opponent Demo rematch."""
    await safe_answer_callback(query)
    user_id = int(query.from_user.id)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    raw_id = str(query.data or "").removeprefix("prematch_")
    if not raw_id.isdigit():
        await query.message.reply_text(t("practice.rematch.invalid", default="❌ Invalid Demo rematch request."))
        return

    # Real-game conflicts remain authoritative. The service itself handles a
    # waiting/active rematch that belongs to this exact original Demo Duel.
    real_game = get_active_game(user_id)
    if real_game:
        await query.message.reply_text(
            _describe_active_duel_conflict("real", real_game, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_active_duel_conflict_keyboard("real", real_game, t=t),
        )
        return

    result = create_or_join_practice_rematch(int(raw_id), user_id)
    if not result.get("ok"):
        code = str(result.get("code") or "internal_error")
        if code == "insufficient_balance":
            text = t(
                "practice.rematch.insufficient",
                default="❌ Not enough Demo GRAM for this rematch. Restore your Demo balance or choose another stake.",
            )
            markup = get_practice_balance_keyboard(
                t=t,
                can_restore=can_restore_practice_balance(user_id),
            )
        elif code == "active_demo":
            active = get_active_practice_game(user_id)
            text = _describe_active_duel_conflict("practice", active, t=t)
            markup = get_active_duel_conflict_keyboard("practice", active, t=t)
        else:
            text = t(
                "practice.rematch.unavailable",
                default="❌ This Demo rematch is no longer available.",
            )
            markup = get_practice_menu_keyboard(
                t=t,
                can_restore=can_restore_practice_balance(user_id),
            )
        await query.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
        return

    action = str(result.get("action") or "")
    practice_game_id = int(result["practice_game_id"])
    stake_amount = float(result.get("stake_amount") or 0)
    duel_format = normalize_duel_format(result.get("duel_format") or DUEL_FORMAT_SINGLE)
    if action in {"created", "waiting_existing"}:
        payload = get_practice_share_payload(practice_game_id, user_id)
        waiting_text = (
            t("practice.rematch.created", default="⚡ <b>Demo rematch created.</b>")
            + "\n\n"
            + t(
                "practice.started.format",
                default="🎮 Format: {format}",
                format=_practice_duel_format_label(duel_format, t=t),
            )
            + "\n"
            + t("practice.started.stake", default="💎 Stake: {stake}", stake=_format_practice_amount(stake_amount))
            + "\n"
            + t("practice.created.waiting", default="⏳ Waiting for another player... The duel expires in 10 minutes.")
            + "\n\n"
            + t(
                "practice.rematch.stake_locked",
                default="The rematch keeps the previous stake: <b>{stake}</b>. To change it, create a new Demo Duel.",
                stake=_format_practice_amount(stake_amount),
            )
        )
        msg = await safe_edit_message(
            query.message,
            waiting_text,
            parse_mode=ParseMode.HTML,
            reply_markup=get_practice_game_created_keyboard(
                practice_game_id,
                share_payload=payload,
                t=t,
            ),
        )
        if msg is not None and getattr(msg, "message_id", None):
            set_practice_room_message_id(practice_game_id, int(msg.message_id))
        if action == "created":
            await start_practice_waiting_timer(
                context,
                practice_game_id,
                user_id,
                deadline_at=result.get("deadline_at"),
            )
            opponent_id = int(result.get("opponent_id") or 0)
            share_url = str((payload or {}).get("url") or "").strip()
            if opponent_id and share_url:
                try:
                    t_opp = get_t(opponent_id)
                    challenger_name = escape(str(query.from_user.first_name or f"Player {user_id}"))
                    await context.bot.send_message(
                        chat_id=opponent_id,
                        text=(
                            t_opp(
                                "practice.rematch.challenged",
                                default=(
                                    "⚡ <b>{name} challenges you to a Demo rematch.</b>\n\n"
                                    "💎 Stake: <b>{stake} Demo GRAM</b>\n"
                                    "No real GRAM is used."
                                ),
                                name=challenger_name,
                                stake=f"{stake_amount:.2f}",
                            )
                            + "\n\n"
                            + t_opp(
                                "practice.rematch.stake_locked",
                                default="The rematch keeps the previous stake: <b>{stake}</b>. To change it, create a new Demo Duel.",
                                stake=_format_practice_amount(stake_amount),
                            )
                        ),
                        parse_mode=ParseMode.HTML,
                        reply_markup=InlineKeyboardMarkup([[
                            InlineKeyboardButton(
                                t_opp("practice.btn.accept_rematch", default="⚡ Accept Demo Rematch"),
                                url=share_url,
                            )
                        ]]),
                    )
                except Exception as exc:
                    logger.warning("Failed to notify Demo rematch opponent %s: %s", opponent_id, exc)
        return

    if action == "already_active":
        active = get_active_practice_game(user_id)
        await query.message.reply_text(
            _describe_active_duel_conflict("practice", active, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_active_duel_conflict_keyboard("practice", active, t=t),
        )
        return

    if action == "joined":
        player1_id = int(result["player1_id"])
        player2_id = int(result["player2_id"])
        _clear_timer_scope(f"practice-waiting:{practice_game_id}")
        room_message_id = get_practice_room_message_id(practice_game_id)
        if room_message_id:
            try:
                await context.bot.delete_message(chat_id=player1_id, message_id=room_message_id)
            except Exception:
                pass
        for participant_id in (player1_id, player2_id):
            participant_t = get_t(participant_id)
            try:
                await context.bot.send_message(
                    chat_id=participant_id,
                    text=(
                        participant_t("practice.rematch.started", default="⚡ <b>Demo rematch started.</b>")
                        + "\n\n"
                        + participant_t("practice.started.id", default="🧪 Demo Duel #{id}", id=practice_game_id)
                        + "\n"
                        + participant_t("practice.started.stake", default="💎 Stake: {stake}", stake=_format_practice_amount(stake_amount))
                        + "\n\n"
                        + participant_t(
                            "practice.rematch.stake_locked",
                            default="The rematch keeps the previous stake: <b>{stake}</b>. To change it, create a new Demo Duel.",
                            stake=_format_practice_amount(stake_amount),
                        )
                    ),
                    parse_mode=ParseMode.HTML,
                )
                await context.bot.send_message(
                    chat_id=participant_id,
                    text=participant_t("practice.started.roll_prompt", default="🎲 Send your Demo dice roll now.\n⏱ You have 60 seconds from the start; a reminder arrives after 30 seconds."),
                    reply_markup=get_game_keyboard(),
                )
            except Exception as exc:
                logger.warning("Failed to announce Demo rematch %s to %s: %s", practice_game_id, participant_id, exc)
        await start_practice_timers(
            context,
            practice_game_id,
            player1_id,
            player2_id,
            deadline_at=result.get("deadline_at"),
        )


async def handle_practice_balance_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    await safe_edit_message(query.message,
        render_practice_balance_text(query.from_user.id, t=t),
        reply_markup=get_practice_balance_keyboard(
            t=t,
            can_restore=can_restore_practice_balance(query.from_user.id),
        ),
        parse_mode=ParseMode.HTML,
    )


async def handle_restore_practice_balance(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    result = restore_practice_balance(query.from_user.id)
    if result.get("ok"):
        text = t(
            "practice.balance.restored",
            default="♻️ <b>Demo balance restored.</b>\n\nAvailable: {amount} Demo GRAM",
            amount=f"{float(result.get('balance') or 0):.2f}",
        )
    else:
        text = "❌ " + t(
            "practice.balance.restore_blocked",
            default="Demo balance cannot be restored right now: {reason}",
            reason=str(result.get("error") or "not available"),
        )
    await safe_edit_message(
        query.message,
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=get_practice_balance_keyboard(
            t=t,
            can_restore=can_restore_practice_balance(query.from_user.id),
        ),
    )


async def handle_practice_about_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    if await _reject_if_demo_mode_disabled_for_query(query, t):
        return
    await safe_edit_message(query.message,
        render_practice_about_text(t=t),
        reply_markup=get_practice_menu_keyboard(t=t),
        parse_mode=ParseMode.HTML,
    )


@guarded
async def groups_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    await show_workspace_list(update.message, user_id=user.id, edit=False)


async def connect_group_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    message = update.message
    user = update.effective_user
    if not message or not user:
        return
    create_or_update_user(user.id, user.username, user.first_name)

    if message.chat.type == 'private':
        payload = create_connect_request(user.id)
        await message.reply_text(
            render_workspace_connect_text(payload, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_workspace_connect_keyboard(t=t),
        )
        return

    if message.chat.type not in {'group', 'supergroup'}:
        await message.reply_text("❌ Only Telegram groups are supported in this step.")
        return

    token = context.args[0].strip() if context.args else ''
    if not token:
        await message.reply_text("❌ Missing connect token. Create one from the bot menu in private chat.")
        return

    try:
        user_member = await context.bot.get_chat_member(message.chat.id, user.id)
    except Exception as exc:
        await message.reply_text(f"❌ Could not verify your admin status: {exc}")
        return
    if str(user_member.status) not in {'administrator', 'creator'}:
        await message.reply_text("❌ You must be a group admin to connect this chat.")
        return

    try:
        detail = activate_connect_request(
            token=token,
            user_id=user.id,
            chat_id=message.chat.id,
            chat_title=message.chat.title or 'Untitled Group',
            chat_type=message.chat.type,
        )
    except WorkspaceError as exc:
        await message.reply_text(f"❌ {exc.message}")
        return

    await message.reply_text(
        "✅ Roll Duel is now connected to this group. Configure posting from the private bot chat.",
        parse_mode=ParseMode.HTML,
    )

    # RD-BOT-012: Send pinned welcome message for group members
    try:
        pinned_text = (
            "🎲 <b>Roll Duel is active in this group!</b>\n\n"
            "Play GRAM duels directly here:\n"
            "• Results are published in the chat\n"
            "• Group leaderboard\n"
            "• Weekly prize giveaways"
        )
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton(
                    "🎮 Play",
                    url=f"https://t.me/{BOT_USERNAME}?start=group_{detail['workspace_id']}"
                ),
                InlineKeyboardButton(
                    "🏆 Leaderboard",
                    url=f"https://t.me/{BOT_USERNAME}?start=group_{detail['workspace_id']}"
                ),
            ],
            [
                InlineKeyboardButton(
                    "🎁 Giveaway",
                    url=f"https://t.me/{BOT_USERNAME}?start=group_{detail['workspace_id']}"
                )
            ],
        ])
        await context.bot.send_message(
            chat_id=message.chat.id,
            text=pinned_text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )
    except Exception as e:
        logger.exception(f"Failed to send pinned welcome message: {e}")
    try:
        runtime_status = await get_workspace_runtime_status(context.bot, user_id=user.id, detail=detail)
        await context.bot.send_message(
            chat_id=user.id,
            text=render_workspace_detail_text(detail, runtime_status=runtime_status, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_workspace_settings_keyboard(detail, t=t),
            disable_web_page_preview=True,
        )
    except Exception as exc:
        logger.exception(f"Could not DM workspace settings to user {user.id}: {exc}")


def _format_admin_user_card(row) -> str:
    info = f"<b>Пользователь #{row['user_id']}</b>\n"
    info += f"Имя: {row['first_name'] or '-'}\n"
    info += f"Username: @{row['username'] or '-'}\n"
    info += f"Баланс: {row['balance']:.2f} GRAM\n"
    info += f"Статус: {'Заблокирован' if row['is_blocked'] else 'Активен'}\n"
    info += f"Игр сыграно: {row['games_played']}\n"
    info += f"Побед: {row['games_won']}\n"
    info += f"Дата регистрации: {row['created_at']} (UTC)"
    return info


def _fetch_admin_user_row(target_id: int, *, include_profit: bool = False):
    fields = "user_id, username, first_name, balance, is_blocked, games_played, games_won, created_at"
    if include_profit:
        fields = "user_id, username, first_name, balance, games_played, games_won, profit, created_at"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT {fields} FROM users WHERE user_id = ?", (target_id,))
        return cursor.fetchone()


def _load_admin_settings_flags() -> tuple[bool, bool, bool, bool, bool]:
    return (
        platform_settings.get_bool("duels_enabled"),
        platform_settings.get_bool("withdrawals_enabled"),
        platform_settings.get_bool("duel_series_bo3_enabled"),
        platform_settings.get_bool("practice_series_bo3_enabled"),
        platform_settings.get_bool("tournament_series_bo3_enabled"),
    )


def _admin_broadcasts_hub_keyboard(admin_web_url: str | None = None) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("🧱 Конструктор рассылки", callback_data=comms_callbacks.bc_builder_new())],
        [InlineKeyboardButton("⚡ Быстрый пост", callback_data=comms_callbacks.bc_quick_new())],
        [InlineKeyboardButton("📤 Outbox", callback_data=comms_callbacks.bc_outbox())],
    ]
    active = broadcast_service.get_active_broadcast()
    if active:
        rows.append([InlineKeyboardButton("▶️ Открыть активную", callback_data=comms_callbacks.bc_open(str(active['broadcast_id'])))])
    for item in broadcast_service.list_recent_broadcasts(limit=4):
        rows.append([
            InlineKeyboardButton(
                f"📣 {broadcast_service.broadcast_status_label(item.get('status'))} · {broadcast_service.short_broadcast_id(item.get('broadcast_id'))}",
                callback_data=comms_callbacks.bc_open(str(item['broadcast_id'])),
            )
        ])
    if admin_web_url:
        rows.append([InlineKeyboardButton("🌐 Веб-админка", url=admin_web_url)])
    rows.append([InlineKeyboardButton("👑 Админка", callback_data="admin_panel")])
    return InlineKeyboardMarkup(rows)



def _admin_broadcast_results_keyboard(broadcast_id: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("🔄 Обновить", callback_data=comms_callbacks.bc_results(broadcast_id)), InlineKeyboardButton("📣 К карточке", callback_data=comms_callbacks.bc_open(broadcast_id))],
        [InlineKeyboardButton("📤 Outbox", callback_data=comms_callbacks.bc_outbox()), InlineKeyboardButton("◀️ К рассылкам", callback_data="admin_broadcasts")],
        [InlineKeyboardButton("👑 Админка", callback_data="admin_panel")],
    ]
    return InlineKeyboardMarkup(rows)


def _admin_broadcast_test_receipt_keyboard(broadcast_id: str, scope: str) -> InlineKeyboardMarkup:
    rerun_label = "🧪 Ещё тест себе" if scope == "self" else "🧪 Ещё тест allowlist"
    rerun_callback = comms_callbacks.bc_test_self(broadcast_id) if scope == "self" else comms_callbacks.bc_test_allow(broadcast_id)
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(rerun_label, callback_data=rerun_callback), InlineKeyboardButton("📍 Результаты", callback_data=comms_callbacks.bc_results(broadcast_id))],
        [InlineKeyboardButton("📣 К карточке", callback_data=comms_callbacks.bc_open(broadcast_id)), InlineKeyboardButton("📤 Outbox", callback_data=comms_callbacks.bc_outbox())],
        [InlineKeyboardButton("👑 Админка", callback_data="admin_panel")],
    ]
    return InlineKeyboardMarkup(rows)


def _admin_broadcast_audience_keyboard(broadcast_id: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    current_row: list[InlineKeyboardButton] = []
    for key, label in broadcast_service.AUDIENCE_CHOICES.items():
        current_row.append(InlineKeyboardButton(label[:28], callback_data=comms_callbacks.bc_audience_set(broadcast_id, key)))
        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []
    if current_row:
        rows.append(current_row)
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.bc_open(broadcast_id))])
    return InlineKeyboardMarkup(rows)


def _admin_broadcast_buttons_keyboard(broadcast_id: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("➕ URL кнопка", callback_data=comms_callbacks.bc_btn_add(broadcast_id)), InlineKeyboardButton("🧼 Очистить", callback_data=comms_callbacks.bc_btn_clear(broadcast_id))]
    ]
    for preset_key, label, _url in broadcast_service.get_button_preset_choices():
        rows.append([InlineKeyboardButton(label[:30], callback_data=comms_callbacks.bc_btn_preset(broadcast_id, preset_key))])
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.bc_open(broadcast_id))])
    return InlineKeyboardMarkup(rows)


def _admin_notice_hub_keyboard(admin_web_url: str | None = None) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [[InlineKeyboardButton("➕ Новый черновик", callback_data=comms_callbacks.nt_new())]]
    active = notice_service.get_active_notice()
    if active:
        rows.append([InlineKeyboardButton("📢 Открыть активное", callback_data=comms_callbacks.nt_open(str(active['notice_id'])))])
    for item in notice_service.list_recent_notices(limit=4):
        rows.append([
            InlineKeyboardButton(
                f"📢 {notice_service.notice_status_label(item.get('status'))} · версия {int(item.get('version') or 0)}",
                callback_data=comms_callbacks.nt_open(str(item['notice_id'])),
            )
        ])
    if admin_web_url:
        rows.append([InlineKeyboardButton("🌐 Веб-админка", url=admin_web_url)])
    rows.append([InlineKeyboardButton("👑 Админка", callback_data="admin_panel")])
    return InlineKeyboardMarkup(rows)


def _admin_notice_target_keyboard(notice_id: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    current_row: list[InlineKeyboardButton] = []
    for key, label in notice_service.TARGET_CHOICES.items():
        current_row.append(InlineKeyboardButton(label[:28], callback_data=comms_callbacks.nt_target_set(notice_id, key)))
        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []
    if current_row:
        rows.append(current_row)
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.nt_open(notice_id))])
    return InlineKeyboardMarkup(rows)


def _admin_notice_severity_keyboard(notice_id: str) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(label, callback_data=comms_callbacks.nt_severity_set(notice_id, key))] for key, label in notice_service.SEVERITY_CHOICES.items()]
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.nt_open(notice_id))])
    return InlineKeyboardMarkup(rows)


def _admin_notice_cta_keyboard(notice_id: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    current_row: list[InlineKeyboardButton] = []
    for key, meta in notice_service.CTA_CHOICES.items():
        label = meta[0]
        current_row.append(InlineKeyboardButton(label[:28], callback_data=comms_callbacks.nt_cta_set(notice_id, key)))
        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []
    if current_row:
        rows.append(current_row)
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.nt_open(notice_id))])
    return InlineKeyboardMarkup(rows)


def _admin_notice_expiry_keyboard(notice_id: str) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(label, callback_data=comms_callbacks.nt_expiry_set(notice_id, key))] for key, (label, _days) in notice_service.EXPIRY_CHOICES.items()]
    rows.append([InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.nt_open(notice_id))])
    return InlineKeyboardMarkup(rows)


def _bc_ref_from_callback(callback_data: str) -> str | None:
    if callback_data.startswith("admin_bc_") and "|" in callback_data:
        return callback_data.split("|", 1)[1].split("|", 1)[0]
    parts = callback_data.split(":")
    if len(parts) >= 3 and parts[0] == "bc":
        return comms_callbacks.resolve_broadcast_id(parts[2])
    return None


def _bc_option_from_callback(callback_data: str) -> str | None:
    if callback_data.startswith("admin_bc_") and callback_data.count("|") >= 2:
        return callback_data.split("|", 2)[2]
    parts = callback_data.split(":")
    if len(parts) >= 4 and parts[0] == "bc":
        return parts[3]
    return None


def _nt_ref_from_callback(callback_data: str) -> str | None:
    if callback_data.startswith("admin_notice_") and "|" in callback_data:
        return callback_data.split("|", 1)[1].split("|", 1)[0]
    parts = callback_data.split(":")
    if len(parts) >= 3 and parts[0] == "nt":
        return comms_callbacks.resolve_notice_id(parts[2])
    return None


def _nt_option_from_callback(callback_data: str) -> str | None:
    if callback_data.startswith("admin_notice_") and callback_data.count("|") >= 2:
        return callback_data.split("|", 2)[2]
    parts = callback_data.split(":")
    if len(parts) >= 4 and parts[0] == "nt":
        return parts[3]
    return None


def _broadcast_admin_error_text(error_code: str | None) -> str:
    key = str(error_code or "").strip()
    mapping = {
        "broadcast_payload_required": "Сначала задайте исходное сообщение или текст рассылки.",
        "broadcast_text_required": "Сначала задайте текст рассылки.",
        "broadcast_audience_empty": "В выбранной аудитории сейчас нет получателей.",
        "broadcast_test_targets_empty": "В allowlist сейчас нет тестовых получателей.",
        "broadcast_no_retryable_deliveries": "Сейчас нет доставок, которые можно повторить.",
        "broadcast_not_found": "Черновик рассылки не найден.",
        "broadcast_not_editable": "Этот черновик уже нельзя редактировать.",
        "broadcast_button_invalid": "Кнопка должна быть в формате: Текст | https://example.com",
        "broadcast_button_limit": "Можно добавить не больше 3 URL-кнопок.",
    }
    return mapping.get(key, key or "Операция не выполнена.")


def _notice_admin_error_text(error_code: str | None) -> str:
    key = str(error_code or "").strip()
    mapping = {
        "notice_text_required": "Сначала задайте текст объявления.",
        "notice_not_found": "Черновик объявления не найден.",
        "notice_not_editable": "Это объявление уже нельзя редактировать.",
        "notice_not_publishable": "Это объявление сейчас нельзя публиковать.",
        "notice_not_deactivatable": "Это объявление сейчас нельзя отключить.",
        "no_notice_updates": "Выберите хотя бы одно изменение для объявления.",
    }
    return mapping.get(key, key or "Операция не выполнена.")


def _render_broadcast_test_result(scope: str, result: dict) -> str:
    target_count = int(result.get('target_count') or 0)
    ok_count = int(result.get('ok_count') or 0)
    failed_count = int(result.get('failed_count') or 0)
    target_ids = [str(value) for value in (result.get('target_ids') or [])]
    ok_target_ids = [str(value) for value in (result.get('ok_target_ids') or [])]
    failed_target_ids = [str(value) for value in (result.get('failed_target_ids') or [])]
    scope_label = "Тест себе" if scope == "self" else "Тест на allowlist"
    lines = [f"<b>{scope_label}</b>"]
    if target_count:
        lines.append(f"• Найдено целей: <b>{target_count}</b>")
    if target_ids:
        lines.append(f"• Preview ID: <code>{escape(', '.join(target_ids))}</code>")
    if scope == "allowlist":
        source_count = int(result.get("allowlist_source_count") or 0)
        lines.append(f"• Источников env с ID: <b>{source_count}</b>")
        lines.extend(_render_allowlist_sources_lines(result.get("allowlist_sources") or []))
    lines.append(f"• Успешно: <b>{ok_count}</b>")
    lines.append(f"• Ошибок: <b>{failed_count}</b>")
    if ok_target_ids:
        lines.append(f"• Успешные ID: <code>{escape(', '.join(ok_target_ids))}</code>")
    if failed_target_ids:
        lines.append(f"• ID с ошибками: <code>{escape(', '.join(failed_target_ids))}</code>")
    failed_codes = [str(code) for code in (result.get('failed_codes') or []) if str(code)]
    if failed_codes:
        lines.append(f"• Коды ошибок: <code>{escape(', '.join(failed_codes[:5]))}</code>")
    if result.get('ok'):
        if scope == "allowlist":
            lines.append("• Итог: allowlist truth подтверждён; теперь можно запускать уже на целевую аудиторию.")
        else:
            lines.append("• Итог: тест завершён; теперь можно сделать allowlist test или запуск.")
    else:
        lines.append(f"• Итог: {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_test_failed'))}")
    return "\n".join(lines)


def _render_broadcast_test_receipt_text(row: dict | None, scope: str, result: dict) -> str:
    if not row:
        return "🧪 <b>Тест рассылки</b>\n\nЧерновик рассылки не найден."
    scope_label = "Тест себе" if scope == "self" else "Тест на allowlist"
    lines = [
        f"🧪 <b>{scope_label}</b>",
        "",
        f"• ID рассылки: <code>{escape(str(row.get('broadcast_id') or '—'))}</code>",
        f"• Статус: <b>{escape(broadcast_service.broadcast_status_label(row.get('status')))}</b>",
        f"• Аудитория: <b>{escape(broadcast_service.audience_label(row.get('audience')))}</b>",
        f"• Тип источника: <b>{escape(broadcast_service.source_type_label(row.get('source_message_type')))}</b>",
        "",
        _render_broadcast_test_result(scope, result),
        "",
        "<b>Что произошло</b>",
        "• Тестовое сообщение отправляется как обычное сообщение в тестовый чат ниже.",
        "• Этот admin-экран остаётся здесь же — это нормальное поведение.",
        "• Для delivery rows откройте «Результаты». Для правок вернитесь в карточку рассылки.",
    ]
    return "\n".join(lines)

def _render_broadcast_result_receipt(row: dict | None) -> str:
    if not row:
        return ""
    status = str(row.get('status') or '').lower()
    if status not in {'completed', 'failed', 'stopped'}:
        return ""
    finished_at = _format_timestamp(row.get('completed_at') or row.get('stopped_at'))
    return (
        "<b>Итог рассылки</b>\n"
        f"• Статус: <b>{escape(broadcast_service.broadcast_status_label(status))}</b>\n"
        f"• Завершена: <b>{escape(finished_at)}</b>\n"
        f"• Доставлено: <b>{int(row.get('sent_count') or 0)}</b>\n"
        f"• Ожидают ретрая: <b>{int(row.get('retry_pending') or 0)}</b>\n"
        f"• Ошибок: <b>{int(row.get('failed_count') or 0)}</b>"
    )


@require_admin_callback
async def _admin_callback_broadcasts(query, context, *, user_id: int, callback_data: str):
    await safe_edit_message(query.message,
        _render_tg_admin_broadcasts_text(),
        reply_markup=_admin_broadcasts_hub_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback


async def _admin_callback_bc_new(query, context, *, user_id: int, callback_data: str):
    return await _admin_callback_bc_builder_new(query, context, user_id=user_id, callback_data=callback_data)

async def _admin_callback_bc_builder_new(query, context, *, user_id: int, callback_data: str):
    draft = broadcast_service.create_broadcast_draft(operator_id=str(user_id))
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(draft) + "\n\n<b>Режим: Конструктор рассылки</b>\nСоберите пост по частям: текст, фото или фото с подписью.",
        reply_markup=get_admin_broadcast_detail_keyboard(str(draft['broadcast_id']), str(draft.get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_quick_new(query, context, *, user_id: int, callback_data: str):
    draft = broadcast_service.create_broadcast_draft(operator_id=str(user_id))
    broadcast_id = str(draft['broadcast_id'])
    user_states[user_id] = f"admin_bc_source:{broadcast_id}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(draft) + "\n\n<b>Режим: Быстрый пост</b>\nОтправьте одно готовое сообщение: текст, фото, видео, GIF или документ. Бот сохранит его как source message и затем разошлёт безопасным copy-потоком.",
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str(draft.get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_open(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть рассылку. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row),
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_outbox(query, context, *, user_id: int, callback_data: str):
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_outbox_text(),
        reply_markup=_admin_broadcasts_hub_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_builder_text(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_bc_text:{broadcast_id}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(broadcast_service.get_broadcast(broadcast_id)) + "\n\n<b>Конструктор → Текст</b>\nОтправьте текст рассылки одним сообщением. Он сохранится в draft и будет использоваться для preview/test/launch.",
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_builder_photo(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_bc_builder_photo:{broadcast_id}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(broadcast_service.get_broadcast(broadcast_id)) + "\n\n<b>Конструктор → Только фото</b>\nОтправьте фото. Можно без подписи — draft всё равно сохранится и будет доступен для предпросмотра и тестов.",
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_builder_textphoto(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_bc_builder_textphoto:{broadcast_id}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(broadcast_service.get_broadcast(broadcast_id)) + "\n\n<b>Конструктор → Фото + текст</b>\nОтправьте фото с подписью. Подпись станет preview/caption, а само фото будет сохранено как source message.",
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_source(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_bc_source:{broadcast_id}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(broadcast_service.get_broadcast(broadcast_id))
        + "\n\nОтправьте сюда одно реальное Telegram-сообщение: текст, фото, видео, GIF или документ.\n\n"
        + "Бот сохранит source_chat_id/source_message_id и потом будет рассылать именно это сообщение через безопасный copy-поток.",
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_audience_menu(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    await safe_edit_message(query.message,
        "📣 <b>Выбор аудитории</b>\n\nВыберите когорту для текущего черновика.",
        reply_markup=_admin_broadcast_audience_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_audience_set(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    audience = comms_callbacks.decode_broadcast_audience(_bc_option_from_callback(callback_data))
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось обновить аудиторию. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.set_broadcast_audience(broadcast_id, audience=audience, operator_id=str(user_id))
    row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + ("\n\nАудитория обновлена." if result.get('ok') else "\n\nНе удалось обновить аудиторию."),
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_buttons(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + "\n\n<b>Конструктор кнопок v1</b>\n• До 3 URL-кнопок\n• Можно добавить готовый пресет\n• Формат ручной кнопки: <code>Текст | https://...</code>",
        reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_btn_add(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_bc_button:{broadcast_id}"
    await safe_edit_message(query.message,
        "🧩 <b>Новая URL-кнопка</b>\n\nОтправьте строку в формате:\n<code>Текст | https://example.com</code>",
        reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_btn_preset(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    preset = comms_callbacks.decode_button_preset(_bc_option_from_callback(callback_data))
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось применить пресет кнопки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.add_broadcast_button_preset(broadcast_id, operator_id=str(user_id), preset=preset)
    row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + ("\n\nКнопка-пресет добавлена." if result.get('ok') else f"\n\n❌ {escape(str(result.get('error') or 'Не удалось добавить пресет-кнопку'))}"),
        reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_btn_clear(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.clear_broadcast_buttons(broadcast_id, operator_id=str(user_id))
    row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + ("\n\nКнопки очищены." if result.get('ok') else f"\n\n❌ {escape(str(result.get('error') or 'broadcast_buttons_clear_failed'))}"),
        reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_preview(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = await broadcast_service.send_preview_to_operator(context.bot, broadcast_id, operator_chat_id=user_id, operator_id=str(user_id))
    row = broadcast_service.get_broadcast(broadcast_id)
    suffix = "\n\n✅ Реальный предпросмотр отправлен вам в личные сообщения." if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_preview_failed'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_results(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть результаты рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_results_text(row),
        reply_markup=_admin_broadcast_results_keyboard(broadcast_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_test_self(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = await broadcast_service.send_test_delivery(context.bot, broadcast_id, operator_id=str(user_id), scope='self', operator_chat_id=user_id)
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_answer_callback(query, "Тест себе отправлен." if result.get('ok') else _broadcast_admin_error_text(result.get('error') or 'broadcast_test_failed'))
    await safe_edit_message(query.message,
        _render_broadcast_test_receipt_text(row, 'self', result),
        reply_markup=_admin_broadcast_test_receipt_keyboard(broadcast_id, 'self'),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_test_allow(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    preflight = broadcast_service.get_allowlist_preflight(limit=10)
    reply_markup = get_yes_no_keyboard(comms_callbacks.bc_test_allow_confirm(broadcast_id), comms_callbacks.bc_open(broadcast_id))
    if int(preflight.get("target_count") or 0) <= 0:
        reply_markup = InlineKeyboardMarkup([[InlineKeyboardButton("◀️ Назад", callback_data=comms_callbacks.bc_open(broadcast_id))]])
    await safe_edit_message(query.message,
        _render_allowlist_preflight_text(preflight),
        reply_markup=reply_markup,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_test_allow_confirm(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = await broadcast_service.send_test_delivery(context.bot, broadcast_id, operator_id=str(user_id), scope='allowlist', operator_chat_id=user_id)
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_answer_callback(query, "Тест allowlist отправлен." if result.get('ok') else _broadcast_admin_error_text(result.get('error') or 'broadcast_test_failed'))
    await safe_edit_message(query.message,
        _render_broadcast_test_receipt_text(row, 'allowlist', result),
        reply_markup=_admin_broadcast_test_receipt_keyboard(broadcast_id, 'allowlist'),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_launch(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + "\n\n<b>Подтвердить запуск</b>\nЭто запустит backend-доставку для выбранной когорты.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.bc_launch_confirm(broadcast_id), comms_callbacks.bc_open(broadcast_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_launch_confirm(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.launch_broadcast(broadcast_id, operator_id=str(user_id))
    row = broadcast_service.get_broadcast(broadcast_id)
    suffix = ("\n\n✅ Рассылка запущена.\n• Следующий шаг: откройте «Результаты» для первых delivery rows или вернитесь в Outbox." + _render_broadcast_result_receipt(row)) if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_launch_failed'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_stop(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + "\n\n<b>Подтвердить остановку</b>\nЭто остановит дальнейшую доставку активной рассылки.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.bc_stop_confirm(broadcast_id), comms_callbacks.bc_open(broadcast_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_stop_confirm(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.stop_broadcast(broadcast_id, operator_id=str(user_id))
    row = broadcast_service.get_broadcast(broadcast_id)
    suffix = ("\n\n✅ Рассылка остановлена.\n" + _render_broadcast_result_receipt(row)) if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_stop_failed'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'stopped'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_retry(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + "\n\n<b>Подтвердить повтор</b>\nЭто заново откроет failed/retry-pending доставки прямо сейчас.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.bc_retry_confirm(broadcast_id), comms_callbacks.bc_open(broadcast_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_retry_confirm(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.retry_failed_deliveries_now(broadcast_id, operator_id=str(user_id))
    row = broadcast_service.get_broadcast(broadcast_id)
    if result.get('ok'):
        retryable_count = int(result.get('retryable_count') or 0)
        suffix = f"\n\n✅ Окно ретрая заново открыто для <b>{retryable_count}</b> доставок.\n• Следующий шаг: откройте «Результаты» или Outbox и дождитесь обновления статуса."
    else:
        suffix = f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_retry_failed'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'running'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_cancel(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    row = broadcast_service.get_broadcast(broadcast_id)
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + "\n\n<b>Подтвердить отмену</b>\nЧерновик будет закрыт и останется в audit/history.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.bc_cancel_confirm(broadcast_id), comms_callbacks.bc_open(broadcast_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_bc_cancel_confirm(query, context, *, user_id: int, callback_data: str):
    broadcast_id = _bc_ref_from_callback(callback_data)
    if not broadcast_id:
        await safe_answer_callback(query, "Не удалось открыть черновик рассылки. Обновите экран.", show_alert=True)
        return
    result = broadcast_service.stop_broadcast(broadcast_id, operator_id=str(user_id))
    row = broadcast_service.get_broadcast(broadcast_id)
    suffix = ("\n\n✅ Черновик отменён.\n" + _render_broadcast_result_receipt(row)) if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_cancel_failed'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'stopped'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice(query, context, *, user_id: int, callback_data: str):
    await safe_edit_message(query.message,
        _render_tg_admin_notice_text(),
        reply_markup=_admin_notice_hub_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_new(query, context, *, user_id: int, callback_data: str):
    draft = notice_service.create_notice_draft(operator_id=str(user_id))
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(draft),
        reply_markup=get_admin_notice_detail_keyboard(str(draft['notice_id']), str(draft.get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_open(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    row = notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row),
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_text(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    user_states[user_id] = f"admin_notice_text:{notice_id}"
    await safe_edit_message(query.message,
        "📢 <b>Текст объявления</b>\n\nОтправьте следующий текст в чат с ботом. Он станет текстом текущего черновика объявления.",
        reply_markup=get_admin_notice_detail_keyboard(notice_id, 'draft', _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_severity_menu(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    await safe_edit_message(query.message,
        "📢 <b>Выберите серьёзность</b>",
        reply_markup=_admin_notice_severity_keyboard(notice_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_severity_set(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    severity = comms_callbacks.decode_notice_severity(_nt_option_from_callback(callback_data))
    if not notice_id:
        await safe_answer_callback(query, "Не удалось обновить серьёзность. Обновите экран.", show_alert=True)
        return
    result = notice_service.set_notice_meta(notice_id, operator_id=str(user_id), severity=severity)
    row = result.get('notice') if result.get('ok') else notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + ("\n\nСерьёзность обновлена." if result.get('ok') else "\n\nНе удалось обновить серьёзность."),
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_target_menu(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    await safe_edit_message(query.message,
        "📢 <b>Выберите таргет</b>",
        reply_markup=_admin_notice_target_keyboard(notice_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_target_set(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    target = comms_callbacks.decode_notice_target(_nt_option_from_callback(callback_data))
    if not notice_id:
        await safe_answer_callback(query, "Не удалось обновить таргет. Обновите экран.", show_alert=True)
        return
    result = notice_service.set_notice_meta(notice_id, operator_id=str(user_id), target=target)
    row = result.get('notice') if result.get('ok') else notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + ("\n\nТаргет обновлён." if result.get('ok') else "\n\nНе удалось обновить таргет."),
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_cta_menu(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    await safe_edit_message(query.message,
        "📢 <b>Выберите CTA</b>",
        reply_markup=_admin_notice_cta_keyboard(notice_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_cta_set(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    cta_key = comms_callbacks.decode_notice_cta(_nt_option_from_callback(callback_data))
    if not notice_id:
        await safe_answer_callback(query, "Не удалось обновить CTA. Обновите экран.", show_alert=True)
        return
    result = notice_service.set_notice_meta(notice_id, operator_id=str(user_id), cta_key=cta_key)
    row = result.get('notice') if result.get('ok') else notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + ("\n\nCTA обновлён." if result.get('ok') else "\n\nНе удалось обновить CTA."),
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_expiry_menu(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    await safe_edit_message(query.message,
        "📢 <b>Выберите срок действия</b>",
        reply_markup=_admin_notice_expiry_keyboard(notice_id),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_expiry_set(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    expiry_key = comms_callbacks.decode_notice_expiry(_nt_option_from_callback(callback_data))
    if not notice_id:
        await safe_answer_callback(query, "Не удалось обновить срок. Обновите экран.", show_alert=True)
        return
    result = notice_service.set_notice_meta(notice_id, operator_id=str(user_id), expiry_key=expiry_key)
    row = result.get('notice') if result.get('ok') else notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + ("\n\nСрок обновлён." if result.get('ok') else "\n\nНе удалось обновить срок."),
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_preview(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    row = notice_service.get_notice(notice_id)
    if not row or not str(row.get('body_text') or '').strip():
        await safe_edit_message(query.message,
            _render_tg_admin_notice_detail_text(row) + "\n\n❌ Сначала задайте текст объявления.",
            reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    cta_label, cta_callback = _notice_cta_payload(row)
    await context.bot.send_message(
        chat_id=user_id,
        text=_render_user_notice_text(row),
        reply_markup=get_notice_view_keyboard(cta_label=cta_label, cta_callback=cta_callback),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + "\n\n✅ Реальный предпросмотр объявления отправлен вам в личные сообщения.",
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_publish(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    row = notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + "\n\n<b>Подтвердите публикацию</b>\nНовая версия объявления сбросит seen-state у подходящих пользователей.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.nt_publish_confirm(notice_id), comms_callbacks.nt_open(notice_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_publish_confirm(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    result = notice_service.publish_notice(notice_id, operator_id=str(user_id))
    row = notice_service.get_notice(notice_id)
    suffix = "\n\n✅ Объявление опубликовано." if result.get('ok') else f"\n\n❌ {escape(_notice_admin_error_text(result.get('error') or 'Не удалось опубликовать объявление'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + suffix,
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'active'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_deactivate(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    row = notice_service.get_notice(notice_id)
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + "\n\n<b>Подтвердите отключение</b>\nТекущее объявление перестанет показываться пользователям.",
        reply_markup=get_yes_no_keyboard(comms_callbacks.nt_deactivate_confirm(notice_id), comms_callbacks.nt_open(notice_id)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_notice_deactivate_confirm(query, context, *, user_id: int, callback_data: str):
    notice_id = _nt_ref_from_callback(callback_data)
    if not notice_id:
        await safe_answer_callback(query, "Не удалось открыть объявление. Обновите экран.", show_alert=True)
        return
    result = notice_service.deactivate_notice(notice_id, operator_id=str(user_id))
    row = notice_service.get_notice(notice_id)
    suffix = "\n\n✅ Объявление отключено." if result.get('ok') else f"\n\n❌ {escape(_notice_admin_error_text(result.get('error') or 'Не удалось отключить объявление'))}"
    await safe_edit_message(query.message,
        _render_tg_admin_notice_detail_text(row) + suffix,
        reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'inactive'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def _callback_notice_open(query, context, *, user_id: int):
    row = notice_service.get_current_notice_for_user(user_id)
    if row:
        notice_service.mark_notice_seen(user_id, str(row.get('notice_id')))
    cta_label, cta_callback = _notice_cta_payload(row)
    await safe_edit_message(query.message,
        _render_user_notice_text(row),
        reply_markup=get_notice_view_keyboard(cta_label=cta_label, cta_callback=cta_callback),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_users(query, context, *, user_id: int, callback_data: str):
    from admin.read_models import users_bulk_export

    # Получаем быстрый экспорт tg_ids (первые 100)
    export_result = users_bulk_export(mode="tg_ids", limit=100)
    tg_ids_count = len(export_result.get("values", [])) if export_result.get("ok") else 0

    text = (
        "👥 <b>Поиск пользователя</b>\n\n"
        "Введите числовой ID пользователя, чтобы быстро открыть квитанцию и затем перейти в карточку пользователя в Web Admin.\n\n"
        f"• Быстрый экспорт: <b>{tg_ids_count}</b> tg_id (первые 100)\n"
        "• Для полного экспорта используй Веб-админку → Users → Export"
    )

    keyboard = get_admin_shortcuts_keyboard("admin_users", _admin_web_url('/users'))

    await safe_edit_message(query.message,
        text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    user_states[user_id] = "admin_waiting_user_id"


# ============================================================
# ЕДИНЫЙ ХЕЛПЕР ДЛЯ АДМИН-ОТВЕТОВ (с гарантированной навигацией)
# ============================================================

async def _admin_reply(query, text: str, keyboard=None, back_callback: str = "admin_panel"):
    """Единый способ ответа в админке с кнопкой «◀️ Назад в Админку»."""
    try:
        if keyboard is None:
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("◀️ Назад в Админку", callback_data=back_callback)]
            ])
        else:
            if isinstance(keyboard, InlineKeyboardMarkup):
                rows = list(keyboard.inline_keyboard)
            elif isinstance(keyboard, (list, tuple)):
                rows = list(keyboard)
            else:
                rows = []
            rows.append([InlineKeyboardButton("◀️ Назад в Админку", callback_data=back_callback)])
            keyboard = InlineKeyboardMarkup(rows)

        await safe_edit_message(query.message,
            text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    except BadRequest as e:
        if "message is not modified" in str(e).lower():
            await safe_answer_callback(query, "Уже актуально.")
        else:
            raise
    except Exception as e:
        logger.exception(f"_admin_reply error: {e}")
        await safe_answer_callback(query, "Ошибка отображения.", show_alert=True)


def get_grouped_admin_panel_keyboard(admin_web_url: str | None = None):
    """Daily TG admin cockpit: compact navigation over the shared backend truth."""
    keyboard = [
        [InlineKeyboardButton("📊 Обзор", callback_data="admin_overview"),
         InlineKeyboardButton("🔄 Обновить", callback_data="admin_refresh")],
        [InlineKeyboardButton("💸 Выводы", callback_data="admin_withdrawals"),
         InlineKeyboardButton("🚨 Проблемы", callback_data="admin_failed")],
        [InlineKeyboardButton("⚠️ Риски", callback_data="admin_risk"),
         InlineKeyboardButton("🏦 Обязательства", callback_data="admin_liabilities")],
        [InlineKeyboardButton("⚔️ Дуэли", callback_data="admin_duels"),
         InlineKeyboardButton("🎁 Розыгрыши", callback_data="admin_giveaways")],
        [InlineKeyboardButton("🏆 ELO", callback_data="admin_elo"),
         InlineKeyboardButton("🏟️ Турниры", callback_data="admin_tournaments")],
        [InlineKeyboardButton("👥 Пользователи", callback_data="admin_users"),
         InlineKeyboardButton("🛟 Поддержка", callback_data="admin_support")],
        [InlineKeyboardButton("📈 Привлечение", callback_data="admin_acquisition_7")],
        [InlineKeyboardButton("📣 Рассылки", callback_data="admin_comms"),
         InlineKeyboardButton("🧭 Рантайм", callback_data="admin_runtime")],
        [InlineKeyboardButton("🧪 Provider", callback_data="admin_provider"),
         InlineKeyboardButton("📋 Аудит", callback_data="admin_audit")],
        [InlineKeyboardButton("📥 Экспорт", callback_data="admin_export"),
         InlineKeyboardButton("⚙️ Настройки", callback_data="admin_settings")],
        [InlineKeyboardButton("❓ Помощь", callback_data="admin_help")],
    ]

    if admin_web_url:
        keyboard.append([InlineKeyboardButton("🌐 Веб-админка", url=admin_web_url)])

    keyboard.append([InlineKeyboardButton("🏠 Главное меню", callback_data="back_to_main")])
    return InlineKeyboardMarkup(keyboard)

@require_admin_callback
async def _admin_callback_panel(query, context, *, user_id: int, callback_data: str):
    # Самая простая и стабильная версия
    try:
        text = get_admin_overview_cached(user_id)
        keyboard = get_grouped_admin_panel_keyboard(_admin_web_url('/'))
        await safe_edit_message(query.message,
            text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    except Exception as e:
        await safe_answer_callback(query, "Админка временно недоступна.", show_alert=True)
        logger.exception(f"Admin panel error: {e}")


@require_admin_callback
async def _admin_callback_overview(query, context, *, user_id: int, callback_data: str):
    try:
        await safe_edit_message(
            query.message,
            get_admin_overview_cached(user_id),
            reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    except BadRequest as e:
        if "message is not modified" in str(e).lower():
            await safe_answer_callback(query, "Обзор уже открыт.")
        else:
            raise


@require_admin_callback
async def _admin_callback_refresh(query, context, *, user_id: int, callback_data: str):
    invalidate_admin_overview_cache(user_id)
    try:
        await safe_edit_message(
            query.message,
            get_admin_overview_cached(user_id, force_refresh=True),
            reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        await safe_answer_callback(query, "Обновлено.")
    except BadRequest as e:
        if "message is not modified" in str(e).lower():
            await safe_answer_callback(query, "Обновлено, изменений нет.")
        else:
            raise

@require_admin_callback
async def _admin_callback_withdrawals_shortcuts(query, context, *, user_id: int, callback_data: str):
    text = _render_tg_admin_withdrawals_text()
    queue = admin_read_models.list_withdrawals(limit=5, offset=0)
    keyboard = get_admin_shortcuts_keyboard("admin_withdrawals", _admin_web_url('/withdrawals'))
    # STEP-TGADMIN-004: Telegram money actions are guarded by a second confirmation screen.
    # First tap routes to a read/confirm card only; approve_withdrawal/reject_withdrawal are
    # called only by compact *_yes_* callbacks below.
    if queue:
        rows = []
        for item in queue[:3]:
            wid = str(item.get('withdrawal_id') or '')
            action_row = []
            if wid and _tg_withdrawal_allows_approve(item):
                action_row.append(InlineKeyboardButton(f"✅ Одобрить {wid[:8]}", callback_data=f"admin_wd_apv_{wid}"))
            if wid and _tg_withdrawal_allows_reject(item):
                action_row.append(InlineKeyboardButton(f"❌ Отклонить {wid[:8]}", callback_data=f"admin_wd_rej_{wid}"))
            if action_row:
                rows.append(action_row)
        if rows:
            keyboard = InlineKeyboardMarkup(rows + list(keyboard.inline_keyboard))
    await safe_edit_message(query.message,
        text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_runtime_shortcuts(query, context, *, user_id: int, callback_data: str):
    await _admin_reply(
        query,
        _render_tg_admin_runtime_text(),
        keyboard=get_admin_shortcuts_keyboard("admin_runtime", _admin_web_url('/runtime')),
        back_callback="admin_panel"
    )


@require_admin_callback
async def _admin_callback_help_shortcuts(query, context, *, user_id: int, callback_data: str):
    await _admin_reply(
        query,
        _render_tg_admin_help_text(),
        keyboard=get_admin_shortcuts_keyboard("admin_help", _admin_web_url('/help')),
        back_callback="admin_panel"
    )


@require_admin_callback
async def _admin_callback_problems(query, context, *, user_id: int, callback_data: str):
    await _admin_reply(
        query,
        _render_tg_admin_problems_text(),
        keyboard=get_admin_shortcuts_keyboard("admin_failed", _admin_web_url('/failed')),
        back_callback="admin_panel"
    )


@require_admin_callback
async def _admin_callback_provider(query, context, *, user_id: int, callback_data: str):
    await _admin_reply(
        query,
        _render_tg_admin_provider_text(),
        keyboard=get_admin_shortcuts_keyboard("admin_provider", _admin_web_url('/provider-diagnostics')),
        back_callback="admin_panel"
    )


def _admin_withdrawal_id_from_callback(callback_data: str, prefixes: tuple[str, ...]) -> str:
    for prefix in prefixes:
        if callback_data.startswith(prefix):
            return callback_data[len(prefix):]
    return ""


def _tg_withdrawal_allows_approve(row: dict | None) -> bool:
    if not row:
        return False
    status = str(row.get("status") or "").lower()
    review_status = str(row.get("review_status") or "not_required").lower()
    return status in {"requested", "reserved"} and review_status == "pending_review"


def _tg_withdrawal_allows_reject(row: dict | None) -> bool:
    if not row:
        return False
    status = str(row.get("status") or "").lower()
    return status in {"requested", "reserved"}


def _render_tg_admin_withdrawal_confirm_text(withdrawal_id: str, *, action: str) -> str:
    row = get_withdrawal_request(withdrawal_id)
    action_ru = "одобрить" if action == "approve" else "отклонить"
    title = "✅ Одобрение вывода" if action == "approve" else "❌ Отклонение вывода"
    if not row:
        return (
            f"{title}\n\n"
            "⚠️ Заявка не найдена или уже изменилась.\n"
            "Обновите очередь выводов перед действием."
        )
    return "\n".join([
        f"{title}",
        "",
        "⚠️ <b>Требуется второе подтверждение</b>",
        f"Действие: <b>{action_ru}</b>",
        f"Withdrawal: <code>{escape(str(withdrawal_id))}</code>",
        f"User ID: <code>{escape(str(row.get('user_id') or '—'))}</code>",
        f"Amount: <b>{float(row.get('amount') or 0):.2f} GRAM</b>",
        f"Status: <b>{escape(str(row.get('status') or '—'))}</b>",
        f"Review: <b>{escape(str(row.get('review_status') or '—'))}</b>",
        "",
        "Первый тап только открыл этот экран. Деньги/ledger ещё не изменялись.",
    ])


def get_admin_withdrawal_confirm_keyboard(withdrawal_id: str, *, action: str) -> InlineKeyboardMarkup:
    if action == "approve":
        confirm_label = "✅ Да, одобрить"
        confirm_callback = f"admin_wd_apv_yes_{withdrawal_id}"
    else:
        confirm_label = "❌ Да, отклонить"
        confirm_callback = f"admin_wd_rej_yes_{withdrawal_id}"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(confirm_label, callback_data=confirm_callback)],
        [InlineKeyboardButton("↩️ Отмена", callback_data="admin_withdrawals"),
         InlineKeyboardButton("🔄 Обновить очередь", callback_data="admin_withdrawals")],
        [InlineKeyboardButton("🌐 Веб-админка", url=_admin_web_url('/withdrawals'))],
    ])


@require_admin_callback
async def _admin_callback_withdrawal_approve(query, context, *, user_id: int, callback_data: str):
    withdrawal_id = _admin_withdrawal_id_from_callback(
        callback_data,
        ("admin_wd_apv_", "admin_withdrawal_approve_", "admin_withdrawal_approve"),
    )
    if not withdrawal_id:
        await safe_answer_callback(query, "Не удалось открыть подтверждение. Обновите очередь.", show_alert=True)
        return
    row = get_withdrawal_request(withdrawal_id)
    if not _tg_withdrawal_allows_approve(row):
        await safe_answer_callback(query, "Эту заявку нельзя одобрить из текущего статуса. Обновите очередь.", show_alert=True)
        await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")
        return
    await _admin_reply(
        query,
        _render_tg_admin_withdrawal_confirm_text(withdrawal_id, action="approve"),
        keyboard=get_admin_withdrawal_confirm_keyboard(withdrawal_id, action="approve"),
        back_callback="admin_withdrawals",
    )


@require_admin_callback
async def _admin_callback_withdrawal_reject(query, context, *, user_id: int, callback_data: str):
    withdrawal_id = _admin_withdrawal_id_from_callback(
        callback_data,
        ("admin_wd_rej_", "admin_withdrawal_reject_", "admin_withdrawal_reject"),
    )
    if not withdrawal_id:
        await safe_answer_callback(query, "Не удалось открыть подтверждение. Обновите очередь.", show_alert=True)
        return
    row = get_withdrawal_request(withdrawal_id)
    if not _tg_withdrawal_allows_reject(row):
        await safe_answer_callback(query, "Эту заявку нельзя отклонить из текущего статуса. Обновите очередь.", show_alert=True)
        await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")
        return
    await _admin_reply(
        query,
        _render_tg_admin_withdrawal_confirm_text(withdrawal_id, action="reject"),
        keyboard=get_admin_withdrawal_confirm_keyboard(withdrawal_id, action="reject"),
        back_callback="admin_withdrawals",
    )


@require_admin_callback
async def _admin_callback_withdrawal_approve_confirm(query, context, *, user_id: int, callback_data: str):
    withdrawal_id = _admin_withdrawal_id_from_callback(callback_data, ("admin_wd_apv_yes_",))
    if not withdrawal_id:
        await safe_answer_callback(query, "Некорректное подтверждение. Обновите очередь.", show_alert=True)
        return
    row = get_withdrawal_request(withdrawal_id)
    if not _tg_withdrawal_allows_approve(row):
        await safe_answer_callback(query, "Эту заявку уже нельзя одобрить. Обновите очередь.", show_alert=True)
        await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")
        return
    result = approve_withdrawal(withdrawal_id, operator_id=str(user_id), reason="tg_admin_confirmed_approve")
    if result.get("ok"):
        await safe_answer_callback(query, "✅ Withdrawal approved", show_alert=False)
    else:
        await safe_answer_callback(query, f"❌ {result.get('error', 'Failed')}", show_alert=True)
    await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")


@require_admin_callback
async def _admin_callback_withdrawal_reject_confirm(query, context, *, user_id: int, callback_data: str):
    withdrawal_id = _admin_withdrawal_id_from_callback(callback_data, ("admin_wd_rej_yes_",))
    if not withdrawal_id:
        await safe_answer_callback(query, "Некорректное подтверждение. Обновите очередь.", show_alert=True)
        return
    row = get_withdrawal_request(withdrawal_id)
    if not _tg_withdrawal_allows_reject(row):
        await safe_answer_callback(query, "Эту заявку уже нельзя отклонить. Обновите очередь.", show_alert=True)
        await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")
        return
    result = reject_withdrawal(withdrawal_id, operator_id=str(user_id), reason="tg_admin_confirmed_reject")
    if result.get("ok"):
        await safe_answer_callback(query, "❌ Withdrawal rejected", show_alert=False)
    else:
        await safe_answer_callback(query, f"❌ {result.get('error', 'Failed')}", show_alert=True)
    await _admin_callback_withdrawals_shortcuts(query, context, user_id=user_id, callback_data="admin_withdrawals")



@require_admin_callback
async def _admin_callback_acquisition(query, context, *, user_id: int, callback_data: str):
    period_days = 30 if callback_data == "admin_acquisition_30" else 7
    try:
        text, snapshot = _render_tg_acquisition_text(period_days)
        await safe_edit_message(
            query.message,
            text,
            reply_markup=_tg_acquisition_keyboard(snapshot, period_days=period_days),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    except BadRequest as exc:
        if "message is not modified" in str(exc).lower():
            await safe_answer_callback(query, "Уже актуально.")
        else:
            raise
    except Exception:
        logger.exception("TG acquisition cockpit failed")
        await safe_answer_callback(query, "Привлечение временно недоступно.", show_alert=True)


async def _admin_callback_acquisition_campaign(query, context, *, user_id: int, callback_data: str):
    if not _is_admin_user(user_id):
        await safe_answer_callback(query, "Доступ запрещён.", show_alert=True)
        return
    code = callback_data.split(":", 1)[1] if ":" in callback_data else ""
    try:
        text, _funnel = _render_tg_acquisition_campaign_text(code, period_days=30)
        await safe_edit_message(
            query.message,
            text,
            reply_markup=_tg_acquisition_campaign_keyboard(acquisition_service.normalize_campaign_code(code)),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    except acquisition_service.AcquisitionError:
        await safe_answer_callback(query, "Кампания не найдена.", show_alert=True)
    except Exception:
        logger.exception("TG acquisition campaign failed: %s", code)
        await safe_answer_callback(query, "Карточка кампании временно недоступна.", show_alert=True)

@require_admin_callback
async def _admin_callback_liabilities(query, context, *, user_id: int, callback_data: str):
    await _admin_reply(
        query,
        _render_tg_admin_liabilities_text(),
        keyboard=get_admin_shortcuts_keyboard("admin_liabilities", _admin_web_url('/liabilities')),
        back_callback="admin_panel"
    )


@require_admin_callback
async def _admin_callback_balance(query, context, *, user_id: int, callback_data: str):
    await _admin_callback_liabilities(query, context, user_id=user_id, callback_data=callback_data)


@require_admin_callback
async def _admin_callback_block_user(query, context, *, user_id: int, callback_data: str):
    target_id = int(callback_data.replace("admin_block_", ""))
    risk_service.freeze_user(target_id, operator_id=str(user_id), reason='legacy_admin_block')
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_blocked = 1 WHERE user_id = ?", (target_id,))
        conn.commit()
    invalidate_blocked_cache(target_id)  # clear TTL cache immediately
    try:
        await context.bot.send_message(
            chat_id=target_id,
            text="Ваш аккаунт заблокирован администрацией. Если это ошибка, свяжитесь с поддержкой."
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    row = _fetch_admin_user_row(target_id)
    await safe_edit_message(query.message,
        _format_admin_user_card(row),
        reply_markup=get_admin_user_keyboard(row['user_id'], bool(row['is_blocked'])),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_unblock_user(query, context, *, user_id: int, callback_data: str):
    target_id = int(callback_data.replace("admin_unblock_", ""))
    risk_service.unfreeze_user(target_id, operator_id=str(user_id), reason='legacy_admin_unblock')
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_blocked = 0 WHERE user_id = ?", (target_id,))
        conn.commit()
    invalidate_blocked_cache(target_id)  # clear TTL cache immediately
    try:
        await context.bot.send_message(
            chat_id=target_id,
            text="Ваш аккаунт разблокирован. Теперь вы снова можете пользоваться ботом."
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    row = _fetch_admin_user_row(target_id)
    await safe_edit_message(query.message,
        _format_admin_user_card(row),
        reply_markup=get_admin_user_keyboard(row['user_id'], bool(row['is_blocked'])),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_change_balance(query, context, *, user_id: int, callback_data: str):
    target_id = int(callback_data.replace("admin_change_balance_", ""))
    await safe_edit_message(query.message,
        f"Введите сумму для изменения баланса пользователя #{target_id} (можно отрицательную):",
        reply_markup=get_admin_user_keyboard(target_id, False)
    )
    user_states[user_id] = f"admin_waiting_balance_{target_id}"


@require_admin_callback
async def _admin_callback_stats(query, context, *, user_id: int, callback_data: str):
    target_id = int(callback_data.replace("admin_stats_", ""))
    row = _fetch_admin_user_row(target_id, include_profit=True)
    if not row:
        await _admin_reply(
            query,
            "Пользователь не найден.",
            keyboard=get_grouped_admin_panel_keyboard(_admin_web_url()),
            back_callback="admin_panel"
        )
        return
    winrate = (row['games_won'] / row['games_played'] * 100) if row['games_played'] > 0 else 0
    stats = f"<b>Статистика пользователя #{row['user_id']}</b>\n"
    stats += f"Имя: {row['first_name'] or '-'}\n"
    stats += f"Username: @{row['username'] or '-'}\n"
    stats += f"Баланс: {row['balance']:.2f} GRAM\n"
    stats += f"Игр сыграно: {row['games_played']}\n"
    stats += f"Побед: {row['games_won']}\n"
    stats += f"Winrate: {winrate:.1f}%\n"
    stats += f"Profit: {row['profit']:.2f} GRAM\n"
    stats += f"Дата регистрации: {row['created_at']} (UTC)"
    await safe_edit_message(query.message,
        stats,
        reply_markup=get_admin_user_keyboard(row['user_id'], False),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_broadcast(query, context, *, user_id: int, callback_data: str):
    await _admin_callback_broadcasts(query, context, user_id=user_id, callback_data="admin_broadcasts")


@require_admin_callback
async def _admin_callback_settings(query, context, *, user_id: int, callback_data: str):
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(query.message,
        "<b>Настройки</b>",
        reply_markup=get_admin_settings_keyboard(allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_toggle_create_game(query, context, *, user_id: int, callback_data: str):
    current = platform_settings.get_bool('duels_enabled')
    platform_settings.set_setting('duels_enabled', not current, operator_id=str(user_id), note='legacy_toggle_create_game')
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(query.message,
        "<b>Настройки</b>",
        reply_markup=get_admin_settings_keyboard(allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_toggle_withdraw(query, context, *, user_id: int, callback_data: str):
    current = platform_settings.get_bool('withdrawals_enabled')
    platform_settings.set_setting('withdrawals_enabled', not current, operator_id=str(user_id), note='legacy_toggle_withdraw')
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(query.message,
        "<b>Настройки</b>",
        reply_markup=get_admin_settings_keyboard(allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled),
        parse_mode=ParseMode.HTML
    )


@require_admin_callback
async def _admin_callback_toggle_duel_series_bo3(query, context, *, user_id: int, callback_data: str):
    current = platform_settings.get_bool("duel_series_bo3_enabled")
    platform_settings.set_setting(
        "duel_series_bo3_enabled",
        not current,
        operator_id=str(user_id),
        note="toggle_duel_series_bo3_canary",
    )
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(
        query.message,
        "<b>Настройки</b>\n\n"
        + (
            "🎯 Best of 3 включён для создания новых дуэлей."
            if bo3_enabled
            else "🎯 Best of 3 отключён. Уже начатые матчи продолжают работать."
        ),
        reply_markup=get_admin_settings_keyboard(allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_toggle_practice_series_bo3(query, context, *, user_id: int, callback_data: str):
    current = platform_settings.get_bool("practice_series_bo3_enabled")
    platform_settings.set_setting(
        "practice_series_bo3_enabled",
        not current,
        operator_id=str(user_id),
        note="toggle_practice_series_bo3_canary",
    )
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(
        query.message,
        "<b>Настройки</b>\n\n"
        + (
            "🧪 Demo Best of 3 включён для создания новых демо-дуэлей."
            if practice_bo3_enabled
            else "🧪 Demo Best of 3 отключён. Уже начатые демо-матчи продолжают работать."
        ),
        reply_markup=get_admin_settings_keyboard(
            allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled
        ),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_toggle_tournament_series_bo3(query, context, *, user_id: int, callback_data: str):
    current = platform_settings.get_bool("tournament_series_bo3_enabled")
    platform_settings.set_setting(
        "tournament_series_bo3_enabled",
        not current,
        operator_id=str(user_id),
        note="toggle_tournament_series_bo3_canary",
    )
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(
        query.message,
        "<b>Настройки</b>\n\n"
        + (
            "🏆 Tournament Best of 3 включён для новых турниров."
            if tournament_bo3_enabled
            else "🏆 Tournament Best of 3 отключён. Уже созданные турниры сохраняют свой формат."
        ),
        reply_markup=get_admin_settings_keyboard(
            allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled
        ),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_cancel_waiting_games(query, context, *, user_id: int, callback_data: str):
    await safe_edit_message(query.message,
        "Вы уверены, что хотите отменить все ожидающие игры? Это действие нельзя отменить.",
        reply_markup=get_yes_no_keyboard(
            yes_callback="confirm_cancel_all_waiting_games",
            no_callback="admin_settings"
        )
    )


@require_admin_callback
async def _admin_callback_confirm_cancel_waiting_games(query, context, *, user_id: int, callback_data: str):
    from database import cancel_all_waiting_games

    count, user_ids = cancel_all_waiting_games()
    allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled = _load_admin_settings_flags()
    await safe_edit_message(query.message,
        f"✅ Все ожидающие игры отменены. Возвращено ставок: {count}.",
        reply_markup=get_admin_settings_keyboard(allow_create_game, allow_withdraw, bo3_enabled, practice_bo3_enabled, tournament_bo3_enabled)
    )
    await notify_cancelled_waiting_games(context, user_ids)


# ── ELO Admin Handlers ────────────────────────────────────────────────

@require_admin_callback
async def _admin_callback_elo(query, context, *, user_id: int, callback_data: str):
    """Admin ELO management panel."""
    from services import elo as elo_service
    from services import settings as settings_svc

    elo_enabled = settings_svc.get_bool("elo_enabled")
    k_factor = settings_svc.get_int("elo_k_factor") or 32
    initial_rating = settings_svc.get_int("elo_initial_rating") or 1000

    # Count rated players
    conn = None
    try:
        conn = database.get_connection()
        rated_rows = conn.execute(
            "SELECT COUNT(*) as cnt FROM user_elo_ratings WHERE games_count > 0"
        ).fetchone()
        rated_count = int(rated_rows["cnt"] or 0) if rated_rows else 0
    except Exception:
        rated_count = 0
    finally:
        if conn is not None:
            conn.close()

    # Top 5 by ELO
    top_elo = elo_service.get_elo_leaderboard(limit=5, offset=0)

    status_emoji = "🟢" if elo_enabled else "🔴"
    text = (
        "🏆 <b>ELO-рейтинг — панель администратора</b>\n\n"
        f"• Статус: {status_emoji} {'включён' if elo_enabled else 'выключен'}\n"
        f"• K-фактор: <b>{k_factor}</b>\n"
        f"• Стартовый рейтинг: <b>{initial_rating}</b>\n"
        f"• Игроков с рейтингом: <b>{rated_count}</b>\n\n"
    )
    if top_elo:
        text += "<b>Топ-5 по ELO:</b>\n"
        for i, p in enumerate(top_elo, 1):
            name = p.get("display_name") or "Игрок"
            text += f"  {i}. {name} — {p.get('elo_rating', 0)} ({p.get('games_count', 0)} игр)\n"
    else:
        text += "<i>Игроков с рейтингом пока нет.</i>"

    text += (
        "\n\n<b>Операторские инструменты</b>\n"
        "ELO обновляется автоматически после завершённых дуэлей. "
        "Ручную коррекцию используй только для теста, спора или исправления технической ошибки. "
        "Сброс сезона спрятан в опасных действиях."
    )

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"ELO: {'ВКЛ' if elo_enabled else 'ВЫКЛ'}",
            callback_data="admin_elo_toggle"
        )],
        [InlineKeyboardButton("🛠 Ручная коррекция ELO", callback_data="admin_elo_adjust")],
        [InlineKeyboardButton("⚠️ Опасные действия", callback_data="admin_elo_danger")],
    ])
    await _admin_reply(query, text, keyboard=keyboard, back_callback="admin_panel")


@require_admin_callback
async def _admin_callback_elo_toggle(query, context, *, user_id: int, callback_data: str):
    """Toggle elo_enabled setting."""
    from services import settings as settings_svc
    current = settings_svc.get_bool("elo_enabled")
    settings_svc.set_setting("elo_enabled", not current, operator_id=str(user_id), note="admin_elo_toggle")
    await _admin_callback_elo(query, context, user_id=user_id, callback_data="admin_elo")


@require_admin_callback
async def _admin_callback_tournaments(query, context, *, user_id: int, callback_data: str):
    """Admin Tournaments management panel — mirrors _admin_callback_elo.
    Added in STEP-089 because tournament_enabled (services/settings.py,
    "Kill switch: disabled by default") had literally zero UI entry
    point anywhere in the bot before this — not TG admin, not web admin.
    The feature (bracket UI, matchmaking, prize distribution) was fully
    built and polished on the landing page, but there was no way for an
    operator to actually turn it on without a raw DB edit."""
    from services import settings as settings_svc

    tournament_enabled = settings_svc.get_bool("tournament_enabled")

    conn = None
    try:
        conn = database.get_connection()
        active_rows = conn.execute(
            "SELECT COUNT(*) as cnt FROM tournaments WHERE status IN ('forming', 'in_progress')"
        ).fetchone()
        active_count = int(active_rows["cnt"] or 0) if active_rows else 0
    except Exception:
        active_count = 0
    finally:
        if conn is not None:
            conn.close()

    status_emoji = "🟢" if tournament_enabled else "🔴"
    text = (
        "🏟️ <b>Турниры — панель администратора</b>\n\n"
        f"• Статус: {status_emoji} {'включены' if tournament_enabled else 'выключены'}\n"
        f"• Активных турниров: <b>{active_count}</b>\n\n"
        "Если флаг выключен, команда /createtournament отвечает игрокам: "
        "<i>Tournaments are currently disabled</i>.\n\n"
        "Важно: секция лендинга «Compete for the crown» обещает турниры. "
        "Держи этот флаг и публичный лендинг синхронно. Не включай турниры "
        "без отдельного HEAVY smoke, потому что это stake/payment-adjacent flow."
    )

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"Турниры: {'ВКЛ' if tournament_enabled else 'ВЫКЛ'}",
            callback_data="admin_tournaments_toggle"
        )],
        [InlineKeyboardButton("◀️ Назад в Админку", callback_data="admin_panel")],
    ])
    await safe_edit_message(query.message, text, reply_markup=keyboard, parse_mode=ParseMode.HTML)


@require_admin_callback
async def _admin_callback_tournaments_toggle(query, context, *, user_id: int, callback_data: str):
    """Toggle tournament_enabled setting."""
    from services import settings as settings_svc
    current = settings_svc.get_bool("tournament_enabled")
    settings_svc.set_setting("tournament_enabled", not current, operator_id=str(user_id), note="admin_tournaments_toggle")
    await _admin_callback_tournaments(query, context, user_id=user_id, callback_data="admin_tournaments")


@require_admin_callback
async def _admin_callback_elo_danger(query, context, *, user_id: int, callback_data: str):
    """Danger-zone tools for ELO administration.

    Hidden behind a separate panel so routine launch operations do not
    expose season reset next to the normal ELO enable/disable control.
    """
    await _admin_reply(
        query,
        "⚠️ <b>Опасные действия ELO</b>\n\n"
        "Обычная работа ELO не требует этих действий.\n\n"
        "• <b>Сброс сезона</b> возвращает ELO всех игроков к стартовому рейтингу.\n"
        "• Использовать только перед новым сезоном или после подтверждённого инцидента.\n"
        "• Для soft launch это действие обычно не нужно.",
        keyboard=InlineKeyboardMarkup([
            [InlineKeyboardButton("⚠️ Сбросить ELO-сезон", callback_data="admin_elo_reset")],
        ]),
        back_callback="admin_elo",
    )


@require_admin_callback
async def _admin_callback_elo_reset(query, context, *, user_id: int, callback_data: str):
    """Confirm ELO season reset."""
    await _admin_reply(
        query,
        "⚠️ <b>Подтверждение сброса ELO-сезона</b>\n\n"
        "Это сбросит <b>ВСЕ</b> ELO-рейтинги к стартовому значению.\n"
        "Для обычной работы и soft launch это действие не нужно.\n"
        "Используй только перед новым сезоном или после подтверждённого инцидента.\n\n"
        "Подтверждаешь сброс?",
        keyboard=InlineKeyboardMarkup([
            [InlineKeyboardButton("⚠️ Да, сбросить ELO-сезон", callback_data="admin_elo_reset_confirm")],
            [InlineKeyboardButton("❌ Отмена", callback_data="admin_elo_danger")],
        ]),
        back_callback="admin_elo_danger",
    )


@require_admin_callback
async def _admin_callback_elo_reset_confirm(query, context, *, user_id: int, callback_data: str):
    """Execute ELO season reset."""
    from services import elo as elo_service
    try:
        with database.transaction() as conn:
            count = elo_service.reset_elo_season(conn, season_name="admin_manual", operator_id=user_id)
        await _admin_reply(
            query,
            f"✅ <b>Сброс ELO-сезона завершён</b>\n\nСброшено игроков: {count}.",
            back_callback="admin_elo",
        )
    except Exception as e:
        await _admin_reply(
            query,
            f"❌ Не удалось сбросить ELO: {e}",
            back_callback="admin_elo",
        )


@require_admin_callback
async def _admin_callback_elo_adjust(query, context, *, user_id: int, callback_data: str):
    """Prompt for user ID to adjust ELO."""
    context.user_data["admin_elo_adjust_state"] = "awaiting_user_id"
    await _admin_reply(
        query,
        "🛠 <b>Ручная коррекция ELO</b>\n\n"
        "ELO работает автоматически после завершённых дуэлей.\n"
        "Эта команда нужна только для теста, спора или исправления технической ошибки.\n\n"
        "Отправь команду с ID зарегистрированного игрока Roll Duel.\n"
        "ID бери в Web Admin → Пользователи или попроси игрока сначала открыть /start.\n\n"
        "Формат: <code>/eloadjust USER_ID NEW_RATING</code>\n"
        "Пример: <code>/eloadjust 1306626097 1500</code>",
        back_callback="admin_elo",
    )


@require_admin_callback
async def _admin_callback_logout(query, context, *, user_id: int, callback_data: str):
    user_states.pop(user_id, None)
    await handle_main_menu(query, context)


async def _admin_callback_giveaways(query, context, user_id=None, callback_data=None):
    """Улучшенная версия Giveaways в админке с фильтрами."""
    if user_id is None:
        user_id = query.from_user.id
    if not _is_admin_user(user_id):
        await safe_answer_callback(query, "Требуется доступ оператора.", show_alert=True)
        return
    if callback_data is None:
        callback_data = query.data

    from services.giveaways import get_public_giveaways_list, count_public_giveaways

    # Фильтр по статусу (из callback или сохранённого состояния)
    status_filter = context.user_data.get("admin_giveaway_filter", "ALL")

    if callback_data.startswith("admin_giveaways_filter_"):
        status_filter = callback_data.replace("admin_giveaways_filter_", "")
        context.user_data["admin_giveaway_filter"] = status_filter

    try:
        giveaways = get_public_giveaways_list(limit=10, offset=0, exclude_workspace_id=None, order_by="created_at")
        total = count_public_giveaways()

        if status_filter != "ALL":
            giveaways = [g for g in giveaways if g.get("status") == status_filter]

        lines = [
            "🎁 <b>Розыгрыши — мониторинг</b>",
            "",
            f"• Всего активных публичных: <b>{total}</b>",
            f"• Фильтр: <b>{status_filter}</b>",
            f"• Показано: <b>{len(giveaways)}</b>",
            "",
            "<b>Последние розыгрыши:</b>",
        ]

        if giveaways:
            for g in giveaways[:6]:
                emoji = {'ACTIVE': '🟢', 'ENDED': '🔴', 'DRAFT': '📝', 'WINNERS_DRAWN': '🏆'}.get(g.get('status'), '❓')
                lines.append(
                    f"{emoji} <code>{g['giveaway_id'][:8]}</code> — {g.get('title','—')[:25]} | {g.get('participants_count',0)} уч. | {g.get('status')}"
                )
        else:
            lines.append("• Нет розыгрышей по выбранному фильтру.")

        lines.extend([
            "",
            "• Полное управление — в <b>Веб-админке</b>",
            "• Оператор может мониторить и отменять (через Веб-админку).",
        ])

        text = "\n".join(lines)

    except Exception as e:
        logger.exception(f"Admin giveaways callback error: {e}")
        text = "🎁 <b>Розыгрыши</b>\n\nОшибка загрузки. Используй Веб-админку."

    # Клавиатура с фильтрами
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🟢 ACTIVE", callback_data="admin_giveaways_filter_ACTIVE"),
            InlineKeyboardButton("🔴 ENDED", callback_data="admin_giveaways_filter_ENDED"),
        ],
        [
            InlineKeyboardButton("📝 DRAFT", callback_data="admin_giveaways_filter_DRAFT"),
            InlineKeyboardButton("📋 ALL", callback_data="admin_giveaways_filter_ALL"),
        ],
        [InlineKeyboardButton("◀️ Назад в Админку", callback_data="admin_panel")]
    ])

    await safe_edit_message(query.message,
        text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_comms(query, context, *, user_id: int, callback_data: str):
    from admin.read_models import comms_snapshot

    snap = comms_snapshot()
    active = snap.get("active_broadcast") or {}
    notice = snap.get("current_notice") or {}

    lines = [
        "📣 <b>Рассылки — обзор</b>",
        "",
        f"• Активная рассылка: <b>{active.get('status', '—')}</b>",
        f"• Доставлено: <b>{active.get('sent_count', 0)}/{active.get('total_count', 0)}</b>",
        f"• Ошибок: <b>{active.get('failed_count', 0)}</b>",
        "",
        f"• Текущее объявление: <b>{notice.get('status', '—')}</b>",
        f"• Серьёзность: <b>{notice.get('severity', '—')}</b>",
        "",
        "Используйте Веб-админку для управления.",
    ]

    await safe_edit_message(query.message,
        "\n".join(lines),
        reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_support(query, context, *, user_id: int, callback_data: str):
    from services import settings

    support_handle = settings.get_setting("SUPPORT_TELEGRAM_HANDLE", "@rollduelbot")

    lines = [
        "🛟 <b>Поддержка — информация</b>",
        "",
        f"• Telegram: <b>{support_handle}</b>",
        f"• Веб-админка: <b>{_admin_web_url('/')}</b>",
        "",
        "Для управления поддержкой используйте Веб-админку.",
    ]

    await safe_edit_message(query.message,
        "\n".join(lines),
        reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_comms_stub(query, context, *, user_id: int, callback_data: str):
    await safe_edit_message(query.message,
        "📣 Раздел рассылок пока не реализован в Telegram-админке.\nИспользуйте Веб-админку.",
        reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url('/')),
        parse_mode=ParseMode.HTML,
    )


@require_admin_callback
async def _admin_callback_support_stub(query, context, *, user_id: int, callback_data: str):
    lines = [
        "🛟 Поддержка — перейдите в Веб-админку или используйте /support в боте.",
        "",
        "• Для управления используй Веб-админку или владелец группы сам управляет.",
        "• Оператор может только мониторить и отменять проблемные розыгрыши (если нужно).",
    ]

    keyboard = get_admin_shortcuts_keyboard("admin_giveaways", _admin_web_url('/giveaways'))

    await safe_edit_message(query.message,
        "\n".join(lines),
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_audit(query, context, *, user_id: int, callback_data: str):
    from admin.read_models import list_operator_actions

    actions = list_operator_actions(limit=10, offset=0)

    lines = [
        "📋 <b>Audit Log — Последние действия</b>",
        "",
        f"• Показано: <b>{len(actions)}</b> последних действий",
        "",
    ]

    if actions:
        for action in actions:
            op_id = str(action.get('operator_id', '—'))[:8]
            action_type = action.get('action_type', '—')
            target_type = action.get('target_type', '—')
            target_id = str(action.get('target_id', '—'))[:12]
            created = str(action.get('created_at', '—'))[:16]
            reason = str(action.get('reason', ''))[:30]

            lines.append(
                f"• <code>{created}</code> | {op_id} → {action_type}"
                f" ({target_type}:{target_id})"
            )
            if reason:
                lines.append(f"   └ {reason}")
    else:
        lines.append("• Нет записей в audit log.")

    lines.extend([
        "",
        "• Полная история доступна в Веб-админка → Аудит.",
    ])

    keyboard = get_admin_shortcuts_keyboard("admin_audit", _admin_web_url('/audit'))

    await safe_edit_message(query.message,
        "\n".join(lines),
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@require_admin_callback
async def _admin_callback_export(query, context, *, user_id: int, callback_data: str):
    from admin.read_models import users_bulk_export
    from export_to_excel import export_all_to_excel
    from io import BytesIO
    import os

    # Navigation keyboard for after export
    nav_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🔄 Ещё раз", callback_data=callback_data)],
        [InlineKeyboardButton("← Назад к форматам", callback_data="admin_export")],
        [InlineKeyboardButton("🏠 В админку", callback_data="admin_panel")],
    ])

    if callback_data == "admin_export_tg_ids":
        result = users_bulk_export(mode="tg_ids", limit=1000)
        if result.get("values"):
            file_obj = BytesIO('\n'.join(result['values']).encode('utf-8'))
            file_obj.name = 'tg_ids.txt'
            caption = "📋 <b>Telegram ID — готово</b>\n\nПолный список в файле"
            await context.bot.send_document(
                chat_id=user_id,
                document=file_obj,
                caption=caption,
                parse_mode=ParseMode.HTML,
                reply_markup=nav_kb
            )
        else:
            await safe_answer_callback(query, "❌ Нет данных для экспорта", show_alert=True)
        return

    elif callback_data == "admin_export_usernames":
        result = users_bulk_export(mode="usernames", limit=1000)
        if result.get("values"):
            file_obj = BytesIO('\n'.join(result['values']).encode('utf-8'))
            file_obj.name = 'usernames.txt'
            caption = "👥 <b>Username — готово</b>\n\nПолный список в файле"
            await context.bot.send_document(
                chat_id=user_id,
                document=file_obj,
                caption=caption,
                parse_mode=ParseMode.HTML,
                reply_markup=nav_kb
            )
        else:
            await safe_answer_callback(query, "❌ Нет данных для экспорта", show_alert=True)
        return

    elif callback_data == "admin_export_user_ids":
        result = users_bulk_export(mode="user_ids", limit=1000)
        if result.get("values"):
            file_obj = BytesIO('\n'.join(result['values']).encode('utf-8'))
            file_obj.name = 'user_ids.txt'
            caption = "🆔 <b>User ID — готово</b>\n\nПолный список в файле"
            await context.bot.send_document(
                chat_id=user_id,
                document=file_obj,
                caption=caption,
                parse_mode=ParseMode.HTML,
                reply_markup=nav_kb
            )
        else:
            await safe_answer_callback(query, "❌ Нет данных для экспорта", show_alert=True)
        return

    elif callback_data == "admin_export_excel":
        try:
            from export_to_excel import export_all_to_excel
            result = users_bulk_export(mode="full", limit=1000)
            rows = result.get("rows", [])
            if not rows:
                await safe_answer_callback(query, "❌ Нет данных для Excel-экспорта.", show_alert=True)
                return
            filename = 'export.xlsx'
            export_all_to_excel(rows, filename=filename)
            with open(filename, 'rb') as f:
                caption = "📎 <b>Excel файл — готово</b>\n\nПолный экспорт всех пользователей"
                await context.bot.send_document(
                    chat_id=user_id,
                    document=f,
                    filename=filename,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=nav_kb
                )
            try:
                os.remove(filename)
            except Exception as e:
                logger.warning("Failed to remove temp export file %s: %s", filename, e)
            return
        except ImportError:
            await safe_edit_message(query.message,
                "❌ Excel export недоступен (не установлен pandas).\n"
                "Используйте другие форматы: Telegram ID, @username или User ID.",
                reply_markup=get_grouped_admin_panel_keyboard()
            )
            return
        except Exception as e:
            logger.exception("Excel export failed")
            await safe_answer_callback(query, "❌ Ошибка при создании Excel-файла.", show_alert=True)
            return

    # По умолчанию — показываем меню выбора формата
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Telegram ID", callback_data="admin_export_tg_ids")],
        [InlineKeyboardButton("👥 @username", callback_data="admin_export_usernames")],
        [InlineKeyboardButton("🆔 User ID", callback_data="admin_export_user_ids")],
        [InlineKeyboardButton("📎 Excel (все поля)", callback_data="admin_export_excel")],
        [InlineKeyboardButton("← Назад", callback_data="admin_panel")],
    ])
    await safe_edit_message(query.message,
        "📥 <b>Выгрузка пользователей</b>\n\nВыберите формат:",
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
    )


def _render_tg_admin_duels_text() -> str:
    snapshot = admin_read_models.dashboard_snapshot()
    stuck = []
    if hasattr(admin_read_models, 'list_stuck_duels'):
        try:
            stuck = admin_read_models.list_stuck_duels(limit=5)
        except Exception as e:
            logger.exception("TG admin duels read model failed: %s", e)
            stuck = []

    lines = [
        "⚔️ <b>Дуэли</b>",
        "",
        f"• Открыто: <b>{int(snapshot.get('open_duels') or 0)}</b>",
        f"• Активно: <b>{int(snapshot.get('active_duels') or 0)}</b>",
        f"• На расчёте: <b>{int(snapshot.get('settling_duels') or 0)}</b>",
        f"• Зависли: <b>{int(snapshot.get('stuck_duels') or 0)}</b>",
        "",
        "<b>Stuck-дуэли (выборка):</b>",
        f"<i>Страница 1 · Показано: {min(len(stuck), 5)}</i>",
    ]
    if stuck:
        for item in stuck[:5]:
            game_id = item.get('game_id') or item.get('id') or '—'
            status = item.get('status') or '—'
            deadline = item.get('deadline_at') or item.get('updated_at') or '—'
            amount = item.get('bet_amount') or item.get('amount') or item.get('stake') or 0
            lines.append(f"• <code>{game_id}</code> — {status} — {float(amount or 0):.2f} GRAM — {escape(str(deadline))}")
    else:
        lines.append("• Сейчас зависших дуэлей нет или read model недоступен.")

    lines.extend([
        "",
        "<b>Квитанция</b>",
        "• Этот экран только для чтения. Force timeout / recovery остаётся отдельным HEAVY/ops action.",
        "• Для полной карточки и audit trail открой Веб-админку.",
    ])
    return "\n".join(lines)


@require_admin_callback
async def _admin_callback_duels(query, context, *, user_id: int, callback_data: str):
    rows = [[InlineKeyboardButton("🔄 Обновить", callback_data="admin_duels")]]
    duels_url = _admin_web_url("/duels")
    if duels_url:
        rows.append([InlineKeyboardButton("🌐 Дуэли в Веб-админке", url=duels_url)])
    await _admin_reply(
        query,
        _render_tg_admin_duels_text(),
        keyboard=InlineKeyboardMarkup(rows),
        back_callback="admin_panel",
    )


@require_admin_callback
async def _admin_callback_risk(query, context, *, user_id: int, callback_data: str):
    """Show risk queue — users pending manual review."""
    try:
        snapshot = admin_read_models.risk_queue_snapshot()
        items = admin_read_models.list_risk_queue(limit=25)
    except Exception as e:
        logger.exception(f"Risk queue error for user {user_id}: {e}")
        await _admin_reply(
            query,
            f"❌ Ошибка загрузки очереди рисков: {escape(str(e))}",
            keyboard=InlineKeyboardMarkup([[InlineKeyboardButton("🌐 Риски в Веб-админке", url=_admin_web_url("/risk"))]]) if _admin_web_url("/risk") else None,
            back_callback="admin_panel",
        )
        return

    pending = int(snapshot.get("pending_manual_review") or 0)
    frozen = int(snapshot.get("frozen_users") or 0)
    flagged = int(snapshot.get("flagged_users") or 0)

    lines = [
        "⚠️ <b>Риски</b>\n",
        f"• На ручной проверке: <b>{pending}</b>",
        f"• Заморожены: <b>{frozen}</b>",
        f"• С флагами: <b>{flagged}</b>",
        "",
    ]

    if items:
        lines.append(f"<b>Страница 1 · Показано: {len(items)}</b>")
        for item in items:
            uid = item.get("user_id", "?")
            uname = item.get("username") or item.get("first_name") or f"#{uid}"
            flags = item.get("flags") or ""
            status = item.get("status") or ""
            lines.append(f"• <code>{uid}</code> @{uname} — {status} {flags}".strip())
        if flagged > len(items):
            lines.append(f"<i>Ещё {flagged - len(items)} → 🌐 Веб-админка</i>")
    else:
        lines.append("✅ Очередь рисков пуста.")

    rows = [[InlineKeyboardButton("🔄 Обновить", callback_data="admin_risk")]]
    risk_url = _admin_web_url("/risk")
    if risk_url:
        rows.append([InlineKeyboardButton("🌐 Риски в Веб-админке", url=risk_url)])
    keyboard = InlineKeyboardMarkup(rows)

    await _admin_reply(
        query,
        "\n".join(lines),
        keyboard=keyboard,
        back_callback="admin_panel",
    )


async def _admin_callback_vip(query, context, *, user_id: int, callback_data: str):
    """VIP is retired — read-only notice, no toggle available.

    Was previously a live management panel with a working
    admin_vip_toggle button that flipped settings.vip_enabled — meaning
    any admin who tapped it would silently re-activate the auto-tier fee
    discount (services/vip.py::get_effective_fee_bps checks exactly this
    flag). That's a real re-enable path for a product decision that was
    supposed to be final (STEP-VIP-REMOVAL-079). Fixed here
    (STEP-VIP-RETIREMENT-SURFACE-083): panel is now informational only.
    """
    await safe_answer_callback(query)
    from services import settings as settings_svc

    vip_enabled = settings_svc.get_bool("vip_enabled")
    lines = [
        "💎 <b>VIP — Retired</b>\n",
        "VIP was fully retired as a product surface. There is no purchasable "
        "status; the referral program is the only reward path.",
        "",
        f"System flag <code>vip_enabled</code> is currently: {'⚠️ ON (unexpected — investigate)' if vip_enabled else '✅ OFF (correct)'}",
        "",
        "This flag cannot be toggled from Telegram admin anymore. If it is "
        "ever ON and should not be, change it via the settings table "
        "directly and confirm why before re-disabling.",
    ]

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("◀️ Назад", callback_data="admin_panel")],
    ])
    await safe_edit_message(query.message, "\n".join(lines), reply_markup=keyboard, parse_mode=ParseMode.HTML)


async def _admin_callback_vip_toggle(query, context, *, user_id: int, callback_data: str):
    """Retired — no longer toggles anything. Kept registered (not
    deleted) so a stale cached button from before STEP-083 shows an
    explanation instead of "unknown callback", and so it can never
    silently re-enable vip_enabled again."""
    await safe_answer_callback(query)
    await safe_edit_message(
        query.message,
        "💎 VIP toggling has been retired. VIP is not coming back as a "
        "purchasable status — see the referral program instead.",
        parse_mode=ParseMode.HTML,
    )


ADMIN_CALLBACK_EXACT_HANDLERS = {
    "admin_users": _admin_callback_users,
    "admin_panel": _admin_callback_panel,
    "admin_overview": _admin_callback_overview,
    "admin_refresh": _admin_callback_refresh,
    "admin_withdrawals": _admin_callback_withdrawals_shortcuts,
    "admin_withdrawal_approve": _admin_callback_withdrawal_approve,
    "admin_withdrawal_reject": _admin_callback_withdrawal_reject,
    "admin_giveaways": _admin_callback_giveaways,
    "admin_elo": _admin_callback_elo,
    "admin_elo_toggle": _admin_callback_elo_toggle,
    "admin_elo_danger": _admin_callback_elo_danger,
    "admin_tournaments": _admin_callback_tournaments,
    "admin_tournaments_toggle": _admin_callback_tournaments_toggle,
    "admin_elo_reset": _admin_callback_elo_reset,
    "admin_elo_reset_confirm": _admin_callback_elo_reset_confirm,
    "admin_elo_adjust": _admin_callback_elo_adjust,
    "admin_audit": _admin_callback_audit,
    "admin_risk": _admin_callback_risk,
    "admin_duels": _admin_callback_duels,
    "admin_vip": _admin_callback_vip,
    "admin_vip_toggle": _admin_callback_vip_toggle,
    "admin_runtime": _admin_callback_runtime_shortcuts,
    "admin_failed": _admin_callback_problems,
    "admin_provider": _admin_callback_provider,
    "admin_liabilities": _admin_callback_liabilities,
    "admin_acquisition": _admin_callback_acquisition,
    "admin_acquisition_7": _admin_callback_acquisition,
    "admin_acquisition_30": _admin_callback_acquisition,
    "admin_help": _admin_callback_help_shortcuts,
    "admin_balance": _admin_callback_balance,
    "admin_broadcast": _admin_callback_broadcast,
    "admin_comms": _admin_callback_comms,
    "admin_support": _admin_callback_support,
    "admin_broadcasts": _admin_callback_broadcasts,
    "admin_bc_new": _admin_callback_bc_new,
    "bc:n": _admin_callback_bc_new,
    "bc:bn": _admin_callback_bc_builder_new,
    "bc:qn": _admin_callback_bc_quick_new,
    "bc:ob": _admin_callback_bc_outbox,
    "admin_notice": _admin_callback_notice,
    "admin_notice_new": _admin_callback_notice_new,
    "nt:n": _admin_callback_notice_new,
    "admin_settings": _admin_callback_settings,
    "toggle_create_game": _admin_callback_toggle_create_game,
    "toggle_withdraw": _admin_callback_toggle_withdraw,
    "toggle_duel_series_bo3": _admin_callback_toggle_duel_series_bo3,
    "toggle_practice_series_bo3": _admin_callback_toggle_practice_series_bo3,
    "toggle_tournament_series_bo3": _admin_callback_toggle_tournament_series_bo3,
    "cancel_all_waiting_games": _admin_callback_cancel_waiting_games,
    "confirm_cancel_all_waiting_games": _admin_callback_confirm_cancel_waiting_games,
    "admin_logout": _admin_callback_logout,
    "admin_export": _admin_callback_export,
    "admin_export_tg_ids": _admin_callback_export,
    "admin_export_usernames": _admin_callback_export,
    "admin_export_user_ids": _admin_callback_export,
    "admin_export_excel": _admin_callback_export,
}

# ── Tournament Admin Handlers (Stage 3B) ──────────────────────────────────

async def _admin_callback_tournament_cancel(query, context):
    """Admin cancel a stuck tournament (H-18 fix)."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    if not _is_admin_user(user_id):
        await query.answer("Access denied.", show_alert=True)
        return
    tournament_id = int(query.data.replace("admin_tournament_cancel_", ""))

    result = tournament_service.cancel_tournament(tournament_id, f"admin_{user_id}")
    if not result.get("ok"):
        await query.answer(result.get("error", "Could not cancel tournament"), show_alert=True)
        return

    await safe_edit_message(
        query.message,
        f"\u2705 <b>Tournament #{tournament_id} cancelled by admin.</b>\n\n"
        f"Participant stakes have been refunded.",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001F3C6 Tournament Menu", callback_data="tournament_menu")],
        ]),
    )


async def _admin_callback_tournament_force_complete(query, context):
    """Admin force-complete a stuck tournament (H-18 fix)."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    if not _is_admin_user(user_id):
        await query.answer("Access denied.", show_alert=True)
        return
    # Format: admin_tournament_force_complete_<tid>_<champion_id>
    parts = query.data.replace("admin_tournament_force_complete_", "").split("_")
    if len(parts) < 2:
        await query.answer("Invalid callback data", show_alert=True)
        return

    tournament_id = int(parts[0])
    champion_id = int(parts[1])

    result = tournament_service.force_complete_tournament(
        tournament_id, champion_id, operator_id=f"admin_{user_id}"
    )
    if not result.get("ok"):
        await query.answer(result.get("error", "Could not force-complete tournament"), show_alert=True)
        return

    prize_pool = result.get("prize_pool", 0)
    await safe_edit_message(
        query.message,
        f"\u2705 <b>Tournament #{tournament_id} force-completed by admin.</b>\n\n"
        f"\U0001F947 Champion: User #{champion_id}\n"
        f"\U0001F4B0 Prize: <b>{prize_pool:.2f} GRAM</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001F3C6 Tournament Menu", callback_data="tournament_menu")],
        ]),
    )


async def _admin_callback_tournament_reconcile(query, context):
    """Admin trigger stale tournament reconciliation."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    if not _is_admin_user(user_id):
        await query.answer("Access denied.", show_alert=True)
        return

    result = tournament_service.reconcile_stale_tournaments()

    msg_lines = [
        "\U0001F504 <b>Tournament Reconciliation Report</b>\n",
        f"\u23F3 Stale forming cancelled: <b>{result.get('cancelled_forming', 0)}</b>",
        f"\u2694\uFE0F Stale matches progressed: <b>{result.get('progressed_matches', 0)}</b>",
    ]
    errors = result.get("errors", [])
    if errors:
        msg_lines.append(f"\n\u26A0\uFE0F <b>{len(errors)} error(s):</b>")
        for err in errors[:5]:
            msg_lines.append(f"  \u2022 {err}")

    await safe_edit_message(
        query.message,
        "\n".join(msg_lines),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001F504 Reconcile Again", callback_data="admin_tournament_reconcile")],
            [InlineKeyboardButton("\U0001F3C6 Tournament Menu", callback_data="tournament_menu")],
        ]),
    )

ADMIN_CALLBACK_PREFIX_HANDLERS = (
    ("admin_acq:", _admin_callback_acquisition_campaign),
    ("bc:o:", _admin_callback_bc_open),
    ("bc:tx:", _admin_callback_bc_builder_text),
    ("bc:ph:", _admin_callback_bc_builder_photo),
    ("bc:tp:", _admin_callback_bc_builder_textphoto),
    ("bc:src:", _admin_callback_bc_source),
    ("bc:am:", _admin_callback_bc_audience_menu),
    ("bc:a:", _admin_callback_bc_audience_set),
    ("bc:btn:", _admin_callback_bc_buttons),
    ("bc:ba:", _admin_callback_bc_btn_add),
    ("bc:bp:", _admin_callback_bc_btn_preset),
    ("bc:bc:", _admin_callback_bc_btn_clear),
    ("bc:pv:", _admin_callback_bc_preview),
    ("bc:rs:", _admin_callback_bc_results),
    ("bc:ts:", _admin_callback_bc_test_self),
    ("bc:tac:", _admin_callback_bc_test_allow_confirm),
    ("bc:ta:", _admin_callback_bc_test_allow),
    ("bc:lnc:", _admin_callback_bc_launch_confirm),
    ("bc:ln:", _admin_callback_bc_launch),
    ("bc:stc:", _admin_callback_bc_stop_confirm),
    ("bc:st:", _admin_callback_bc_stop),
    ("bc:rtc:", _admin_callback_bc_retry_confirm),
    ("bc:rt:", _admin_callback_bc_retry),
    ("bc:cxc:", _admin_callback_bc_cancel_confirm),
    ("bc:cx:", _admin_callback_bc_cancel),
    ("nt:o:", _admin_callback_notice_open),
    ("nt:tx:", _admin_callback_notice_text),
    ("nt:sm:", _admin_callback_notice_severity_menu),
    ("nt:s:", _admin_callback_notice_severity_set),
    ("nt:tm:", _admin_callback_notice_target_menu),
    ("nt:t:", _admin_callback_notice_target_set),
    ("nt:cm:", _admin_callback_notice_cta_menu),
    ("nt:c:", _admin_callback_notice_cta_set),
    ("nt:em:", _admin_callback_notice_expiry_menu),
    ("nt:e:", _admin_callback_notice_expiry_set),
    ("nt:pv:", _admin_callback_notice_preview),
    ("nt:pbc:", _admin_callback_notice_publish_confirm),
    ("nt:pb:", _admin_callback_notice_publish),
    ("nt:dxc:", _admin_callback_notice_deactivate_confirm),
    ("nt:dx:", _admin_callback_notice_deactivate),
    ("admin_bc_open|", _admin_callback_bc_open),
    ("admin_bc_text|", _admin_callback_bc_builder_text),
    ("admin_bc_source|", _admin_callback_bc_source),
    ("admin_bc_audience_menu|", _admin_callback_bc_audience_menu),
    ("admin_bc_aud|", _admin_callback_bc_audience_set),
    ("admin_bc_buttons|", _admin_callback_bc_buttons),
    ("admin_bc_btn_add|", _admin_callback_bc_btn_add),
    ("admin_bc_btn_preset|", _admin_callback_bc_btn_preset),
    ("admin_bc_btn_clear|", _admin_callback_bc_btn_clear),
    ("admin_bc_preview|", _admin_callback_bc_preview),
    ("admin_bc_results|", _admin_callback_bc_results),
    ("admin_bc_test_self|", _admin_callback_bc_test_self),
    ("admin_bc_test_allow_confirm|", _admin_callback_bc_test_allow_confirm),
    ("admin_bc_test_allow|", _admin_callback_bc_test_allow),
    ("admin_bc_launch_confirm|", _admin_callback_bc_launch_confirm),
    ("admin_bc_launch|", _admin_callback_bc_launch),
    ("admin_bc_stop_confirm|", _admin_callback_bc_stop_confirm),
    ("admin_bc_stop|", _admin_callback_bc_stop),
    ("admin_bc_retry_confirm|", _admin_callback_bc_retry_confirm),
    ("admin_bc_retry|", _admin_callback_bc_retry),
    ("admin_bc_cancel_confirm|", _admin_callback_bc_cancel_confirm),
    ("admin_bc_cancel|", _admin_callback_bc_cancel),
    ("admin_notice_open|", _admin_callback_notice_open),
    ("admin_notice_text|", _admin_callback_notice_text),
    ("admin_notice_severity_menu|", _admin_callback_notice_severity_menu),
    ("admin_notice_severity|", _admin_callback_notice_severity_set),
    ("admin_notice_target_menu|", _admin_callback_notice_target_menu),
    ("admin_notice_target|", _admin_callback_notice_target_set),
    ("admin_notice_cta_menu|", _admin_callback_notice_cta_menu),
    ("admin_notice_cta|", _admin_callback_notice_cta_set),
    ("admin_notice_expiry_menu|", _admin_callback_notice_expiry_menu),
    ("admin_notice_expiry|", _admin_callback_notice_expiry_set),
    ("admin_notice_preview|", _admin_callback_notice_preview),
    ("admin_notice_publish_confirm|", _admin_callback_notice_publish_confirm),
    ("admin_notice_publish|", _admin_callback_notice_publish),
    ("admin_notice_deactivate_confirm|", _admin_callback_notice_deactivate_confirm),
    ("admin_notice_deactivate|", _admin_callback_notice_deactivate),
    ("admin_wd_apv_yes_", _admin_callback_withdrawal_approve_confirm),
    ("admin_wd_rej_yes_", _admin_callback_withdrawal_reject_confirm),
    ("admin_wd_apv_", _admin_callback_withdrawal_approve),
    ("admin_wd_rej_", _admin_callback_withdrawal_reject),
    ("admin_withdrawal_approve_", _admin_callback_withdrawal_approve),
    ("admin_withdrawal_reject_", _admin_callback_withdrawal_reject),
    ("admin_block_", _admin_callback_block_user),
    ("admin_unblock_", _admin_callback_unblock_user),
    ("admin_change_balance_", _admin_callback_change_balance),
    ("admin_stats_", _admin_callback_stats),
    ("admin_giveaways_filter_", _admin_callback_giveaways),
    # ── Tournament Admin (Stage 3B) ──
    ("admin_tournament_cancel_", _admin_callback_tournament_cancel),
    ("admin_tournament_force_complete_", _admin_callback_tournament_force_complete),
    ("admin_tournament_reconcile", _admin_callback_tournament_reconcile),
)

# ============================================================
# GIVEAWAY + WORKSPACE + GROUP WRAPPERS (Phase 3 Step 1 - Exact from user)
# ============================================================

async def _handle_gw_edit_field(query, context):
    """Обрабатывает gw_edit_title_, gw_edit_prize_, gw_edit_winners_, gw_edit_deadline_, gw_edit_starts_"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    callback_data = query.data
    user_id = query.from_user.id
    if callback_data.startswith("gw_edit_title_"):
        field_name = "title"
        giveaway_id = callback_data[len("gw_edit_title_"):]
    elif callback_data.startswith("gw_edit_prize_"):
        field_name = "prize"
        giveaway_id = callback_data[len("gw_edit_prize_"):]
    elif callback_data.startswith("gw_edit_winners_"):
        field_name = "winners"
        giveaway_id = callback_data[len("gw_edit_winners_"):]
    elif callback_data.startswith("gw_edit_deadline_"):
        field_name = "deadline"
        giveaway_id = callback_data[len("gw_edit_deadline_"):]
    elif callback_data.startswith("gw_edit_starts_"):
        field_name = "starts"
        giveaway_id = callback_data[len("gw_edit_starts_"):]
    else:
        return
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    user_states[user_id] = f"gw_edit_{field_name}:{giveaway_id}"
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_edit_prompt(field_name, (snapshot.get("giveaway") or {}).get("title"), t=t, snapshot=snapshot),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, field_name, t=t),
    )


async def _handle_gw_activate(query, context):
    giveaway_id = query.data.replace("gw_activate_", "", 1)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_confirm_text("activate", snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_confirm_keyboard("activate", giveaway_id, workspace_id, t=t),
    )


async def _handle_gw_confirm_activate(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    giveaway_id = query.data.replace("gw_confirm_activate_", "", 1)
    user_id = query.from_user.id
    try:
        activate_giveaway(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.activated", default="Giveaway activated"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_end(query, context):
    giveaway_id = query.data.replace("gw_end_", "", 1)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_confirm_text("end", snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_confirm_keyboard("end", giveaway_id, workspace_id, t=t),
    )


async def _handle_gw_confirm_end(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    giveaway_id = query.data.replace("gw_confirm_end_", "", 1)
    user_id = query.from_user.id
    try:
        end_giveaway(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.ended", default="Giveaway ended"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_draw(query, context):
    giveaway_id = query.data.replace("gw_draw_", "", 1)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_confirm_text("draw", snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_confirm_keyboard("draw", giveaway_id, workspace_id, t=t),
    )


async def _handle_gw_confirm_draw(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    giveaway_id = query.data.replace("gw_confirm_draw_", "", 1)
    user_id = query.from_user.id
    try:
        result = draw_giveaway_winners(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    except Exception as exc:
        logger.exception("Giveaway winner draw failed for %s", giveaway_id)
        try:
            snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
            workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
            await safe_answer_callback(query, t("giveaway.toast.draw_error_short", default="❌ Could not draw winners."), show_alert=True)
            await safe_edit_message(
                query.message,
                t("giveaway.error.draw_failed", default="❌ Could not draw winners. Open the giveaway again and retry."),
                parse_mode=ParseMode.HTML,
                reply_markup=get_giveaway_confirm_keyboard("draw", giveaway_id, workspace_id, t=t),
            )
        except Exception:
            await safe_answer_callback(query, t("giveaway.error.draw_failed", default="❌ Could not draw winners. Open the giveaway again and retry."), show_alert=True)
        return
    outcome = str((result or {}).get("outcome") or "")
    if outcome == "no_entries":
        await safe_answer_callback(query, t("giveaway.toast.no_winners_drawn", default="No winners selected: no entries."))
    else:
        await safe_answer_callback(query, t("giveaway.toast.winners_drawn", default="Winners drawn"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_publish_live(query, context):
    giveaway_id = query.data.replace("gw_publish_live_", "", 1)
    user_id = query.from_user.id
    try:
        snapshot = get_giveaway_public_snapshot(giveaway_id=giveaway_id)
        workspace = snapshot.get("workspace") or {}
        chat_id = workspace.get("telegram_chat_id")
        if not chat_id:
            raise GiveawayError("workspace_chat_missing", "This group is missing a Telegram chat id.", 409)
        public_t = _public_giveaway_t()
        giveaway = snapshot.get("giveaway") or {}
        sent = await context.bot.send_message(
            chat_id=int(chat_id),
            text=render_public_giveaway_post_text(snapshot, t=public_t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_public_giveaway_join_keyboard(giveaway_id, t=public_t, not_started=_giveaway_not_started_yet(giveaway)),
            disable_web_page_preview=True,
        )
        mark_giveaway_post_published(owner_user_id=user_id, giveaway_id=giveaway_id, published_message_id=sent.message_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    except Exception as exc:
        logger.warning("Could not publish giveaway post %s: %s", giveaway_id, exc)
        await safe_answer_callback(query, get_t(user_id)("giveaway.toast.publish_live_error", default="❌ Could not publish the giveaway post to the group."), show_alert=True)
        return
    await safe_answer_callback(query, get_t(user_id)("giveaway.toast.published", default="Giveaway published"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_publish_results(query, context):
    giveaway_id = query.data.replace("gw_publish_results_", "", 1)
    user_id = query.from_user.id
    try:
        snapshot = get_giveaway_public_snapshot(giveaway_id=giveaway_id)
        workspace = snapshot.get("workspace") or {}
        chat_id = workspace.get("telegram_chat_id")
        if not chat_id:
            raise GiveawayError("workspace_chat_missing", "This group is missing a Telegram chat id.", 409)
        public_t = _public_giveaway_t()
        sent = await context.bot.send_message(
            chat_id=int(chat_id),
            text=render_public_giveaway_result_text(snapshot, t=public_t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_public_giveaway_result_keyboard(t=public_t),
            disable_web_page_preview=True,
        )
        mark_results_published(owner_user_id=user_id, giveaway_id=giveaway_id, results_message_id=sent.message_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    except Exception as exc:
        logger.warning("Could not publish giveaway results %s: %s", giveaway_id, exc)
        await safe_answer_callback(query, get_t(user_id)("giveaway.toast.publish_results_error", default="❌ Could not publish the giveaway results to the group."), show_alert=True)
        return
    await safe_answer_callback(query, get_t(user_id)("giveaway.toast.results_published", default="Results published"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_results(query, context):
    giveaway_id = query.data.replace("gw_results_", "", 1)
    user_id = query.from_user.id
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_confirm_text("results", snapshot, t=context.user_data.get("t", get_t(user_id))),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_confirm_keyboard("results", giveaway_id, workspace_id, t=context.user_data.get("t", get_t(user_id))),
    )


async def _handle_gw_confirm_results(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    giveaway_id = query.data.replace("gw_confirm_results_", "", 1)
    user_id = query.from_user.id
    try:
        mark_results_published(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.results_marked", default="Results marked published"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_cancel(query, context):
    giveaway_id = query.data.replace("gw_cancel_", "", 1)
    user_id = query.from_user.id
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    workspace_id = str((snapshot.get("workspace") or {}).get("workspace_id") or (snapshot.get("giveaway") or {}).get("workspace_id") or "")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_giveaway_confirm_text("cancel", snapshot, t=context.user_data.get("t", get_t(user_id))),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_confirm_keyboard("cancel", giveaway_id, workspace_id, t=context.user_data.get("t", get_t(user_id))),
    )


async def _handle_gw_confirm_cancel(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    giveaway_id = query.data.replace("gw_confirm_cancel_", "", 1)
    user_id = query.from_user.id
    try:
        cancel_giveaway(owner_user_id=user_id, giveaway_id=giveaway_id, reason="owner_cancelled_from_bot")
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.cancelled", default="Giveaway cancelled"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _refresh_public_giveaway_post_after_join(query, context, giveaway_id: str, *, t=None) -> None:
    if t is None:
        t = _public_giveaway_t()
    try:
        snapshot = get_giveaway_public_snapshot(giveaway_id=giveaway_id)
        workspace = snapshot.get("workspace") or {}
        giveaway = snapshot.get("giveaway") or {}
        chat_id = int(workspace.get("telegram_chat_id") or 0)
        published_message_id = giveaway.get("published_message_id")
        public_t = _public_giveaway_t()
        text = render_public_giveaway_post_text(snapshot, t=public_t)
        keyboard = get_public_giveaway_join_keyboard(giveaway_id, t=public_t, not_started=_giveaway_not_started_yet(giveaway))
        message = getattr(query, "message", None)
        current_chat_id = int(((getattr(message, "chat", None) and getattr(message.chat, "id", 0)) or getattr(message, "chat_id", 0) or 0))
        if published_message_id:
            message_id = int(published_message_id)
        elif current_chat_id and chat_id and current_chat_id == chat_id:
            message_id = int(getattr(message, "message_id", 0) or 0)
        else:
            message_id = 0
        if chat_id and message_id:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=message_id,
                text=text,
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
    except BadRequest as exc:
        if "message is not modified" not in str(exc).lower():
            logger.info("Giveaway public post refresh skipped for %s: %s", giveaway_id, exc)
    except Exception as exc:
        logger.info("Giveaway public post refresh skipped for %s: %s", giveaway_id, exc)


async def _handle_gw_join(query, context):
    from services.i18n import get_translator
    t = _public_giveaway_t()
    giveaway_id = query.data.replace("gw_join_", "", 1)
    user_id = query.from_user.id
    logger.info("giveaway_join_attempt giveaway_id=%s user_id=%s source=public_post", giveaway_id, user_id)
    try:
        snapshot = get_giveaway_public_snapshot(giveaway_id=giveaway_id)
        workspace = snapshot.get("workspace") or {}
        target_chat_id = int(workspace.get("telegram_chat_id") or 0)
        msg = getattr(query, 'message', None)
        current_chat_id = int(((getattr(msg, 'chat', None) and getattr(msg.chat, 'id', 0)) or getattr(msg, 'chat_id', 0) or 0))
        if target_chat_id and current_chat_id and target_chat_id != current_chat_id:
            logger.info("giveaway_join_failed giveaway_id=%s user_id=%s reason=wrong_group", giveaway_id, user_id)
            await safe_answer_callback(query, t("giveaway.join.target_group_only", default="Откройте пост розыгрыша в нужной группе, чтобы участвовать."), show_alert=True)
            return
        result = join_giveaway_public(giveaway_id=giveaway_id, user_id=user_id)
    except GiveawayError as exc:
        logger.info("giveaway_join_failed giveaway_id=%s user_id=%s reason=%s", giveaway_id, user_id, getattr(exc, "code", "giveaway_error"))
        message = _localize_giveaway_error(exc, t=t, snapshot=snapshot if 'snapshot' in locals() else None)
        show_alert = exc.code in {"giveaway_cancelled", "giveaway_not_found", "workspace_chat_missing", "giveaway_not_started"}
        await safe_answer_callback(query, f"❌ {message}", show_alert=show_alert)
        return
    except Exception as exc:
        logger.exception("giveaway_join_failed giveaway_id=%s user_id=%s reason=unexpected: %s", giveaway_id, user_id, exc)
        await safe_answer_callback(query, t("giveaway.join.error", default="❌ Не удалось вступить в розыгрыш. Попробуйте ещё раз."), show_alert=True)
        return
    eligibility_result = None
    try:
        eligibility_result = await evaluate_giveaway_entry_eligibility(
            context.bot,
            giveaway_id=giveaway_id,
            user_id=user_id,
            force_refresh=False,
        )
    except Exception as exc:
        logger.warning("giveaway_eligibility_refresh_failed giveaway_id=%s user_id=%s error=%s", giveaway_id, user_id, exc)
    outcome = str(result.get("outcome") or "")
    eligible_now, eligibility_notice = _format_giveaway_join_eligibility_notice(eligibility_result, t=t)
    if outcome == "already_joined":
        logger.info("giveaway_join_already_joined giveaway_id=%s user_id=%s", giveaway_id, user_id)
        await safe_answer_callback(query, eligibility_notice if not eligible_now else t("giveaway.join.already_joined", default="ℹ️ Вы уже участвуете в этом розыгрыше."), show_alert=True)
    else:
        logger.info("giveaway_join_success giveaway_id=%s user_id=%s eligible=%s", giveaway_id, user_id, eligible_now)
        await safe_answer_callback(query, eligibility_notice, show_alert=True)
        await _notify_public_giveaway_join_once(query, context, giveaway_id, snapshot if 'snapshot' in locals() else None, t=t)
    await _refresh_public_giveaway_post_after_join(query, context, giveaway_id, t=t)


def _format_giveaway_join_eligibility_notice(result: dict | None, t=None) -> tuple[bool, str]:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    if not result:
        return True, t("giveaway.join.toast_success", default="✅ Вы участвуете в розыгрыше.")
    if result.get("eligible"):
        return True, t("giveaway.join.toast_success_eligible", default="✅ Вы участвуете в розыгрыше. Условия выполнены.")
    checks = result.get("checks") or {}
    parts = [t("giveaway.join.toast_pending", default="✅ Заявка принята, но для допуска к draw нужно выполнить условия.")]
    min_real = int(checks.get("min_completed_real_duels") or 0)
    completed = int(checks.get("completed_real_duels") or 0)
    if min_real > 0 and completed < min_real:
        parts.append(t("giveaway.eligibility.need_real_duel", default="🎲 Завершите минимум {required} real GRAM duel. Сейчас: {current}/{required}.", current=completed, required=min_real))
    missing = list(checks.get("missing") or [])
    unknown = list(checks.get("unknown") or [])
    if missing:
        parts.append(t("giveaway.eligibility.need_subscription", default="🔐 Подпишитесь на sponsor channel и нажмите Проверить."))
    elif checks.get("subscription_required") and not missing and not unknown:
        parts.append(t("giveaway.eligibility.check_subscription", default="🔐 Нажмите Проверить, чтобы подтвердить подписку."))
    if unknown:
        parts.append(t("giveaway.eligibility.subscription_unknown_short", default="⚠️ Подписку не удалось проверить: бот должен иметь доступ к sponsor channel."))
    return False, "\n".join(parts)


def _giveaway_preset_to_datetime(preset: str, *, allow_now: bool = False):
    normalized = str(preset or "").strip().lower()
    if allow_now and normalized in {"now", "сейчас", "сразу"}:
        return None
    now = datetime.utcnow().replace(microsecond=0)
    match = re.fullmatch(r"(\d+)\s*([mhd])", normalized)
    if not match:
        return _parse_giveaway_deadline_input(normalized, min_future_minutes=0)
    amount = int(match.group(1))
    unit = match.group(2)
    if unit == "m":
        return now + timedelta(minutes=amount)
    if unit == "h":
        return now + timedelta(hours=amount)
    return now + timedelta(days=amount)


async def _handle_gw_deadline_preset(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    callback_data = query.data
    user_id = query.from_user.id
    remainder = callback_data.replace("gw_deadline_preset_", "", 1)
    giveaway_id, _, preset = remainder.rpartition("_")
    try:
        deadline = _giveaway_preset_to_datetime(preset)
        update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, ends_at=deadline)
    except GiveawayError as exc:
        snapshot = None
        try:
            snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
        except Exception:
            snapshot = None
        await safe_answer_callback(query, f"❌ {_localize_giveaway_error(exc, t=t, snapshot=snapshot)}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.deadline_set", default="Дедлайн обновлён."))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_start_preset(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    callback_data = query.data
    user_id = query.from_user.id
    remainder = callback_data.replace("gw_start_preset_", "", 1)
    giveaway_id, _, preset = remainder.rpartition("_")
    try:
        snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
        giveaway = snapshot.get("giveaway") or {}
        if str(preset).lower() in {"now", "сейчас", "сразу"}:
            if not giveaway.get("starts_at"):
                await safe_answer_callback(query, t("giveaway.info.start_already_now", default="Начало уже установлено: сразу."), show_alert=True)
                visible = t(
                    "giveaway.info.start_already_now_visible",
                    default="ℹ️ <b>Начало уже установлено: сразу.</b>\n\nВыберите другое время или вернитесь к розыгрышу.",
                )
                await safe_edit_message(
                    query.message,
                    visible + "\n\n" + render_giveaway_edit_prompt("starts", giveaway.get("title"), t=t, snapshot=snapshot),
                    parse_mode=ParseMode.HTML,
                    reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, "starts", t=t),
                    disable_web_page_preview=True,
                )
                return
            update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, clear_starts_at=True)
        else:
            starts_at = _giveaway_preset_to_datetime(preset, allow_now=True)
            update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, starts_at=starts_at)
    except GiveawayError as exc:
        snapshot = None
        try:
            snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
        except Exception:
            snapshot = None
        await safe_answer_callback(query, f"❌ {_localize_giveaway_error(exc, t=t, snapshot=snapshot)}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.start_set", default="Время начала обновлено."))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_toggle_public(query, context):
    giveaway_id = query.data.replace("giveaway_toggle_public_", "", 1)
    await handle_giveaway_toggle_public(query, context)


async def _handle_gw_join_public(query, context):
    giveaway_id = query.data.replace("giveaway_join_public_", "", 1)
    await handle_giveaway_join_public(query, context)


# ============================================================
# WORKSPACE PREFIX WRAPPERS
# ============================================================

async def _handle_ws_toggle(query, context):
    callback = query.data
    user_id = query.from_user.id
    if callback.startswith("workspace_toggle_duel_"):
        workspace_id = callback[len("workspace_toggle_duel_"):]
        setting_key = "post_duel_created_enabled"
    elif callback.startswith("workspace_toggle_result_"):
        workspace_id = callback[len("workspace_toggle_result_"):]
        setting_key = "post_duel_result_enabled"
    elif callback.startswith("ws_toggle_lb_"):
        workspace_id = callback[len("ws_toggle_lb_"):]
        setting_key = "leaderboard_posts_enabled"
    elif callback.startswith("ws_toggle_weekly_"):
        workspace_id = callback[len("ws_toggle_weekly_"):]
        setting_key = "weekly_summary_enabled"
    else:
        return
    try:
        toggle_workspace_setting(user_id, workspace_id, setting_key)
    except WorkspaceError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, "Updated")
    await show_workspace_detail(query, user_id=user_id, workspace_id=workspace_id, edit=True, bot=context.bot)


async def _handle_ws_set_default(query, context):
    workspace_id = query.data.replace("workspace_set_default_", "", 1)
    user_id = query.from_user.id
    try:
        set_default_workspace(user_id, workspace_id)
    except WorkspaceError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, "Default group updated")
    await show_workspace_detail(query, user_id=user_id, workspace_id=workspace_id, edit=True, bot=context.bot)


async def _handle_ws_test(query, context):
    workspace_id = query.data.replace("workspace_test_", "", 1)
    user_id = query.from_user.id
    try:
        result = await publish_test_post(context.bot, workspace_id=workspace_id, user_id=user_id)
    except WorkspaceError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, f"✅ Test post sent (#{result['messageId']})", show_alert=False)
    await show_workspace_detail(query, user_id=user_id, workspace_id=workspace_id, edit=True, bot=context.bot)


async def _handle_ws_refresh(query, context):
    workspace_id = query.data.replace("workspace_refresh_", "", 1)
    await safe_answer_callback(query, "Rechecked")
    await show_workspace_detail(query, user_id=query.from_user.id, workspace_id=workspace_id, edit=True, bot=context.bot)


async def _handle_ws_disconnect(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    workspace_id = query.data.replace("workspace_disconnect_", "", 1)
    user_id = query.from_user.id
    detail = get_workspace_detail(user_id, workspace_id)
    if not detail:
        await safe_answer_callback(query, "❌ Group not found", show_alert=True)
        await show_workspace_list(query, user_id=user_id, edit=True)
        return
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_workspace_disconnect_confirm_text(detail, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_workspace_disconnect_confirm_keyboard(workspace_id, t=t),
    )


async def _handle_ws_disconnect_apply(query, context):
    workspace_id = query.data.replace("workspace_disconnect_apply_", "", 1)
    user_id = query.from_user.id
    try:
        disconnect_workspace(user_id, workspace_id)
    except WorkspaceError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, "Group disconnected")
    await show_workspace_list(query, user_id=user_id, edit=True)


async def _handle_ws_scope(query, context):
    workspace_id = query.data.replace("ws_scope_", "", 1)
    user_id = query.from_user.id
    try:
        set_workspace_default_scope(user_id, workspace_id)
    except WorkspaceError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, "Default scope updated")
    await show_workspace_detail(query, user_id=user_id, workspace_id=workspace_id, edit=True, bot=context.bot)


async def _handle_ws_publish(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    callback = query.data
    user_id = query.from_user.id
    if callback.startswith("ws_pub_chat_"):
        workspace_id = callback[len("ws_pub_chat_"):]
        kind = "chat"
    elif callback.startswith("ws_pub_weekly_"):
        workspace_id = callback[len("ws_pub_weekly_"):]
        kind = "weekly"
    elif callback.startswith("ws_pub_champ_"):
        workspace_id = callback[len("ws_pub_champ_"):]
        kind = "champion"
    elif callback.startswith("ws_pub_preview_"):
        workspace_id = callback[len("ws_pub_preview_"):]
        kind = "preview"
    else:
        await safe_answer_callback(query, "Неизвестная команда", show_alert=True)
        return

    try:
        result = await publish_workspace_leaderboard_post(context.bot, workspace_id=workspace_id, user_id=user_id, kind=kind)
    except (WorkspaceError, WorkspacePublishError) as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return

    await safe_answer_callback(query, f"✅ {'Preview sent' if kind == 'preview' else 'Published'}")

    if kind == 'preview':
        # Добавляем кнопки навигации в само сообщение с превью,
        # чтобы можно было вернуться к настройкам группы без прокрутки.
        try:
            await context.bot.edit_message_reply_markup(
                chat_id=user_id,
                message_id=result['messageId'],
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn.back_group", default="◀️ Back to group"), callback_data=f"workspace_open_{workspace_id}")],
                    [InlineKeyboardButton("◀️ Main menu", callback_data="back_to_main")],
                ]),
            )
        except Exception:
            pass
        # Основное сообщение с настройками группы не трогаем — оно остаётся без изменений.
    else:
        # Для публикаций в группу обновляем основное сообщение с настройками.
        await show_workspace_detail(query, user_id=user_id, workspace_id=workspace_id, edit=True, bot=context.bot)


# ============================================================
# GROUP DEEPLINK WRAPPERS
# ============================================================

async def _handle_group_deeplink(query, context):
    callback = query.data
    user_id = query.from_user.id
    if callback.startswith("group_play_"):
        workspace_id = callback[len("group_play_"):]
        text = f"🎮 Чтобы играть из группы, откройте бота в личном чате:\nhttps://t.me/{BOT_USERNAME}?start=group_{workspace_id}"
    elif callback.startswith("group_leaderboard_"):
        workspace_id = callback[len("group_leaderboard_"):]
        text = f"🏆 Таблица лидеров группы скоро появится здесь. Пока смотрите в боте:\nhttps://t.me/{BOT_USERNAME}?start=group_{workspace_id}"
    elif callback.startswith("group_giveaway_"):
        workspace_id = callback[len("group_giveaway_"):]
        text = f"🎁 Чтобы создать или войти в розыгрыш группы, откройте бота:\nhttps://t.me/{BOT_USERNAME}?start=group_{workspace_id}"
    else:
        return
    await safe_answer_callback(query)
    await query.message.reply_text(text, disable_web_page_preview=True)


# ============================================================
# REF LIST WRAPPER
# ============================================================
async def _handle_ref_list(query, context):
    await handle_ref_list(query, context)


# (словари перемещены в конец файла перед handle_callback_query)


async def _invoke_admin_callback_handler(handler, query, context, *, user_id: int, callback_data: str):
    """Invoke admin callback handlers through one guarded envelope.

    New admin handlers accept keyword-only `user_id` and `callback_data`.
    A few legacy admin handlers still read the actor/data from `query`; keep them
    routed through the same admin envelope without widening their call surface.
    """
    params = inspect.signature(handler).parameters
    kwargs = {}
    if "user_id" in params:
        kwargs["user_id"] = user_id
    if "callback_data" in params:
        kwargs["callback_data"] = callback_data
    result = handler(query, context, **kwargs)
    if asyncio.iscoroutine(result):
        return await result
    return result


async def _dispatch_admin_callback(query, context, *, user_id: int, callback_data: str) -> bool:
    handler = ADMIN_CALLBACK_EXACT_HANDLERS.get(callback_data)
    if handler is not None:
        if not await _enforce_admin_callback(query, user_id=user_id, callback_data=callback_data):
            return True
        await _invoke_admin_callback_handler(handler, query, context, user_id=user_id, callback_data=callback_data)
        return True
    for prefix, prefix_handler in ADMIN_CALLBACK_PREFIX_HANDLERS:
        if callback_data.startswith(prefix):
            if not await _enforce_admin_callback(query, user_id=user_id, callback_data=callback_data):
                return True
            await _invoke_admin_callback_handler(prefix_handler, query, context, user_id=user_id, callback_data=callback_data)
            return True
    return False


async def handle_wallet_telegram(query, context):
    """Handle Telegram Wallet (built-in) button click."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id

    try:
        from services.ton_connect import generate_telegram_wallet_url
        url = generate_telegram_wallet_url(user_id)

        if url:
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("📱 Open Telegram Wallet", url=url)],
                [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="wallet_open")]
            ])
            await safe_edit_message(query.message,
                "📱 <b>Telegram Wallet (built-in)</b>\n\n"
                "Tap the button below to connect your official Telegram Wallet.\n\n"
                "✅ Most convenient — works directly inside Telegram.\n"
                "No need to install anything extra!",
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard
            )
        else:
            await safe_edit_message(query.message,
                "❌ Could not generate Telegram Wallet link. Please try again later.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="wallet_open")]])
            )
    except Exception as e:
        logger.exception(f"handle_wallet_telegram error: {e}")
        await safe_edit_message(query.message,
            "❌ Error opening Telegram Wallet. Please try again.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="wallet_open")]])
        )


async def handle_wallet_open(query, context):
    """Open wallet management screen."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        from services.wallet_links import get_wallet_snapshot
        wallet = get_wallet_snapshot(user_id)
        balance = get_user_balance(user_id)
        if wallet.get("status") == "connected":
            text = (
                t("wallet.connected.title", default="🔗 <b>Your TON Wallet</b>") + "\n\n"
                + t("wallet.connected.status", default="<b>Status:</b> ✅ Connected") + "\n"
                + t("wallet.connected.address", default="<b>Address:</b> {addr}", addr=wallet.get("shortAddress", "n/a")) + "\n"
                + t("wallet.connected.balance", default="<b>Balance:</b> {balance}", balance=format_balance_display(balance)) + "\n\n"
                + t("wallet.connected.note", default="⚡️ <b>To deposit, use the “💰 Deposit” button below.</b>\nTON Connect is for withdrawals and future features.")
            )
            keyboard = [
                [
                    InlineKeyboardButton(t("btn.deposit", default="💰 Deposit"), callback_data="deposit"),
                    InlineKeyboardButton(t("btn.withdraw", default="💸 Withdraw"), callback_data="withdraw"),
                ],
                [InlineKeyboardButton(t("wallet.btn.disconnect", default="🔌 Disconnect"), callback_data="wallet_disconnect")],
                [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
            ]
        else:
            text = (
                t("wallet.disconnected.title", default="🔗 <b>Connect Your TON Wallet</b>") + "\n\n"
                + t("wallet.disconnected.why", default=(
                    "TON Connect is used for <b>withdrawing winnings</b> and future features.\n\n"
                    "<b>➕ Deposits are made ONLY through CryptoBot</b> (button below).\n\n"
                    "<b>Why connect your TON Wallet?</b>\n"
                    "• Withdraw prizes in future directly to your address\n"
                    "• Get access to future updates &amp; automation\n"
                    "• Better security &amp; control"
                ))
            )
            keyboard = [
                [InlineKeyboardButton(t("wallet.btn.connect", default="🔗 Connect TON Wallet"), callback_data="ton_connect_start")],
                [InlineKeyboardButton(t("btn.deposit", default="💰 Deposit"), callback_data="deposit")],
                [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
            ]
        await safe_edit_message(query.message, text,
            reply_markup=InlineKeyboardMarkup(keyboard), parse_mode=ParseMode.HTML)
    except Exception as e:
        logger.exception("Error opening wallet: %s", e)
        await query.answer("❌ Error loading wallet info.", show_alert=True)


async def handle_wallet_disconnect(query, context):
    """Disconnect the wallet"""
    await safe_answer_callback(query)
    user_id = query.from_user.id

    try:
        from services.wallet_links import unlink_wallet

        result = unlink_wallet(user_id=user_id)

        await query.answer("✅ Wallet disconnected", show_alert=False)
        await handle_wallet_open(query, context)
    except Exception as e:
        logger.exception("Error disconnecting wallet: %s", e)
        await query.answer(f"❌ Error: {str(e)}", show_alert=True)


async def handle_ton_connect_start(query, context):
    """Show multi-wallet choice and start Bridge SSE listener as background task."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        from services.ton_connect import create_connection_session, build_wallet_urls, listen_bridge_session
        session = create_connection_session(user_id)
        client_id = session.client_id
        privkey_bytes = bytes.fromhex(session.private_key_hex)
        wallets = build_wallet_urls(client_id, session.request_payload)

        # Start Bridge SSE listener — fires and forgets, notifies user when connected
        asyncio.create_task(
            listen_bridge_session(client_id, privkey_bytes, user_id, context.bot, timeout=180)
        )

        keyboard = [
            [InlineKeyboardButton(t("wallet.btn.telegram", default="📱 Telegram Wallet (built-in)"), url=wallets["telegram"])],
            [InlineKeyboardButton(t("wallet.btn.tonkeeper", default="🔗 Tonkeeper (recommended)"), url=wallets["tonkeeper"])],
            [InlineKeyboardButton(t("wallet.btn.tonhub", default="🔗 Tonhub"), url=wallets["tonhub"])],
            [InlineKeyboardButton(t("wallet.btn.mytonwallet", default="🔗 MyTonWallet"), url=wallets["mytonwallet"])],
            [InlineKeyboardButton(t("btn.back_main", default=t("btn.back", default="◀️ Back")), callback_data="wallet_open")],
        ]
        await safe_edit_message(query.message,
            t("wallet.connect.title",
              default=(
                  "🔐 <b>Connect your TON Wallet</b>\n\n"
                  "Choose your preferred wallet:\n\n"
                  "• <b>📱 Telegram Wallet</b> — most convenient (built into Telegram)\n"
                  "• <b>Tonkeeper</b> — most popular\n"
                  "• <b>Tonhub</b> — fast &amp; secure\n"
                  "• <b>MyTonWallet</b> — great for desktop\n\n"
                  "After connecting you'll be able to withdraw your winnings.\n\n"
                  "⏳ <i>This session is valid for 3 minutes.</i>"
              )),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(keyboard),
            disable_web_page_preview=True,
        )
    except Exception as e:
        logger.exception("Error in ton_connect_start: %s", e)
        await query.answer("❌ Error generating wallet links.", show_alert=True)


# ============================================================
# WRAPPER FUNCTIONS FOR CENTRALIZED ROUTING (PHASE 3)
# ============================================================

async def handle_deposit_callback(query, context):
    user_id = query.from_user.id
    allowed, error_text = _check_product_access(user_id, 'deposit')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(query.message,
        t("deposit.prompt", default="💸 Enter the deposit amount (minimum 0.1 GRAM).\nCryptoBot invoice fee: 3%."),
        reply_markup=get_back_button("balance", t=t)
    )
    user_states[user_id] = 'waiting_deposit_amount'

async def handle_withdraw_callback(query, context):
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from rate_limiter import _func_requests
    import time as _time
    _now = _time.time()
    _key = "handle_withdraw_callback"
    if _key not in _func_requests:
        _func_requests[_key] = {}
    if user_id not in _func_requests[_key]:
        _func_requests[_key][user_id] = []
    _func_requests[_key][user_id] = [ts for ts in _func_requests[_key][user_id] if _now - ts < 300]
    if len(_func_requests[_key][user_id]) >= 3:
        from services.i18n import get_translator
        t = context.user_data.get("t", get_translator("en"))
        await query.answer(t("rate_limit.withdraw_title", default="⏳ Withdrawal limit"), show_alert=True)
        await context.bot.send_message(
            chat_id=user_id,
            text=t("rate_limit.withdraw", default="⏳ Withdrawals are limited to 3 per 5 minutes. Please try again later."),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(
                t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")]]),
            parse_mode=ParseMode.HTML,
        )
        return
    _func_requests[_key][user_id].append(_now)
    allowed, error_text = _check_product_access(user_id, 'withdraw')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    active_game = get_active_game(user_id)
    if active_game:
        from services.i18n import get_translator
        t = context.user_data.get("t", get_translator("en"))
        await safe_answer_callback(query,
            t("withdraw.blocked_active_duel", default="❌ You cannot withdraw while an active duel is open. Finish it first."),
            show_alert=True)
        return
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    min_withdraw = float(get_effective_gram_withdrawal_minimum())
    await safe_edit_message(query.message,
        t("withdraw.prompt", default="💸 Enter the withdrawal amount. Minimum — {min} GRAM.\nWithdrawals are sent back to your CryptoBot balance.",
          min=f"{min_withdraw:.1f}"),
        reply_markup=get_back_button("balance", t=t)
    )
    user_states[user_id] = 'waiting_withdraw_amount'

async def handle_help_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(query.message,
        render_help_text(t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_help_keyboard(t=t),
    )


async def handle_community_callback(query, context):
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    lang = getattr(t, "lang", "en")
    await safe_edit_message(
        query.message,
        render_community_text(t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_community_keyboard(lang=lang, t=t),
        disable_web_page_preview=True,
    )

async def handle_money_flow_callback(query, context):
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(query.message,
        t("screen.help.money_flow_text",
          default=(
              "💸 <b>How do deposits &amp; withdrawals work?</b>\n\n"
              "• <b>Deposit (top-up):</b> Only via CryptoBot invoice. You pay the invoice, funds appear on your Roll Duel balance.\n\n"
              "• <b>Withdrawal:</b> Sent to your CryptoBot balance automatically.\n"
              "  If you connect a TON wallet via TON Connect, direct wallet withdrawals will be available in a future update.\n\n"
              "• Always use the <b>Deposit</b> button — never transfer GRAM directly to any address yourself!\n\n"
              "After depositing via CryptoBot, your balance is available for duels immediately."
          )),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.back_main", default=t("btn.back_help", default="◀️ Back to Help")), callback_data="help")]
        ])
    )

async def handle_support_callback(query, context):
    """Entry point — shows support screen without silently opening input state."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    open_ticket = _get_user_open_ticket(user_id)
    if open_ticket:
        ticket_id = int(open_ticket["ticket_id"])
        user_states[user_id] = f"support_open:{ticket_id}"
        await safe_edit_message(
            query.message,
            _render_ticket_continuation_text(ticket_id, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_support_active_keyboard(ticket_id, t=t),
        )
    else:
        user_states.pop(user_id, None)
        await safe_edit_message(
            query.message,
            _render_support_entry_text(t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_support_entry_keyboard(t=t),
        )


async def handle_support_open_callback(query, context):
    """Start new support ticket input after user explicitly taps Open ticket."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    open_ticket = _get_user_open_ticket(user_id)
    if open_ticket:
        ticket_id = int(open_ticket["ticket_id"])
        user_states[user_id] = f"support_open:{ticket_id}"
        await safe_edit_message(
            query.message,
            _render_ticket_continuation_text(ticket_id, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_support_active_keyboard(ticket_id, t=t),
        )
        return
    user_states[user_id] = "waiting_support_message"
    await safe_edit_message(
        query.message,
        t("support.ticket.new_message_prompt", default="💬 <b>New support request</b>\n\nSend one clear message with the issue details, or go back to the main menu."),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")]]),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: helper functions
# ─────────────────────────────────────────────────────────────────────────────

def _render_support_entry_text(t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return t("support.entry.text", default=(
        "🆘 <b>Поддержка</b>\n\n"
        "Отправьте <b>одно понятное сообщение</b>:\n"
        "• какая проблема возникла;\n"
        "• на каком экране вы были;\n"
        "• что ожидали увидеть.\n\n"
        "Когда поддержка ответит, просто напишите сюда следующее сообщение — оно продолжит то же обращение."
    ))


def _render_ticket_continuation_text(ticket_id: int, t=None) -> str:
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    return t(
        "support.ticket.open_text",
        default=(
            "💬 <b>Ticket #{ticket_id} is open</b>\n\n"
            "Send a message to add more details, or close the ticket if your issue is resolved."
        ),
        ticket_id=ticket_id,
    )


def _get_user_open_ticket(user_id: int):
    """Return the most recent open ticket for a user, or None."""
    try:
        with get_connection() as conn:
            return conn.execute(
                "SELECT ticket_id FROM support_tickets WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1",
                (user_id,),
            ).fetchone()
    except Exception:
        return None


def _get_ticket_owner(ticket_id: int) -> int | None:
    """Return user_id that owns this ticket, or None."""
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT user_id FROM support_tickets WHERE ticket_id = ?", (ticket_id,)
            ).fetchone()
        return int(row["user_id"]) if row else None
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: create new ticket
# ─────────────────────────────────────────────────────────────────────────────

async def handle_new_support_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Called from handle_message when user is in waiting_support_message state."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    text = (update.message.text or "").strip()
    if not text:
        await update.message.reply_text(t("support.ticket.empty_message", default="❌ Please send a non-empty message."))
        user_states[user.id] = "waiting_support_message"
        return

    # Create ticket + first message in DB
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO support_tickets (user_id) VALUES (?)", (user.id,))
            ticket_id = cur.lastrowid
            cur.execute(
                "INSERT INTO support_messages (ticket_id, author_type, author_id, text) VALUES (?, 'user', ?, ?)",
                (ticket_id, user.id, text),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Failed to create support ticket for user %s: %s", user.id, exc)
        await update.message.reply_text(t("support.ticket.error_create", default="❌ Не удалось создать обращение. Попробуйте позже."))
        return

    # Forward to support chat
    support_tg_msg_id = None
    if SUPPORT_CHAT_ID:
        header = _format_ticket_for_support_chat(ticket_id, user, text, is_new=True)
        try:
            sent = await context.bot.send_message(
                chat_id=SUPPORT_CHAT_ID,
                text=header,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(t("support.ticket.operator_close_btn", default="🔒 Закрыть обращение"), callback_data=f"ticket_close_{ticket_id}"),
                ]]),
            )
            support_tg_msg_id = sent.message_id
            # Store the support-chat message_id so followups can thread-reply to it
            with get_connection() as conn:
                conn.execute(
                    "UPDATE support_tickets SET support_msg_id = ? WHERE ticket_id = ?",
                    (support_tg_msg_id, ticket_id),
                )
                conn.commit()
        except Exception as exc:
            logger.exception("Failed to forward ticket #%s to support chat: %s", ticket_id, exc)
    else:
        logger.warning("SUPPORT_CHAT_ID not set — ticket #%s not forwarded", ticket_id)

    user_states[user.id] = f"support_open:{ticket_id}"
    await update.message.reply_text(
        t("support.ticket.created", default="✅ <b>Ticket #{ticket_id} created.</b>\n\nSupport will reply soon. You can send more details here anytime.", ticket_id=ticket_id),
        parse_mode=ParseMode.HTML,
        reply_markup=get_support_active_keyboard(ticket_id, t=t),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: user follow-up on existing ticket
# ─────────────────────────────────────────────────────────────────────────────

async def handle_support_followup(update: Update, context: ContextTypes.DEFAULT_TYPE, ticket_id: int):
    """Called from handle_message when user is in support_open:<id> state."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    text = (update.message.text or "").strip()
    if not text:
        return

    try:
        with get_connection() as conn:
            # Verify ticket still belongs to this user and is open
            row = conn.execute(
                "SELECT status, support_msg_id FROM support_tickets WHERE ticket_id = ? AND user_id = ?",
                (ticket_id, user.id),
            ).fetchone()
            if not row:
                user_states.pop(user.id, None)
                await update.message.reply_text(t("support.ticket.not_found", default="❌ Ticket not found. Start a new one via Support."))
                return
            if row["status"] != "open":
                user_states.pop(user.id, None)
                await update.message.reply_text(
                    t("support.ticket.already_closed", default="Ticket #{ticket_id} is already closed. Use Support to open a new one.", ticket_id=ticket_id),
                    reply_markup=get_support_entry_keyboard(t=t),
                )
                return
            support_root_msg_id = row["support_msg_id"]
            conn.execute(
                "INSERT INTO support_messages (ticket_id, author_type, author_id, text) VALUES (?, 'user', ?, ?)",
                (ticket_id, user.id, text),
            )
            conn.execute(
                "UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                (ticket_id,),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Failed to save followup for ticket #%s: %s", ticket_id, exc)
        await update.message.reply_text(t("support.ticket.error_send", default="❌ Не удалось отправить сообщение. Попробуйте ещё раз."))
        return

    # Forward followup to support chat as a threaded reply
    if SUPPORT_CHAT_ID:
        followup_text = (
            f"📩 <b>Обращение / Ticket #{ticket_id}</b> — новое сообщение от пользователя\n"
            f"От: {escape(user.first_name or '—')} (@{escape(user.username or '—')})\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"{escape(text)}"
        )
        try:
            kwargs: dict = {"chat_id": SUPPORT_CHAT_ID, "text": followup_text, "parse_mode": ParseMode.HTML}
            if support_root_msg_id:
                kwargs["reply_to_message_id"] = support_root_msg_id
            await context.bot.send_message(**kwargs)
        except Exception as exc:
            logger.exception("Failed to forward followup for ticket #%s: %s", ticket_id, exc)

    await update.message.reply_text(
        t("support.ticket.message_added", default="✅ Message added to ticket."),
        reply_markup=get_support_active_keyboard(ticket_id, t=t),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: operator replies from the support group chat
# ─────────────────────────────────────────────────────────────────────────────

async def handle_support_chat_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles operator replies inside SUPPORT_CHAT_ID via reply to a ticket card."""
    msg = update.message
    if not msg or not msg.reply_to_message:
        return

    # Extract ticket_id from the original bot message text (e.g. "Ticket #42")
    import re
    source_text = msg.reply_to_message.text or msg.reply_to_message.caption or ""
    match = re.search(r"(?:[Tt]icket|Обращение) #(\d+)", source_text)
    if not match:
        return  # reply to something unrelated — ignore silently

    ticket_id = int(match.group(1))
    reply_text = (msg.text or "").strip()
    if not reply_text:
        return

    operator_id = msg.from_user.id if msg.from_user else 0

    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT user_id, status FROM support_tickets WHERE ticket_id = ?",
                (ticket_id,),
            ).fetchone()
            if not row:
                await msg.reply_text(f"❌ Обращение #{ticket_id} не найдено в базе.")
                return
            if row["status"] != "open":
                await msg.reply_text(f"⚠️ Обращение #{ticket_id} уже закрыто.")
                return
            user_id = int(row["user_id"])
            t = get_t(user_id)
            conn.execute(
                "INSERT INTO support_messages (ticket_id, author_type, author_id, text) VALUES (?, 'operator', ?, ?)",
                (ticket_id, operator_id, reply_text),
            )
            conn.execute(
                "UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                (ticket_id,),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("DB error saving operator reply for ticket #%s: %s", ticket_id, exc)
        await msg.reply_text(f"❌ DB error: {exc}")
        return

    # Deliver reply to the user in their private chat with the bot
    try:
        await context.bot.send_message(
            chat_id=user_id,
            text=(
                f"💬 <b>Ответ поддержки — обращение #{ticket_id}</b>\n\n"
                f"{escape(reply_text)}"
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_support_active_keyboard(ticket_id, t=t),
        )
        await msg.reply_text(f"✅ Ответ по обращению #{ticket_id} доставлен пользователю {user_id}.")
    except Exception as exc:
        logger.exception("Failed to deliver reply for ticket #%s to user %s: %s", ticket_id, user_id, exc)
        await msg.reply_text(f"❌ Не удалось доставить ответ пользователю {user_id}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: close (operator presses button in support chat)
# ─────────────────────────────────────────────────────────────────────────────

async def handle_ticket_close_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Operator closes ticket from the support chat button. Accepts Update or CallbackQuery from central router."""
    query = update.callback_query if hasattr(update, "callback_query") else update
    ticket_id = int((query.data or "").replace("ticket_close_", ""))
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT user_id, status FROM support_tickets WHERE ticket_id = ?", (ticket_id,)
            ).fetchone()
            if not row:
                await safe_answer_callback(query, "Обращение не найдено.", show_alert=True)
                return
            if row["status"] == "closed":
                await safe_answer_callback(query, "Уже закрыто.", show_alert=False)
                return
            user_id = int(row["user_id"])
            t = get_t(user_id)
            conn.execute(
                "UPDATE support_tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                (ticket_id,),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Failed to close ticket #%s: %s", ticket_id, exc)
        await safe_answer_callback(query, "Ошибка базы данных.", show_alert=True)
        return

    await safe_answer_callback(query, t("support.ticket.closed_short", default="Ticket #{ticket_id} closed.", ticket_id=ticket_id))
    # Remove the Close button from the support card
    try:
        await query.message.edit_reply_markup(reply_markup=None)
        await query.message.reply_text(f"🔒 Обращение #{ticket_id} закрыто оператором.")
    except Exception:
        pass
    # Notify the user
    try:
        # Clear their active ticket state
        if user_states.get(user_id, "").startswith(f"support_open:{ticket_id}"):
            user_states.pop(user_id, None)
        user_t = get_t(user_id)
        await context.bot.send_message(
            chat_id=user_id,
            text=user_t("support.ticket.closed_by_support_text", default="✅ <b>Ticket #{ticket_id} has been closed by support.</b>\n\nIf you have a new issue, tap Support to open a new ticket.", ticket_id=ticket_id),
            parse_mode=ParseMode.HTML,
            reply_markup=get_support_entry_keyboard(t=user_t),
        )
    except Exception as exc:
        logger.warning("Could not notify user %s about ticket #%s close: %s", user_id, ticket_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: user closes their own ticket
# ─────────────────────────────────────────────────────────────────────────────

async def handle_ticket_user_close_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User closes their own open ticket via button in bot chat. Accepts Update or CallbackQuery from central router."""
    query = update.callback_query if hasattr(update, "callback_query") else update
    ticket_id = int((query.data or "").replace("ticket_user_close_", ""))
    user_id = query.from_user.id
    try:
        with get_connection() as conn:
            conn.execute(
                "UPDATE support_tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ? AND user_id = ?",
                (ticket_id, user_id),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Failed to close ticket #%s by user: %s", ticket_id, exc)

    user_states.pop(user_id, None)
    await safe_answer_callback(query, get_t(user_id)("support.ticket.closed_short", default="Ticket closed."))
    await safe_edit_message(
        query.message,
        get_t(user_id)("support.ticket.closed_by_user_text", default="🔒 Ticket #{ticket_id} closed. Open a new one any time via Support.", ticket_id=ticket_id),
        parse_mode=ParseMode.HTML,
        reply_markup=get_support_entry_keyboard(t=get_t(user_id)),
    )
    # Notify support chat
    if SUPPORT_CHAT_ID:
        try:
            await context.bot.send_message(
                chat_id=SUPPORT_CHAT_ID,
                text=f"🔒 Обращение #{ticket_id} закрыто пользователем.",
            )
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Support ticket: helpers for formatting
# ─────────────────────────────────────────────────────────────────────────────

def _format_ticket_for_support_chat(ticket_id: int, user, text: str, *, is_new: bool) -> str:
    from datetime import timezone
    now = datetime.now(timezone.utc)
    title = "🆕 <b>Новое обращение" if is_new else "📩 <b>Обращение"
    return (
        f"{title} / Ticket #{ticket_id}</b>\n"
        f"От: {escape(user.first_name or '—')} (@{escape(user.username or '—')})\n"
        f"User ID: <code>{user.id}</code>\n"
        f"Время: {now:%Y-%m-%d %H:%M} UTC\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"{escape(text)}\n\n"
        f"<i>💡 Ответьте на это сообщение, чтобы ответить пользователю.</i>"
    )



async def handle_back_to_main(query, context):
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    chat_id = query.message.chat_id
    msg_id = query.message.message_id

    now = time.time()
    last_dice = context.user_data.get("last_dice_menu_ts", 0)

    if now - last_dice >= 900:
        try:
            await context.bot.delete_message(chat_id, msg_id)
        except Exception:
            pass

        await context.bot.send_dice(chat_id, emoji='🎲')
        await asyncio.sleep(1.2)
        context.user_data["last_dice_menu_ts"] = now

        await context.bot.send_message(
            chat_id=chat_id,
            text=render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    else:
        await safe_edit_message(
            query.message,
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
async def handle_notice_open_callback(query, context):
    await safe_answer_callback(query)
    await _callback_notice_open(query, context, user_id=query.from_user.id)


async def handle_giveaway_dashboard(query, context):
    """Owner-facing giveaway management entry point."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    t = context.user_data.get("t") or get_t(user_id)
    try:
        overviews = list_giveaway_workspace_overview(user_id)
    except Exception as exc:
        logger.exception("giveaway_dashboard_failed user_id=%s: %s", user_id, exc)
        await safe_answer_callback(query, t("giveaway.dashboard.error", default="❌ Не удалось открыть управление розыгрышами."), show_alert=True)
        return
    await safe_edit_message(
        query.message,
        render_giveaway_dashboard_text(overviews, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_dashboard_keyboard(overviews, t=t),
        disable_web_page_preview=True,
    )


async def _handle_giveaway_group_dashboard(query, context):
    await safe_answer_callback(query)
    user_id = query.from_user.id
    t = context.user_data.get("t") or get_t(user_id)
    workspace_id = query.data.replace("giveaway_group_", "", 1)
    try:
        overviews = list_giveaway_workspace_overview(user_id)
        overview = next((item for item in overviews if str(item.get("workspace_id")) == str(workspace_id)), None)
        if not overview:
            raise GiveawayError("workspace_not_found", "Workspace not found.", 404)
        rows = list_workspace_giveaway_history(owner_user_id=user_id, workspace_id=workspace_id, limit=1)
        current = rows[0] if rows else None
    except Exception as exc:
        logger.exception("giveaway_group_dashboard_failed workspace_id=%s: %s", workspace_id, exc)
        await safe_answer_callback(query, t("giveaway.dashboard.error", default="❌ Не удалось открыть управление розыгрышами."), show_alert=True)
        return
    await safe_edit_message(
        query.message,
        render_giveaway_group_dashboard_text(overview, current, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_group_dashboard_keyboard(workspace_id, str(current.get("giveaway_id")) if current else None, t=t),
        disable_web_page_preview=True,
    )


async def _handle_giveaway_history(query, context):
    await safe_answer_callback(query)
    user_id = query.from_user.id
    t = context.user_data.get("t") or get_t(user_id)
    data = str(query.data or "")
    if data.startswith("gh_"):
        raw = data.replace("gh_", "", 1)
    else:
        raw = data.replace("giveaway_history_", "", 1)
    page = 0
    status_filter = "all"
    workspace_id = raw
    if "__f" in raw:
        workspace_id, rest = raw.split("__f", 1)
        if "__p" in rest:
            filter_raw, _, page_raw = rest.partition("__p")
        else:
            filter_raw, page_raw = rest, "0"
        status_filter = (filter_raw or "all").strip().lower()
        try:
            page = max(0, int(page_raw or 0))
        except ValueError:
            page = 0
    elif "__p" in raw:
        workspace_id, _, page_raw = raw.rpartition("__p")
        try:
            page = max(0, int(page_raw or 0))
        except ValueError:
            page = 0
    if status_filter not in {"all", "active", "draft", "finished", "cancelled"}:
        status_filter = "all"
    page_size = 7
    try:
        overviews = list_giveaway_workspace_overview(user_id)
        overview = next((item for item in overviews if str(item.get("workspace_id")) == str(workspace_id)), None)
        workspace_title = str((overview or {}).get("title") or t("workspace.untitled", default="Группа"))
        fetched = list_workspace_giveaway_history(owner_user_id=user_id, workspace_id=workspace_id, limit=page_size + 1, offset=page * page_size, status_filter=status_filter)
        has_more = len(fetched) > page_size
        rows = fetched[:page_size]
    except Exception as exc:
        logger.exception("giveaway_history_failed workspace_id=%s: %s", workspace_id, exc)
        await safe_answer_callback(query, t("giveaway.history.error", default="❌ Не удалось открыть историю розыгрышей."), show_alert=True)
        return
    await safe_edit_message(
        query.message,
        render_giveaway_history_text(workspace_title, rows, t=t, page=page, page_size=page_size, has_more=has_more, status_filter=status_filter),
        parse_mode=ParseMode.HTML,
        reply_markup=get_giveaway_history_keyboard(workspace_id, rows, t=t, page=page, has_more=has_more, status_filter=status_filter),
        disable_web_page_preview=True,
    )


async def handle_connect_how_to(query, context):
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    text = t("workspace.how_to_connect",
        default=(
            "👥 <b>How to connect a group</b>\n\n"
            "1️⃣ Add @rollduelbot to your Telegram group and make it an administrator.\n\n"
            "2️⃣ Come back to this chat and press <b>➕ Connect Group</b> to get a one‑time token.\n\n"
            "3️⃣ Send that token inside the group chat to finish the connection."
        ))
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("workspace.btn.back_chats", default="◀️ Back to My Chats"), callback_data="my_chats")]
    ])
    await query.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=keyboard)

# 👇 ЗДЕСЬ, БЕЗ ОТСТУПА, ВСТАВЬТЕ НОВУЮ ФУНКЦИЮ
async def handle_my_chats_callback(query, context):
    """Show the list of connected workspaces (My Chats)."""
    await safe_answer_callback(query)
    await show_workspace_list(query, user_id=query.from_user.id, edit=True)

async def handle_workspace_connect_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    payload = create_connect_request(user_id)
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        render_workspace_connect_text(payload, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_workspace_connect_keyboard(t=t),
    )

async def handle_invite_main(query, context):
    """Canonical Invite Friends screen — single entry point for all sharing flows."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.referrals import get_referral_snapshot, get_referral_dashboard
    snapshot = get_referral_snapshot(user_id)
    try:
        dashboard = get_referral_dashboard(user_id)
        snapshot["invitedCount"] = dashboard.get("total_invited", 0)
        snapshot["activatedCount"] = dashboard.get("active_invited", 0)
    except Exception:
        pass
    await safe_edit_message(
        query.message,
        render_invite_main_text(snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=get_invite_main_keyboard(t=t),
        disable_web_page_preview=True,
    )


async def handle_invite_show_link(query, context):
    """Show link screen — clean, just the link to copy + Back."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.referrals import get_referral_snapshot
    snapshot = get_referral_snapshot(user_id)
    invite_link = str(snapshot.get("inviteLink") or "").strip()
    if not invite_link:
        await safe_answer_callback(query, "❌ Invite link is not ready yet.", show_alert=True)
        return
    await safe_edit_message(
        query.message,
        render_invite_link_text(snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="invite_main")],
        ]),
        disable_web_page_preview=True,
    )


async def handle_invite_show_short_link(query, context):
    """Show short invite link (t.me/...) without preview."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.referrals import get_referral_snapshot
    snapshot = get_referral_snapshot(user_id)
    short_link = snapshot.get("botDeepLink") or f"https://t.me/{BOT_USERNAME}?start=i_{snapshot.get('inviteCode')}"
    if not short_link:
        await safe_answer_callback(query, "❌ Invite link is not ready yet.", show_alert=True)
        return
    await safe_edit_message(
        query.message,
        t("invite.short_link_screen", default="🔗 <b>Your short invite link</b>\n\n<code>{link}</code>\n\nUse this link in Twitter, DM, or any place where you need a short URL.", link=escape(short_link)),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="invite_main")]]),
        disable_web_page_preview=True,
    )


async def handle_invite_send_card(query, context):
    """Get invite card — forwardable card. Join button goes to bot deep link."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.referrals import get_referral_snapshot
    snapshot = get_referral_snapshot(user_id)
    bot_deep_link = str(snapshot.get("botDeepLink") or snapshot.get("inviteLink") or "").strip()
    if not bot_deep_link:
        await safe_answer_callback(query, "❌ Invite link is not ready yet.", show_alert=True)
        return
    await safe_edit_message(
        query.message,
        render_invite_card_text(snapshot, t=t),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.join_roll_duel", default="🎲 Join Roll Duel"), url=bot_deep_link)],
            [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="invite_main")],
        ]),
        disable_web_page_preview=False,
    )

async def handle_wallet_info_callback(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    await safe_edit_message(query.message,
        t("wallet.info.text", default=(
            "ℹ️ <b>Как работают депозиты и выводы</b>\n\n"
            "• <b>CryptoBot</b> — пополнение баланса Roll Duel. Вы оплачиваете счёт, и GRAM зачисляется во внутренний баланс бота.\n\n"
            "• <b>TON Connect</b> — подключение вашего TON-кошелька для будущих прямых выводов и дополнительных функций.\n\n"
            "<b>⚠️ Прямые депозиты через TON Connect пока не поддерживаются.</b>\n\n"
            "После пополнения через CryptoBot вы можете играть и выводить доступный баланс по правилам платформы."
        )),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data="back_to_main")]])
    )

async def _handle_join_game_safe(query, context):
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await safe_answer_callback(query)
        await safe_edit_message(
            query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
        )
        return
    await handle_join_game_request(query, context)

async def _handle_workspace_open(query, context):
    await safe_answer_callback(query)
    workspace_id = query.data.replace("workspace_open_", "", 1)
    await show_workspace_detail(query, user_id=query.from_user.id, workspace_id=workspace_id, edit=True, bot=context.bot)

async def _handle_giveaway_open(query, context):
    workspace_id = query.data.replace("giveaway_open_", "", 1)
    await safe_answer_callback(query)
    await show_giveaway_detail(query, user_id=query.from_user.id, workspace_id=workspace_id, edit=True)

async def _handle_giveaway_create(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t") or get_t(query.from_user.id) or get_translator("en")
    workspace_id = query.data.replace("giveaway_create_", "", 1)
    user_id = query.from_user.id
    try:
        existing = get_workspace_giveaway_for_owner(owner_user_id=user_id, workspace_id=workspace_id)
        existing_status = str((existing or {}).get("status") or "").upper()
        if existing and existing_status == "ACTIVE":
            raise GiveawayError("active_giveaway_exists", "Only one active giveaway is allowed per group.", 409)
        if existing and existing_status == "DRAFT":
            created = existing
        else:
            created = create_giveaway_draft(
                owner_user_id=user_id,
                workspace_id=workspace_id,
                title=t("giveaway.default_title", default="New giveaway"),
                prize_text=t("giveaway.default_prize", default="Set the prize"),
                winners_count=1,
                starts_at=None,
                ends_at=None,
            )
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query, t("giveaway.toast.draft_created", default="Draft created"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=str(created["giveaway_id"]), edit=True)

async def _handle_gw_back(query, context):
    giveaway_id = query.data.replace("gw_back_", "", 1)
    user_states.pop(query.from_user.id, None)
    await safe_answer_callback(query)
    await show_giveaway_detail(query, user_id=query.from_user.id, giveaway_id=giveaway_id, edit=True)

# Остальные gw_* обёртки реализуй аналогично (по необходимости)

async def _handle_bet_select_back(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    user_states.pop(user_id, None)
    duel_format = _selected_duel_format(context)
    await safe_edit_message(
        query.message,
        _duel_stake_prompt(duel_format, t=t),
        reply_markup=get_bet_amount_keyboard(
            user_id=user_id,
            t=t,
            back_callback="duel_format_menu" if _bo3_enabled() else "back_to_main",
        ),
        parse_mode=ParseMode.HTML,
    )

async def handle_main_menu(query, context):
    """Show the classic main menu."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(query.message,
        render_main_menu_text(query.from_user.id, t=t),
        reply_markup=_main_menu_markup(query.from_user.id, t=t),
        parse_mode=ParseMode.HTML,
    )

async def handle_create_game(query, context):
    """Start the classic create-duel flow."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    allowed, error_text = _check_product_access(query.from_user.id, 'duel')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    active_kind, active_game = _get_active_duel_context(query.from_user.id)
    if active_kind:
        await safe_edit_message(
            query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    min_stake = float(platform_settings.get_float('min_stake_ton'))
    if get_user_balance(query.from_user.id) < min_stake:
        await safe_edit_message(
            query.message,
            render_insufficient_balance_text(
                query.from_user.id,
                required_amount=min_stake,
                action_label="start a real duel",
            ),
            reply_markup=get_insufficient_balance_keyboard(
                t=t,
                demo_mode_enabled=_is_demo_mode_enabled(),
            ),
            parse_mode=ParseMode.HTML,
        )
        return

    context.user_data["duel_format"] = DUEL_FORMAT_SINGLE
    if _bo3_enabled():
        await handle_duel_format_menu(query, context)
    else:
        await safe_edit_message(
            query.message,
            _duel_stake_prompt(DUEL_FORMAT_SINGLE, t=t),
            reply_markup=get_bet_amount_keyboard(t=t),
            parse_mode=ParseMode.HTML,
        )

@rate_limit(max_calls=10, period=60)  # 10 bets per minute
async def handle_bet_selection(query, context):
    """Обработать выбор ставки"""
    user_id = query.from_user.id
    callback_data = query.data
    from services.i18n import get_translator as _get_translator
    t = context.user_data.get("t", _get_translator("en"))
    duel_format = _selected_duel_format(context)
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _bo3_enabled():
        duel_format = DUEL_FORMAT_SINGLE
        context.user_data["duel_format"] = duel_format
    # Получаем баланс пользователя
    balance = get_user_balance(user_id)
    if callback_data == "bet_all":
        bet_amount = balance
    elif callback_data == "bet_custom":
        user_states[user_id] = "waiting_custom_bet"
        min_stake = float(platform_settings.get_float('min_stake_ton'))
        max_stake = float(platform_settings.get_float('max_stake_ton'))
        await safe_edit_message(query.message,
            t("bet.custom_prompt", default="✏️ Enter a custom stake from <b>{min} to {max} GRAM</b>.", min=f"{min_stake:.1f}", max=f"{max_stake:.0f}"),
            reply_markup=get_back_button("bet_select", t=t),
            parse_mode=ParseMode.HTML
        )
        return

    elif callback_data == "bet_select":
        # Пользователь нажал "Back" при вводе кастомной ставки
        user_states.pop(user_id, None)
        await safe_edit_message(
            query.message,
            _duel_stake_prompt(duel_format, t=t),
            reply_markup=get_bet_amount_keyboard(
                user_id=user_id,
                t=t,
                back_callback="duel_format_menu" if _bo3_enabled() else "back_to_main",
            ),
            parse_mode=ParseMode.HTML,
        )
        return
    else:
        bet_amount = float(callback_data.replace("bet_", ""))
    is_valid, error_message = validate_bet_amount(bet_amount, balance, t=t)
    if not is_valid:
        if bet_amount > balance:
            await safe_edit_message(query.message,
                render_insufficient_balance_text(user_id, required_amount=bet_amount, action_label="create this real duel"),
                reply_markup=get_insufficient_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
                parse_mode=ParseMode.HTML,
            )
        else:
            await safe_edit_message(query.message,
                f"❌ {error_message}",
                reply_markup=get_bet_amount_keyboard(t=t)
            )
        return
    # Создаем игру через truth-layer reservation flow
    # Persist stake for Quick Duel re-use
    context.user_data["last_bet_amount"] = bet_amount
    try:
        save_last_bet(user_id, bet_amount)
    except Exception:
        pass
    create_result = create_game_with_reservation(
        user_id,
        bet_amount,
        publish_community=True,
        duel_format=duel_format,
    )
    if not create_result.get('ok'):
        if create_result.get('error') == 'Insufficient available balance':
            await safe_edit_message(query.message,
                render_insufficient_balance_text(user_id, required_amount=bet_amount, action_label="create this real duel"),
                reply_markup=get_insufficient_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
                parse_mode=ParseMode.HTML,
            )
        else:
            await safe_edit_message(query.message,
                f"❌ {create_result.get('error', 'Could not create the duel.')}",
                reply_markup=get_bet_amount_keyboard(t=t)
            )
        return
    game_id = create_result['game_id']
    success_text = t(
        "duel.created_with_format",
        default=(
            "✅ <b>Duel created.</b>\n\n"
            "🎲 Duel ID: {game_id}\n"
            "🎮 Format: <b>{format}</b>\n"
            "💰 Stake: {amount} GRAM for the entire match\n"
            "⏳ Another player can join for <b>15 minutes</b>.\n"
            "💸 If nobody joins, your stake is returned automatically.\n\n"
        ),
        game_id=game_id,
        format=_duel_format_label(duel_format, t=t),
        amount=f"{bet_amount:.2f}",
    )
    success_text += get_random_game_message(t=t)
    msg = await safe_edit_message(query.message,
        success_text,
        reply_markup=get_game_created_keyboard(game_id, get_duel_share_payload(game_id=game_id, user_id=user_id), t=t),
        parse_mode=ParseMode.HTML
    )
    # Сохраняем message_id сообщения с комнатой
    set_room_message_id(game_id, msg.message_id)
    publish_result = await publish_open_duel_to_default_workspace(context.bot, owner_user_id=user_id, game_id=game_id)
    if publish_result.get('ok'):
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=t("duel.create.published", default="👥 Duel published to your default group. Message #{message_id}.", message_id=publish_result['messageId']),
            )
        except Exception as e:
            logger.exception(f"Failed to send duel published notification to user {user_id}: {e}")


def _get_matchmaking_activity_snapshot() -> dict:
    """Return lightweight live lobby counters for UX only.

    This is intentionally read-only and must not affect matchmaking decisions.
    """
    conn = get_connection()
    try:
        waiting_row = conn.execute(
            "SELECT COUNT(*) AS c FROM games WHERE status = 'waiting'"
        ).fetchone()
        active_row = conn.execute(
            "SELECT COUNT(*) AS c FROM games WHERE status IN ('active', 'settling')"
        ).fetchone()

        def _count(row) -> int:
            if not row:
                return 0
            try:
                return int(row["c"])
            except Exception:
                return int(row[0])

        return {
            "waiting": _count(waiting_row),
            "active": _count(active_row),
        }
    except Exception as exc:
        logger.warning("matchmaking activity snapshot failed: %s", exc)
        return {"waiting": 0, "active": 0}
    finally:
        conn.close()


async def handle_find_game(query, context):
    """Open the live matchmaking lobby screen."""
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    allowed, error_text = _check_product_access(user_id, 'duel_find')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await safe_edit_message(query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    waiting_games = get_waiting_games()
    visible_waiting_games = [g for g in waiting_games if g.get("player1_id") != user_id]
    activity = _get_matchmaking_activity_snapshot()

    title = t("find_duel.title", default="🎲 <b>Find a Duel</b>")
    summary = t(
        "find_duel.summary",
        default="⚔️ Open duels: <b>{waiting}</b>\n🎮 Games in progress: <b>{active}</b>",
        waiting=activity["waiting"],
        active=activity["active"],
    )
    if visible_waiting_games:
        body = t(
            "find_duel.intro_with_games",
            default="Choose an open duel below, or start a quick duel and let the bot find an opponent for you.",
        )
        text = f"{title}\n\n{summary}\n\n{body}\n\n{t('find_duel.open_duels', default='Open duels:')}"
    else:
        body = t(
            "find_duel.empty",
            default=(
                "🎲 Nobody is waiting for an opponent right now.\n\n"
                "Start a quick duel — another player can join when they enter.\n"
                "Or challenge a friend directly with a private link."
            ),
        )
        hint = t(
            "find_duel.hint",
            default="Quick Duel = automatic opponent search.\nChallenge Friend = private invite link.",
        )
        text = f"{title}\n\n{summary}\n\n{body}\n\n<i>{hint}</i>"

    await safe_edit_message(query.message,
        text,
        reply_markup=get_waiting_games_keyboard(waiting_games, user_id, t=t),
        parse_mode=ParseMode.HTML,
    )


async def handle_rematch(query, context):
    """Challenge the same verified opponent with the original stake and format."""
    await safe_answer_callback(query)
    user_id = int(query.from_user.id)
    t = get_t(user_id)

    parts = query.data.split("_", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        await query.message.reply_text(t("error.generic", default="❌ Invalid rematch request."))
        return
    orig_game_id = int(parts[1])

    try:
        import database as _db
        conn = _db.get_connection()
        ph = "%s" if _db.using_postgres() else "?"
        try:
            row = conn.execute(
                f"""
                SELECT game_id, player1_id, player2_id, bet_amount, status, duel_format
                FROM games
                WHERE game_id = {ph}
                """,
                (orig_game_id,),
            ).fetchone()
        finally:
            conn.close()
    except Exception as exc:
        logger.exception("handle_rematch: DB lookup failed for game %s: %s", orig_game_id, exc)
        await query.message.reply_text(t("error.generic", default="❌ Could not load game data."))
        return

    if not row:
        await query.message.reply_text(t("error.generic", default="❌ Game not found."))
        return

    game = dict(row)
    p1_id = int(game.get("player1_id") or 0)
    p2_id = int(game.get("player2_id") or 0)
    status = str(game.get("status") or "")
    if user_id not in (p1_id, p2_id):
        logger.warning("handle_rematch: user %s tried game %s without participation", user_id, orig_game_id)
        await query.message.reply_text(t("error.generic", default="❌ You did not play in this game."))
        return
    if status not in {"finished", "completed", "cancelled", "settled", "timed_out"}:
        await query.message.reply_text(t("rematch.not_finished", default="❌ Can only rematch a finished game."))
        return

    opponent_id = p2_id if user_id == p1_id else p1_id
    bet_amount = float(game.get("bet_amount") or 0)
    duel_format = normalize_duel_format(game.get("duel_format") or DUEL_FORMAT_SINGLE)
    if not opponent_id or bet_amount <= 0:
        await query.message.reply_text(t("error.generic", default="❌ Rematch data missing."))
        return
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _bo3_enabled():
        await query.message.reply_text(
            t("duel.format.bo3.disabled", default="Best of 3 is currently disabled."),
        )
        return

    balance = get_user_balance(user_id)
    if balance < bet_amount:
        await query.message.reply_text(
            t(
                "rematch.no_balance",
                default="💸 Not enough balance for rematch.\n\nRequired: <b>{amount} GRAM</b>",
                amount=f"{bet_amount:.2f}",
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        )
        return

    from services.private_duels import create_private_game_with_invite
    result = create_private_game_with_invite(
        player1_id=user_id,
        bet_amount=bet_amount,
        duel_format=duel_format,
    )
    if not result.get("ok"):
        # Rematch identity is part of the contract. Never fall back to a public
        # opponent, because that would silently stop being a rematch.
        await query.message.reply_text(
            t(
                "rematch.create_failed",
                default="❌ Could not create this rematch: {error}",
                error=_friendly_game_error(result.get("error") or "unknown", t=t),
            ),
            parse_mode=ParseMode.HTML,
        )
        return

    new_game_id = int(result["game_id"])
    invite_code = str(result["invite_code"])
    deep_link = f"https://t.me/{BOT_USERNAME}?start=duel_{invite_code}"
    format_label = _duel_format_label(duel_format, t=t)

    await query.message.reply_text(
        t(
            "rematch.created",
            default=(
                "⚡ <b>Rematch challenge sent!</b>\n\n"
                "🎮 Format: <b>{format}</b>\n"
                "💰 Stake: <b>{amount} GRAM</b> for the whole match\n\n"
                "Waiting for opponent to accept..."
            ),
            format=format_label,
            amount=f"{bet_amount:.2f}",
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                t("btn.share_challenge", default="📤 Share challenge"),
                url="https://t.me/share/url?" + urlencode({"url": deep_link}),
            )],
            [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
        ]),
    )

    try:
        t_opp = get_t(opponent_id)
        creator_name = query.from_user.first_name or f"User {user_id}"
        await context.bot.send_message(
            chat_id=opponent_id,
            text=t_opp(
                "rematch.challenged",
                default=(
                    "⚡ <b>{name} challenges you to a rematch!</b>\n\n"
                    "🎮 Format: <b>{format}</b>\n"
                    "💰 Stake: <b>{amount} GRAM</b> for the whole match"
                ),
                name=escape(creator_name),
                format=_duel_format_label(duel_format, t=t_opp),
                amount=f"{bet_amount:.2f}",
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t_opp("btn.accept_rematch", default="⚔️ Accept Rematch"), url=deep_link)],
                [InlineKeyboardButton(t_opp("btn.decline", default="❌ Decline"), callback_data="back_to_main")],
            ]),
        )
    except Exception as exc:
        logger.warning("handle_rematch: failed to notify opponent %s: %s", opponent_id, exc)


async def handle_create_private_duel_single(query, context):
    """Open a private challenge from global navigation with a deterministic format.

    Global navigation must not inherit a stale BO3 selection from an earlier
    create-duel flow. BO3 private challenges remain available from the explicit
    format/stake flow, while the one-tap Challenge Friend action stays backward
    compatible and single-round.
    """
    context.user_data["duel_format"] = DUEL_FORMAT_SINGLE
    await handle_create_private_duel(query, context)


async def handle_create_private_duel(query, context):
    await safe_answer_callback(query)
    user_id = int(query.from_user.id)
    t = get_t(user_id)

    from services.private_duels import create_private_game_with_invite

    duel_format = _selected_duel_format(context)
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _bo3_enabled():
        duel_format = DUEL_FORMAT_SINGLE
        context.user_data["duel_format"] = duel_format

    min_stake = platform_settings.get_float("min_stake_ton")
    balance = get_user_balance(user_id)
    if balance < min_stake:
        await query.message.reply_text(
            t(
                "private_duel.no_balance",
                default="💸 Insufficient balance to create a private duel.\n\nMinimum stake: <b>{min} GRAM</b>",
                min=f"{min_stake:.2f}",
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        )
        return

    raw_amount = context.user_data.get("last_bet_amount") or get_last_bet(user_id) or min_stake
    ok_amount, amount, amount_error = _normalize_real_duel_stake(
        raw_amount,
        user_id=user_id,
        balance=balance,
        t=t,
    )
    if not ok_amount:
        await query.message.reply_text(
            f"❌ {amount_error}",
            parse_mode=ParseMode.HTML,
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        )
        return
    context.user_data["last_bet_amount"] = amount
    try:
        save_last_bet(user_id, amount)
    except Exception:
        pass

    result = create_private_game_with_invite(
        player1_id=user_id,
        bet_amount=amount,
        duel_format=duel_format,
    )
    if not result.get("ok"):
        error = result.get("error", "Unknown error")
        if str(error) == "User already has an active duel":
            active_kind, active_game = _get_active_duel_context(user_id)
            await query.message.reply_text(
                _describe_active_duel_conflict(active_kind, active_game, t=t),
                parse_mode=ParseMode.HTML,
                reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            )
        else:
            await query.message.reply_text(
                t(
                    "private_duel.error",
                    default="❌ Could not create the challenge: {error}",
                    error=_friendly_game_error(error, t=t),
                ),
                parse_mode=ParseMode.HTML,
            )
        return

    game_id = int(result["game_id"])
    invite_code = str(result["invite_code"])
    deep_link = f"https://t.me/{BOT_USERNAME}?start=duel_{invite_code}"

    await query.message.reply_text(
        t(
            "private_duel.created",
            default=(
                "⚔️ <b>Private Duel created!</b>\n\n"
                "🎮 Format: <b>{format}</b>\n"
                "💰 Stake: <b>{amount} GRAM</b> for the whole match\n\n"
                "Send this link to your friend:\n"
                "👉 {link}\n\n"
                "⏳ The invitation works for <b>15 minutes</b>.\n"
                "💸 If your friend does not join, the stake is returned automatically."
            ),
            format=_duel_format_label(duel_format, t=t),
            amount=f"{amount:.2f}",
            link=deep_link,
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                t("btn.share_challenge", default="📤 Share challenge"),
                switch_inline_query=f"private_duel_{game_id}",
            )],
            [InlineKeyboardButton(t("duel.action.check_status", default="📊 Duel status"), callback_data=f"check_game_{game_id}")],
            [InlineKeyboardButton(t("btn.cancel_duel", default="❌ Cancel duel"), callback_data=f"cancel_game_{game_id}")],
            [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
        ]),
    )


async def handle_quick_duel(query, context):
    """Quick Duel — instant PvP matchmaking (±20%) or auto-expiring game (30 sec)."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    allowed, error_text = _check_product_access(user_id, 'duel')
    if not allowed:
        await safe_answer_callback(query, error_text, show_alert=True)
        return

    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await safe_edit_message(
            query.message,
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    raw_min = platform_settings.get_float("min_stake_ton")
    min_stake = raw_min if raw_min is not None else 1.0
    amount = (context.user_data.get("last_bet_amount") or get_last_bet(user_id) or min_stake)
    amount = max(float(amount), min_stake)
    balance = get_user_balance(user_id)

    if balance < amount:
        await safe_edit_message(
            query.message,
            t("quick_duel.no_balance",
              default=(
                  "⚡ <b>Quick Duel</b>\n\nFast PvP matchmaking — find an opponent in seconds.\n\n"
                  "🎯 Your stake would be: <b>{amount} GRAM</b>\n"
                  "💰 Your balance: <b>{balance} GRAM</b>\n\n"
                  "❌ Not enough GRAM to start.\n\n"
                  "<b>How it works</b>\n"
                  "• Bot finds an opponent with a similar stake (±20%)\n"
                  "• 30 sec search — no opponent? Refund\n"
                  "• 1 minute to roll your dice, otherwise you lose\n"
                  "• Winner takes 95% of the pot (stake × 2)\n"
                  "• Draw — both stakes returned\n\n"
                  "Ready? Tap ⚡ Quick Duel!\n\n"
                  "Deposit at least <b>{min_stake} GRAM</b> to use Quick Duel."
              ),
              amount=f"{amount:.2f}", balance=f"{balance:.2f}", min_stake=f"{min_stake:.2f}"),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn.deposit", default="💰 Deposit"), callback_data="deposit")],
                [InlineKeyboardButton(t("quick_duel.how_it_works_btn", default="ℹ️ How Quick Duel works"), callback_data="quick_duel_info")],
                [InlineKeyboardButton(t("btn.balance", default="💰 Balance"), callback_data="balance")],
                [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
            ]),
        )
        return

    await safe_edit_message(
        query.message,
        t("quick_duel.searching", default=(
              "⚡ <b>Quick Duel</b>\n\n"
              "🔍 Searching for opponent...\n"
              "Target stake: <b>{amount} GRAM</b>\n"
              "The final matched stake may vary by up to ±20% and will be shown exactly when a match is found."
          ), amount=f"{amount:.2f}"),
        parse_mode=ParseMode.HTML,
    )

    result = await quick_duel_match(user_id, amount, context)

    if result["status"] == "joined":
        game_id = result["game_id"]
        game = get_game_by_id(game_id)
        opponent_id = result["opponent_id"]
        # Financial truth: the search amount is only a target. Smart matching
        # may select a waiting duel within the configured tolerance, so every
        # post-match surface must render the exact stake reserved by the
        # canonical game service (with a DB fallback for older result shapes).
        matched_amount_raw = result.get("bet_amount")
        if matched_amount_raw is None and game:
            matched_amount_raw = game.get("bet_amount")
        matched_amount = float(matched_amount_raw if matched_amount_raw is not None else amount)
        if game and game.get("player2_id") == user_id:
            await start_timers(context, game_id, opponent_id, user_id, deadline_at=result.get("deadline_at"))
        # Edit the inline message (no reply_markup — can't use ReplyKeyboard in editMessage)
        await safe_edit_message(
            query.message,
            t("quick_duel.opponent_found",
              default=(
                  "⚔️ <b>Opponent found!</b>\n\n"
                  "Final stake: <b>{amount} GRAM</b>\n"
                  "💰 This exact amount is reserved from each player.\n"
                  "⏱ Each player has <b>60 seconds</b> to roll. A reminder arrives after 30 seconds."
              ),
              amount=f"{matched_amount:.2f}"),
            parse_mode=ParseMode.HTML,
        )
        # Send 🎲 keyboard to the joiner (this user)
        await context.bot.send_message(
            chat_id=user_id,
            text=t("duel.roll_prompt",
                   default="🎲 Send your dice roll now.\n\n⏱ You have 60 seconds from the start of the duel. A reminder arrives after 30 seconds."),
            reply_markup=get_game_keyboard(),
        )
        # Send 🎲 keyboard to the creator (opponent) — they're still on the "waiting" screen
        if opponent_id:
            try:
                t_opp = get_t(opponent_id)
                await context.bot.send_message(
                    chat_id=opponent_id,
                    text=t_opp("duel.roll_prompt",
                               default="🎲 Send your dice roll now.\n\n⏱ You have 60 seconds from the start of the duel. A reminder arrives after 30 seconds."),
                    reply_markup=get_game_keyboard(),
                )
            except Exception as _e:
                logger.warning("handle_quick_duel: could not send roll prompt to opponent %s: %s", opponent_id, _e)

    elif result["status"] == "created":
        game_id = result["game_id"]
        reserved_amount = float(result.get("bet_amount", amount))
        msg = await safe_edit_message(
            query.message,
            t("quick_duel.waiting",
              default=(
                  "⏳ <b>Waiting for opponent...</b>\n\nReserved stake: <b>{amount} GRAM</b>\n"
                  "⚡ Quick duel expires in <b>30 seconds</b> — you'll be refunded automatically if no one joins."
              ),
              amount=f"{reserved_amount:.2f}"),
            parse_mode=ParseMode.HTML,
            reply_markup=get_game_created_keyboard(game_id, get_duel_share_payload(game_id=game_id, user_id=user_id), t=t),
        )
        if msg:
            set_room_message_id(game_id, msg.message_id)

    else:
        await safe_edit_message(
            query.message,
            t("quick_duel.error", default="❌ Could not start quick duel: {error}", error=result.get('error', 'Unknown error')),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
        )


async def handle_quick_duel_info(query, context):
    """Показать подробное описание Quick Duel для новых игроков."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(
        query.message,
        t("quick_duel.how_it_works",
          default=(
              "⚡ <b>Quick Duel — how it works</b>\n\n"
              "The fastest way to play. One tap and you're in the lobby.\n\n"
              "🔍 <b>Smart Matching</b>\n"
              "• Finds an opponent with a similar stake (±20%)\n"
              "• Uses your last stake or the minimum (1 GRAM)\n\n"
              "⏱ <b>Timeouts</b>\n"
              "• 30 sec search — no opponent? Refund\n"
              "• 1 minute to roll — otherwise you lose\n\n"
              "💰 <b>Payouts</b>\n"
              "• Platform fee: 5%\n"
              "• Winner gets 95% of the pot (stake × 2)\n"
              "• Draw — both stakes returned\n\n"
              "⚔️ <b>Fair PvP</b> — you always play against a real person, never the house.\n\n"
              "Ready? Deposit GRAM and hit ⚡ Quick Duel!"
          )),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.deposit", default="💰 Deposit"), callback_data="deposit")],
            [InlineKeyboardButton(t("btn.back_main", default=t("btn.back", default="◀️ Back")), callback_data="quick_duel")],
        ]),
    )


# ═══════════════════════════════════════════════════════════════════════════
# TOURNAMENT HANDLERS
# ═══════════════════════════════════════════════════════════════════════════


def _format_tournament_amount(value: float) -> str:
    """Compact stake display that never turns 0.1 into 0."""
    try:
        value = float(value)
    except Exception:
        return str(value)
    if value.is_integer():
        return str(int(value))
    return (f"{value:.4f}".rstrip("0").rstrip(".")) or "0"


def _public_base_url() -> str:
    base = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if not base:
        public_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip().strip("/")
        if public_domain:
            if public_domain.startswith(("http://", "https://")):
                base = public_domain.rstrip("/")
            else:
                base = f"https://{public_domain}"
    if not base:
        base = os.getenv("RAILWAY_STATIC_URL", "").strip().rstrip("/")
    return base.rstrip("/")


def _build_tournament_share_links(owner_user_id: int, tournament_id: int, *, stake: float | None = None, size: int | None = None) -> tuple[str, str]:
    """Return (share_link, bot_deep_link) for tournament invites.

    share_link prefers a web OG-preview URL when APP_BASE_URL is available,
    while bot_deep_link always points directly to Telegram.
    """
    deep_link = f"https://t.me/{BOT_USERNAME}?start=tournament_{tournament_id}"
    invite_code = ""
    try:
        snap = get_referral_snapshot(owner_user_id)
        invite_code = str(snap.get("inviteCode") or "").strip()
        if invite_code:
            deep_link = f"https://t.me/{BOT_USERNAME}?start=i_{invite_code}_tournament_{tournament_id}"
    except Exception:
        invite_code = ""

    share_link = deep_link
    base = _public_base_url()
    if base:
        params: dict[str, str] = {}
        if invite_code:
            params["ref"] = invite_code
        if stake is not None:
            params["stake"] = _format_tournament_amount(float(stake))
        if size is not None:
            params["size"] = str(int(size))
        query = f"?{urlencode(params)}" if params else ""
        share_link = f"{base}/join/tournament/{tournament_id}{query}"
    return share_link, deep_link


def _localize_tournament_error(error: str, t) -> str:
    """Map common tournament service errors to operator/user language."""
    raw = str(error or "").strip()
    lowered = raw.lower()
    if not raw:
        return t("tournament.error.unknown", default="Неизвестная ошибка")
    if "currently disabled" in lowered:
        return t("tournament.error.disabled", default="Турниры сейчас отключены.")
    if "tournament size must be 4 or 8" in lowered:
        return t("tournament.error.size", default="Размер турнира должен быть 4 или 8 игроков.")
    if "stake must be between" in lowered:
        import re
        m = re.search(r"between\s+([0-9.]+)\s+and\s+([0-9.]+)", raw, re.IGNORECASE)
        if m:
            return t(
                "tournament.error.stake_range",
                default="Ставка должна быть от {min_stake} до {max_stake} GRAM.",
                min_stake=_format_tournament_amount(float(m.group(1))),
                max_stake=_format_tournament_amount(float(m.group(2))),
            )
        return t("tournament.error.stake_invalid", default="Недопустимая ставка турнира.")
    if "insufficient balance" in lowered:
        return raw.replace("Insufficient balance", t("tournament.error.insufficient_balance_short", default="Недостаточно баланса"))
    if "already joined" in lowered:
        return t("tournament.error.already_joined", default="Вы уже участвуете в этом турнире.")
    if "not found" in lowered:
        return t("tournament.error.not_found", default="Турнир не найден.")
    if "already" in lowered and "active" in lowered:
        return raw
    return raw

def _tournament_menu_content(user_id: int, *, t) -> tuple[str, InlineKeyboardMarkup]:
    active = tournament_service.get_user_active_tournament(user_id)
    extra = ""
    extra_buttons = []
    if active:
        tid = active["tournament_id"]
        status = tournament_service.localize_tournament_status(active["status"], getattr(t, "lang", "ru"))
        extra = "\n\n" + t("tournament.active_notice", default="📌 <i>Вы сейчас участвуете в турнире #{tid} ({status})</i>", tid=tid, status=status)
        extra_buttons = [[InlineKeyboardButton(t("tournament.btn.my_tournament", default="📊 Мой турнир #{tid}", tid=tid), callback_data=f"tournament_status_{tid}")]]

    keyboard = InlineKeyboardMarkup(
        extra_buttons + [
            [InlineKeyboardButton(t("tournament.btn.create", default="➕ Create Tournament"), callback_data="tournament_create_prompt")],
            [InlineKeyboardButton(t("tournament.btn.join", default="🔍 Join a Tournament"), callback_data="tournament_list")],
            [InlineKeyboardButton(t("tournament.btn.how", default="❓ How it works"), callback_data="tournament_info")],
            [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
        ]
    )
    text = t("tournament.menu_text",
      default=(
          "🏆 <b>Tournament Mode</b>\n\n"
          "Bracket-style PvP for 4 or 8 players.\n"
          "Winner takes the entire prize pool (minus 5% platform fee).\n"
          "All duels use the standard Roll Duel engine — fully fair, fully verifiable."
      )) + extra
    return text, keyboard


async def handle_tournament_menu(query, context):
    """Main tournament menu."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    text, keyboard = _tournament_menu_content(user_id, t=t)
    await safe_edit_message(
        query.message,
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


async def handle_tournament_info(query, context):
    """Detailed explanation of tournament flow."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(
        query.message,
        t("tournament.help_text", default=(
            "🏆 <b>How Tournaments Work</b>\n\n"
            "<b>1.</b> Any player creates a tournament with <code>/createtournament &lt;stake&gt; &lt;4|8&gt;</code>\n"
            "   Example: <code>/createtournament 5 4</code>\n\n"
            "<b>2.</b> Other players join until the bracket is full.\n\n"
            "<b>3.</b> Any participant presses <b>Start</b> — the bot automatically pairs players and opens duels.\n\n"
            "<b>4.</b> After each duel, winners advance to the next round. Losers are eliminated.\n\n"
            "<b>5.</b> The last player standing wins the entire prize pool (total stakes − 5% fee).\n\n"
            "📌 <b>Prize pool example</b> (4 players, 5 GRAM each):\n"
            "Total: 20 GRAM → Fee: 1 GRAM → <b>Champion gets: 19 GRAM</b>\n\n"
            "✅ No manual seeding. No complex settings. Just stake, join, and roll!"
        )),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.create", default="➕ Create Tournament"), callback_data="tournament_create_prompt")],
            [InlineKeyboardButton(t("tournament.btn.back", default=t("btn.back", default="◀️ Back")), callback_data="tournament_menu")],
        ]),
    )


async def handle_tournament_create_prompt(query, context):
    """Wizard Step 1: choose bracket size."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_edit_message(
        query.message,
        t("tournament.create_prompt", default="➕ <b>Create a Tournament</b>\n\nHow many players?"),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.players4", default="4 игрока"), callback_data="tsize_4"),
             InlineKeyboardButton(t("tournament.btn.players8", default="8 игроков"), callback_data="tsize_8")],
            [InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data="tournament_menu")],
        ]),
    )


async def handle_tournament_size_chosen(query, context):
    """Wizard Step 2: size chosen → pick stake."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    size = int(query.data.replace("tsize_", ""))
    context.user_data["t_size"] = size
    raw_min = platform_settings.get_float("min_stake_ton")
    min_stake = raw_min if raw_min is not None else 1.0
    prize_example_4 = round(min_stake * size * 0.95, 2)
    min_stake_label = _format_tournament_amount(min_stake)
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"{min_stake_label} GRAM", callback_data=f"tstake_{min_stake_label}"),
         InlineKeyboardButton("5 GRAM", callback_data="tstake_5"),
         InlineKeyboardButton("10 GRAM", callback_data="tstake_10")],
        [InlineKeyboardButton(t("tournament.btn.custom_amount", default="✏️ Своя сумма"), callback_data="tstake_custom")],
        [InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data="tournament_create_prompt")],
    ])
    await safe_edit_message(
        query.message,
        t("tournament.size_chosen",
          default="➕ <b>Tournament — {size} players</b>\n\nChoose the entry stake per player:\n<i>Prize pool = stake × {size} × 95%</i>",
          size=size),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


async def handle_tournament_stake_chosen(query, context):
    """Wizard Step 3: stake chosen → confirm."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    stake = float(query.data.replace("tstake_", ""))
    context.user_data["t_stake"] = stake
    size = context.user_data.get("t_size", 4)
    prize = round(stake * size * 0.95, 2)
    await safe_edit_message(
        query.message,
        t("tournament.stake_chosen",
          default="✅ <b>Confirm Tournament</b>\n\nPlayers: <b>{size}</b>\nEntry stake: <b>{stake:.1f} GRAM</b>\nPrize pool: <b>{prize:.2f} GRAM</b> (winner takes all)\n\nYour balance must cover your own entry ({stake:.1f} GRAM).",
          size=size, stake=stake, prize=prize),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.create", default="🏆 Создать турнир"), callback_data="tcreate_confirm")],
            [InlineKeyboardButton(t("tournament.btn.change_stake", default="◀️ Изменить ставку"), callback_data=f"tsize_{size}")],
        ]),
    )


async def handle_tournament_custom_stake_prompt(query, context):
    """Wizard: ask user to type a custom stake amount."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    size = context.user_data.get("t_size", 4)
    user_states[query.from_user.id] = "waiting_tournament_stake"
    await safe_edit_message(
        query.message,
        t("tournament.custom_stake_prompt", default="✏️ <b>Своя ставка — {size} игроков</b>\n\nВведите сумму ставки, например <code>2.5</code>:", size=size),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.cancel", default="◀️ Отмена"), callback_data="tournament_create_prompt")],
        ]),
    )


async def _handle_tournament_stake_input(update, context):
    """Handle free-text stake input from user (state: waiting_tournament_stake)."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    text = (update.message.text or "").strip().replace(",", ".")
    try:
        stake = float(text)
    except ValueError:
        await update.message.reply_text(
            t("tournament.error.invalid_amount", default="❌ Неверная сумма. Введите число, например <code>2.5</code>"),
            parse_mode=ParseMode.HTML,
        )
        return
    raw_min = platform_settings.get_float("min_stake_ton")
    min_stake = raw_min if raw_min is not None else 1.0
    if stake < min_stake:
        await update.message.reply_text(
            t("duel.error.stake_min_too_low", default="❌ Минимальная ставка: <b>{min_stake} GRAM</b>.", min_stake=f"{min_stake:.1f}"),
            parse_mode=ParseMode.HTML,
        )
        return
    context.user_data["t_stake"] = stake
    user_states.pop(user_id, None)
    size = context.user_data.get("t_size", 4)
    prize = round(stake * size * 0.95, 2)
    await update.message.reply_text(
        t("tournament.stake_chosen",
          default="✅ <b>Подтверждение турнира</b>\n\nИгроков: <b>{size}</b>\nСтавка: <b>{stake:.1f} GRAM</b>\nПризовой фонд: <b>{prize:.2f} GRAM</b> (победитель забирает всё)\n\nВаш баланс должен покрывать ставку ({stake:.1f} GRAM).",
          size=size, stake=stake, prize=prize),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.create", default="🏆 Создать турнир"), callback_data="tcreate_confirm")],
            [InlineKeyboardButton(t("tournament.btn.change_stake", default="◀️ Изменить ставку"), callback_data=f"tsize_{size}")],
        ]),
    )


async def handle_tournament_confirm(query, context):
    """Wizard final step: create tournament and show invite."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await safe_answer_callback(query)
    user_id = query.from_user.id
    size = context.user_data.get("t_size", 4)
    stake = context.user_data.get("t_stake")
    if stake is None:
        await safe_edit_message(
            query.message,
            t("tournament.error.session_expired", default="❌ <b>Сессия устарела</b>\n\nНачните создание турнира заново."),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("tournament.btn.create", default="🏆 Создать турнир"), callback_data="tournament_create_prompt")],
            ]),
        )
        return

    stake = float(stake)
    size = int(size)

    # Pre-check balance to give a clear message instead of silent popup
    from database import get_user_balance
    balance = get_user_balance(user_id)
    if balance < stake:
        await safe_edit_message(
            query.message,
            t("tournament.error.insufficient_balance", default="💸 <b>Недостаточно баланса</b>\n\nСтавка входа: <b>{stake:.1f} GRAM</b>\nВаш баланс: <b>{balance:.2f} GRAM</b>\nНе хватает: <b>{missing:.2f} GRAM</b>.", stake=stake, balance=balance, missing=stake - balance),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("wallet.deposit", default="💰 Пополнить GRAM"), callback_data="deposit")],
                [InlineKeyboardButton(t("tournament.btn.change_stake", default="◀️ Изменить ставку"), callback_data=f"tsize_{size}")],
                [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
            ]),
        )
        return

    result = tournament_service.create_tournament(user_id, stake, size)
    if not result.get("ok"):
        await safe_edit_message(
            query.message,
            t("tournament.error.create_failed", default="❌ <b>Не удалось создать турнир</b>\n\n{error}", error=_localize_tournament_error(result.get('error', 'Unknown error'), t)),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn.try_again", default="🔄 Попробовать снова"), callback_data="tournament_create_prompt")],
                [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
            ]),
        )
        return

    tid = result["tournament_id"]
    prize = round(stake * size * 0.95, 2)
    tournament = tournament_service.get_tournament(tid) or {}
    tournament_format = normalize_duel_format(tournament.get("match_format") or DUEL_FORMAT_SINGLE)
    format_label = (
        t("tournament.format.bo3", default="До двух побед")
        if is_series_format(tournament_format)
        else t("tournament.format.single", default="Один раунд")
    )

    share_link, _bot_deep_link = _build_tournament_share_links(user_id, tid, stake=stake, size=size)

    from urllib.parse import quote
    share_text = t(
        "tournament.share_text",
        default="Присоединяйся к моему турниру Roll Duel #{tid} — нажми ссылку ниже, чтобы вступить.",
        tid=tid,
        share_link=share_link,
    )
    telegram_share_url = f"https://t.me/share/url?url={quote(share_link, safe='')}&text={quote(share_text, safe='')}"

    await safe_edit_message(
        query.message,
        t("tournament.created_text", default="🏆 <b>Турнир #{tid} создан!</b>\n\nИгроков: <b>{size}</b> | Ставка: <b>{stake:.1f} GRAM</b>\nПризовой фонд: <b>{prize:.2f} GRAM</b> (победитель забирает всё)\n\n📨 <b>Как пригласить игроков:</b>\n<code>{share_link}</code>\n\n{joined_auto}", tid=tid, size=size, stake=stake, format=format_label, prize=prize, share_link=share_link, joined_auto=t("tournament.joined_auto", default="Вы вступили автоматически. Нажмите <b>Старт</b>, когда все {size} мест заняты.", size=size)),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.copy_link", default="📋 Ссылка для приглашения"), callback_data=f"tcopy_{tid}")],
            [InlineKeyboardButton(t("tournament.btn.share", default="📨 Поделиться"), url=telegram_share_url)],
            [InlineKeyboardButton(t("tournament.btn.start", default="🚀 Старт турнира"), callback_data=f"tournament_start_{tid}")],
            [InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tid}")],
        ]),
    )


async def handle_tournament_copy_link(query, context):
    """Show the invite link prominently so user can copy it."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    tid = int(query.data.replace("tcopy_", ""))
    tournament = tournament_service.get_tournament(tid) or {}
    share_link, _bot_deep_link = _build_tournament_share_links(
        user_id,
        tid,
        stake=float(tournament.get("stake") or 0) if tournament.get("stake") is not None else None,
        size=int(tournament.get("size") or 0) if tournament.get("size") is not None else None,
    )
    from urllib.parse import quote
    share_text = t(
        "tournament.share_text",
        default="Присоединяйся к моему турниру Roll Duel #{tid} — нажми ссылку ниже, чтобы вступить.",
        tid=tid,
        share_link=share_link,
    )
    telegram_share_url = f"https://t.me/share/url?url={quote(share_link, safe='')}&text={quote(share_text, safe='')}"
    await safe_edit_message(
        query.message,
        t("tournament.copy_link_text", default="📋 <b>Ссылка для турнира #{tid}</b>\n\n<code>{share_link}</code>\n\nНажмите на ссылку, чтобы скопировать, и отправьте друзьям.\nИгрок увидит турнир и кнопку вступления.", tid=tid, share_link=share_link),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.share", default="📨 Поделиться"), url=telegram_share_url)],
            [InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data=f"tournament_status_{tid}")],
        ]),
    )


async def handle_tournament_list(query, context):
    """List forming tournaments available to join."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    tournaments = tournament_service.get_forming_tournaments(limit=10)

    if not tournaments:
        await safe_edit_message(
            query.message,
            t("tournament.list.empty",
              default=(
                  "🔍 <b>Find a Tournament</b>\n\nNo tournaments are currently forming.\n\n"
                  "Be the first — create one with <code>/createtournament &lt;stake&gt; &lt;4|8&gt;</code>!"
              )),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("tournament.btn.create", default="🏆 Создать турнир"), callback_data="tournament_create_prompt")],
                [InlineKeyboardButton(t("tournament.btn.back", default=t("btn.back", default="◀️ Назад")), callback_data="tournament_menu")],
            ]),
        )
        return

    lines = [t("tournament.list.title", default="🔍 <b>Open Tournaments</b>") + "\n"]
    keyboard_rows = []
    for trn in tournaments:
        tid = trn["tournament_id"]
        stake = float(trn["stake_amount"])
        joined = int(trn.get("participant_count", 0))
        total = int(trn["max_participants"])
        prize = round(stake * total * 0.95, 2)
        format_label = (
            t("tournament.format.bo3", default="До двух побед")
            if is_series_format(trn.get("match_format") or DUEL_FORMAT_SINGLE)
            else t("tournament.format.single", default="Один раунд")
        )
        lines.append(t(
            "tournament.list.line",
            default="• <b>#{tid}</b> — {stake:.2f} GRAM × {total} игроков → 🏆 {prize:.2f} GRAM | {joined}/{total} вступили | {format}",
            tid=tid, stake=stake, total=total, prize=prize, joined=joined, format=format_label,
        ))
        keyboard_rows.append([
            InlineKeyboardButton(
                t("tournament.btn.join_list", default="Вступить #{tid} — {stake:.2f} GRAM ({joined}/{total})", tid=tid, stake=stake, joined=joined, total=total),
                callback_data=f"join_tournament_{tid}"
            )
        ])

    keyboard_rows.append([InlineKeyboardButton(t("btn.refresh", default="🔄 Обновить"), callback_data="tournament_list")])
    keyboard_rows.append([InlineKeyboardButton(t("tournament.btn.back", default=t("btn.back", default="◀️ Назад")), callback_data="tournament_menu")])

    await safe_edit_message(
        query.message,
        "\n".join(lines),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
    )


async def handle_tournament_status(query, context):
    """Show current status / bracket of a tournament."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    tournament_id = int(query.data.replace("tournament_status_", ""))
    user_id = query.from_user.id

    tournament = tournament_service.get_tournament(tournament_id)
    if not tournament:
        await query.answer(t("tournament.error.not_found", default="Турнир не найден."), show_alert=True)
        return

    text = tournament_service.get_tournament_status_text(tournament_id, lang=getattr(context.user_data.get("t", None), "lang", "ru"))
    buttons = []

    if tournament["status"] == "forming":
        participants = tournament_service.get_tournament_participants(tournament_id)
        already = any(int(p["user_id"]) == int(user_id) for p in participants)
        is_full = len(participants) >= tournament["max_participants"]

        if already and is_full:
            buttons.append([InlineKeyboardButton(t("tournament.btn.start", default="🚀 Старт турнира"), callback_data=f"tournament_start_{tournament_id}")])
        elif not already:
            buttons.append([InlineKeyboardButton(t("tournament.btn.join_one", default="✅ Вступить в турнир"), callback_data=f"join_tournament_{tournament_id}")])

        if tournament["creator_id"] == user_id:
            buttons.append([InlineKeyboardButton(t("tournament.btn.cancel", default="❌ Отменить турнир"), callback_data=f"tournament_cancel_{tournament_id}")])

    if tournament["status"] in ("in_progress", "completed"):
        buttons.append([InlineKeyboardButton(t("tournament.btn.history", default="📜 История турнира"), callback_data=f"tournament_history_{tournament_id}")])

    buttons.append([InlineKeyboardButton(t("btn.refresh", default="🔄 Обновить"), callback_data=f"tournament_status_{tournament_id}")])
    buttons.append([InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")])

    await safe_edit_message(
        query.message, text, parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_join_tournament(query, context):
    """Handle join_tournament_<id> callback."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    tournament_id = int(query.data.replace("join_tournament_", ""))

    # Check user is not in another active tournament
    active = tournament_service.get_user_active_tournament(user_id)
    if active and active["tournament_id"] != tournament_id:
        await query.answer(
            t("tournament.error.already_active", default="Вы уже участвуете в турнире #{tid}. Завершите его сначала.", tid=active['tournament_id']),
            show_alert=True,
        )
        return

    result = tournament_service.join_tournament(tournament_id, user_id)
    if not result.get("ok"):
        await query.answer(_localize_tournament_error(result.get("error", "Could not join tournament"), t), show_alert=True)
        return

    joined = result["joined"]
    total = result["total"]
    ready = result["ready"]

    if ready:
        status_msg = t("tournament.join.joined_full", default="✅ Вы вступили! Турнир заполнен ({joined}/{total}). Любой участник может нажать Старт.", joined=joined, total=total)
    else:
        status_msg = t("tournament.join.joined_progress", default="✅ Вы вступили! ({joined}/{total} игроков)", joined=joined, total=total)

    await query.answer(status_msg)

    # Show updated tournament status
    text = tournament_service.get_tournament_status_text(tournament_id, lang=getattr(context.user_data.get("t", None), "lang", "ru"))
    buttons = []
    if ready:
        buttons.append([InlineKeyboardButton(t("tournament.btn.start", default="🚀 Старт турнира"), callback_data=f"tournament_start_{tournament_id}")])
    buttons.append([InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")])
    buttons.append([InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")])

    await safe_edit_message(
        query.message, text, parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_tournament_dice_help(query, context):
    """Explain Telegram dice mechanics without changing fairness semantics."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await query.message.reply_text(
        t(
            "tournament.dice_help",
            default=(
                "🎲 <b>Как бросить кубик</b>\n\n"
                "Откройте чат дуэли и отправьте emoji 🎲 через кнопку Telegram рядом с полем сообщения.\n"
                "Бросок должен быть сделан вашим аккаунтом: бот не бросает за игрока и не подменяет результат."
            ),
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")
        ]]),
    )


async def handle_tournament_start(query, context):
    """Handle tournament_start_<id> callback — creator starts the bracket."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    tournament_id = int(query.data.replace("tournament_start_", ""))

    result = tournament_service.start_tournament(tournament_id, user_id)
    if not result.get("ok"):
        await query.answer(_localize_tournament_error(result.get("error", "Could not start tournament"), t), show_alert=True)
        return

    matches = result.get("matches", [])
    errors = result.get("errors", [])
    tournament_format = normalize_duel_format(result.get("duel_format") or DUEL_FORMAT_SINGLE)
    tournament_bo3 = is_series_format(tournament_format)

    msg_lines = [
        t("tournament.start.started", default="🏆 <b>Турнир #{tournament_id} — раунд 1 начался!</b>\n", tournament_id=tournament_id),
        t("tournament.start.duels_created", default="⚔️ <b>Создано дуэлей: {count}.</b> Все пары получили уведомления.\n", count=len(matches)),
        t(
            "tournament.start.roll_hint_bo3" if tournament_bo3 else "tournament.start.roll_hint",
            default=(
                "Каждый матч идёт до двух побед. Бросайте кубик по приглашению каждого раунда!\n"
                if tournament_bo3
                else "Бросайте кубик, когда начнётся ваша дуэль!\n"
            ),
        ),
    ]
    if errors:
        msg_lines.append(t("tournament.start.errors", default="⚠️ <i>Не удалось запустить матчей: {count}. Проверьте балансы.</i>", count=len(errors)))

    # Notify all participants in their own language.
    for match in matches:
        is_bo3 = is_series_format(match.get("duel_format") or DUEL_FORMAT_SINGLE)
        for pid in [match["player1_id"], match["player2_id"]]:
            participant_t = get_t(int(pid))
            try:
                await context.bot.send_message(
                    chat_id=pid,
                    text=participant_t(
                        "tournament.duel_starting_bo3" if is_bo3 else "tournament.duel_starting_full",
                        default=(
                            "🎯 <b>Турнир #{tournament_id} — матч до двух побед начинается!</b>\n\n"
                            "Игра #{game_id}. Одна турнирная ставка действует на весь турнир; "
                            "отдельной выплаты за матч нет.\n\n"
                            "Раунд 1: отправьте 🎲."
                            if is_bo3
                            else
                            "⚔️ <b>Турнир #{tournament_id} — ваша дуэль начинается!</b>\n\n"
                            "Игра #{game_id} — отправьте 🎲 в чат, чтобы сделать бросок.\n\n"
                            "Нажмите кнопку ниже, если не знаете, где находится кубик."
                        ),
                        tournament_id=tournament_id,
                        game_id=match["game_id"],
                    ),
                    parse_mode=ParseMode.HTML,
                    reply_markup=get_game_keyboard(),
                )
            except Exception as e:
                logger.warning("Could not notify tournament participant %s: %s", pid, e)

    await safe_edit_message(
        query.message,
        "\n".join(msg_lines),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.bracket", default="📊 Сетка турнира"), callback_data=f"tournament_status_{tournament_id}")],
            [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
        ]),
    )


async def handle_tournament_history(query, context):
    """Show completed/in-progress tournament bracket history."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    tournament_id = int(query.data.replace("tournament_history_", ""))
    text = tournament_service.get_tournament_history_text(tournament_id, lang=getattr(t, "lang", "ru"))
    await safe_edit_message(
        query.message,
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")],
            [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
        ]),
    )


async def handle_tournament_cancel(query, context):
    """Handle tournament_cancel_<id> callback."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    tournament_id = int(query.data.replace("tournament_cancel_", ""))

    result = tournament_service.cancel_tournament(tournament_id, user_id)
    if not result.get("ok"):
        await query.answer(_localize_tournament_error(result.get("error", "Could not cancel"), t), show_alert=True)
        return

    await safe_edit_message(
        query.message,
        t("tournament.cancel_success", default="✅ <b>Турнир #{tid} отменён.</b>\n\nСредства не списаны — дуэли ещё не начинались.", tid=tournament_id),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
        ]),
    )


async def _createtournament_command(update, context):
    """Handle /createtournament <stake> <4|8>"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    args = context.args or []

    if len(args) < 2:
        await update.message.reply_text(
            t("tournament.create.usage", default="Использование: <code>/createtournament &lt;ставка&gt; &lt;4|8&gt;</code>\n\nПримеры:\n  <code>/createtournament 1 4</code>\n  <code>/createtournament 5 8</code>"),
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        stake = float(args[0])
        size = int(args[1])
    except ValueError:
        await update.message.reply_text(t("tournament.error.invalid_create_args", default="❌ Неверные аргументы. Ставка должна быть числом, размер — 4 или 8."))
        return

    result = tournament_service.create_tournament(user.id, stake, size)
    if not result.get("ok"):
        await update.message.reply_text(f"❌ {_localize_tournament_error(result.get('error', 'Could not create tournament'), t)}")
        return

    tournament_id = result["tournament_id"]
    # H-03: Dynamic fee (no longer hardcoded 0.95)
    from services.settings import get_int as _get_int
    fee_bps = _get_int("tournament_fee_bps") or 500
    prize_pool = round(stake * size * (1 - fee_bps / 10000), 2)
    tournament = tournament_service.get_tournament(tournament_id) or {}
    tournament_format = normalize_duel_format(tournament.get("match_format") or DUEL_FORMAT_SINGLE)
    format_label = (
        t("tournament.format.bo3", default="До двух побед")
        if is_series_format(tournament_format)
        else t("tournament.format.single", default="Один раунд")
    )

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("tournament.btn.join_number", default="✅ Вступить в турнир #{tid}", tid=tournament_id), callback_data=f"join_tournament_{tournament_id}")],
        [InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")],
        [InlineKeyboardButton(t("tournament.btn.menu", default="🏆 Меню турниров"), callback_data="tournament_menu")],
    ])
    await update.message.reply_text(
        t("tournament.created_command", default="🏆 <b>Турнир #{tid} создан!</b>\n\nСтавка: <b>{stake:.2f} GRAM</b> за игрока\nРазмер: <b>{size} игрока</b>\nПризовой фонд: <b>{prize:.2f} GRAM</b> (победитель забирает всё)\n\n<b>Как пригласить игроков:</b>\nПерешлите это сообщение и попросите нажать «Вступить», или отправьте команду:\n<code>/jointournament {tid}</code>\n\n{joined_auto}", tid=tournament_id, stake=stake, size=size, format=format_label, prize=prize_pool, joined_auto=t("tournament.joined_auto", default="Вы вступили автоматически. Нажмите <b>Старт</b>, когда все {size} мест заняты.", size=size)),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


async def _jointournament_command(update, context):
    """Handle /jointournament <id>"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    args = context.args or []

    if not args:
        await update.message.reply_text(
            t("tournament.join.usage", default="Использование: <code>/jointournament &lt;ID турнира&gt;</code>"),
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        tournament_id = int(args[0])
    except ValueError:
        await update.message.reply_text(t("tournament.error.invalid_id", default="❌ Неверный ID турнира."))
        return

    result = tournament_service.join_tournament(tournament_id, user.id)
    if not result.get("ok"):
        await update.message.reply_text(f"❌ {_localize_tournament_error(result.get('error', 'Could not join tournament'), t)}")
        return

    joined = result["joined"]
    total = result["total"]
    ready = result["ready"]

    status_text = t("tournament.join.command_success", default="✅ Вы вступили в турнир #{tid}! ({joined}/{total} игроков)\n\n", tid=tournament_id, joined=joined, total=total)
    if ready:
        status_text += t("tournament.join.command_full", default="🔔 Турнир заполнен! Любой участник может нажать Старт.")
    else:
        status_text += t("tournament.join.command_waiting", default="⏳ Ждём ещё игроков: {remaining}.", remaining=total - joined)

    keyboard_rows = []
    if ready:
        keyboard_rows.append([InlineKeyboardButton(t("tournament.btn.start", default="🚀 Старт турнира"), callback_data=f"tournament_start_{tournament_id}")])
    keyboard_rows.append([InlineKeyboardButton(t("tournament.btn.status", default="📊 Статус турнира"), callback_data=f"tournament_status_{tournament_id}")])

    await update.message.reply_text(
        status_text,
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
    )


async def handle_join_game_request(query, context):
    """Render an authoritative join preview for an open duel."""
    from services.i18n import get_translator

    t = context.user_data.get("t", get_translator("en"))
    game_id = int(query.data.replace("join_game_", ""))
    user_id = query.from_user.id
    allowed, error_text = _check_product_access(user_id, "duel")
    if not allowed:
        await safe_answer_callback(query, text=error_text, show_alert=True)
        return

    game_info = next(
        (game for game in get_waiting_games() if int(game["game_id"]) == game_id),
        None,
    )
    if not game_info:
        await safe_edit_message(
            query.message,
            t("duel.error.not_available", default="❌ This duel is no longer available."),
            reply_markup=get_back_button("find_game", t=t),
        )
        return
    if int(game_info["player1_id"]) == user_id:
        await safe_answer_callback(
            query,
            t("duel.error.own_duel", default="❌ You cannot join your own duel."),
            show_alert=True,
        )
        return

    balance = get_user_balance(user_id)
    bet_amount = float(game_info["bet_amount"])
    duel_format = normalize_duel_format(game_info.get("duel_format") or DUEL_FORMAT_SINGLE)
    is_valid, error_message = validate_bet_amount(bet_amount, balance, t=t)
    if not is_valid:
        if bet_amount > balance:
            await safe_edit_message(
                query.message,
                render_insufficient_balance_text(
                    user_id,
                    required_amount=bet_amount,
                    action_label="join this real duel",
                ),
                reply_markup=get_insufficient_balance_keyboard(
                    t=t,
                    demo_mode_enabled=_is_demo_mode_enabled(),
                ),
                parse_mode=ParseMode.HTML,
            )
        else:
            await safe_edit_message(
                query.message,
                f"❌ {error_message}",
                reply_markup=get_back_button("find_game", t=t),
            )
        return

    text = t(
        "duel.join.confirm_text_with_format",
        default=(
            "🎮 <b>Join Duel</b>\n\n"
            "🎲 Opponent: <b>{opponent}</b>\n"
            "🎮 Format: <b>{format}</b>\n"
            "💰 Stake: <b>{amount}</b> for the entire match\n"
            "⏳ Available for: <b>{time}</b>\n\n"
            "Confirm the join:"
        ),
        opponent=escape(str(game_info.get("first_name") or "Player")),
        format=_duel_format_label(duel_format, t=t),
        amount=format_balance_display(bet_amount),
        time=format_mm_ss(game_info.get("seconds_remaining")),
    )
    await safe_edit_message(
        query.message,
        text,
        reply_markup=get_game_confirmation_keyboard(
            game_id,
            bet_amount,
            duel_format=duel_format,
            t=t,
        ),
        parse_mode=ParseMode.HTML,
    )


async def handle_confirm_join(query, context):
    """Atomically join a waiting duel and start the selected gameplay format."""
    from services.i18n import get_translator

    t = context.user_data.get("t", get_translator("en"))
    game_id = int(query.data.replace("confirm_join_", ""))
    user_id = query.from_user.id
    game_info = next(
        (game for game in get_waiting_games() if int(game["game_id"]) == game_id),
        None,
    )
    if not game_info:
        await safe_edit_message(
            query.message,
            t("duel.error.not_available", default="❌ This duel is no longer available."),
            reply_markup=get_back_button("find_game", t=t),
        )
        return

    join_result = join_game_with_reservation(game_id, user_id)
    if not join_result.get("ok"):
        if join_result.get("error") == "Insufficient available balance":
            await safe_edit_message(
                query.message,
                render_insufficient_balance_text(
                    user_id,
                    required_amount=float(game_info["bet_amount"]),
                    action_label="join this real duel",
                ),
                reply_markup=get_insufficient_balance_keyboard(
                    t=t,
                    demo_mode_enabled=_is_demo_mode_enabled(),
                ),
                parse_mode=ParseMode.HTML,
            )
        else:
            await safe_edit_message(
                query.message,
                f"❌ {join_result.get('error', 'Could not join the duel.')}",
                reply_markup=get_back_button("find_game", t=t),
            )
        return

    duel_format = normalize_duel_format(
        join_result.get("duel_format")
        or game_info.get("duel_format")
        or DUEL_FORMAT_SINGLE
    )
    game_text = t(
        "duel.started_with_format",
        default=(
            "🎮 <b>Duel started.</b>\n\n"
            "🎲 Duel #{game_id}\n"
            "🎮 Format: <b>{format}</b>\n"
            "💰 Stake: <b>{amount}</b> for the entire match\n\n"
            "⏱ Each player has <b>60 seconds</b> to roll in the current round."
        ),
        game_id=game_id,
        format=_duel_format_label(duel_format, t=t),
        amount=format_balance_display(game_info["bet_amount"]),
    )
    roll_prompt = (
        t(
            "duel.series.roll_prompt",
            default=(
                "🎯 Round 1 · Best of 3\n"
                "🎲 Send your dice now. First to two round wins takes the match."
            ),
        )
        if duel_format == DUEL_FORMAT_BEST_OF_3
        else t(
            "duel.roll_prompt",
            default=(
                "🎲 Send your dice roll now.\n\n"
                "⏱ You have 60 seconds from the start of the duel. "
                "A reminder arrives after 30 seconds."
            ),
        )
    )

    await safe_edit_message(query.message, game_text, parse_mode=ParseMode.HTML)
    await context.bot.send_message(
        chat_id=user_id,
        text=roll_prompt,
        reply_markup=get_game_keyboard(),
    )
    try:
        creator_id = int(game_info["player1_id"])
        await context.bot.send_message(
            chat_id=creator_id,
            text=game_text,
            parse_mode=ParseMode.HTML,
        )
        await context.bot.send_message(
            chat_id=creator_id,
            text=roll_prompt,
            reply_markup=get_game_keyboard(),
        )
    except Exception as exc:
        logger.exception(
            "handle_confirm_join: failed to notify player1 for game %s: %s",
            game_id,
            exc,
        )

    room_message_id = get_room_message_id(game_id)
    if room_message_id:
        try:
            await context.bot.delete_message(
                chat_id=int(game_info["player1_id"]),
                message_id=room_message_id,
            )
        except Exception as exc:
            logger.exception(
                "handle_confirm_join: failed to delete room message for game %s: %s",
                game_id,
                exc,
            )
    await start_timers(
        context,
        game_id,
        int(game_info["player1_id"]),
        user_id,
        deadline_at=join_result.get("deadline_at"),
    )

async def handle_balance_callback(query, context):
    """Render the balance screen with wallet status."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    user_states.pop(user_id, None)
    balance_text = render_balance_screen_text(user_id, t=t)
    try:
        from services.wallet_links import get_wallet_snapshot
        wallet = get_wallet_snapshot(user_id)
        balance_text += "\n\n" + render_balance_wallet_line(wallet, t=t)
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    await safe_edit_message(
        query.message,
        balance_text,
        reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        parse_mode=ParseMode.HTML,
    )

async def handle_stats_callback(query, context):
    """Обработать callback статистики"""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    stats = get_user_stats(user_id)

    stats_text = t("screen.stats.title", default="📊 <b>Ваша статистика</b>") + "\n\n"
    stats_text += t("screen.stats.balance", default="💰 Баланс: {balance}", balance=format_balance_display(stats['balance'])) + "\n"
    stats_text += t("screen.stats.played", default="🎮 Сыграно: {n}", n=stats['games_played']) + "\n"
    stats_text += t("screen.stats.wins", default="🏆 Побед: {n}", n=stats['games_won']) + "\n"
    stats_text += t("screen.stats.win_rate", default="📈 Процент побед: {rate:.1f}%", rate=stats['win_rate']) + "\n"

    # ELO display (safe — never crashes if elo module is unavailable)
    try:
        from services import elo as elo_service
        elo_info = elo_service.get_elo_stats(user_id)
        stats_text += f"🏆 ELO: {elo_info['elo_rating']} ({elo_info['rank_name']})\n"
    except Exception:
        stats_text += f"🏆 ELO: 1000 (Bronze)\n"

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.leaderboard", default="🥇 Лидерборд"), callback_data="leaderboard")],
        [InlineKeyboardButton(t("btn.history", default="📜 История"), callback_data="my_history")],
        [InlineKeyboardButton(t("btn.back_profile", default="◀️ Back to Profile"), callback_data="profile")],
    ])
    await safe_edit_message(query.message,
        stats_text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

# (duplicate handle_help_callback removed)

async def handle_cancel_game(query, context):
    """Обработать отмену игры"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    game_id = int(query.data.replace("cancel_game_", ""))
    user_id = query.from_user.id

    # Получаем информацию об игре для возврата ставки
    waiting_games = get_waiting_games()
    game_info = None

    for game in waiting_games:
        if game['game_id'] == game_id and game['player1_id'] == user_id:
            game_info = game
            break

    if not game_info:
        await safe_edit_message(query.message,
            t("duel.cancel.not_found", default="❌ Duel not found or it has already started."),
            reply_markup=get_back_button("balance", t=t)
        )
        return

    # Отменяем игру через truth-layer flow
    cancel_result = cancel_waiting_game(game_id, user_id)
    if cancel_result.get('ok'):
        await safe_edit_message(query.message,
            t("duel.cancel.success", default="✅ Duel cancelled.\n💰 Stake {amount} was released back to balance.", amount=format_balance_display(game_info['bet_amount'])),
            reply_markup=get_back_button("balance", t=t)
        )
    else:
        await safe_edit_message(query.message,
            t("duel.cancel.error", default="❌ Could not cancel the duel."),
            reply_markup=get_back_button("balance", t=t)
        )

async def handle_check_game(query, context):
    """Render truthful waiting/active/terminal duel status."""
    game_id = int(query.data.replace("check_game_", ""))
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    game = get_game_by_id(game_id)
    participants = {int(game.get("player1_id") or 0), int(game.get("player2_id") or 0)} if game else set()
    if not game or user_id not in participants:
        await safe_edit_message(
            query.message,
            t("duel.error.not_available", default="❌ This duel is no longer available."),
            reply_markup=get_back_button("balance", t=t),
        )
        return

    status = str(game.get("status") or "")
    if status in {"active", "settling"}:
        remaining = format_mm_ss(seconds_remaining(game.get("deadline_at")))
        if is_series_format(game.get("duel_format") or DUEL_FORMAT_SINGLE):
            score1 = int(game.get("player1_round_wins") or 0)
            score2 = int(game.get("player2_round_wins") or 0)
            current_round = int(game.get("current_round") or 1)
            live_text = t(
                "duel.series.status",
                default=(
                    "🎯 Format: <b>Best of 3</b>\n"
                    "📊 Score: <b>{score1}–{score2}</b>\n"
                    "🎲 Current round: <b>{round}</b>\n"
                ),
                score1=score1,
                score2=score2,
                round=current_round,
            )
            if status == "settling":
                live_text += "\n" + t("duel.status.settling", default="Finishing duel")
            else:
                live_text += f"\n⏱ {remaining}"
            prompt = t(
                "duel.series.roll_prompt_current",
                default=(
                    "🎯 Round {round} · Best of 3\n"
                    "📊 Score: {score1}–{score2}\n"
                    "🎲 Send a fresh dice roll now."
                ),
                round=current_round,
                score1=score1,
                score2=score2,
            )
        else:
            live_text = t(
                "duel.live_prompt",
                default="🎮 The duel is live. Send a fresh 🎲 dice roll in this chat.",
            ) + f"\n\n⏱ {remaining}"
            prompt = t(
                "duel.roll_prompt",
                default=(
                    "🎲 Send your dice roll now.\n\n⏱ You have 60 seconds from "
                    "the start of the duel. A reminder arrives after 30 seconds."
                ),
            )
        await safe_edit_message(
            query.message,
            live_text,
            reply_markup=get_back_button("balance", t=t),
            parse_mode=ParseMode.HTML,
        )
        if status == "active":
            await context.bot.send_message(
                chat_id=user_id,
                text=prompt,
                reply_markup=get_game_keyboard(),
            )
        return

    if status == "waiting":
        remaining = format_mm_ss(seconds_remaining(game.get("deadline_at")))
        invite_code = game.get("invite_code") if str(game.get("visibility") or "public") == "private" else None
        await safe_edit_message(
            query.message,
            t(
                "duel.status.waiting_join",
                default=(
                    "⏳ Waiting for another player. Time remaining: <b>{time}</b>.\n"
                    "💸 The stake returns automatically if nobody joins."
                ),
                time=remaining,
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=get_game_created_keyboard(game_id, invite_code=invite_code, t=t),
        )
        return

    is_private = str(game.get("visibility") or "public") == "private"
    action = "create_private_duel" if is_private else "create_game"
    label = t(
        "duel.action.renew_invite" if is_private else "duel.action.create_again",
        default="🔁 Renew private challenge" if is_private else "🔁 Create another duel",
    )
    await safe_edit_message(
        query.message,
        t(
            "duel.status.expired_refunded",
            default="⌛ The waiting time expired.\n💸 The reserved stake was returned automatically.",
        ),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(label, callback_data=action)],
            [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
        ]),
    )


async def _create_and_send_deposit_invoice(reply_text_func, user_id, amount, t):
    """Create a CryptoBot invoice and send the ready-to-pay message.

    Shared by the normal deposit-amount flow and the
    "create new anyway" confirm callback (STEP-107D3) so both paths stay
    identical instead of duplicating invoice-creation logic.
    `reply_text_func` is either update.message.reply_text or
    query.message.reply_text -- both share the same (text, **kwargs) shape.
    """
    commission_rate = 0.03
    invoice_amount = math.ceil(amount * (1 + commission_rate) * 100) / 100
    await reply_text_func(
        t("deposit.creating", default="⏳ Creating a CryptoBot invoice...")
    )
    try:
        invoice = await create_ton_invoice(invoice_amount, user_id)
    except Exception as e:
        logger.exception("create_ton_invoice failed for user %s: %s", user_id, e)
        await reply_text_func(
            t("deposit.error.api", default="❌ Could not create invoice. Please try again in a moment."),
            reply_markup=get_back_button("balance", t=t),
        )
        return
    if not invoice or not invoice.get("ok"):
        err = (invoice or {}).get("error", "unknown")
        await reply_text_func(
            t("deposit.error.api", default="❌ Could not create invoice. Please try again in a moment.") + f"\n<code>{err}</code>",
            reply_markup=get_back_button("balance", t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    create_invoice_record(user_id, amount, invoice)
    await reply_text_func(
        t("deposit.invoice_ready",
          default=(
              "💸 <b>Deposit via CryptoBot</b>\n\n"
              "Amount you'll receive: <b>{amount} GRAM</b>\n"
              "CryptoBot fee (3%): <b>{fee} GRAM</b>\n"
              "Total to pay: <b>{total} GRAM</b>\n\n"
              "<a href=\"{pay_url}\">👉 Open CryptoBot invoice</a>\n\n"
              "<i>Invoice expires in 15 minutes. Balance will be credited automatically after payment.</i>"
          ),
          amount=f"{amount:.2f}",
          fee=f"{invoice_amount - amount:.2f}",
          total=f"{invoice_amount:.2f}",
          pay_url=invoice.get("pay_url", ""),
          ),
        reply_markup=get_deposit_invoice_keyboard(str(invoice.get("invoice_id", "")), invoice.get("pay_url", ""), t=t),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def handle_deposit_amount(update, context):
    user_id = update.effective_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    # NOTE (found while reviewing 107D3): this guard used to reference `t`
    # in get_back_button(..., t=t) before `t` was ever assigned below,
    # which would raise NameError instead of showing the maintenance/
    # deposits-disabled message -- i.e. exactly when an operator disables
    # deposits or a user is risk-blocked, this handler would crash instead
    # of explaining why. Moved the translator setup above this check.
    allowed, error_text = _check_product_access(user_id, 'deposit')
    if not allowed:
        await update.message.reply_text(error_text, reply_markup=get_back_button("balance", t=t))
        user_states.pop(user_id, None)
        return
    message_text = (update.message.text or "").strip().replace(',', '.').replace(' ', '')
    user_states.pop(user_id, None)
    try:
        amount = float(message_text)
        if amount < MIN_DEPOSIT_AMOUNT:
            raise ValueError("below_min")
    except (ValueError, TypeError):
        await update.message.reply_text(
            t("deposit.error.min", default="❌ Minimum deposit is <b>{min} GRAM</b>.", min=f"{MIN_DEPOSIT_AMOUNT:.1f}"),
            reply_markup=get_back_button("balance", t=t),
            parse_mode=ParseMode.HTML,
        )
        return
    # STEP-107D3: warn instead of silently letting active invoices pile up.
    # If this user already has an unpaid active invoice, let them choose
    # to reopen it or explicitly create a new one, instead of always
    # creating a fresh invoice on every deposit attempt.
    existing = get_active_unpaid_invoice_for_user(user_id)
    if existing:
        await update.message.reply_text(
            t(
                "deposit.existing_unpaid_warning",
                default=(
                    "⚠️ У вас уже есть неоплаченный счёт на <b>{amount} GRAM</b>.\n\n"
                    "Если вы уже пробовали оплатить его и не хватило средств "
                    "в CryptoBot, можете открыть тот же счёт ещё раз или "
                    "создать новый на другую сумму."
                ),
                amount=f"{float(existing['amount']):.2f}",
            ),
            reply_markup=get_existing_unpaid_invoice_keyboard(
                str(existing["invoice_id"]), str(existing.get("pay_url") or ""), amount, t=t,
            ),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    await _create_and_send_deposit_invoice(update.message.reply_text, user_id, amount, t)


async def _handle_deposit_confirm_new(query, context):
    """User explicitly chose to create a new invoice despite an existing
    unpaid one (STEP-107D3 confirm path)."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    # STEP-107D3 correction: handle_deposit_amount() re-checks
    # _check_product_access(user_id, "deposit") before creating an
    # invoice (covers maintenance_mode, deposits_enabled, and per-user
    # risk restrictions via risk_service.can_user_perform). This confirm
    # callback must not skip that guard just because the warning screen
    # was already shown earlier -- an operator could disable deposits (or
    # a user could get risk-flagged) in the time between the warning
    # being shown and this button being tapped, and the button must not
    # bypass either control.
    allowed, error_text = _check_product_access(user_id, "deposit")
    if not allowed:
        await safe_answer_callback(query, error_text or t("deposit.error.api", default="❌ Could not create invoice. Please try again in a moment."), show_alert=True)
        await query.message.reply_text(error_text, reply_markup=get_back_button("balance", t=t))
        return
    try:
        amount = float(query.data.replace("deposit_confirm_new_", "", 1))
    except ValueError:
        await safe_answer_callback(query, t("deposit.error.api", default="❌ Could not create invoice. Please try again in a moment."), show_alert=True)
        return
    await safe_answer_callback(query)
    await _create_and_send_deposit_invoice(query.message.reply_text, user_id, amount, t)


async def handle_check_deposit_invoice(query, context):
    """Manual safe check for a CryptoBot deposit invoice from the invoice screen."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    invoice_id = (query.data or "").replace("check_deposit_", "", 1).strip()
    if not invoice_id:
        await query.answer(t("deposit.check.invalid", default="Invoice not found."), show_alert=True)
        return

    invoice_row = None
    conn = get_connection()
    try:
        invoice_row = conn.execute(
            "SELECT invoice_id, user_id, amount, status, pay_url FROM invoices WHERE invoice_id = ?",
            (invoice_id,),
        ).fetchone()
    finally:
        conn.close()

    if not invoice_row or int(invoice_row["user_id"]) != int(user_id):
        await query.answer(t("deposit.check.invalid", default="Invoice not found."), show_alert=True)
        return

    local_state = get_invoice_credit_state(invoice_id, user_id=user_id)
    if local_state.get("ok") and local_state.get("credited"):
        amount = float(local_state.get("credit_amount") or local_state.get("amount") or invoice_row["amount"] or 0)
        balance_text = render_balance_screen_text(user_id, t=t)
        await safe_edit_message(
            query.message,
            t(
                "deposit.check.already_credited",
                default="✅ This invoice is already credited. Balance is up to date.\nAmount: <b>{amount}</b>",
                amount=format_balance_display(amount),
            ) + "\n\n" + balance_text,
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        status = await get_invoice_status(invoice_id)
    except Exception as e:
        logger.exception("deposit manual check failed for invoice %s: %s", invoice_id, e)
        await safe_edit_message(
            query.message,
            t(
                "deposit.check.error",
                default="⚠️ Could not check the payment right now. Please try again in a few seconds.",
            ),
            reply_markup=get_deposit_invoice_keyboard(invoice_id, invoice_row["pay_url"] or "", t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    if status == "paid":
        result = apply_paid_invoice(invoice_id, source="manual_check", provider_event_id=f"manual_check:{invoice_id}")
        if not result.get("ok"):
            await safe_edit_message(
                query.message,
                t(
                    "deposit.check.credit_error",
                    default="⚠️ Payment was found, but balance was not updated. Please contact support.",
                ),
                reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
                parse_mode=ParseMode.HTML,
            )
            return
        amount = float(result.get("amount") or invoice_row["amount"] or 0)
        balance_text = render_balance_screen_text(user_id, t=t)
        is_repeat = bool(result.get("already_paid") or result.get("already_processed"))
        await safe_edit_message(
            query.message,
            t(
                "deposit.check.already_credited" if is_repeat else "deposit.check.paid",
                default=(
                    "✅ This invoice is already credited. Balance is up to date.\nAmount: <b>{amount}</b>"
                    if is_repeat
                    else "✅ Deposit received: <b>{amount}</b>.\n\nYour balance is updated below."
                ),
                amount=format_balance_display(amount),
            ) + "\n\n" + balance_text,
            reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
            parse_mode=ParseMode.HTML,
        )
        return

    update_invoice_status(invoice_id, status)
    await safe_edit_message(
        query.message,
        t(
            "deposit.check.pending",
            default="⏳ Payment not found yet. If you just paid, wait a few seconds and tap check again. This check is idempotent and will not credit twice.",
        ),
        reply_markup=get_deposit_invoice_keyboard(invoice_id, invoice_row["pay_url"] or "", t=t),
        parse_mode=ParseMode.HTML,
    )

async def notify_successful_deposit(update, context, amount):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await update.message.reply_text(
        t(
            "balance.topped_up",
            default="✅ Your balance was topped up by {amount} GRAM!\nYou can now open Balance or start a duel.",
            amount=format_balance_display(float(amount)),
        ),
        reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        parse_mode=ParseMode.HTML,
    )

@rate_limit(max_calls=3, period=300)
async def handle_withdraw_amount(update, context):
    user_id = update.effective_user.id
    allowed, error_text = _check_product_access(user_id, 'withdraw')
    if not allowed:
        await update.message.reply_text(error_text, reply_markup=get_back_button("balance", t=t))
        user_states.pop(user_id, None)
        return
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    # Always clear state first so user is never stuck
    user_states.pop(user_id, None)

    message_text = (update.message.text or "").strip().replace(',', '.').replace(' ', '')
    min_withdraw = float(get_effective_gram_withdrawal_minimum())

    try:
        amount = float(message_text)
    except (ValueError, TypeError):
        await update.message.reply_text(
            t("withdraw.error.invalid", default="❌ Please enter a valid number, e.g. <b>5</b> or <b>2.5</b>"),
            reply_markup=get_back_button("balance", t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    if amount < min_withdraw:
        await update.message.reply_text(
            t("withdraw.error.min", default="❌ Minimum withdrawal is <b>{min} GRAM</b>.", min=f"{min_withdraw:.1f}"),
            reply_markup=get_back_button("balance", t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    balance = get_user_balance(user_id)
    if amount > balance:
        # Clear, actionable error — shows actual balance and offers deposit
        await update.message.reply_text(
            t("withdraw.error.insufficient",
              default=(
                  "❌ <b>Insufficient balance</b>\n\n"
                  "Requested: <code>{amount} GRAM</code>\n"
                  "Your balance: <code>{balance} GRAM</code>\n\n"
                  "Deposit GRAM first to be able to withdraw."
              ),
              amount=f"{amount:.2f}", balance=f"{balance:.2f}"),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn.deposit", default="💰 Deposit GRAM"), callback_data="deposit")],
                [InlineKeyboardButton(t("btn.balance", default="💰 Balance"), callback_data="balance")],
            ]),
        )
        return

    create_result = create_withdrawal_request(user_id, amount)
    if not create_result.get('ok'):
        try:
            from services.observability import metrics as _obs
            _obs.inc("withdrawal.failed_create")
        except Exception:
            pass
        await update.message.reply_text(
            f"❌ {create_result.get('error', t('withdraw.error.generic', default='Could not create the withdrawal request.'))}",
            reply_markup=get_back_button("balance", t=t),
        )
        return

    review_status = create_result.get('review_status', 'not_required')
    try:
        from services.observability import metrics as _obs
        _obs.inc("withdrawal.requested")
    except Exception:
        pass
    if review_status == 'pending_review':
        text = t("withdraw.status.review",
                 default="🕒 Withdrawal of <b>{amount} GRAM</b> submitted for review. An operator will process it shortly.",
                 amount=f"{amount:.2f}")
    else:
        text = t("withdraw.status.processing",
                 default="⏳ Withdrawal of <b>{amount} GRAM</b> is being processed via CryptoBot. Check @CryptoBot — you'll receive the funds shortly.",
                 amount=f"{amount:.2f}")

    await update.message.reply_text(text, reply_markup=None, parse_mode=ParseMode.HTML)
    await update.message.reply_text(
        render_main_menu_text(update.effective_user.id, t=t),
        reply_markup=_main_menu_markup(update.effective_user.id, t=t),
        parse_mode=ParseMode.HTML,
    )

# Удалено: неиспользуемая функция _extract_admin_broadcast_message_payload


def _broadcast_button_input_help() -> str:
    return "Формат кнопки: <code>Текст | https://example.com</code>"



async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик текстовых сообщений"""
    # FIX: Ignore text messages in group chats entirely
    if update.effective_chat and update.effective_chat.type in ("group", "supergroup", "channel"):
        return

    user_id = update.effective_user.id
    from services.i18n import get_translator as _hm_get_translator
    t = context.user_data.get("t") or get_t(user_id) or _hm_get_translator("en")
    # Проверка блокировки пользователя
    from database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_blocked FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row and row["is_blocked"]:
            return  # Молчим для заблокированных
    giveaway_state = str(user_states.get(user_id) or "")
    if giveaway_state.startswith("gw_edit_"):
        parts = giveaway_state.split(":", 2)
        state_name = parts[0]
        giveaway_id = parts[1] if len(parts) > 1 else ""
        incoming_text = (update.message.text or "").strip()
        if not giveaway_id:
            user_states.pop(user_id, None)
            await update.message.reply_text(
                t("giveaway.error.edit_session_expired", default="❌ Сессия редактирования розыгрыша истекла. Откройте розыгрыш заново."),
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back_main", default="◀️ Главное меню"), callback_data="back_to_main")]]),
            )
            return
        try:
            snapshot = get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
            giveaway = snapshot.get("giveaway") or {}
            if state_name == "gw_edit_title":
                if not incoming_text:
                    raise GiveawayError("missing_giveaway_title", "Send a title in one message.", 400)
                update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, title=incoming_text)
            elif state_name == "gw_edit_prize":
                if not incoming_text:
                    raise GiveawayError("missing_prize_text", "Send the prize text in one message.", 400)
                update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, prize_text=incoming_text)
            elif state_name == "gw_edit_winners":
                winners_count = int(incoming_text)
                update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, winners_count=winners_count)
            elif state_name == "gw_edit_deadline":
                deadline = _parse_giveaway_deadline_input(incoming_text, min_future_minutes=5)
                update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, ends_at=deadline)
            elif state_name == "gw_edit_starts":
                if incoming_text.lower() in {"now", "сейчас", "сразу"}:
                    if not giveaway.get("starts_at"):
                        user_states.pop(user_id, None)
                        await update.message.reply_text(
                            t("giveaway.info.start_already_now", default="ℹ️ Начало уже установлено: сразу."),
                            parse_mode=ParseMode.HTML,
                            reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, "starts", t=t),
                        )
                        await show_giveaway_detail(update.message, user_id=user_id, giveaway_id=giveaway_id, edit=False)
                        return
                    update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, clear_starts_at=True)
                else:
                    starts_at = _parse_giveaway_deadline_input(incoming_text, min_future_minutes=0)
                    update_giveaway_core(owner_user_id=user_id, giveaway_id=giveaway_id, starts_at=starts_at)
            else:
                user_states.pop(user_id, None)
                await update.message.reply_text(
                    t("giveaway.error.edit_session_expired", default="❌ Сессия редактирования розыгрыша истекла. Откройте розыгрыш заново."),
                    reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, t=t),
                )
                return
        except ValueError:
            field_name = state_name.replace("gw_edit_", "", 1)
            await update.message.reply_text(
                t("giveaway.error.whole_number", default="❌ Отправьте целое число, например 1, 3 или 5."),
                parse_mode=ParseMode.HTML,
                reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, field_name, t=t),
            )
            user_states[user_id] = giveaway_state
            return
        except GiveawayError as exc:
            field_name = state_name.replace("gw_edit_", "", 1)
            giveaway_title = None
            try:
                giveaway_title = (get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id).get("giveaway") or {}).get("title")
            except Exception as e:
                logger.exception(f"Failed to get giveaway title for {giveaway_id}: {e}")
                giveaway_title = None
            error_text = _localize_giveaway_error(exc, t=t, snapshot=snapshot if 'snapshot' in locals() else None)
            await update.message.reply_text(
                f"❌ {escape(str(error_text))}\n\n{render_giveaway_edit_prompt(field_name, giveaway_title, t=t, snapshot=snapshot if 'snapshot' in locals() else None)}",
                parse_mode=ParseMode.HTML,
                reply_markup=get_giveaway_edit_prompt_keyboard(giveaway_id, field_name, t=t),
            )
            user_states[user_id] = giveaway_state
            return
        user_states.pop(user_id, None)
        await update.message.reply_text(t("giveaway.toast.updated", default="✅ Розыгрыш обновлён."))
        await show_giveaway_detail(update.message, user_id=user_id, giveaway_id=giveaway_id, edit=False)
        return
    # Проверка состояния для пополнения GRAM
    if user_states.get(user_id) == 'waiting_deposit_amount':
        await handle_deposit_amount(update, context)
        return
    # Проверка состояния для вывода GRAM
    if user_states.get(user_id) == 'waiting_withdraw_amount':
        await handle_withdraw_amount(update, context)
        return
    # Проверка состояния для поиска пользователя админом
    admin_lookup_state = user_states.get(user_id)
    if admin_lookup_state == 'admin_waiting_user_id':
        if not _allow_admin_message_state(user_id, admin_lookup_state):
            return
        user_states.pop(user_id, None)
        try:
            target_id = int(update.message.text.strip())
        except Exception as e:
            logger.exception(f"Invalid admin user ID input from {user_id}: {e}")
            await update.message.reply_text(
                "❌ Некорректный ID. Введите числовой ID пользователя:",
                reply_markup=get_admin_shortcuts_keyboard("admin_users", _admin_web_url('/users'))
            )
            user_states[user_id] = 'admin_waiting_user_id'
            return
        user_card = admin_read_models.get_user_card(target_id)
        if not user_card:
            await update.message.reply_text(
                "❌ Пользователь не найден. Введите другой ID или откройте раздел Users в Web Admin.",
                reply_markup=get_admin_shortcuts_keyboard("admin_users", _admin_web_url('/users')),
                disable_web_page_preview=True,
            )
            user_states[user_id] = 'admin_waiting_user_id'
            return
        await update.message.reply_text(
            _render_tg_admin_user_lookup_receipt(user_card),
            reply_markup=get_admin_shortcuts_keyboard("admin_users", _admin_web_url(f"/users/{target_id}")),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    # Проверка состояния для изменения баланса пользователя админом
    current_state = user_states.get(user_id, '')
    if current_state.startswith('admin_waiting_balance_'):
        if not _allow_admin_message_state(user_id, current_state):
            return
        target_id = int(current_state.replace('admin_waiting_balance_', ''))
        user_states.pop(user_id, None)
        try:
            amount = float(update.message.text.replace(',', '.'))
        except Exception as e:
            logger.exception(f"Invalid balance amount input from {user_id} for user {target_id}: {e}")
            await update.message.reply_text(
                "❌ Некорректная сумма. Введите число:",
                reply_markup=get_admin_user_keyboard(target_id, False)
            )
            user_states[user_id] = f'admin_waiting_balance_{target_id}'
            return
        from database import get_connection
        risk_service.manual_balance_adjustment(target_id, amount, operator_id=str(user_id), reason='legacy_admin_balance_adjustment')
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id, username, first_name, balance, is_blocked, games_played, games_won, created_at FROM users WHERE user_id = ?", (target_id,))
            row = cursor.fetchone()
        info = f"<b>Пользователь #{row['user_id']}</b>\n"
        info += f"Имя: {row['first_name'] or '-'}\n"
        info += f"Username: @{row['username'] or '-'}\n"
        info += f"Баланс: {row['balance']:.2f} GRAM\n"
        info += f"Статус: {'Заблокирован' if row['is_blocked'] else 'Активен'}\n"
        info += f"Игр сыграно: {row['games_played']}\n"
        info += f"Побед: {row['games_won']}\n"
        info += f"Дата регистрации: {row['created_at']} (UTC)"
        await update.message.reply_text(
            info,
            reply_markup=get_admin_user_keyboard(row['user_id'], bool(row['is_blocked'])),
            parse_mode=ParseMode.HTML
        )
        return
    # Проверка состояния для quick post / source message (text path)
    admin_broadcast_state = user_states.get(user_id, '')
    if admin_broadcast_state.startswith('admin_bc_source:'):
        if not _allow_admin_message_state(user_id, admin_broadcast_state):
            return
        broadcast_id = admin_broadcast_state.split(':', 1)[1]
        user_states.pop(user_id, None)
        result = broadcast_service.set_broadcast_source_message(
            broadcast_id,
            operator_id=str(user_id),
            source_chat_id=update.effective_chat.id,
            source_message_id=update.message.message_id,
            source_message_type='text',
            preview_text=update.message.text,
        )
        row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
        suffix = "\n\n✅ Исходное сообщение сохранено как быстрый пост." if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_source_failed'))}"
        await update.message.reply_text(
            _render_tg_admin_broadcast_detail_text(row) + suffix,
            reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if admin_broadcast_state.startswith('admin_bc_button:'):
        if not _allow_admin_message_state(user_id, admin_broadcast_state):
            return
        broadcast_id = admin_broadcast_state.split(':', 1)[1]
        label, url = _parse_broadcast_button_input(update.message.text)
        if not label or not url:
            await update.message.reply_text(
                "❌ Формат кнопки: <code>Текст | https://example.com</code>",
                reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            user_states[user_id] = f'admin_bc_button:{broadcast_id}'
            return
        user_states.pop(user_id, None)
        result = broadcast_service.add_broadcast_button(broadcast_id, operator_id=str(user_id), label=label, url=url)
        row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
        suffix = "\n\n✅ URL-кнопка добавлена." if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_button_failed'))}"
        await update.message.reply_text(
            _render_tg_admin_broadcast_detail_text(row) + suffix,
            reply_markup=_admin_broadcast_buttons_keyboard(broadcast_id),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if admin_broadcast_state.startswith('admin_bc_builder_photo:') or admin_broadcast_state.startswith('admin_bc_builder_textphoto:'):
        if not _allow_admin_message_state(user_id, admin_broadcast_state):
            return
        broadcast_id = admin_broadcast_state.split(':', 1)[1]
        need_caption = admin_broadcast_state.startswith('admin_bc_builder_textphoto:')
        prompt = "❌ Здесь нужен именно <b>фото-пост</b>. Отправьте фото." if not need_caption else "❌ Здесь нужен <b>фото-пост с подписью</b>. Отправьте фото с подписью."
        await update.message.reply_text(prompt, reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')), parse_mode=ParseMode.HTML, disable_web_page_preview=True)
        return

    # Проверка состояния для broadcast draft text
    admin_broadcast_state = user_states.get(user_id, '')
    if admin_broadcast_state.startswith('admin_bc_text:'):
        if not _allow_admin_message_state(user_id, admin_broadcast_state):
            return
        broadcast_id = admin_broadcast_state.split(':', 1)[1]
        user_states.pop(user_id, None)
        result = broadcast_service.set_broadcast_text(broadcast_id, text=update.message.text, operator_id=str(user_id))
        row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
        suffix = "\n\n✅ Текст рассылки обновлён." if result.get('ok') else f"\n\n❌ {escape(str(result.get('error') or 'broadcast_text_failed'))}"
        await update.message.reply_text(
            _render_tg_admin_broadcast_detail_text(row) + suffix,
            reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    # Проверка состояния для notice draft text
    admin_notice_state = user_states.get(user_id, '')
    if admin_notice_state.startswith('admin_notice_text:'):
        if not _allow_admin_message_state(user_id, admin_notice_state):
            return
        notice_id = admin_notice_state.split(':', 1)[1]
        user_states.pop(user_id, None)
        result = notice_service.set_notice_text(notice_id, body_text=update.message.text, operator_id=str(user_id))
        row = result.get('notice') if result.get('ok') else notice_service.get_notice(notice_id)
        suffix = "\n\n✅ Текст объявления обновлён." if result.get('ok') else f"\n\n❌ {escape(str(result.get('error') or 'notice_text_failed'))}"
        await update.message.reply_text(
            _render_tg_admin_notice_detail_text(row) + suffix,
            reply_markup=get_admin_notice_detail_keyboard(notice_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    message_text = update.message.text

    # Проверяем состояние пользователя
    user_state = user_states.get(user_id, "")

    # ── Support ticket states ────────────────────────────────────────────────
    if user_state == "waiting_support_message":
        await handle_new_support_ticket(update, context)
        return

    if user_state.startswith("support_open:"):
        ticket_id_str = user_state.split(":", 1)[1]
        if ticket_id_str.isdigit():
            await handle_support_followup(update, context, int(ticket_id_str))
            return
    # ────────────────────────────────────────────────────────────────────────

    if user_state == "waiting_custom_practice_bet":
        await handle_custom_practice_bet_input(update, context)
        return

    if user_state == "waiting_custom_bet":
        await handle_custom_bet_input(update, context)
        return

    if user_state == "waiting_tournament_stake":
        await _handle_tournament_stake_input(update, context)
        return

    if user_state and user_state.startswith("gw_add_sponsor:"):
        await _handle_gw_sponsor_input(update, context)
        return

    # Обрабатываем кнопки reply клавиатуры
    if message_text == "🎲":
        active_game = get_active_game(user_id)
        if not active_game:
            from services.i18n import get_translator
            t = context.user_data.get("t", get_translator("en"))
            await update.message.reply_text(
                t("duel.error.no_active",
                  default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
                reply_markup=_main_menu_markup(user_id, t=t),
            )
            return
        return
    elif message_text in {"📋 Main menu", "📋 Главное меню", "/menu", "menu"}:
        from services.i18n import get_translator
        t = context.user_data.get("t", get_translator("en"))
        await update.message.reply_text(
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
        )
    elif message_text in {"❌ Leave duel", "❌ Покинуть игру"}:
        await handle_leave_game_message(update, context)
    else:
        return


async def handle_media_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.effective_user or not update.message:
        return
    # FIX: Ignore media in group chats
    if update.effective_chat and update.effective_chat.type in ("group", "supergroup", "channel"):
        return
    user_id = update.effective_user.id
    current_state = user_states.get(user_id, '')
    if not current_state.startswith(('admin_bc_source:', 'admin_bc_builder_photo:', 'admin_bc_builder_textphoto:')):
        return
    if not _allow_admin_message_state(user_id, current_state):
        return
    broadcast_id = current_state.split(':', 1)[1]
    payload = _extract_broadcast_source_from_message(update.message)
    if not payload:
        await update.message.reply_text(
            "❌ Поддерживаются только текст, фото, видео, GIF и документ.",
            reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    source_type, preview_text = payload
    if current_state.startswith('admin_bc_builder_photo:') and source_type != 'photo':
        await update.message.reply_text(
            "❌ Для режима <b>Только фото</b> отправьте именно фото.",
            reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
        return
    if current_state.startswith('admin_bc_builder_textphoto:'):
        if source_type != 'photo':
            await update.message.reply_text(
                "❌ Для режима <b>Фото + текст</b> отправьте именно фото с подписью.",
                reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            return
        if not str(preview_text or '').strip():
            await update.message.reply_text(
                "❌ Для режима <b>Фото + текст</b> подпись обязательна. Отправьте фото с подписью.",
                reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, 'draft', _admin_web_url('/')),
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            return
    user_states.pop(user_id, None)
    result = broadcast_service.set_broadcast_source_message(
        broadcast_id,
        operator_id=str(user_id),
        source_chat_id=update.effective_chat.id,
        source_message_id=update.message.message_id,
        source_message_type=source_type,
        preview_text=preview_text,
    )
    row = result.get('broadcast') if result.get('ok') else broadcast_service.get_broadcast(broadcast_id)
    suffix = "\n\n✅ Исходное сообщение сохранено в черновик." if result.get('ok') else f"\n\n❌ {escape(_broadcast_admin_error_text(result.get('error') or 'broadcast_source_failed'))}"
    await update.message.reply_text(
        _render_tg_admin_broadcast_detail_text(row) + suffix,
        reply_markup=get_admin_broadcast_detail_keyboard(broadcast_id, str((row or {}).get('status') or 'draft'), _admin_web_url('/')),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def handle_custom_practice_bet_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Create a Demo Duel from a user-entered stake with TOCTOU revalidation."""
    from services.i18n import get_translator

    t = context.user_data.get("t", get_translator("en"))
    user_id = int(update.effective_user.id)
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        user_states.pop(user_id, None)
        await update.message.reply_text(
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    balance = get_practice_balance(user_id)
    ok, stake_amount, error_text = _normalize_practice_stake_input(
        update.message.text,
        balance=balance,
        t=t,
    )
    if not ok or stake_amount is None:
        user_states[user_id] = "waiting_custom_practice_bet"
        await update.message.reply_text(
            (error_text or t("practice.custom.invalid", default="❌ Enter a valid Demo stake."))
            + "\n\n"
            + t(
                "practice.custom.prompt",
                default="✏️ Enter a Demo stake from <b>{min}</b> to <b>{max} Demo GRAM</b>.",
                min=f"{PRACTICE_MIN_STAKE:g}",
                max=f"{balance:.2f}",
            ),
            reply_markup=get_back_button("practice_format_menu" if _practice_bo3_enabled() else "practice_create", t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    user_states.pop(user_id, None)
    await _create_practice_duel_and_render(
        message=update.message,
        context=context,
        user_id=user_id,
        stake_amount=stake_amount,
        t=t,
        edit_existing=False,
        duel_format=_selected_practice_duel_format(context),
    )


async def handle_custom_bet_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработать ввод пользовательской ставки"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    message_text = update.message.text
    duel_format = _selected_duel_format(context)
    if duel_format == DUEL_FORMAT_BEST_OF_3 and not _bo3_enabled():
        duel_format = DUEL_FORMAT_SINGLE
        context.user_data["duel_format"] = duel_format

    # Удаляем состояние пользователя
    user_states.pop(user_id, None)

    # Защита от гонки (TOCTOU)
    active_kind, active_game = _get_active_duel_context(user_id)
    if active_kind:
        await update.message.reply_text(
            _describe_active_duel_conflict(active_kind, active_game, t=t),
            reply_markup=get_active_duel_conflict_keyboard(active_kind, active_game, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        bet_amount = float(message_text.replace(",", "."))
    except ValueError:
        await update.message.reply_text(
            t("bet.invalid_amount", default="❌ Enter a valid number."),
            reply_markup=get_bet_amount_keyboard(t=t)
        )
        return

    # Проверяем корректность ставки
    balance = get_user_balance(user_id)
    is_valid, error_message = validate_bet_amount(bet_amount, balance, t=t)

    if not is_valid:
        if bet_amount > balance:
            await update.message.reply_text(
                render_insufficient_balance_text(user_id, required_amount=bet_amount, action_label="create this real duel"),
                reply_markup=get_insufficient_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
                parse_mode=ParseMode.HTML,
            )
        else:
            await update.message.reply_text(
                f"❌ {error_message}",
                reply_markup=get_bet_amount_keyboard(t=t)
            )
        return

    # Создаем игру через truth-layer reservation flow
    create_result = create_game_with_reservation(
        user_id,
        bet_amount,
        publish_community=True,
        duel_format=duel_format,
    )
    if not create_result.get('ok'):
        if create_result.get('error') == 'Insufficient available balance':
            await update.message.reply_text(
                render_insufficient_balance_text(user_id, required_amount=bet_amount, action_label="create this real duel"),
                reply_markup=get_insufficient_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()),
                parse_mode=ParseMode.HTML,
            )
        else:
            await update.message.reply_text(
                f"❌ {create_result.get('error', 'Could not create the duel.')}",
                reply_markup=get_bet_amount_keyboard(t=t)
            )
        return
    game_id = create_result['game_id']

    success_text = t(
        "duel.created_with_format",
        default=(
            "✅ <b>Duel created.</b>\n\n"
            "🎲 Duel ID: {game_id}\n"
            "🎮 Format: <b>{format}</b>\n"
            "💰 Stake: {amount} GRAM for the entire match\n"
            "⏳ Another player can join for <b>15 minutes</b>.\n"
            "💸 If nobody joins, your stake is returned automatically.\n\n"
        ),
        game_id=game_id,
        format=_duel_format_label(duel_format, t=t),
        amount=f"{bet_amount:.2f}",
    )
    success_text += get_random_game_message(t=t)

    sent = await update.message.reply_text(
        success_text,
        reply_markup=get_game_created_keyboard(game_id, get_duel_share_payload(game_id=game_id, user_id=user_id), t=t),
        parse_mode=ParseMode.HTML
    )
    set_room_message_id(game_id, sent.message_id)
    publish_result = await publish_open_duel_to_default_workspace(context.bot, owner_user_id=user_id, game_id=game_id)
    if publish_result.get('ok'):
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=t("duel.create.published", default="👥 Duel published to your default group. Message #{message_id}.", message_id=publish_result['messageId']),
            )
        except Exception as e:
            logger.exception(f"Failed to send duel published notification to user {user_id}: {e}")

async def handle_leave_game(query, context):
    """Handle leaving either a real or practice duel via callback.
    Always clears reply keyboard and returns to main menu for clean UX."""
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    leave_result = await leave_active_game(user_id, context)

    if not leave_result.get('ok'):
        await query.message.reply_text(
            t("duel.error.no_active", default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
            reply_markup=remove_reply_keyboard()
        )
        await query.message.reply_text(
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML
        )
        return

    await query.message.reply_text(
        leave_result['userMessage'],
        reply_markup=remove_reply_keyboard()
    )
    await query.message.reply_text(
        render_main_menu_text(user_id, t=t),
        reply_markup=_main_menu_markup(user_id, t=t),
        parse_mode=ParseMode.HTML
    )


async def handle_leave_game_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle leaving either a real or practice duel via text.
    Always clears reply keyboard and returns to main menu for clean UX."""
    user_id = update.effective_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    leave_result = await leave_active_game(user_id, context)

    if not leave_result.get('ok'):
        await update.message.reply_text(
            t("duel.error.no_active", default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
            reply_markup=remove_reply_keyboard()
        )
        await update.message.reply_text(
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML
        )
        return

    await update.message.reply_text(
        leave_result['userMessage'],
        reply_markup=remove_reply_keyboard()
    )
    await update.message.reply_text(
        render_main_menu_text(user_id, t=t),
        reply_markup=_main_menu_markup(user_id, t=t),
        parse_mode=ParseMode.HTML
    )


async def leave_active_game(user_id: int, context):
    """Leave the current real or practice duel."""
    result = cancel_active_game_by_user(user_id)
    if result.get('ok'):
        opponent_id = result.get('opponent_id')
        game_id = result.get('game_id')
        bet_amount = result.get('bet_amount')
        if game_id is not None:
            _clear_timer_scope(game_id)
        if opponent_id:
            try:
                t_opp = get_t(opponent_id)
                await context.bot.send_message(
                    chat_id=opponent_id,
                    text=t_opp("duel.opponent_left",
                               default="😔 Your opponent left the duel.\n💰 Stake {amount} was returned to your balance.",
                               amount=f"{bet_amount:.2f}"),
                    reply_markup=remove_reply_keyboard(),
                )
                await context.bot.send_message(
                    chat_id=opponent_id,
                    text=t_opp("duel.play_again", default="🎲 Want to open another duel?"),
                    reply_markup=_main_menu_markup(opponent_id, t=t_opp),
                )
            except Exception as e:
                logger.exception(f"leave_active_game: failed to notify opponent for real duel: {e}")
        return {"ok": True, "userMessage": get_t(user_id)("duel.leave.success", default="✅ You left the duel."), "mode": "real"}

    practice_result = cancel_active_practice_game_by_user(user_id)
    if practice_result.get('ok'):
        opponent_id = practice_result.get('opponent_id')
        stake_amount = practice_result.get('stake_amount')
        if opponent_id:
            try:
                t_opp = get_t(opponent_id)
                await context.bot.send_message(
                    chat_id=opponent_id,
                    text=t_opp("duel.opponent_left_practice",
                               default="😔 Your opponent left the practice duel.\n💎 Practice stake {amount} was returned to your demo balance.",
                               amount=_format_practice_amount(stake_amount)),
                    reply_markup=remove_reply_keyboard(),
                )
                await context.bot.send_message(
                    chat_id=opponent_id,
                    text=t_opp("duel.play_again_practice", default="🧪 Want to open another practice duel?"),
                    reply_markup=get_practice_menu_keyboard(t=t_opp),
                )
            except Exception as e:
                logger.exception(f"leave_active_game: failed to notify practice opponent for game {practice_result.get('practice_game_id')}: {e}")
        practice_key = f"practice:{practice_result.get('practice_game_id')}"
        _clear_timer_scope(practice_key, [uid for uid in [user_id, opponent_id] if uid is not None])
        return {"ok": True, "userMessage": get_t(user_id)("duel.leave.success_practice", default="✅ You left the practice duel."), "mode": "practice"}

    return {"ok": False, "mode": None}


async def handle_game_status(query, context):
    """Показать статус текущей игры."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    active_game = get_active_game(user_id)

    if not active_game:
        await safe_edit_message(
            query.message,
            t("duel.error.no_active", default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
            reply_markup=get_back_button("balance", t=t),
        )
        return

    opponent_id = active_game['player2_id'] if user_id == active_game['player1_id'] else active_game['player1_id']
    current_turn = active_game['current_turn']

    try:
        opponent_info = await context.bot.get_chat(opponent_id) if opponent_id else None
        opponent_name = opponent_info.first_name if opponent_info else t("duel.status.waiting_opponent", default="waiting for opponent")
    except Exception:
        opponent_name = t("duel.status.opponent", default="Opponent")

    status_text = t(
        "duel.status.header",
        default="🎮 <b>Duel #{game_id}</b>\n\n👤 Opponent: {opponent}\n💰 Stake: {amount}\n",
        game_id=active_game['game_id'],
        opponent=escape(str(opponent_name)),
        amount=format_balance_display(active_game['bet_amount']),
    )

    if is_series_format(active_game.get("duel_format") or DUEL_FORMAT_SINGLE):
        status_text += "\n" + t(
            "duel.series.status",
            default=(
                "🎯 Format: <b>Best of 3</b>\n"
                "📊 Score: <b>{score1}–{score2}</b>\n"
                "🎲 Current round: <b>{round}</b>\n"
            ),
            score1=int(active_game.get("player1_round_wins") or 0),
            score2=int(active_game.get("player2_round_wins") or 0),
            round=int(active_game.get("current_round") or 1),
        )

    remaining = format_mm_ss(seconds_remaining(active_game.get("deadline_at")))
    if active_game.get('status') == 'waiting':
        status_text += t(
            "duel.status.waiting_join",
            default="⏳ Waiting for another player. Time remaining: <b>{time}</b>.",
            time=remaining,
        )
    elif current_turn == user_id:
        status_text += t("duel.status.roll_deadline", default="⏱ Time to roll: <b>{time}</b>.\n", time=remaining)
        status_text += t("duel.status.your_turn", default="⚡ Your turn. Send a fresh 🎲 dice message.")
    else:
        status_text += t("duel.status.roll_deadline", default="⏱ Time to roll: <b>{time}</b>.\n", time=remaining)
        status_text += t("duel.status.waiting_roll", default="⏳ Waiting for the opponent's roll...")

    if active_game['player1_roll'] > 0:
        player1_emoji = get_dice_emoji(active_game['player1_roll'])
        status_text += t("duel.status.player1_roll", default="\n🎲 Player 1: {emoji} ({value})", emoji=player1_emoji, value=active_game['player1_roll'])

    if active_game['player2_roll'] > 0:
        player2_emoji = get_dice_emoji(active_game['player2_roll'])
        status_text += t("duel.status.player2_roll", default="\n🎲 Player 2: {emoji} ({value})", emoji=player2_emoji, value=active_game['player2_roll'])

    await safe_edit_message(
        query.message,
        status_text,
        reply_markup=get_back_button("find_game", t=t),
        parse_mode=ParseMode.HTML,
    )

async def _notify_tournament_progress(context, game_id: int, winner_id: int | None) -> dict:
    """Advance one tournament match and send localized bracket notifications."""
    try:
        result = tournament_service.on_game_finished(game_id, winner_id)
        action = result.get("action", "none")
        tournament_id = result.get("tournament_id")

        if action == "next_round":
            round_num = result.get("round", "?")
            for match in result.get("matches", []):
                is_bo3 = is_series_format(match.get("duel_format") or DUEL_FORMAT_SINGLE)
                for participant_id in (match["player1_id"], match["player2_id"]):
                    translator = get_t(int(participant_id))
                    text = translator(
                        "tournament.next_round.duel_starting_bo3" if is_bo3 else "tournament.next_round.duel_starting",
                        default=(
                            "🏆 <b>Турнир #{tid} — раунд {round}!</b>\n\n"
                            "Ваша следующая дуэль — игра #{game_id}. "
                            "Матч идёт до двух побед; отправьте 🎲 для первого раунда."
                            if is_bo3
                            else
                            "🏆 <b>Турнир #{tid} — раунд {round}!</b>\n\n"
                            "Ваша следующая дуэль — игра #{game_id}. Отправьте 🎲 в чат дуэли."
                        ),
                        tid=tournament_id,
                        round=round_num,
                        game_id=match["game_id"],
                    )
                    try:
                        await context.bot.send_message(
                            chat_id=participant_id,
                            text=text,
                            parse_mode=ParseMode.HTML,
                            reply_markup=get_game_keyboard(),
                        )
                    except Exception as exc:
                        logger.warning(
                            "Could not notify tournament next-round participant %s: %s",
                            participant_id,
                            exc,
                        )

        elif action == "complete":
            champion_id = int(result.get("champion_id") or 0)
            prize = float(result.get("prize_pool") or 0)
            champion_name = tournament_service._get_user_name(champion_id)
            participants = tournament_service.get_tournament_participants(int(tournament_id))
            for participant in participants:
                participant_id = int(participant["user_id"])
                translator = get_t(participant_id)
                if participant_id == champion_id:
                    text = translator(
                        "tournament.complete.champion",
                        default=(
                            "🥇 <b>Вы победили в турнире #{tid}!</b>\n\n"
                            "💰 <b>{prize:.2f} GRAM</b> зачислено на ваш баланс.\n\n"
                            "Поздравляем, чемпион! 🎉"
                        ),
                        tid=tournament_id,
                        prize=prize,
                    )
                else:
                    text = translator(
                        "tournament.complete.participant",
                        default=(
                            "🏆 <b>Турнир #{tid} завершён!</b>\n\n"
                            "Чемпион: <b>{champion}</b>\n\n"
                            "Спасибо за игру!"
                        ),
                        tid=tournament_id,
                        champion=escape(champion_name),
                    )
                try:
                    await context.bot.send_message(
                        chat_id=participant_id,
                        text=text,
                        parse_mode=ParseMode.HTML,
                        reply_markup=InlineKeyboardMarkup([
                            [InlineKeyboardButton(
                                translator("tournament.btn.status", default="📊 Статус турнира"),
                                callback_data=f"tournament_status_{tournament_id}",
                            )],
                            [InlineKeyboardButton(
                                translator("tournament.btn.menu", default="🏆 Меню турниров"),
                                callback_data="tournament_menu",
                            )],
                        ]),
                    )
                except Exception as exc:
                    logger.warning(
                        "Could not notify tournament completion participant %s: %s",
                        participant_id,
                        exc,
                    )

        elif action == "manual_review":
            participants = tournament_service.get_tournament_participants(int(tournament_id))
            for participant in participants:
                participant_id = int(participant["user_id"])
                translator = get_t(participant_id)
                try:
                    await context.bot.send_message(
                        chat_id=participant_id,
                        text=translator(
                            "tournament.match.manual_review",
                            default=(
                                "⚠️ Турнирный матч остановлен для проверки. "
                                "Сетка не будет продвинута без подтверждённого победителя."
                            ),
                        ),
                        reply_markup=remove_reply_keyboard(),
                    )
                except Exception:
                    pass
        return result
    except Exception as exc:
        logger.exception("Tournament hook failed for game %s: %s", game_id, exc)
        return {"action": "error", "error": str(exc)}


async def handle_game_finish(context, game):
    """Обработать завершение игры"""
    game_id = game['game_id']
    player1_id = game['player1_id']
    player2_id = game['player2_id']
    player1_roll = game['player1_roll']
    player2_roll = game['player2_roll']
    bet_amount = game['bet_amount']
    is_tournament_match = is_tournament_no_payout_game(game)

    t1 = get_t(player1_id)
    t2 = get_t(player2_id)

    # Получаем имена игроков
    try:
        player1_info = await context.bot.get_chat(player1_id)
        player2_info = await context.bot.get_chat(player2_id)
        player1_name = player1_info.first_name
        player2_name = player2_info.first_name
    except:
        player1_name = "Player 1"
        player2_name = "Player 2"

    # Определяем победителя
    winner = determine_winner(player1_roll, player2_roll)

    # --- Новый блок: определяем, кто бросил вторым ---
    # По current_turn: если current_turn == player1_id, значит player2 бросил вторым, и наоборот
    if game['current_turn'] == player1_id:
        second_roller_id = player2_id
        second_roller_value = player2_roll
    else:
        second_roller_id = player1_id
        second_roller_value = player1_roll
    try:
        await context.bot.send_message(
            chat_id=second_roller_id,
            text=(t1 if second_roller_id == player1_id else t2)(
                "duel.roll_confirm",
                default="✅ Your roll: {emoji} ({value})",
                emoji=get_dice_emoji(second_roller_value),
                value=second_roller_value,
            ),
            reply_markup=remove_reply_keyboard()
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    # --- Конец нового блока ---

    # STEP006: Clean settle + verifiable reveal (fixed)
    t1 = get_t(player1_id)
    t2 = get_t(player2_id)

    if winner == "draw":
        winner_id = None
        result_text_p1 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t1)
        result_text_p2 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t2)
        if is_tournament_match:
            result_text_p1 += "\n" + t1(
                "tournament.match.draw_resolved",
                default="🏆 Турнирная ничья будет решена честным системным жребием для продвижения по сетке.",
            )
            result_text_p2 += "\n" + t2(
                "tournament.match.draw_resolved",
                default="🏆 Турнирная ничья будет решена честным системным жребием для продвижения по сетке.",
            )
        else:
            result_text_p1 += "\n" + t1(
                "duel.finish.stakes_returned",
                default="💰 Stakes returned: {amount}",
                amount=format_balance_display(bet_amount),
            )
            result_text_p2 += "\n" + t2(
                "duel.finish.stakes_returned",
                default="💰 Stakes returned: {amount}",
                amount=format_balance_display(bet_amount),
            )
        try:
            from services.observability import metrics as _obs
            _obs.inc("settlement.attempted")
        except Exception:
            pass
        settle_result = settle_game(game_id, None, reason="draw")
    else:
        winner_id = player1_id if winner == "player1" else player2_id
        bank = bet_amount * 2
        fee_bps = platform_settings.get_int("platform_fee_bps")  # dynamic, not hardcoded 0.95
        winnings = round(bank * (1 - fee_bps / 10000), 8)
        result_text_p1 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t1)
        result_text_p2 = format_game_result(player1_name, player1_roll, player2_name, player2_roll, winner, t=t2)
        if is_tournament_match:
            advance_note_p1 = t1(
                "tournament.match.no_payout_result",
                default="🏆 Турнирная дуэль: победитель проходит дальше. Приз выплачивается только чемпиону турнира.",
            )
            advance_note_p2 = t2(
                "tournament.match.no_payout_result",
                default="🏆 Турнирная дуэль: победитель проходит дальше. Приз выплачивается только чемпиону турнира.",
            )
            result_text_p1 += f"\n{advance_note_p1}"
            result_text_p2 += f"\n{advance_note_p2}"
        else:
            result_text_p1 += f"\n{t1('duel.finish.winner_gets', default='🏆 Winner gets: {amount}', amount=format_balance_display(winnings))}"
            result_text_p2 += f"\n{t2('duel.finish.winner_gets', default='🏆 Winner gets: {amount}', amount=format_balance_display(winnings))}"
        try:
            from services.observability import metrics as _obs
            _obs.inc("settlement.attempted")
        except Exception:
            pass
        settle_result = settle_game(game_id, winner_id, reason="completed")

    if not settle_result.get('ok'):
        try:
            from services.observability import metrics as _obs
            _obs.inc("settlement.failed")
        except Exception:
            pass
        logger.exception(f"handle_game_finish: failed to settle game {game_id}: {settle_result.get('error')}")
        await context.bot.send_message(chat_id=player1_id,
            text=t1("duel.settle_recovery", default="⚠️ The dice rolls were saved, but the duel result could not be finalized immediately. The system will retry automatically."))
        await context.bot.send_message(chat_id=player2_id,
            text=t2("duel.settle_recovery", default="⚠️ The dice rolls were saved, but the duel result could not be finalized immediately. The system will retry automatically."))
        return

    try:
        from services.observability import metrics as _obs
        _obs.inc("settlement.total")
        if winner == "draw":
            _obs.inc("settlement.draw")
        else:
            _obs.inc("settlement.completed")
            _obs.inc("settlement.volume_ton", int(bank * 1000))   # stored as milli-GRAM to avoid float
    except Exception:
        pass

    # Record integrity data after successful settlement without claiming full verifiability.
    try:
        meta = game.get("meta_json") or {}
        if isinstance(meta, str):
            import json
            meta = json.loads(meta) if meta else {}
        verifiable = meta.get("verifiable_random") or {}
        if verifiable.get("commit_hash") and not verifiable.get("revealed"):
            verifiable["revealed"] = True
            meta["verifiable_random"] = verifiable
            with get_connection() as conn:
                conn.execute("UPDATE games SET meta_json = ? WHERE game_id = ?", (json.dumps(meta), game_id))
                conn.commit()
            integrity_suffix = "\n\n" + t1("duel.integrity_recorded", default="🔐 Game integrity data recorded.")
            result_text_p1 += integrity_suffix
            result_text_p2 += integrity_suffix
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")

    # RD-BOT-012 Step 3: Auto-publish duel result to group if workspace_id exists
    try:
        workspace_id = game.get("workspace_id")
        if workspace_id:
            from services.workspace_publish import publish_duel_result_to_workspace
            await publish_duel_result_to_workspace(
                bot=context.bot,
                workspace_id=workspace_id,
                game_id=game_id,
                player1_name=player1_name,
                player2_name=player2_name,
                winner=winner,
                bet_amount=bet_amount
            )
    except Exception as e:
        logger.exception(f"Failed to auto-publish duel result to group: {e}")

    # Отправляем результаты каждому игроку на его языке
    final_message_p1 = f"{t1('duel.finish.real', default='🏁 <b>Duel finished.</b>')}\n\n{result_text_p1}"
    final_message_p2 = f"{t2('duel.finish.real', default='🏁 <b>Duel finished.</b>')}\n\n{result_text_p2}"
    try:
        await context.bot.send_message(
            chat_id=player1_id,
            text=final_message_p1,
            parse_mode=ParseMode.HTML,
            reply_markup=get_result_actions_keyboard(
                get_result_share_payload(game_id=game_id, user_id=player1_id, t=t1),
                game_id=game_id,
                t=t1,
            ),
        )
        await context.bot.send_message(
            chat_id=player2_id,
            text=final_message_p2,
            parse_mode=ParseMode.HTML,
            reply_markup=get_result_actions_keyboard(
                get_result_share_payload(game_id=game_id, user_id=player2_id, t=t2),
                game_id=game_id,
                t=t2,
            ),
        )
    except Exception as e:
        logger.exception(f"handle_game_finish: failed to send final message for game {game_id}: {e}")
    try:
        await safe_finish_publish(context, game_id)
    except Exception as e:
        logger.exception(f"Failed to publish result to workspaces for game {game_id}: {e}")

    # ── Tournament hook ──────────────────────────────────────────────────
    await _notify_tournament_progress(context, game_id, winner_id)

async def handle_practice_game_finish(context, game):
    practice_game_id = int(game["practice_game_id"])
    player1_id = int(game["player1_id"])
    player2_id = int(game["player2_id"])
    player1_roll = int(game["player1_roll"] or 0)
    player2_roll = int(game["player2_roll"] or 0)
    stake_amount = float(game["stake_amount"])
    t1 = get_t(player1_id)
    t2 = get_t(player2_id)

    winner = determine_winner(player1_roll, player2_roll)
    winner_id = None if winner == "draw" else (player1_id if winner == "player1" else player2_id)
    settle_result = settle_practice_game(
        practice_game_id,
        winner_id,
        reason="draw" if winner_id is None else "completed",
    )
    if not settle_result.get("ok"):
        logger.error("Error settling Demo Duel %s: %s", practice_game_id, settle_result.get("error"))
        try:
            await context.bot.send_message(chat_id=player1_id, text=t1("duel.settle_error_practice", default="❌ Could not settle the Demo Duel result."))
            await context.bot.send_message(chat_id=player2_id, text=t2("duel.settle_error_practice", default="❌ Could not settle the Demo Duel result."))
        except Exception as exc:
            logger.exception("Failed to send Demo settlement error for %s: %s", practice_game_id, exc)
        return
    # Atomic notification ownership: only the transaction that actually moved
    # Demo balances sends final messages. Concurrent roll/timeout handlers see
    # already_settled and exit without duplicate results.
    if settle_result.get("already_settled"):
        return

    try:
        player1_info = await context.bot.get_chat(player1_id)
        player2_info = await context.bot.get_chat(player2_id)
        player1_name = player1_info.first_name
        player2_name = player2_info.first_name
    except Exception:
        player1_name, player2_name = "Player 1", "Player 2"

    if game.get("current_turn") == player1_id:
        second_roller_id, second_roller_value = player2_id, player2_roll
    else:
        second_roller_id, second_roller_value = player1_id, player1_roll
    try:
        second_t = t1 if second_roller_id == player1_id else t2
        await context.bot.send_message(
            chat_id=second_roller_id,
            text=second_t(
                "duel.practice_roll_confirm",
                default="✅ Demo roll: {emoji} ({value})",
                emoji=get_dice_emoji(second_roller_value),
                value=second_roller_value,
            ),
            reply_markup=remove_reply_keyboard(),
        )
    except Exception as exc:
        logger.debug("Could not send second Demo roll confirmation for %s: %s", practice_game_id, exc)

    payout = float(settle_result.get("payout_amount") or 0)
    fee = float(settle_result.get("fee_amount") or 0)
    fee_bps = int(settle_result.get("fee_bps") or 0)
    result_text_p1 = _format_practice_result_text(
        player1_name,
        player1_roll,
        player2_name,
        player2_roll,
        winner,
        stake_amount,
        payout_amount=payout,
        fee_amount=fee,
        fee_bps=fee_bps,
        t=t1,
    )
    result_text_p2 = _format_practice_result_text(
        player1_name,
        player1_roll,
        player2_name,
        player2_roll,
        winner,
        stake_amount,
        payout_amount=payout,
        fee_amount=fee,
        fee_bps=fee_bps,
        t=t2,
    )
    try:
        await context.bot.send_message(
            chat_id=player1_id,
            text=f"{t1('duel.finish.practice', default='🧪 <b>Demo Duel finished.</b>')}\n\n{result_text_p1}",
            parse_mode=ParseMode.HTML,
            reply_markup=remove_reply_keyboard(),
        )
        await context.bot.send_message(
            chat_id=player2_id,
            text=f"{t2('duel.finish.practice', default='🧪 <b>Demo Duel finished.</b>')}\n\n{result_text_p2}",
            parse_mode=ParseMode.HTML,
            reply_markup=remove_reply_keyboard(),
        )
        await context.bot.send_message(
            chat_id=player1_id,
            text=t1("duel.practice_ready", default="🧪 Choose what to do next:"),
            reply_markup=get_practice_result_actions_keyboard(
                practice_game_id,
                t=t1,
                can_restore=can_restore_practice_balance(player1_id),
            ),
        )
        await context.bot.send_message(
            chat_id=player2_id,
            text=t2("duel.practice_ready", default="🧪 Choose what to do next:"),
            reply_markup=get_practice_result_actions_keyboard(
                practice_game_id,
                t=t2,
                can_restore=can_restore_practice_balance(player2_id),
            ),
        )
    except Exception as exc:
        logger.error("Error sending Demo final message for %s: %s", practice_game_id, exc)
    _clear_timer_scope(f"practice:{practice_game_id}")


async def _handle_practice_series_round_progress(context, game: dict, result: dict) -> None:
    """Render one Demo BO3 transition and settle Demo balances exactly once."""
    practice_game_id = int(game["practice_game_id"])
    player1_id = int(game["player1_id"])
    player2_id = int(game["player2_id"])
    t1 = get_t(player1_id)
    t2 = get_t(player2_id)
    player1_name, player2_name = await _duel_player_names(context, player1_id, player2_id)

    round_number = int(result.get("round_number") or game.get("current_round") or 1)
    player1_roll = int(result.get("player1_roll") or 0)
    player2_roll = int(result.get("player2_roll") or 0)
    player1_wins = int(result.get("player1_wins") or game.get("player1_round_wins") or 0)
    player2_wins = int(result.get("player2_wins") or game.get("player2_round_wins") or 0)
    score = f"{player1_wins}–{player2_wins}"

    if result.get("series_complete"):
        is_draw = bool(result.get("series_draw")) or (
            result.get("winner_id") is None
            and str(game.get("status_reason") or "") == "series_draw_limit"
        )
        winner_id = None if is_draw else int(result.get("winner_id") or game.get("winner_id") or 0)
        settle_result = settle_practice_game(
            practice_game_id,
            winner_id or None,
            reason="draw" if is_draw else "completed",
        )
        if not settle_result.get("ok"):
            logger.error(
                "Demo BO3 settlement failed for game %s: %s",
                practice_game_id,
                settle_result.get("error"),
            )
            recovery_default = (
                "⚠️ The Demo match score was saved, but Demo settlement could not be completed "
                "immediately. Restart recovery will retry safely."
            )
            for uid, translator in ((player1_id, t1), (player2_id, t2)):
                try:
                    await context.bot.send_message(
                        chat_id=uid,
                        text=translator("practice.series.settle_recovery", default=recovery_default),
                        reply_markup=remove_reply_keyboard(),
                    )
                except Exception:
                    pass
            return
        if settle_result.get("already_settled"):
            return

        if is_draw:
            def final_text(translator):
                return translator(
                    "practice.series.finished_draw",
                    default=(
                        "🤝 <b>Demo Best of 3 finished as a draw.</b>\n\n"
                        "The safety draw limit was reached.\n"
                        "Final score: <b>{score}</b>\n"
                        "💎 Both Demo stakes were returned. No real GRAM was used."
                    ),
                    score=score,
                )
        else:
            winner_name = player1_name if winner_id == player1_id else player2_name
            payout = _format_practice_amount(float(settle_result.get("payout_amount") or 0))
            fee = _format_practice_amount(float(settle_result.get("fee_amount") or 0))
            fee_percent = int(settle_result.get("fee_bps") or 0) / 100

            def final_text(translator):
                return translator(
                    "practice.series.finished",
                    default=(
                        "🏆 <b>{winner} wins the Demo Best of 3!</b>\n\n"
                        "Final score: <b>{score}</b>\n"
                        "💎 Demo stake per player: <b>{stake}</b>\n"
                        "🏆 Demo payout: <b>{payout}</b>\n"
                        "💸 Demo fee: <b>{fee}</b> ({percent:.2f}%)\n"
                        "No real GRAM was used."
                    ),
                    winner=escape(winner_name),
                    score=score,
                    stake=_format_practice_amount(game.get("stake_amount") or 0),
                    payout=payout,
                    fee=fee,
                    percent=fee_percent,
                )

        for uid, translator in ((player1_id, t1), (player2_id, t2)):
            try:
                await _send_result_with_keyboard_cleanup(
                    context.bot,
                    chat_id=uid,
                    result_text=final_text(translator),
                    actions_markup=get_practice_result_actions_keyboard(
                        practice_game_id,
                        t=translator,
                        can_restore=can_restore_practice_balance(uid),
                    ),
                    t=translator,
                    actions_text_key="duel.practice_ready",
                    actions_text_default="🧪 Choose what to do next:",
                )
            except Exception as exc:
                logger.exception(
                    "Failed to send Demo BO3 result for game %s to %s: %s",
                    practice_game_id,
                    uid,
                    exc,
                )
        _clear_timer_scope(f"practice:{practice_game_id}")
        return

    if result.get("round_draw"):
        def progress_text(translator):
            return translator(
                "practice.series.round_draw",
                default=(
                    "🤝 <b>Demo round {round} is a draw.</b>\n\n"
                    "{player1}: {roll1} — {player2}: {roll2}\n"
                    "Score: <b>{score}</b>\n\n"
                    "🎲 Replay the same round. Send a fresh Demo dice roll."
                ),
                round=round_number,
                player1=escape(player1_name),
                player2=escape(player2_name),
                roll1=player1_roll,
                roll2=player2_roll,
                score=score,
            )
    else:
        round_winner_id = int(result.get("round_winner_id") or 0)
        round_winner_name = player1_name if round_winner_id == player1_id else player2_name
        next_round = int(result.get("next_round") or round_number + 1)

        def progress_text(translator):
            return translator(
                "practice.series.round_complete",
                default=(
                    "🎯 <b>Demo round {round}: {winner} wins.</b>\n\n"
                    "{player1}: {roll1} — {player2}: {roll2}\n"
                    "Score: <b>{score}</b>\n\n"
                    "🎲 Demo round {next_round}: send a fresh dice roll."
                ),
                round=round_number,
                winner=escape(round_winner_name),
                player1=escape(player1_name),
                player2=escape(player2_name),
                roll1=player1_roll,
                roll2=player2_roll,
                score=score,
                next_round=next_round,
            )

    for uid, translator in ((player1_id, t1), (player2_id, t2)):
        try:
            await context.bot.send_message(
                chat_id=uid,
                text=progress_text(translator),
                parse_mode=ParseMode.HTML,
                reply_markup=get_game_keyboard(),
            )
        except Exception as exc:
            logger.exception(
                "Failed to send Demo BO3 round state for game %s to %s: %s",
                practice_game_id,
                uid,
                exc,
            )

    await start_practice_timers(
        context,
        practice_game_id,
        player1_id,
        player2_id,
        deadline_at=result.get("deadline_at"),
    )


async def _handle_practice_series_dice_roll(update: Update, context, active_game: dict, dice_value: int, t) -> None:
    """Accept one Demo BO3 roll through the locked Demo series state machine."""
    msg = update.message
    user_id = int(update.effective_user.id)
    practice_game_id = int(active_game["practice_game_id"])
    player1_id = int(active_game["player1_id"])
    player2_id = int(active_game["player2_id"])

    roll_result = record_practice_series_roll(
        practice_game_id,
        user_id,
        dice_value,
        expected_round=int(active_game.get("current_round") or 1),
        expected_attempt=int(active_game.get("current_attempt") or 1),
    )
    if not roll_result.get("ok"):
        error = str(roll_result.get("error") or "")
        if error in {"game_not_active", "game_not_found"}:
            text = t("duel.error.no_active", default="❌ This Demo Duel is no longer active.")
        else:
            text = t(
                "practice.series.roll_error",
                default="❌ The Demo round could not be recorded. Refresh Demo Mode and try again.",
            )
        await msg.reply_text(text, reply_markup=remove_reply_keyboard())
        return
    if not roll_result.get("accepted"):
        if roll_result.get("already_rolled"):
            await msg.reply_text(
                t(
                    "practice.series.already_rolled",
                    default="❗ You already rolled in this Demo round. Wait for your opponent.",
                )
            )
        elif roll_result.get("stale_roll_context"):
            await msg.reply_text(
                t(
                    "practice.series.stale_roll",
                    default="↩️ That dice update belongs to the previous Demo round and was ignored. Use the current round prompt.",
                ),
                reply_markup=remove_reply_keyboard(),
            )
        return

    await cancel_timers(f"practice:{practice_game_id}", user_id)
    opponent_id = player2_id if user_id == player1_id else player1_id
    try:
        await context.bot.forward_message(
            chat_id=opponent_id,
            from_chat_id=update.effective_chat.id,
            message_id=msg.message_id,
        )
    except Forbidden:
        logger.exception(
            "Opponent %s blocked the bot during Demo BO3 game %s",
            opponent_id,
            practice_game_id,
        )
        await msg.reply_text(t("duel.error.opponent_blocked", default="❌ Opponent blocked the bot or is unavailable."))
    except BadRequest as exc:
        logger.exception("Bad request forwarding Demo BO3 dice for game %s: %s", practice_game_id, exc)
        await msg.reply_text(t("duel.error.send_dice_failed", default="❌ Failed to send dice to opponent."))
    except Exception as exc:
        logger.exception("Unexpected Demo BO3 dice forwarding error for game %s: %s", practice_game_id, exc)
        await msg.reply_text(t("duel.error.system_error", default="❌ System error sending dice."))

    if not roll_result.get("round_complete"):
        await msg.reply_text(
            t(
                "practice.series.roll_waiting",
                default=(
                    "✅ Demo round {round} roll: {emoji} ({value})\n"
                    "📊 Score: {score1}–{score2}\n"
                    "⏳ Waiting for the opponent's roll..."
                ),
                round=roll_result.get("round_number") or 1,
                emoji=get_dice_emoji(dice_value),
                value=dice_value,
                score1=roll_result.get("player1_wins") or 0,
                score2=roll_result.get("player2_wins") or 0,
            ),
            reply_markup=remove_reply_keyboard(),
        )
        return

    updated_game = get_practice_game_by_id(practice_game_id)
    if not updated_game:
        return
    await _handle_practice_series_round_progress(context, updated_game, roll_result)


async def _send_result_with_keyboard_cleanup(
    bot,
    *,
    chat_id: int,
    result_text: str,
    actions_markup,
    t,
    actions_text_key: str = "duel.play_again",
    actions_text_default: str = "🎲 Want to open another duel?",
) -> None:
    """Remove the persistent dice keyboard before showing inline result actions.

    Telegram accepts only one reply_markup type per message, so a persistent
    ReplyKeyboardMarkup cannot be removed on the same message that carries
    InlineKeyboardMarkup actions. The terminal result therefore removes the
    reply keyboard first, then sends a compact inline action panel.
    """
    await bot.send_message(
        chat_id=chat_id,
        text=result_text,
        parse_mode=ParseMode.HTML,
        reply_markup=remove_reply_keyboard(),
    )
    await bot.send_message(
        chat_id=chat_id,
        text=t(actions_text_key, default=actions_text_default),
        reply_markup=actions_markup,
    )


async def _duel_player_names(context, player1_id: int, player2_id: int) -> tuple[str, str]:
    """Resolve display names best-effort without affecting gameplay truth."""
    try:
        player1_info = await context.bot.get_chat(player1_id)
        player2_info = await context.bot.get_chat(player2_id)
        return player1_info.first_name or "Player 1", player2_info.first_name or "Player 2"
    except Exception:
        return "Player 1", "Player 2"


async def _handle_series_round_progress(context, game: dict, result: dict) -> None:
    """Render one BO3 state transition and settle exactly once at match end."""
    game_id = int(game["game_id"])
    player1_id = int(game["player1_id"])
    player2_id = int(game["player2_id"])
    t1 = get_t(player1_id)
    t2 = get_t(player2_id)
    player1_name, player2_name = await _duel_player_names(context, player1_id, player2_id)
    is_tournament_match = is_tournament_no_payout_game(game)

    round_number = int(result.get("round_number") or game.get("current_round") or 1)
    player1_roll = int(result.get("player1_roll") or 0)
    player2_roll = int(result.get("player2_roll") or 0)
    player1_wins = int(result.get("player1_wins") or 0)
    player2_wins = int(result.get("player2_wins") or 0)
    score = f"{player1_wins}–{player2_wins}"

    if result.get("series_complete"):
        is_draw = bool(result.get("series_draw"))
        winner_id = None if is_draw else int(result.get("winner_id") or 0)
        settle_result = settle_game(
            game_id,
            winner_id or None,
            reason="draw" if is_draw else "completed",
        )
        if not settle_result.get("ok"):
            logger.error(
                "BO3 settlement failed for game %s: %s",
                game_id,
                settle_result.get("error"),
            )
            recovery_default = (
                "⚠️ The match score was saved, but settlement could not be completed "
                "immediately. The durable recovery job will retry automatically."
            )
            for uid, translator in ((player1_id, t1), (player2_id, t2)):
                try:
                    await context.bot.send_message(
                        chat_id=uid,
                        text=translator("duel.series.settle_recovery", default=recovery_default),
                        reply_markup=remove_reply_keyboard(),
                    )
                except Exception:
                    pass
            return
        if settle_result.get("already_settled"):
            # Tournament advancement is a separate durable state transition.
            # Replay it after a crash even when the no-payout game settlement
            # already committed, but do not duplicate terminal player cards.
            if is_tournament_match:
                await _notify_tournament_progress(context, game_id, winner_id or None)
            _clear_timer_scope(game_id)
            return

        tournament_progress = (
            await _notify_tournament_progress(context, game_id, winner_id or None)
            if is_tournament_match
            else {"action": "none"}
        )

        if is_tournament_match and is_draw:
            def final_text(translator):
                return translator(
                    "tournament.match.bo3_manual_review",
                    default=(
                        "⚠️ <b>Best-of-3 tournament match paused.</b>\n\n"
                        "Final score: <b>{score}</b>\n"
                        "No verified winner exists, so the bracket was paused for review."
                    ),
                    score=score,
                )
        elif is_tournament_match:
            winner_name = player1_name if winner_id == player1_id else player2_name

            def final_text(translator):
                return translator(
                    "tournament.match.bo3_finished",
                    default=(
                        "🏆 <b>{winner} wins the tournament match!</b>\n\n"
                        "Format: Best of 3\n"
                        "Final score: <b>{score}</b>\n"
                        "✅ The winner advances. No separate match payout was made."
                    ),
                    winner=escape(winner_name),
                    score=score,
                )
        elif is_draw:
            def final_text(translator):
                return translator(
                    "duel.series.finished_draw",
                    default=(
                        "🤝 <b>Best of 3 finished as a draw.</b>\n\n"
                        "The safety draw limit was reached.\n"
                        "Final score: <b>{score}</b>\n"
                        "💰 Both stakes were returned. No platform fee was charged."
                    ),
                    score=score,
                )
        else:
            winner_name = player1_name if winner_id == player1_id else player2_name

            def final_text(translator):
                return translator(
                    "duel.series.finished",
                    default=(
                        "🏆 <b>{winner} wins the Best of 3!</b>\n\n"
                        "Final score: <b>{score}</b>\n"
                        "💰 Stake per player: <b>{amount}</b>\n"
                        "✅ One final settlement was applied for the whole match."
                    ),
                    winner=escape(winner_name),
                    score=score,
                    amount=format_balance_display(game.get("bet_amount") or 0),
                )

        for uid, translator in ((player1_id, t1), (player2_id, t2)):
            try:
                if is_tournament_match:
                    tournament_id = tournament_progress.get("tournament_id")
                    actions_markup = InlineKeyboardMarkup([
                        [InlineKeyboardButton(
                            translator("tournament.btn.status", default="📊 Статус турнира"),
                            callback_data=f"tournament_status_{tournament_id}",
                        )],
                        [InlineKeyboardButton(
                            translator("tournament.btn.menu", default="🏆 Меню турниров"),
                            callback_data="tournament_menu",
                        )],
                    ])
                    await _send_result_with_keyboard_cleanup(
                        context.bot,
                        chat_id=uid,
                        result_text=final_text(translator),
                        actions_markup=actions_markup,
                        t=translator,
                        actions_text_key="tournament.match.next_actions",
                        actions_text_default="🏆 Откройте сетку турнира:",
                    )
                else:
                    await _send_result_with_keyboard_cleanup(
                        context.bot,
                        chat_id=uid,
                        result_text=final_text(translator),
                        actions_markup=get_result_actions_keyboard(
                            get_result_share_payload(game_id=game_id, user_id=uid, t=translator),
                            game_id=game_id,
                            t=translator,
                        ),
                        t=translator,
                    )
            except Exception as exc:
                logger.exception("Failed to send BO3 result for game %s to %s: %s", game_id, uid, exc)

        try:
            from services.observability import metrics as _obs
            _obs.inc("duel_series.completed")
            if is_draw:
                _obs.inc("duel_series.draw_limit")
        except Exception:
            pass
        if not is_tournament_match:
            try:
                await safe_finish_publish(context, game_id)
            except Exception as exc:
                logger.exception("Failed to publish BO3 result for game %s: %s", game_id, exc)
        _clear_timer_scope(game_id)
        return

    if result.get("round_draw"):
        def progress_text(translator):
            return translator(
                "duel.series.round_draw",
                default=(
                    "🤝 <b>Round {round} is a draw.</b>\n\n"
                    "{player1}: {roll1} — {player2}: {roll2}\n"
                    "Score: <b>{score}</b>\n\n"
                    "🎲 Replay the same round. Send a fresh dice roll."
                ),
                round=round_number,
                player1=escape(player1_name),
                player2=escape(player2_name),
                roll1=player1_roll,
                roll2=player2_roll,
                score=score,
            )
    else:
        round_winner_id = int(result.get("round_winner_id") or 0)
        round_winner_name = player1_name if round_winner_id == player1_id else player2_name
        next_round = int(result.get("next_round") or round_number + 1)

        def progress_text(translator):
            return translator(
                "duel.series.round_complete",
                default=(
                    "🎯 <b>Round {round}: {winner} wins.</b>\n\n"
                    "{player1}: {roll1} — {player2}: {roll2}\n"
                    "Score: <b>{score}</b>\n\n"
                    "🎲 Round {next_round}: send a fresh dice roll."
                ),
                round=round_number,
                winner=escape(round_winner_name),
                player1=escape(player1_name),
                player2=escape(player2_name),
                roll1=player1_roll,
                roll2=player2_roll,
                score=score,
                next_round=next_round,
            )

    for uid, translator in ((player1_id, t1), (player2_id, t2)):
        try:
            await context.bot.send_message(
                chat_id=uid,
                text=progress_text(translator),
                parse_mode=ParseMode.HTML,
                reply_markup=get_game_keyboard(),
            )
        except Exception as exc:
            logger.exception("Failed to send BO3 round state for game %s to %s: %s", game_id, uid, exc)

    try:
        from services.observability import metrics as _obs
        _obs.inc("duel_series.round_completed")
        if result.get("round_draw"):
            _obs.inc("duel_series.round_draw")
    except Exception:
        pass

    await start_timers(
        context,
        game_id,
        player1_id,
        player2_id,
        deadline_at=result.get("deadline_at"),
    )


async def _handle_series_dice_roll(update: Update, context, active_game: dict, dice_value: int, t) -> None:
    """Accept one BO3 roll through the locked series state machine."""
    msg = update.message
    user_id = int(update.effective_user.id)
    game_id = int(active_game["game_id"])
    player1_id = int(active_game["player1_id"])
    player2_id = int(active_game["player2_id"])

    roll_result = record_series_roll(game_id, user_id, dice_value)
    if not roll_result.get("ok"):
        error = str(roll_result.get("error") or "")
        if error in {"game_not_active", "game_not_found"}:
            text = t("duel.error.no_active", default="❌ This duel is no longer active.")
        else:
            text = t("duel.series.roll_error", default="❌ The round could not be recorded. Please refresh the duel status.")
        await msg.reply_text(text, reply_markup=remove_reply_keyboard())
        return
    if not roll_result.get("accepted"):
        if roll_result.get("already_rolled"):
            await msg.reply_text(
                t("duel.series.already_rolled", default="❗ You already rolled in this round. Wait for your opponent."),
            )
        return

    await cancel_timers(game_id, user_id)
    opponent_id = player2_id if user_id == player1_id else player1_id
    try:
        await context.bot.forward_message(
            chat_id=opponent_id,
            from_chat_id=update.effective_chat.id,
            message_id=msg.message_id,
        )
    except Forbidden:
        logger.exception("Opponent %s blocked the bot during BO3 game %s", opponent_id, game_id)
        await msg.reply_text(t("duel.error.opponent_blocked", default="❌ Opponent blocked the bot or is unavailable."))
    except BadRequest as exc:
        logger.exception("Bad request forwarding BO3 dice for game %s: %s", game_id, exc)
        await msg.reply_text(t("duel.error.send_dice_failed", default="❌ Failed to send dice to opponent."))
    except Exception as exc:
        logger.exception("Unexpected error forwarding BO3 dice for game %s: %s", game_id, exc)
        await msg.reply_text(t("duel.error.system_error", default="❌ System error sending dice."))

    if not roll_result.get("round_complete"):
        await msg.reply_text(
            t(
                "duel.series.roll_waiting",
                default=(
                    "✅ Round {round} roll: {emoji} ({value})\n"
                    "📊 Score: {score1}–{score2}\n"
                    "⏳ Waiting for the opponent's roll..."
                ),
                round=roll_result.get("round_number") or 1,
                emoji=get_dice_emoji(dice_value),
                value=dice_value,
                score1=roll_result.get("player1_wins") or 0,
                score2=roll_result.get("player2_wins") or 0,
            ),
            reply_markup=remove_reply_keyboard(),
        )
        return

    updated_game = get_game_by_id(game_id)
    if not updated_game:
        return
    await _handle_series_round_progress(context, updated_game, roll_result)



@rate_limit(max_calls=5, period=60)
@guarded
async def handle_dice_roll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle a dice roll for either real or practice duels."""
    user_id = update.effective_user.id
    msg = update.message
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    # @guarded already enforces private-only via _is_allowed_in_chat,
    # but dice in groups should always be silently ignored:
    if msg.chat.type != 'private':
        return
    if (
        user_id not in ADMIN_IDS and (
            (hasattr(msg, "forward_origin") and msg.forward_origin)
            or (hasattr(msg, "forward_date") and msg.forward_date)
            or (hasattr(msg, "forward_sender_name") and msg.forward_sender_name)
        )
    ):
        await msg.reply_text(t("duel.error.forwarded_dice", default="❌ Forwarded dice do not count. Send a fresh roll instead."))
        return

    dice_value = msg.dice.value
    logger.info("DICE ROLL: user=%s value=%s", user_id, dice_value)

    mode, active_game = _get_active_duel_context(user_id)
    if not active_game:
        await msg.reply_text(
            t("duel.error.no_active", default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
            reply_markup=remove_reply_keyboard(),
        )
        await msg.reply_text(
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    # Guard: for real-mode duels, check the game is still active
    if mode != 'practice' and active_game.get("status") != "active":
        await msg.reply_text(
            t("duel.error.no_active", default="❌ You do not have an active duel.\nCreate one or join an open duel first."),
            reply_markup=remove_reply_keyboard(),
        )
        await msg.reply_text(
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
        )
        return

    if mode == 'practice':
        practice_game_id = int(active_game['practice_game_id'])
        player1_id = active_game['player1_id']
        player2_id = active_game['player2_id']
        if is_series_format(active_game.get("duel_format") or DUEL_FORMAT_SINGLE):
            await _handle_practice_series_dice_roll(update, context, active_game, dice_value, t)
            return
        if (user_id == player1_id and active_game['player1_roll'] > 0) or (user_id == player2_id and active_game['player2_roll'] > 0):
            await msg.reply_text(t("duel.error.already_rolled_practice", default="❗ You already rolled in this practice duel."))
            return
        roll_result = update_practice_game_roll(practice_game_id, user_id, dice_value)
        if not roll_result.get("ok"):
            if roll_result.get("already_rolled"):
                await msg.reply_text(t("duel.error.already_rolled_practice", default="❗ You already rolled in this Demo Duel."))
            else:
                await msg.reply_text(t("duel.error.no_active", default="❌ This Demo Duel is no longer active."))
            return
        await cancel_timers(f"practice:{practice_game_id}", user_id)
        opponent_id = player2_id if user_id == player1_id else player1_id
        try:
            await context.bot.forward_message(
                chat_id=opponent_id,
                from_chat_id=update.effective_chat.id,
                message_id=msg.message_id,
            )
        except Forbidden:
            logger.exception(f"Opponent {opponent_id} blocked the bot")
            await msg.reply_text(t("duel.error.opponent_blocked", default="❌ Opponent blocked the bot or is unavailable."))
        except BadRequest as e:
            logger.exception(f"Bad request forwarding dice: {e}")
            await msg.reply_text(t("duel.error.send_dice_failed", default="❌ Failed to send dice to opponent."))
        except Exception as e:
            logger.exception(f"Unexpected error forwarding practice dice: {e}")
            await msg.reply_text(t("duel.error.system_error", default="❌ System error sending dice."))
        updated_game = get_practice_game_by_id(practice_game_id)
        if not updated_game or updated_game.get("status") != "active":
            return
        player1_roll = int(updated_game.get('player1_roll') or 0)
        player2_roll = int(updated_game.get('player2_roll') or 0)
        if player1_roll > 0 and player2_roll > 0:
            await handle_practice_game_finish(context, updated_game)
        else:
            await msg.reply_text(
                t("duel.practice_roll_waiting",
                  default="✅ Practice roll: {emoji} ({value})\n⏳ Waiting for the opponent's roll...",
                  emoji=get_dice_emoji(dice_value), value=dice_value),
                reply_markup=remove_reply_keyboard(),
            )
        return

    if is_series_format(active_game.get("duel_format") or DUEL_FORMAT_SINGLE):
        await _handle_series_dice_roll(update, context, active_game, dice_value, t)
        return

    game_id = active_game['game_id']
    player1_id = active_game['player1_id']
    player2_id = active_game['player2_id']
    if (user_id == player1_id and active_game['player1_roll'] > 0) or (user_id == player2_id and active_game['player2_roll'] > 0):
        await msg.reply_text(t("duel.error.already_rolled", default="❗ You already rolled in this duel."))
        return
    update_game_roll(game_id, user_id, dice_value)
    await cancel_timers(game_id, user_id)

    opponent_id = player2_id if user_id == player1_id else player1_id
    try:
        await context.bot.forward_message(
            chat_id=opponent_id,
            from_chat_id=update.effective_chat.id,
            message_id=msg.message_id,
        )
    except Forbidden:
        logger.exception(f"Opponent {opponent_id} blocked the bot")
        await msg.reply_text(t("duel.error.opponent_blocked", default="❌ Opponent blocked the bot or is unavailable."))
    except BadRequest as e:
        logger.exception(f"Bad request forwarding dice: {e}")
        await msg.reply_text(t("duel.error.send_dice_failed", default="❌ Failed to send dice to opponent."))
    except Exception as e:
        logger.exception(f"Unexpected error forwarding dice: {e}")
        await msg.reply_text(t("duel.error.system_error", default="❌ System error sending dice."))
    updated_game = get_active_game(user_id)
    player1_roll = updated_game['player1_roll']
    player2_roll = updated_game['player2_roll']
    if player1_roll > 0 and player2_roll > 0:
        await handle_game_finish(context, updated_game)
        _clear_timer_scope(game_id)
    else:
        await msg.reply_text(
            t("duel.roll_waiting",
              default="✅ Your roll: {emoji} ({value})\n⏳ Waiting for the opponent's roll...",
              emoji=get_dice_emoji(dice_value), value=dice_value),
            reply_markup=remove_reply_keyboard(),
        )


async def handle_profile_callback(query, context):
    """Show profile with stats and wallet info."""
    from services.i18n import get_translator
    lang = context.user_data.get("lang", "en")
    t = context.user_data.get("t", get_translator(lang))
    user_id = query.from_user.id
    snapshot = get_profile_snapshot(user_id)
    await safe_edit_message(query.message,
        render_profile_text(snapshot, t=t),
        reply_markup=get_profile_keyboard(t=t, lang=lang),
        parse_mode=ParseMode.HTML,
    )

async def handle_language_toggle_callback(query, context):
    """Toggle user language between 'en' and 'ru' from the Profile screen."""
    from services.i18n import get_translator, SUPPORTED_LANGS
    await safe_answer_callback(query)
    user_id = query.from_user.id

    current_lang = context.user_data.get("lang", "en")
    # Cycle through supported langs: en → ru → en → …
    supported = sorted(SUPPORTED_LANGS)  # ['en', 'ru']
    try:
        idx = supported.index(current_lang)
        new_lang = supported[(idx + 1) % len(supported)]
    except ValueError:
        new_lang = "en"

    # Persist + update session
    set_user_language(user_id, new_lang)
    context.user_data["lang"] = new_lang
    context.user_data["t"] = get_translator(new_lang)
    t = context.user_data["t"]

    # Re-render profile in the new language
    snapshot = get_profile_snapshot(user_id)
    await safe_edit_message(
        query.message,
        render_profile_text(snapshot, t=t),
        reply_markup=get_profile_keyboard(t=t, lang=new_lang),
        parse_mode=ParseMode.HTML,
    )


async def handle_history_callback(query, context):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = query.from_user.id
    snapshot = get_duel_history(user_id, limit=10)

    # Extract last 3 real duels with opponent (for rematch buttons)
    # Keys from services/social.py _history_row_from_game:
    # "id", "mode", "resultKind", "opponent", "stakeDisplay", "isPractice"
    rematch_candidates = [
        item for item in snapshot.get("items", [])
        if not item.get("isPractice")
        and item.get("resultKind") in ("win", "loss", "draw")
        and item.get("id")
    ][:3]

    await safe_edit_message(query.message,
        render_duel_history_text(snapshot, t=t),
        reply_markup=get_duel_history_keyboard(
            bool(snapshot.get('items')),
            t=t,
            demo_mode_enabled=_is_demo_mode_enabled(),
            rematch_items=rematch_candidates,
        ),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


# ==================== PRO REFERRAL CABINET HANDLERS ====================

async def handle_ref_cabinet(query, context):
    """Pro Referral Cabinet — главный экран"""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    dash = get_referral_dashboard(user_id)
    level = dash.get("level") or {}
    try:
        progress = int(level.get("progress") or 0)
    except Exception:
        progress = 0
    progress = max(0, min(100, progress))
    lines = [
        t("referral.cabinet_title", default="🏆 <b>Referral Cabinet</b>"),
        "",
        t("referral.earn_rate", default="💰 You earn <b>20%</b> of the rake from each referral game."),
        t("referral.progress", default="Progress to next tier:"),
        f"{render_progress_bar(progress, width=10)} {progress}%",
        t("referral.need_more", default="Need {invites} more invites for {next}", invites=level.get('invites_for_next', 0), next=level.get('next_tier', 'next tier')),
        "",
        t("referral.total_invited", default="👥 Total invited: <b>{total}</b>", total=dash['total_invited']),
        t("referral.active_players", default="🟢 Active players: <b>{active}</b>", active=dash['active_invited']),
        t("referral.your_code", default="🔗 Your code: <code>{code}</code>", code=dash['invite_code']),
        "",
        t("referral.recent_label", default="<b>Recent referrals:</b>"),
    ]
    for r in dash.get('recent_referrals', []):
        name = r.get("first_name") or f"User {r['user_id']}"
        status = "🟢" if r.get("is_activated") else "🟡"
        lines.append(f"{status} {escape(name)} — {_format_timestamp(r.get('created_at'))}")
    try:
        from services.referrals import get_weekly_challenge_status
        challenge = get_weekly_challenge_status(user_id)
        lines += [
            "",
            t("referral.weekly.title", default="🎯 <b>Weekly Challenge</b>"),
            t("referral.weekly.invite", default="Invite {target} friends this week", target=challenge['target']),
            f"{render_progress_bar(challenge.get('progress', 0), width=10)} {challenge.get('progress', 0)}%",
            f"({challenge['invited']}/{challenge['target']})",
            t("referral.weekly.reward", default="🎁 Reward: +{reward:.1f} GRAM", reward=challenge['reward']),
        ]
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    keyboard = [
        [InlineKeyboardButton(t("ref.tab.invitees", default="👥 Invitees"), callback_data="ref_list_1"), InlineKeyboardButton(t("ref.tab.stats", default="📊 Statistics"), callback_data="ref_stats")],
        [InlineKeyboardButton(t("ref.tab.earnings", default="💰 Earnings"), callback_data="ref_earnings")],
        [InlineKeyboardButton(t("ref.tab.tiers", default="🏅 Tiers"), callback_data="ref_tiers"), InlineKeyboardButton(t("ref.tab.leaderboard", default="🏆 Leaderboard"), callback_data="ref_leaderboard")],
        [InlineKeyboardButton(t("btn.invite_friends", default="📨 Invite Friends"), callback_data="invite_main"), InlineKeyboardButton(t("ref.tab.share_duel", default="📤 Share Duel"), callback_data="ref_share_duel")],
        [InlineKeyboardButton(t("ref.tab.how", default="❓ How It Works"), callback_data="ref_how_it_works"), InlineKeyboardButton(t("btn.back_profile", default="◀️ Back to Profile"), callback_data="profile")],
    ]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard), disable_web_page_preview=True)


async def handle_ref_share_card(query, context):
    """Показать красивую карточку приглашения с превью."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.referrals import get_referral_snapshot
    snapshot = get_referral_snapshot(user_id)
    invite_link = str(snapshot.get("inviteLink") or "").strip()

    if not invite_link:
        await safe_edit_message(query.message,
            "❌ Invite link is not ready yet.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")]])
        )
        return

    text = render_invite_card_text(snapshot, t=t)
    keyboard = get_invite_card_keyboard(invite_link, t=t)

    await safe_edit_message(query.message,
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
        disable_web_page_preview=False  # Показываем превью!
    )


async def handle_ref_share_duel(query, context):
    """Share an active/open duel with invite link — friend joins the bot AND the duel."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id

    # Find the user's latest open or active duel
    import database
    conn = database.get_connection()
    ph = "%s" if database.using_postgres() else "?"
    try:
        row = conn.execute(
            f"""SELECT game_id, bet_amount FROM games
                WHERE (player1_id = {ph} OR player2_id = {ph})
                AND status IN ('waiting', 'active')
                ORDER BY created_at DESC LIMIT 1""",
            (user_id, user_id)
        ).fetchone()
    except Exception:
        row = None
    finally:
        conn.close()

    from services.referrals import get_referral_snapshot
    snapshot = get_referral_snapshot(user_id)
    invite_code = str(snapshot.get("inviteCode") or "").strip()
    bot_username = __import__("os").getenv("BOT_USERNAME", "rollduelbot")

    if row:
        game_id = row[0] if not hasattr(row, 'get') else row.get("game_id")
        bet = row[1] if not hasattr(row, 'get') else row.get("bet_amount", 0)
        # Deep link: start the bot with ref code AND duel id embedded
        # Format: start=ref_{invite_code}_duel_{game_id}
        start_param = f"ref_{invite_code}_duel_{game_id}" if invite_code else f"duel_{game_id}"
        duel_link = f"https://t.me/{bot_username}?start={start_param}"
        text = t(
            "ref.share_duel.active_text",
            default=(
                "⚔️ <b>Challenge me on Roll Duel!</b>\n\n"
                "I created a duel for <b>{bet:.2f} GRAM</b> — join and let's roll!\n\n"
                "🎲 Tap the link to join the bot and enter the duel directly:\n"
                "👇 {link}\n\n"
                "Winner takes all. First come, first served!"
            ),
            bet=float(bet),
            link=duel_link,
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(t("ref.share_duel.join_btn", default="⚔️ Join this Duel"), url=duel_link)],
            [InlineKeyboardButton(t("ref.share_duel.share_btn", default=t("btn.share_telegram", default="📨 Share in Telegram")), switch_inline_query=f"duel_{game_id}")],
            [InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")],
        ])
    else:
        # No active duel — show regular invite instead
        invite_link = str(snapshot.get("inviteLink") or f"https://t.me/{bot_username}?start={invite_code}").strip()
        text = t(
            "ref.share_duel.no_active_text",
            default=(
                "ℹ️ <b>No active duel found.</b>\n\n"
                "Create a duel first, then share it so friends can join directly.\n\n"
                "Or share your general invite link to bring friends to Roll Duel:"
            ),
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(t("ref.share_duel.copy_invite_btn", default="📋 Copy invite link"), callback_data="invite_show_link")],
            [InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")],
        ])

    await safe_edit_message(query.message, text,
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
        disable_web_page_preview=False,
    )


async def handle_ref_list(query, context):
    """Список рефералов с пагинацией и фильтрами."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    parts = query.data.split("_")
    # Ожидаем формат ref_list_{page}_{filter} или ref_list_{page}
    page = int(parts[2]) if len(parts) > 2 else 1
    filter_status = parts[3] if len(parts) > 3 else "all"

    data = get_referral_list(user_id, page=page, filter_status=filter_status)
    items = data["items"]

    # Сводка
    lines = [
        f"<b>👥 " + t("ref.invitees.title", default="My referrals") + "</b>",
        f"Всего приглашено: {data['total']} · Активных: {data['active_total']} · Заработано: +{data['total_earnings']:.4f} GRAM",
        f"Страница {page}/{data['pages']}",
        "",
    ]

    if items:
        for ref in items:
            name = ref.get("first_name") or (f"@{ref.get('username')}" if ref.get("username") else str(ref.get("user_id")))
            earned = float(ref.get("earned", 0))
            earnings_str = f" +{earned:.4f} GRAM" if earned > 0 else ""
            status = "🟢 Активен" if ref.get("is_activated") else "🟡 Ожидает"
            lines.append(
                f"{status} {escape(name)}{earnings_str} — {_format_timestamp(ref.get('created_at'))}"
            )
    else:
        lines.append(t("ref.invitees.empty", default="No referrals found in this filter."))

    # Клавиатура с фильтрами и пагинацией
    keyboard = []
    # Строка фильтров
    filter_labels = [
        (t("ref.filter.all", default="All"), "all"),
        (t("ref.filter.active", default="Active"), "active"),
        (t("ref.filter.waiting", default="Waiting"), "waiting"),
    ]
    filter_buttons = []
    for label, val in filter_labels:
        # Активный фильтр подкрашиваем
        prefix = "✅ " if val == filter_status else ""
        filter_buttons.append(
            InlineKeyboardButton(f"{prefix}{label}", callback_data=f"ref_list_1_{val}")
        )
    keyboard.append(filter_buttons)

    # Пагинация
    if data["pages"] > 1:
        pager = []
        if page > 1:
            pager.append(InlineKeyboardButton("⬅️ Prev", callback_data=f"ref_list_{page-1}_{filter_status}"))
        if page < data["pages"]:
            pager.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data=f"ref_list_{page+1}_{filter_status}"))
        keyboard.append(pager)

    keyboard.append([InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")])

    await safe_edit_message(
        query.message,
        "\n".join(lines),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True,
    )

async def handle_ref_earnings(query, context):
    """💰 My Earnings — сколько GRAM принесли рефералы."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    from services.referrals import get_referral_revenue_stats
    stats = get_referral_revenue_stats(user_id)

    lines = [
        t("referral.earnings_title", default="💰 <b>Referral Earnings</b>"),
        "",
        t("referral.total_earned", default="Total earned:   <b>{earned:.4f} GRAM</b>", earned=stats['totalEarned']),
        t("referral.available", default="Available: <b>{available:.4f} GRAM</b>", available=stats['availableToWithdraw']),
        t("referral.paid", default="Paid to balance: <b>{paid:.4f} GRAM</b>", paid=stats['totalPaid']),
        t("referral.active_refs", default="Active referrals: <b>{active}</b>", active=stats['activeReferrals']),
        t("referral.total_rake", default="Total rake from your players: <b>{rake:.4f} GRAM</b>", rake=stats['totalRakeFromReferrals']),
        "",
        t("referral.how_earn_detail", default="💡 Earnings are credited instantly when your referral plays a duel.\nWithdraw them anytime from your main Balance."),
    ]

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")],
    ])

    await safe_edit_message(
        query.message,
        "\n".join(lines),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


async def handle_ref_stats(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    from services.referrals import get_referral_stats
    stats = get_referral_stats(query.from_user.id)
    lines = [t("ref.stats.title", default="📊 <b>Referral Statistics</b>"), ""]
    lines.append(t("ref.stats.growth", default="<b>Growth over the last 10 days:</b>"))
    for day in stats["monthly_growth"][-10:]:
        bar = "█" * min(day["count"], 8)
        lines.append(f"{day['date']}: {bar} ({day['count']})")
    if stats["top_referrals"]:
        lines.append("\n" + t("ref.stats.top_activity", default="<b>🏆 Most Active Referrals:</b>"))
        for ref in stats["top_referrals"]:
            name = ref.get("first_name") or ref.get("username") or str(ref.get("user_id"))
            lines.append(t("ref.stats.activity_row", default="• {name} — {n} duels", name=escape(name), n=ref.get('games_played', 0)))
    else:
        lines.append(t("ref.no_data", default="No data yet."))
    keyboard = [[InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")]]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))


async def handle_ref_tiers(query, context):
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    from services.referrals import get_referral_dashboard
    data = get_referral_dashboard(user_id)
    level = data["level"]
    lines = [
        t("referral.tiers_title", default="🎁 <b>Referral Tiers & Bonuses</b>"),
        "",
        t("referral.your_level", default="Your level: {icon} <b>{name}</b> (+{bonus}% to referral share)", icon=level['icon'], name=level['name'], bonus=level['bonus']),
    ]
    if level.get("next_tier"):
        progress = level.get("progress", 0)
        lines += [t("referral.progress_to", default="Progress to {next}:", next=level['next_tier']), f"{render_progress_bar(progress, width=10)} {progress}%"]
    lines += [
        "", "━━━━━━━━━━━━━━━━━━━━",
        t("referral.bronze", default="🥉 Bronze — 10+ refs → +5%"),
        t("referral.silver", default="🥈 Silver — 50+ refs → +10%"),
        t("referral.gold", default="🥇 Gold — 150+ refs → +15%"),
        t("referral.diamond", default="💎 Diamond — 500+ refs → +20% + 50 GRAM one-time bonus"),
        t("referral.legend", default="👑 Legend — 1000+ refs → 45% total, permanent"),
        "━━━━━━━━━━━━━━━━━━━━", "",
        t("referral.diamond_note", default="💎 <b>50 GRAM</b> is credited immediately when you reach Diamond."),
        t("referral.legend_note", default="👑 <b>Legend</b> locks the maximum 45% tier share under the current ladder."),
        "",
        t("referral.example", default="💡 Example: your friend stakes 10 GRAM, rake = 1 GRAM"),
        t("referral.example_starter", default="• Starter: you receive 0.20 GRAM (20%)"),
        t("referral.example_levels", default="• Bronze: 0.25 GRAM  |  Gold: 0.35 GRAM  |  Legend: 0.45 GRAM"),
        "", t("ref.how.note1", default="✅ The bot doesn't lose — we share part of our revenue with you."),
    ]
    keyboard = [
        [InlineKeyboardButton(t("ref.tab.diamond_legend", default="👑 Diamond & Legend"), callback_data="ref_diamond_legend")],
        [InlineKeyboardButton(t("ref.tab.how_earn", default="💰 How to Earn More?"), callback_data="ref_how_to_earn")],
        [InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")]
    ]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))


async def handle_ref_diamond_legend(query, context):
    """Глубокое объяснение Diamond и Legend бонусов."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    lines = [
        t("ref.diamond.title", default="💎👑 <b>Diamond and Legend — Maximum Rewards</b>"),
        "", "━━━━━━━━━━━━━━━━━━━━", t("ref.diamond.diamond_title", default="💎 DIAMOND (500 referrals)"), "━━━━━━━━━━━━━━━━━━━━",
        t("ref.diamond.bonus", default="🎁 Instant one-time +50 GRAM bonus!"),
        t("ref.diamond.share", default="📈 40% rake share instead of the base 20%."),
        "", "━━━━━━━━━━━━━━━━━━━━", t("ref.diamond.legend_title", default="👑 LEGEND (1,000 referrals)"), "━━━━━━━━━━━━━━━━━━━━",
        t("ref.diamond.legend_share", default="🔥 45% total rake share: 20% base + 25% tier bonus."),
        t("ref.diamond.forever", default="♾️ Legend is the maximum 45% share under the current rules."),
        "", "━━━━━━━━━━━━━━━━━━━━", t("ref.diamond.earnings_title", default="📊 Earnings from a 10 GRAM duel:"), "━━━━━━━━━━━━━━━━━━━━",
        t("ref.diamond.row_starter", default="🆕 Starter: 0.20 GRAM  (20% of rake)"),
        t("ref.diamond.row_bronze", default="🥉 Bronze: 0.25 GRAM  (+5%)"),
        t("ref.diamond.row_silver", default="🥈 Silver: 0.30 GRAM  (+10%)"),
        t("ref.diamond.row_gold", default="🥇 Gold: 0.35 GRAM  (+15%)"),
        t("ref.diamond.row_diamond", default="💎 Diamond: 0.40 GRAM  (+20%) + 50 GRAM"),
        t("ref.diamond.row_legend", default="👑 Legend: 0.45 GRAM  (45% total share)"),
        "", t("ref.diamond.example", default="💰 Passive-income example: 1,000 active friends × 1 duel/day = up to 50 extra GRAM/day."),
        "", t("ref.how.note1", default="✅ The bot doesn't lose — we share part of our revenue with you."),
    ]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back_tiers", default="◀️ Back to Tiers"), callback_data="ref_tiers")]]))


async def handle_ref_how_to_earn(query, context):
    """Подробное объяснение как зарабатывать на рефералах."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    lines = [
        t("ref.earn.title", default="💰 <b>How to Earn from Referral Rake</b>"), "",
        t("ref.earn.math_title", default="📌 <b>Simple math:</b>"),
        t("ref.earn.math_1", default="• Your friend stakes 10 GRAM → pot = 20 GRAM"),
        t("ref.earn.math_2", default="• The platform takes 5% = 1 GRAM rake"),
        t("ref.earn.math_3", default="• You receive 20% of that rake = <b>0.20 GRAM</b>"),
        "", t("ref.earn.share_title", default="🎯 <b>Your share from a 10 GRAM duel:</b>"), "",
        t("ref.earn.starter", default="🆕 Starter (0–9 referrals): <b>0.20 GRAM</b>"),
        t("ref.earn.bronze", default="🥉 Bronze (10+): <b>0.25 GRAM</b>"),
        t("ref.earn.silver", default="🥈 Silver (50+): <b>0.30 GRAM</b>"),
        t("ref.earn.gold", default="🥇 Gold (150+): <b>0.35 GRAM</b>"),
        t("ref.earn.diamond", default="💎 Diamond (500+): <b>0.40 GRAM</b> + 50 GRAM"),
        t("ref.earn.legend", default="👑 Legend (1000+): <b>0.45 GRAM</b> (45% total share)"),
        "", t("ref.earn.real_example", default="📈 <b>Example:</b> 100 active referrals × 1 duel/day at 10 GRAM → up to ~1,050 GRAM/month at Gold tier."),
        "", t("ref.earn.tip", default="💡 Active players create steady earnings. Quality matters more than quantity."),
        "", t("ref.earn.instant", default="✅ Earnings are credited automatically after every game."),
    ]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back_tiers", default="◀️ Back to Tiers"), callback_data="ref_tiers")], [InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")]]))


async def handle_ref_leaderboard(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    from services.referrals import get_referral_leaderboard
    rows = get_referral_leaderboard(10)
    lines = ["🏅 <b>" + t("ref.leaderboard.title", default="Top referrers") + "</b>\n"]
    if rows:
        for i, row in enumerate(rows, 1):
            name = row.get("first_name") or row.get("username") or str(row.get("user_id"))
            lines.append(t("ref.leaderboard.row", default="{i}. {name} — {n} invites", i=i, name=escape(name), n=row.get('invited_count', 0)))
    else:
        lines.append(t("ref.no_data", default="No data yet."))
    keyboard = [[InlineKeyboardButton(t("btn.back_cabinet", default=t("ref.back_to_cabinet", default="◀️ Back to cabinet")), callback_data="ref_cabinet")]]
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))


async def handle_ref_show_link(query, context):
    """Redirect to canonical invite show link screen."""
    await handle_invite_show_link(query, context)


async def handle_transaction_history(query, context):
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    from database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT amount, status, created_at FROM invoices
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 5
        """, (user_id,))
        deposits = cursor.fetchall()
        cursor.execute("""
        SELECT amount, status, created_at FROM withdrawals
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 5
        """, (user_id,))
        withdrawals = cursor.fetchall()
    def _status_label(status):
        key = str(status or "").replace("_", " ").lower()
        mapping = {"paid": t("status.paid", default="Оплачен"), "active": t("status.active", default="Активен"), "sent": t("status.sent", default="Отправлен"), "pending": t("status.pending", default="Ожидает"), "failed": t("status.failed", default="Ошибка")}
        return mapping.get(key, str(status or "—").replace("_", " ").title())
    lines = [t("balance.history.title", default="💸 <b>История баланса</b>"), "", t("balance.history.deposits", default="<b>Последние пополнения</b>")]
    if deposits:
        for row in deposits:
            lines.append(f"• {_format_timestamp(row['created_at'])} — +{float(row['amount']):.2f} GRAM — {_status_label(row['status'])}")
    else:
        lines.append(t("balance.history.no_deposits", default="• Пополнений пока нет."))
    lines.extend(["", t("balance.history.withdrawals", default="<b>Последние выводы</b>")])
    if withdrawals:
        for row in withdrawals:
            lines.append(f"• {_format_timestamp(row['created_at'])} — -{float(row['amount']):.2f} GRAM — {_status_label(row['status'])}")
    else:
        lines.append(t("balance.history.no_withdrawals", default="• Выводов пока нет."))
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()))



# ============================================================
# PUBLIC GIVEAWAYS — Browse + Join (RD-BOT-013)
# ============================================================

# ═══════════════════════════════════════════════════════════════════════════
# GIVEAWAY — SPONSOR MANAGEMENT (Этап 1)
# ═══════════════════════════════════════════════════════════════════════════

async def _handle_gw_toggle_subscription_required(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    giveaway_id = query.data.replace("gw_toggle_sub_", "", 1)
    try:
        giveaway = get_giveaway_by_id(giveaway_id)
        if not giveaway:
            await safe_answer_callback(query, t("giveaway.error.not_found", default="❌ Giveaway not found"), show_alert=True)
            return
        current = bool(int(giveaway.get("require_sponsor_subscription") or 0))
        update_giveaway_launch_rules(
            owner_user_id=user_id,
            giveaway_id=giveaway_id,
            require_sponsor_subscription=not current,
        )
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {_localize_giveaway_error(exc, t=t)}", show_alert=True)
        return
    except Exception as exc:
        logger.exception("giveaway_toggle_subscription_required_failed giveaway_id=%s: %s", giveaway_id, exc)
        await safe_answer_callback(query, t("error.generic_short", default="Произошла ошибка. Попробуйте снова."), show_alert=True)
        return
    await safe_answer_callback(
        query,
        t("giveaway.toast.subscription_rule_on", default="🔐 Подписка обязательна.") if not current else t("giveaway.toast.subscription_rule_off", default="🔓 Подписка больше не обязательна."),
        show_alert=False,
    )
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_toggle_real_duel_required(query, context):
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    giveaway_id = query.data.replace("gw_toggle_real_duel_", "", 1)
    try:
        giveaway = get_giveaway_by_id(giveaway_id)
        if not giveaway:
            await safe_answer_callback(query, t("giveaway.error.not_found", default="❌ Giveaway not found"), show_alert=True)
            return
        current = int(giveaway.get("min_completed_real_duels") or 0)
        next_value = 0 if current > 0 else 1
        update_giveaway_launch_rules(
            owner_user_id=user_id,
            giveaway_id=giveaway_id,
            min_completed_real_duels=next_value,
        )
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {_localize_giveaway_error(exc, t=t)}", show_alert=True)
        return
    except Exception as exc:
        logger.exception("giveaway_toggle_real_duel_required_failed giveaway_id=%s: %s", giveaway_id, exc)
        await safe_answer_callback(query, t("error.generic_short", default="Произошла ошибка. Попробуйте снова."), show_alert=True)
        return
    await safe_answer_callback(
        query,
        t("giveaway.toast.real_duel_rule_on", default="🎲 Требуется 1 завершённая real GRAM duel.") if next_value > 0 else t("giveaway.toast.real_duel_rule_off", default="🎲 Требование real GRAM duel выключено."),
        show_alert=False,
    )
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


async def _handle_gw_add_sponsor(query, context):
    """Show prompt to enter a sponsor channel/chat @username or link."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    giveaway_id = query.data.replace("gw_add_sponsor_", "", 1)
    user_id = query.from_user.id
    try:
        get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    await safe_answer_callback(query)
    user_states[user_id] = f"gw_add_sponsor:{giveaway_id}"
    await safe_edit_message(
        query.message,
        t("giveaway.sponsor.prompt", default=(
            "➕ <b>Add Sponsor Channel/Chat</b>\n\n"
            "Send the public @username or link:\n"
            "Supported: <code>@my_channel</code>, <code>@my_chat</code>, "
            "<code>https://t.me/my_channel</code>, or a numeric chat_id "
            "if the bot is already in that chat.\n\n"
            "Not supported: private invite links (<code>t.me/+...</code>, "
            "<code>t.me/joinchat/...</code>).\n\n"
            "Important: the bot must already be a member of this channel/chat, "
            "otherwise subscription cannot be checked.\n\n"
            "Users will need to be subscribed to be eligible."
        )),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data=f"gw_back_{giveaway_id}")],
        ]),
    )


def is_unsupported_sponsor_invite_link(raw: str) -> bool:
    """True if raw input is a private Telegram invite link, not a resolvable
    @username or numeric chat_id.

    STEP-107B2: private invite links (t.me/+... and t.me/joinchat/...) look
    like a normal t.me path but are NOT a resolvable @username or chat_id.
    The naive "take the last path segment" normalization used elsewhere
    would turn them into a garbage handle (e.g. "@+AbCdInvite") that
    silently gets INSERTed (add_giveaway_sponsor does no format validation)
    and then fails Telegram membership checks forever with an opaque
    "unknown" reason — the giveaway becomes permanently unwinnable with no
    clear signal to the operator. Callers must reject these explicitly
    before normalizing.
    """
    lowered = (raw or "").strip().lower()
    return "t.me/+" in lowered or "t.me/joinchat/" in lowered or lowered.startswith("+")


def normalize_sponsor_input(raw: str) -> str:
    """Normalize free-text sponsor input into an @username or numeric chat_id.

    Caller must check is_unsupported_sponsor_invite_link(raw) first and
    reject before calling this; this function does not re-validate that.
    """
    if raw.startswith("https://t.me/"):
        return "@" + raw.rstrip("/").split("/")[-1]
    if raw.startswith("@"):
        return raw
    if raw.lstrip("-").isdigit():
        return raw  # numeric chat_id
    return "@" + raw


async def _handle_gw_sponsor_input(update, context):
    """Process free-text input of sponsor channel/chat (state: gw_add_sponsor:<id>)."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    state = str(user_states.get(user_id) or "")
    giveaway_id = state.replace("gw_add_sponsor:", "", 1)
    user_states.pop(user_id, None)
    try:
        get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await update.message.reply_text(f"❌ {exc.message}")
        return
    raw = (update.message.text or "").strip()
    if not raw:
        await update.message.reply_text(t("giveaway.sponsor.no_input", default="❌ No input received. Please try again."))
        return
    if is_unsupported_sponsor_invite_link(raw):
        await update.message.reply_text(
            t(
                "giveaway.sponsor.invite_link_unsupported",
                default=(
                    "❌ Приватная invite-ссылка не поддерживается.\n\n"
                    "Отправьте публичный @username канала/чата или ссылку вида "
                    "<code>https://t.me/my_channel</code>.\n\n"
                    "Если канал/чат приватный, но у вас есть его числовой chat_id "
                    "(например <code>-1001234567890</code>), отправьте его напрямую — "
                    "бот должен уже быть добавлен в этот канал/чат."
                ),
            ),
            parse_mode=ParseMode.HTML,
        )
        user_states[user_id] = f"gw_add_sponsor:{giveaway_id}"
        return
    username = normalize_sponsor_input(raw)
    display = username.lstrip("@") if username.startswith("@") else username
    try:
        result = database.add_giveaway_sponsor(giveaway_id, username, display)
    except Exception:
        logger.exception("giveaway_sponsor_add_failed giveaway_id=%s username=%s", giveaway_id, username)
        await update.message.reply_text(
            t("giveaway.sponsor.add_error", default="❌ Не удалось добавить канал-спонсор. Проверьте username/ссылку и попробуйте снова."),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("giveaway.btn.back", default="↩️ Назад к розыгрышу"), callback_data=f"gw_back_{giveaway_id}")]]),
        )
        return
    if not result.get("ok"):
        await update.message.reply_text(
            f"❌ {escape(str(result.get('error') or t('giveaway.sponsor.add_error', default='Не удалось добавить канал-спонсор.')))}",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("giveaway.btn.back", default="↩️ Назад к розыгрышу"), callback_data=f"gw_back_{giveaway_id}")]]),
        )
        return
    await update.message.reply_text(
        t(
            "giveaway.sponsor.added",
            default="✅ Канал-спонсор <b>{channel}</b> добавлен.\n\nУчастникам нужно будет подписаться на этот канал для участия.",
            channel=escape(username),
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("giveaway.btn.back", default="↩️ Назад к розыгрышу"), callback_data=f"gw_back_{giveaway_id}")]]),
    )
    # Refresh giveaway detail
    await show_giveaway_detail(update.message, user_id=user_id, giveaway_id=giveaway_id, edit=False)


async def _handle_gw_remove_sponsor(query, context):
    """Show a confirm screen before removing a sponsor channel/chat.

    STEP-107B3: this used to delete immediately on a single tap with no
    owner re-check in this handler (it only relied on the cockpit render
    path being owner-gated). Two problems fixed here:
    1. Accidental one-tap delete during a live giveaway silently blocks
       *new* entrants if this was the only sponsor and subscription is
       required (evaluate_giveaway_entry_eligibility hard-fails with
       "sponsor_required:no_channels" for anyone checked after removal),
       with no operator-facing alarm -- exactly when traffic matters most.
    2. This action skipped the _require_giveaway_owner_tx-equivalent check
       that the sibling gw_toggle_sub_ / gw_cancel_ actions perform. Render
       gating alone is not an authorization boundary for the action itself.
    """
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    try:
        sponsor_id = int(query.data.replace("gw_remove_sponsor_", "", 1))
    except ValueError:
        await query.answer(t("giveaway.sponsor.invalid_id", default="Invalid sponsor ID"), show_alert=True)
        return
    conn = database.get_connection()
    try:
        row = conn.execute(
            "SELECT giveaway_id, sponsor_username, sponsor_chat_id FROM giveaway_sponsors WHERE id = ?", (sponsor_id,)
        ).fetchone()
        sponsor_row = dict(row) if row else None
    finally:
        conn.close()
    if not sponsor_row:
        await safe_answer_callback(query, t("giveaway.sponsor.not_found", default="Канал/чат-спонсор не найден."), show_alert=True)
        return
    giveaway_id = sponsor_row["giveaway_id"]
    try:
        get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    display = sponsor_row.get("sponsor_username") or sponsor_row.get("sponsor_chat_id")
    await safe_answer_callback(query)
    await safe_edit_message(
        query.message,
        t(
            "giveaway.sponsor.confirm_remove",
            default=(
                "🗑️ <b>Удалить спонсора?</b>\n\n"
                "Канал/чат: <b>{name}</b>\n\n"
                "Если это единственный спонсор и подписка обязательна, "
                "новые участники не смогут пройти проверку до тех пор, "
                "пока вы не добавите спонсора снова."
            ),
            name=escape(str(display)),
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("giveaway.btn.confirm_remove_sponsor", default="🗑️ Да, удалить"), callback_data=f"gw_confirm_remove_sponsor_{sponsor_id}")],
            [InlineKeyboardButton(t("giveaway.btn.cancel_remove_sponsor", default="↩️ Отмена"), callback_data=f"gw_back_{giveaway_id}")],
        ]),
    )


async def _handle_gw_confirm_remove_sponsor(query, context):
    """Actually remove a sponsor channel/chat, after operator confirmation."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    try:
        sponsor_id = int(query.data.replace("gw_confirm_remove_sponsor_", "", 1))
    except ValueError:
        await query.answer(t("giveaway.sponsor.invalid_id", default="Invalid sponsor ID"), show_alert=True)
        return
    conn = database.get_connection()
    try:
        row = conn.execute(
            "SELECT giveaway_id FROM giveaway_sponsors WHERE id = ?", (sponsor_id,)
        ).fetchone()
        giveaway_id = dict(row)["giveaway_id"] if row else None
    finally:
        conn.close()
    if not giveaway_id:
        await safe_answer_callback(query, t("giveaway.sponsor.not_found", default="Канал/чат-спонсор не найден."), show_alert=True)
        return
    # Re-check ownership at the point of actual deletion, not just when the
    # confirm screen was shown -- defense in depth against a stale/replayed
    # callback_data if the giveaway ever changed hands in between.
    try:
        get_giveaway_owner_snapshot(owner_user_id=user_id, giveaway_id=giveaway_id)
    except GiveawayError as exc:
        await safe_answer_callback(query, f"❌ {exc.message}", show_alert=True)
        return
    database.remove_giveaway_sponsor(sponsor_id)
    await safe_answer_callback(query, t("giveaway.sponsor.removed", default="Канал/чат-спонсор удалён ✓"))
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


# ═══════════════════════════════════════════════════════════════════════════
# GIVEAWAY — ELIGIBILITY CHECK (Этап 1)
# ═══════════════════════════════════════════════════════════════════════════

async def _handle_gw_check_eligibility(query, context):
    """Check and update subscription eligibility for the calling user."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    user_id = query.from_user.id
    giveaway_id = query.data.replace("gw_check_eligibility_", "", 1)

    entry = database.get_connection()
    try:
        row = entry.execute(
            "SELECT entry_id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ? LIMIT 1",
            (giveaway_id, user_id),
        ).fetchone()
    finally:
        entry.close()

    if not row:
        await safe_answer_callback(query, t("giveaway.eligibility.not_joined", default="Сначала нажмите «Участвовать» в посте розыгрыша."), show_alert=True)
        return

    # force_refresh=True bypasses cache — user asked explicitly
    result = await check_user_subscriptions(
        context.bot, user_id=user_id, giveaway_id=giveaway_id, force_refresh=True
    )
    eligible = result["eligible"]
    missing = result.get("missing", [])
    unknown = result.get("unknown", [])

    checks = result.get("checks") or {}
    min_real = int(checks.get("min_completed_real_duels") or 0)
    completed_real = int(checks.get("completed_real_duels") or 0)
    if eligible:
        parts = [t("giveaway.eligibility.eligible", default="✅ <b>Вы подходите!</b> Все условия подтверждены.")]
        if min_real > 0:
            parts.append(t("giveaway.eligibility.real_duel_ok", default="🎲 Real GRAM duels: {current}/{required}.", current=completed_real, required=min_real))
        msg = "\n".join(parts)
    else:
        lines = ["❌ <b>" + t("giveaway.eligibility.not_eligible_title", default="Вы пока не подходите.") + "</b>"]
        if min_real > 0 and completed_real < min_real:
            lines.append(t("giveaway.eligibility.need_real_duel", default="🎲 Завершите минимум {required} real GRAM duel. Сейчас: {current}/{required}.", current=completed_real, required=min_real))
        if missing:
            missing_fmt = "\n".join(f"• {ch}" for ch in missing)
            lines.append(t("giveaway.eligibility.subscribe_prompt", default="Подпишитесь на:") + f":\n{missing_fmt}")
        if unknown:
            lines.append(t("giveaway.eligibility.unknown_verify", default="<i>({count} channel(s) could not be verified.)</i>", count=len(unknown)))
        lines.append(t("giveaway.eligibility.check_again", default="Затем нажмите <b>Проверить</b> снова."))
        msg = "\n\n".join(lines)


    await safe_answer_callback(query)
    await safe_edit_message(
        query.message,
        msg,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("giveaway.eligibility.recheck", default="🔄 Re-check"), callback_data=f"gw_check_eligibility_{giveaway_id}")],
            [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data=f"gw_back_{giveaway_id}")],
        ]),
    )


# ═══════════════════════════════════════════════════════════════════════════
# GIVEAWAY — PUBLIC CATALOG + MY PARTICIPATIONS (Этап 3)
# ═══════════════════════════════════════════════════════════════════════════

def _format_time_remaining(ends_at_raw, t=None) -> str:
    """Format a deadline into a localized short human-readable string."""
    if t is None:
        from services.i18n import get_translator
        t = get_translator("en")
    if not ends_at_raw:
        return "—"
    try:
        s = str(ends_at_raw).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = dt - datetime.now(timezone.utc)
        if delta.total_seconds() <= 0:
            return t("giveaway.time.ended", default="Ended")
        days = delta.days
        hours = delta.seconds // 3600
        if days > 0:
            return t("giveaway.time.days_hours", default="{days}d {hours}h", days=days, hours=hours)
        if hours > 0:
            return t("giveaway.time.hours", default="{hours}h", hours=hours)
        mins = delta.seconds // 60
        return t("giveaway.time.minutes", default="{minutes}m", minutes=mins)
    except Exception:
        return "—"


@guarded
async def giveaways_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show paginated list of active public giveaways."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    args = context.args or []
    page = int(args[0]) if args and args[0].isdigit() else 1
    limit = 5
    offset = (page - 1) * limit
    giveaways = get_public_giveaways_list(limit=limit + 1, offset=offset, order_by="ends_at")
    has_more = len(giveaways) > limit
    giveaways = giveaways[:limit]

    if not giveaways:
        await update.message.reply_text(t("giveaway.browse.empty", default="🎁 <b>Giveaways</b>\n\nNo active public giveaways right now.\nCreate one in your group!"), parse_mode=ParseMode.HTML)
        return

    lines = [t("giveaway.browse.active_title", default="🎁 <b>Active Giveaways</b>") + "\n"]
    for g in giveaways:
        title = escape(g.get("title") or t("giveaway.untitled", default="Untitled"))
        prize = escape(g.get("prize_text") or "—")
        winners = g.get("winners_count") or 1
        remaining = _format_time_remaining(g.get("ends_at"), t=t)
        participants = g.get("participants_count") or 0
        lines.append(
            f"🎁 <b>{title}</b>\n"
            f"  🏆 {prize} · 👥 {winners} {t('giveaway.label.winners', default='winners')} · ⏳ {remaining} · {participants} {t('giveaway.label.joined', default='joined')}\n"
            f"  👉 /join_giveaway_{g['giveaway_id']}\n"
        )

    keyboard_row = []
    if page > 1:
        keyboard_row.append(InlineKeyboardButton(t("btn.prev", default="← Prev"), callback_data=f"giveaways_page_{page - 1}"))
    if has_more:
        keyboard_row.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data=f"giveaways_page_{page + 1}"))

    markup = InlineKeyboardMarkup([keyboard_row]) if keyboard_row else None
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=markup)


@guarded
async def join_giveaway_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Join a public giveaway by ID. Usage: /join_giveaway_<id> or /join_giveaway <id>"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    # Support both /join_giveaway_<id> and /join_giveaway <id>
    text = update.message.text or ""
    if "_" in text.split()[0][1:]:   # command contains underscore → /join_giveaway_<id>
        giveaway_id = text.split()[0].split("_", 2)[-1]
    elif context.args:
        giveaway_id = context.args[0]
    else:
        await update.message.reply_text(t("giveaway.join.usage", default="Использование: /join_giveaway <ID розыгрыша>"))
        return

    try:
        result = join_giveaway_public(giveaway_id=giveaway_id, user_id=user_id)
    except GiveawayError as e:
        await update.message.reply_text(
            t("error.generic", default="❌ Не удалось выполнить действие. Попробуйте снова."),
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
        return
    except Exception as e:
        await update.message.reply_text(
            t("error.generic", default="❌ Не удалось выполнить действие. Попробуйте снова."),
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
        return

    if result.get("outcome") == "already_joined":
        await update.message.reply_text(t("giveaway.join.already_joined", default="ℹ️ Вы уже участвуете в этом розыгрыше."))
        return

    # Trigger async subscription check in background — no await to keep response fast
    giveaway = result.get("giveaway") or {}
    title = escape(giveaway.get("title") or t("giveaway.title", default="Giveaway"))
    sponsors = database.list_giveaway_sponsors(giveaway_id)

    if sponsors:
        sub_result = await check_user_subscriptions(context.bot, user_id=user_id, giveaway_id=giveaway_id)
        if sub_result["eligible"]:
            await update.message.reply_text(
                t("giveaway.join.success", default="✅ Вы участвуете в {title}! Удачи!", title=title),
                parse_mode=ParseMode.HTML,
            )
        else:
            missing_fmt = "\n".join(f"• {ch}" for ch in sub_result["missing"])
            await update.message.reply_text(
                t("giveaway.join.eligible_warning", default="⚠️ Для участия подпишитесь на:\n{missing}\n\nЗатем используйте /check_eligibility_{giveaway_id} для подтверждения.", missing=missing_fmt, giveaway_id=giveaway_id),
                parse_mode=ParseMode.HTML,
            )
    else:
        await update.message.reply_text(
            t("giveaway.join.success", default="✅ Вы участвуете в {title}! Удачи!", title=title),
            parse_mode=ParseMode.HTML,
        )


@guarded
async def my_giveaways_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the user's giveaway participation history."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user_id = update.effective_user.id
    args = context.args or []
    page = int(args[0]) if args and args[0].isdigit() else 1
    limit = 5
    offset = (page - 1) * limit
    items = get_user_giveaway_participations(user_id, limit=limit + 1, offset=offset)
    has_more = len(items) > limit
    items = items[:limit]

    if not items:
        await update.message.reply_text(
            t("giveaway.my.empty", default="📋 You haven't joined any giveaways yet.\n\nUse /giveaways to browse active ones!")
        )
        return

    lines = [t("giveaway.my.title", default="📋 <b>My Giveaway Participations</b>") + "\n"]
    for p in items:
        title = escape(p.get("title") or t("giveaway.untitled", default="Untitled"))
        status = p.get("status") or "UNKNOWN"
        eligible = p.get("is_eligible")
        if eligible is None:
            eligible_str = t("giveaway.my.not_checked", default="❓ Not checked")
        elif eligible:
            eligible_str = t("giveaway.my.eligible", default="✅ Eligible")
        else:
            eligible_str = t("giveaway.my.not_eligible", default="❌ Not eligible")
        remaining = _format_time_remaining(p.get("ends_at"), t=t)
        lines.append(t("giveaway.my.status_line", default="🎁 <b>{title}</b>\n  Status: {status} · {eligible} · ⏳ {remaining}", title=title, status=status, eligible=eligible_str, remaining=remaining))
        lines.append(f"  ID: <code>{p['giveaway_id']}</code>")

    keyboard_row = []
    if page > 1:
        keyboard_row.append(InlineKeyboardButton(t("btn.prev", default="← Prev"), callback_data=f"my_giveaways_page_{page - 1}"))
    if has_more:
        keyboard_row.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data=f"my_giveaways_page_{page + 1}"))

    markup = InlineKeyboardMarkup([keyboard_row]) if keyboard_row else None
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=markup)


async def _handle_giveaways_page(query, context):
    """Paginate public giveaway catalog inline."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    page = int(query.data.replace("giveaways_page_", "", 1))
    limit = 5
    offset = (page - 1) * limit
    giveaways = get_public_giveaways_list(limit=limit + 1, offset=offset, order_by="ends_at")
    has_more = len(giveaways) > limit
    giveaways = giveaways[:limit]

    if not giveaways:
        await safe_edit_message(query.message, t("giveaway.browse.no_more", default="🎁 No more giveaways on this page."),
                                reply_markup=InlineKeyboardMarkup([[
                                    InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data=f"giveaways_page_{max(1, page - 1)}")
                                ]]))
        return

    lines = [t("giveaway.browse.active_title", default="🎁 <b>Active Giveaways</b>") + "\n"]
    for g in giveaways:
        title = escape(g.get("title") or t("giveaway.untitled", default="Untitled"))
        prize = escape(g.get("prize_text") or "—")
        winners = g.get("winners_count") or 1
        remaining = _format_time_remaining(g.get("ends_at"), t=t)
        participants = g.get("participants_count") or 0
        lines.append(
            f"🎁 <b>{title}</b>\n"
            f"  🏆 {prize} · 👥 {winners} {t('giveaway.label.winners', default='winners')} · ⏳ {remaining} · {participants} {t('giveaway.label.joined', default='joined')}\n"
            f"  👉 /join_giveaway_{g['giveaway_id']}\n"
        )

    keyboard_row = []
    if page > 1:
        keyboard_row.append(InlineKeyboardButton(t("btn.prev", default="← Prev"), callback_data=f"giveaways_page_{page - 1}"))
    if has_more:
        keyboard_row.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data=f"giveaways_page_{page + 1}"))

    await safe_edit_message(
        query.message, "\n".join(lines), parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([keyboard_row]) if keyboard_row else None,
    )


async def _handle_my_giveaways_page(query, context):
    """Paginate my giveaways inline."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    user_id = query.from_user.id
    page = int(query.data.replace("my_giveaways_page_", "", 1))
    limit = 5
    offset = (page - 1) * limit
    items = get_user_giveaway_participations(user_id, limit=limit + 1, offset=offset)
    has_more = len(items) > limit
    items = items[:limit]

    lines = [t("giveaway.my.title", default="📋 <b>My Giveaway Participations</b>") + "\n"]
    for p in items:
        title = escape(p.get("title") or t("giveaway.untitled", default="Untitled"))
        status = p.get("status") or "UNKNOWN"
        eligible = p.get("is_eligible")
        eligible_str = t("giveaway.my.not_checked_short", default="❓") if eligible is None else (t("giveaway.my.eligible_short", default="✅") if eligible else t("giveaway.my.not_eligible_short", default="❌"))
        remaining = _format_time_remaining(p.get("ends_at"), t=t)
        lines.append(t("giveaway.my.status_line_short", default="🎁 <b>{title}</b> · {status} · {eligible} · ⏳ {remaining}\n  <code>{giveaway_id}</code>", title=title, status=status, eligible=eligible_str, remaining=remaining, giveaway_id=p['giveaway_id']))

    keyboard_row = []
    if page > 1:
        keyboard_row.append(InlineKeyboardButton(t("btn.prev", default="← Prev"), callback_data=f"my_giveaways_page_{page - 1}"))
    if has_more:
        keyboard_row.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data=f"my_giveaways_page_{page + 1}"))

    await safe_edit_message(
        query.message, "\n".join(lines), parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([keyboard_row]) if keyboard_row else None,
    )


async def handle_giveaway_browse_public(query, context):
    """Показать список публичных активных giveaways с сортировкой."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    callback_data = query.data if hasattr(query, "data") else ""

    order_by = context.user_data.get("giveaway_browse_order", "ends_at")
    page = int(context.user_data.get("giveaway_browse_page", 0))

    if callback_data.startswith("giveaway_sort_"):
        order_by = callback_data.replace("giveaway_sort_", "")
        context.user_data["giveaway_browse_order"] = order_by
        context.user_data["giveaway_browse_page"] = 0
        page = 0
    elif callback_data == "giveaway_browse_prev":
        page = max(0, page - 1)
        context.user_data["giveaway_browse_page"] = page
    elif callback_data == "giveaway_browse_next":
        page += 1
        context.user_data["giveaway_browse_page"] = page

    limit = 5
    offset = page * limit
    giveaways = get_public_giveaways_list(limit=limit + 1, offset=offset, exclude_workspace_id=None, order_by=order_by)
    has_more = len(giveaways) > limit
    giveaways = giveaways[:limit]

    if not giveaways:
        await safe_edit_message(
            query.message,
            t("giveaway.browse.empty", default="🎁 <b>Розыгрыши</b>\n\n😔 Активных розыгрышей пока нет.\nСоздайте первый розыгрыш в своей группе."),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data="back_to_main")]]),
            parse_mode=ParseMode.HTML,
        )
        return

    sort_labels = {
        "ends_at": t("giveaway.sort.ends", default="⏳ Скоро завершатся"),
        "created_at": t("giveaway.sort.newest", default="🆕 Новые"),
        "participants_count": t("giveaway.sort.popular", default="👥 Популярные"),
    }
    current_sort_label = sort_labels.get(order_by, t("giveaway.sort.ends", default="⏳ Скоро завершатся"))

    text = t("giveaway.browse.active_title", default="🎁 <b>Активные розыгрыши</b>") + "\n\n"
    text += t("giveaway.browse.sort_by", default="<i>Сортировка: {label}</i>", label=current_sort_label) + "\n\n"

    buttons = []
    for i, g in enumerate(giveaways, 1):
        remaining = _format_time_remaining(g.get('ends_at'), t=t)
        starts_at = g.get('starts_at')
        status_line = ""
        can_join = True
        if starts_at:
            try:
                from datetime import datetime, timezone
                starts_dt = datetime.fromisoformat(str(starts_at).replace('Z', '+00:00'))
                if starts_dt > datetime.now(timezone.utc):
                    status_line = t("giveaway.starts_in", default="⏳ Начнётся: {time}", time=_format_time_remaining(starts_at, t=t))
                    can_join = False
            except Exception as e:
                logger.exception(f"Error parsing starts_at for giveaway {g.get('giveaway_id')}: {e}")
                can_join = True
        text += (
            f"{i}. <b>{escape(g.get('title') or '—')}</b>\n"
            f" 🏆 {g['winners_count']} {t('giveaway.label.winners', default='победителей')} | 💝 {escape(g.get('prize_text') or '—')}\n"
            f" 👥 {g['participants_count']} {t('giveaway.label.joined', default='участников')} | {remaining}\n"
        )
        if status_line:
            text += f" {status_line}\n"
        text += f" 📍 {escape(g.get('workspace_title', t('workspace.untitled', default='Группа')))}\n\n"
        if can_join:
            buttons.append([InlineKeyboardButton(t("giveaway.btn.join", default="🎁 Участвовать #{n}", n=i+1), callback_data=f"giveaway_join_public_{g['giveaway_id']}")])

    sort_buttons = []
    if order_by != "ends_at":
        sort_buttons.append(InlineKeyboardButton(t("giveaway.sort.ends", default="⏳ Скоро завершатся"), callback_data="giveaway_sort_ends_at"))
    if order_by != "created_at":
        sort_buttons.append(InlineKeyboardButton(t("giveaway.sort.newest", default="🆕 Новые"), callback_data="giveaway_sort_created_at"))
    if order_by != "participants_count":
        sort_buttons.append(InlineKeyboardButton(t("giveaway.sort.popular_short", default="👥 Популярные"), callback_data="giveaway_sort_participants_count"))
    if sort_buttons:
        buttons.append(sort_buttons)

    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(t("btn.prev", default="← Назад"), callback_data="giveaway_browse_prev"))
    if has_more:
        nav_row.append(InlineKeyboardButton(t("btn.next", default="Вперёд →"), callback_data="giveaway_browse_next"))
    if nav_row:
        buttons.append(nav_row)
    buttons.append([InlineKeyboardButton(t("btn.back", default="◀️ Назад"), callback_data="back_to_main")])

    await safe_edit_message(query.message, text, reply_markup=InlineKeyboardMarkup(buttons), parse_mode=ParseMode.HTML, disable_web_page_preview=True)


async def handle_giveaway_join_public(query, context):
    """Присоединиться к публичному giveaway from catalog-style callback."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or get_t(query.from_user.id) or _i18n_gt("en")
    giveaway_id = query.data.replace("giveaway_join_public_", "", 1)
    user_id = query.from_user.id

    logger.info("giveaway_join_attempt giveaway_id=%s user_id=%s source=catalog", giveaway_id, user_id)
    try:
        result = join_giveaway_public(giveaway_id=giveaway_id, user_id=user_id)
    except GiveawayError as exc:
        logger.info("giveaway_join_failed giveaway_id=%s user_id=%s reason=%s", giveaway_id, user_id, getattr(exc, "code", "giveaway_error"))
        await safe_answer_callback(query, f"❌ {_localize_giveaway_error(exc, t=t)}", show_alert=exc.code in {"giveaway_not_found", "giveaway_cancelled", "giveaway_not_started"})
        return
    except Exception as exc:
        logger.exception("giveaway_join_failed giveaway_id=%s user_id=%s reason=unexpected: %s", giveaway_id, user_id, exc)
        await safe_answer_callback(query, t("giveaway.join.error", default="❌ Не удалось вступить в розыгрыш. Попробуйте ещё раз."), show_alert=True)
        return

    eligibility_result = None
    try:
        eligibility_result = await evaluate_giveaway_entry_eligibility(
            context.bot,
            giveaway_id=giveaway_id,
            user_id=user_id,
            force_refresh=False,
        )
    except Exception as exc:
        logger.warning("giveaway_eligibility_refresh_failed giveaway_id=%s user_id=%s error=%s", giveaway_id, user_id, exc)
    eligible_now, eligibility_notice = _format_giveaway_join_eligibility_notice(eligibility_result, t=t)
    if result.get("outcome") == "already_joined":
        logger.info("giveaway_join_already_joined giveaway_id=%s user_id=%s", giveaway_id, user_id)
        await safe_answer_callback(query, eligibility_notice if not eligible_now else t("giveaway.join.already_joined", default="ℹ️ Вы уже участвуете в этом розыгрыше."), show_alert=True)
    else:
        logger.info("giveaway_join_success giveaway_id=%s user_id=%s eligible=%s", giveaway_id, user_id, eligible_now)
        await safe_answer_callback(query, eligibility_notice, show_alert=True)
    await _refresh_public_giveaway_post_after_join(query, context, giveaway_id, t=t)

    try:
        await handle_giveaway_browse_public(query, context)
    except Exception as exc:
        logger.warning("Could not refresh public giveaway catalog after join %s: %s", giveaway_id, exc)


async def handle_giveaway_toggle_public(query, context):
    """Toggle публичности giveaway."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    giveaway_id = query.data.split("_")[-1]
    user_id = query.from_user.id

    try:
        from services.giveaways import get_giveaway_by_id, set_giveaway_public
        giveaway = get_giveaway_by_id(giveaway_id)
        if not giveaway:
            await safe_answer_callback(query, t("giveaway.error.not_found", default="❌ Giveaway not found"), show_alert=True)
            return

        current_public = bool(giveaway.get("is_public", False))
        result = set_giveaway_public(
            giveaway_id=giveaway_id,
            is_public=not current_public,
            actor_user_id=user_id
        )
    except Exception as e:
        logger.exception(f"Toggle public error for giveaway {giveaway_id}: {e}")
        await safe_answer_callback(query, t("error.generic_short", default="Произошла ошибка. Попробуйте снова."), show_alert=True)
        return

    if not result.get("ok"):
        await safe_answer_callback(query, f"❌ {result.get('error', 'Failed')}", show_alert=True)
        return

    new_status = t("giveaway.visibility.public", default="🌐 Public") if not current_public else t("giveaway.visibility.private", default="🔒 Private")
    await safe_answer_callback(query, t("giveaway.toast.visibility", default="✅ Giveaway is now {status}", status=new_status), show_alert=False)

    # Предупреждение при переходе в Public
    if not current_public:
        await safe_answer_callback(
            query,
            "🌐 This giveaway is now visible to all Roll Duel users.",
            show_alert=True
        )

    # Возвращаемся на экран редактирования
    await show_giveaway_detail(query, user_id=user_id, giveaway_id=giveaway_id, edit=True)


# === Периодический опрос инвойсов ===

async def check_pending_invoices():
    """Legacy fallback invoice poller for local/dev mode only."""
    if database.using_postgres():
        # На Postgres поллинг не нужен — используем вебхуки
        return
    while True:
        await asyncio.sleep(30)
        from database import get_connection
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT invoice_id, user_id, amount, status FROM invoices WHERE status = 'active'")
            rows = cursor.fetchall()
        for row in rows:
            invoice_id = row['invoice_id'] if hasattr(row, 'keys') else row[0]
            user_id = row['user_id'] if hasattr(row, 'keys') else row[1]
            amount = row['amount'] if hasattr(row, 'keys') else row[2]
            invoice_status = await get_invoice_status(invoice_id)
            update_invoice_status(invoice_id, invoice_status)
            if invoice_status == 'paid':
                result = apply_paid_invoice(invoice_id, source='poller', provider_event_id=f'poller:{invoice_id}')
                if result.get('ok') and result.get('credited'):
                    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
                    bot = Bot(token=bot_token)
                    try:
                        await bot.send_message(
                            chat_id=user_id,
                            text=f"✅ Ваш баланс пополнен на {amount} GRAM!\nМожете открыть баланс или начать дуэль."
                        )
                    except Exception as e:
                        logger.exception(f"Failed to send deposit notification to user {user_id}: {e}")


# ---------------------------------------------------------------------------
# Menu mode toggle — callback handler
# ---------------------------------------------------------------------------

async def handle_toggle_menu_mode(query, context):
    """Callback: toggle between 'play' and 'full' menu mode."""
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    current = get_cached_menu_mode(user_id)
    new_mode = "play" if current == "full" else "full"
    set_user_menu_mode(user_id, new_mode)
    invalidate_menu_mode_cache(user_id)
    mode_label = t("btn.play_mode", default="🎮 Play Mode") if new_mode == "play" else t("btn.full_suite", default="🧩 Full Suite")
    await safe_answer_callback(query, f"✅ {mode_label}")

    chat_id = query.message.chat_id
    msg_id = query.message.message_id
    now = time.time()
    last_dice = context.user_data.get("last_dice_menu_ts", 0)

    if now - last_dice >= 900:
        try:
            await context.bot.delete_message(chat_id, msg_id)
        except Exception:
            pass
        await context.bot.send_dice(chat_id, emoji='🎲')
        await asyncio.sleep(1.2)
        context.user_data["last_dice_menu_ts"] = now
        await context.bot.send_message(
            chat_id=chat_id,
            text=render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    else:
        await safe_edit_message(
            query.message,
            render_main_menu_text(user_id, t=t),
            reply_markup=_main_menu_markup(user_id, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )


@guarded
async def mode_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle menu mode via /mode command."""
    from services.i18n import get_translator
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    t = context.user_data.get("t", get_translator(get_user_language(user.id) or "en"))
    current = get_cached_menu_mode(user.id)
    new_mode = "play" if current == "full" else "full"
    set_user_menu_mode(user.id, new_mode)
    invalidate_menu_mode_cache(user.id)
    await update.message.reply_text(
        render_main_menu_text(user.id, t=t),
        reply_markup=_main_menu_markup(user.id, t=t),
        parse_mode=ParseMode.HTML,
    )


@guarded
async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await update.message.reply_text(render_main_menu_text(user.id, t=t), reply_markup=_main_menu_markup(user.id, t=t), parse_mode=ParseMode.HTML)


@guarded
async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await update.message.reply_text(render_balance_screen_text(user.id, t=t), reply_markup=get_balance_keyboard(t=t, demo_mode_enabled=_is_demo_mode_enabled()), parse_mode=ParseMode.HTML)


# ── i18n commands ────────────────────────────────────────────────────────────

@guarded
async def language_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Allow users to switch their interface language: /language en|ru"""
    user = update.effective_user
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    lang = (context.args[0] or "").strip().lower() if context.args else ""
    if lang not in ("en", "ru"):
        await update.message.reply_text("Usage: /language en|ru")
        return
    set_user_language(user.id, lang)
    context.user_data["lang"] = lang
    context.user_data["t"] = get_translator(lang)
    t = context.user_data["t"]
    await update.message.reply_text(
        t("language.updated", default="✅ Language updated"),
    )


@require_admin_command
async def reload_locale_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin-only: hot-reload locale JSON files without restarting the bot."""
    from services.i18n import reload_translations
    reload_translations()
    await update.message.reply_text("✅ Locales reloaded")

@guarded
async def profile_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    lang = context.user_data.get("lang", "en")
    t = context.user_data.get("t", get_translator(lang))
    snapshot = get_profile_snapshot(user.id)
    await update.message.reply_text(
        render_profile_text(snapshot, t=t),
        reply_markup=get_profile_keyboard(t=t, lang=lang),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


def _waiting_duel_share_copy(payload: dict, *, t, practice: bool = False) -> tuple[str, str]:
    """Render a stable localized waiting-card from authoritative DB data.

    STEP-007 deliberately avoids embedding a minute countdown in the shared
    message: Telegram inline cards can outlive the original query and a static
    timer becomes false. The lifecycle binding updates the whole card on join,
    expiry, cancellation, and completion instead.
    """
    share_url = str(payload.get("url") or "").strip()
    remaining_raw = payload.get("secondsRemaining")
    if remaining_raw is None:
        return "", share_url
    try:
        if int(remaining_raw) <= 0:
            return "", share_url
    except (TypeError, ValueError):
        return "", share_url
    if not share_url:
        return "", share_url

    if practice:
        stake = float(payload.get("stakeAmount") or 0)
        duel_format = str(payload.get("duelFormat") or DUEL_FORMAT_SINGLE)
        if duel_format == DUEL_FORMAT_BEST_OF_3:
            message = t(
                "shared_live.practice.open_bo3",
                default=(
                    "🎯 Demo Best of 3 challenge is open\n\n"
                    "💎 Stake: {stake} Demo GRAM for the whole match\n"
                    "🆓 No deposit and no real GRAM\n"
                    "🔥 An opponent is still needed — join while the spot is open."
                ),
                stake=f"{stake:.2f}",
            )
        else:
            message = t(
                "shared_live.practice.open_single",
                default=(
                    "⚡ Demo Duel challenge is open\n\n"
                    "💎 Stake: {stake} Demo GRAM\n"
                    "🆓 No deposit and no real GRAM\n"
                    "🔥 One opponent spot is still open."
                ),
                stake=f"{stake:.2f}",
            )
        description = t(
            "shared_live.practice.open_description",
            default="{stake} Demo GRAM • free challenge • spot open",
            stake=f"{stake:.2f}",
        )
        return str(message).strip(), str(description)

    amount = float(payload.get("betAmount") or 0)
    asset = str(payload.get("asset") or "GRAM").strip().upper() or "GRAM"
    is_private = bool(payload.get("isPrivate"))
    duel_format = str(payload.get("duelFormat") or DUEL_FORMAT_SINGLE)
    if duel_format == DUEL_FORMAT_BEST_OF_3:
        message = t(
            "shared_live.duel.open_bo3",
            default=(
                "🎯 Best of 3 challenge is open\n\n"
                "💰 Stake: {amount} {asset}\n"
                "One stake covers the whole match.\n"
                "🔥 An opponent is still needed — accept while the spot is open."
            ),
            amount=f"{amount:.2f}",
            asset=asset,
        )
    else:
        message = t(
            "shared_live.duel.open_single",
            default=(
                "⚔️ Roll Duel challenge is open\n\n"
                "💰 Stake: {amount} {asset}\n"
                "🔥 One opponent spot is still open."
            ),
            amount=f"{amount:.2f}",
            asset=asset,
        )
    description = t(
        "shared_live.duel.open_description_private" if is_private else "shared_live.duel.open_description",
        default="{amount} {asset} • challenge open",
        amount=f"{amount:.2f}",
        asset=asset,
    )
    return str(message).strip(), str(description)


def _branded_waiting_share_message(
    message: str,
    *,
    payload: dict,
    kind: str,
    entity_id: int,
    language: str,
) -> tuple[str, str, dict | None]:
    destination_url = str(payload.get("url") or "").strip()
    amount = payload.get("stakeAmount") if kind == "practice" else payload.get("betAmount")
    asset = "Demo GRAM" if kind == "practice" else str(payload.get("asset") or "GRAM")
    preview_url = build_preview_url(
        kind=kind,
        entity_id=int(entity_id),
        destination_url=destination_url,
        language=language,
        state="waiting",
        duel_format=str(payload.get("duelFormat") or DUEL_FORMAT_SINGLE),
        amount=f"{float(amount or 0):.2f}",
        asset=asset,
    )
    return (
        append_preview_link(message, preview_url=preview_url, language=language),
        preview_url,
        link_preview_api_kwargs(preview_url),
    )


async def handle_chosen_inline_result(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bind a sent inline duel card to its authoritative lifecycle.

    Telegram only supplies ``inline_message_id`` when inline feedback is enabled
    in BotFather. Missing feedback is a safe no-op: the deep link remains valid
    and gameplay never depends on social-card delivery.
    """
    chosen = update.chosen_inline_result
    user = update.effective_user
    if not chosen or not user or not chosen.inline_message_id:
        return

    from services.shared_inline_status import (
        parse_chosen_result_id,
        register_shared_inline_message,
    )

    target = parse_chosen_result_id(chosen.result_id, chosen_user_id=user.id)
    if not target:
        return
    try:
        language = get_user_language(user.id) or "en"
        result = register_shared_inline_message(
            inline_message_id=chosen.inline_message_id,
            result_id=chosen.result_id,
            kind=target.kind,
            entity_id=target.entity_id,
            owner_user_id=target.owner_user_id,
            language=language,
        )
        if not result.get("ok"):
            logger.warning(
                "Shared inline binding rejected: result_id=%s user=%s error=%s",
                chosen.result_id,
                user.id,
                result.get("error"),
            )
    except Exception:
        logger.exception(
            "Shared inline binding failed: result_id=%s user=%s",
            chosen.result_id,
            user.id,
        )


async def handle_inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.inline_query
    user = update.effective_user
    if not query or not user:
        return

    create_or_update_user(user.id, user.username, user.first_name)
    t = get_t(user.id)
    language = get_user_language(user.id) or "en"
    query_text = str(query.query or "").strip()

    def _inline_game_id(prefix: str) -> int | None:
        raw_id = query_text.removeprefix(prefix)
        if not raw_id.isdigit():
            return None
        game_id = int(raw_id)
        return game_id if game_id > 0 else None

    async def _answer_empty() -> None:
        await query.answer([], cache_time=0, is_personal=True)

    if query_text.startswith("practice_result_"):
        practice_game_id = _inline_game_id("practice_result_")
        if practice_game_id is None:
            await _answer_empty()
            return
        try:
            payload = get_practice_result_share_payload(practice_game_id, user.id)
        except Exception:
            logger.exception(
                "Inline Demo result share payload failed for game %s and user %s",
                practice_game_id,
                user.id,
            )
            await _answer_empty()
            return
        if not payload:
            await _answer_empty()
            return
        share_url = str(payload.get("url") or "").strip()
        outcome = str(payload.get("outcome") or "draw")
        outcome_label = t(
            f"practice.share_result.outcome_{outcome}",
            default={"win": "Win", "loss": "Loss", "draw": "Draw"}.get(outcome, "Draw"),
        )
        duel_format = str(payload.get("duelFormat") or DUEL_FORMAT_SINGLE)
        if duel_format == DUEL_FORMAT_BEST_OF_3:
            message_text = t(
                "practice.share_result.message_bo3",
                default=(
                    "🧪 Demo Best of 3 result on Roll Duel\n\n"
                    "🎯 Final score: {p1}–{p2}\n"
                    "Result: {outcome}\n"
                    "No real GRAM was used.\n\n"
                    "Try Demo Mode:\n{url}"
                ),
                p1=int(payload.get("player1RoundWins") or 0),
                p2=int(payload.get("player2RoundWins") or 0),
                outcome=outcome_label,
                url=share_url,
            )
        else:
            message_text = t(
                "practice.share_result.message",
                default=(
                    "🧪 Demo Duel result on Roll Duel\n\n"
                    "🎲 Score: {p1}–{p2}\n"
                    "Result: {outcome}\n"
                    "No real GRAM was used.\n\n"
                    "Try Demo Mode:\n{url}"
                ),
                p1=int(payload.get("player1Roll") or 0),
                p2=int(payload.get("player2Roll") or 0),
                outcome=outcome_label,
                url=share_url,
            )
        article = InlineQueryResultArticle(
            id=f"practice_result_{practice_game_id}_{user.id}",
            title=t("practice.share_result.inline_title", default="📨 Share Demo Result"),
            description=t(
                "practice.share_result.inline_description",
                default="Share the score and invite someone to try Demo Mode.",
            ),
            input_message_content=InputTextMessageContent(
                message_text=message_text,
                disable_web_page_preview=False,
            ),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    t("practice.share_result.open_demo", default="🧪 Try Demo Mode"),
                    url=share_url,
                )
            ]]),
            url=share_url,
        )
        await query.answer([article], cache_time=0, is_personal=True)
        return

    if query_text.startswith("practice_"):
        practice_game_id = _inline_game_id("practice_")
        if practice_game_id is None:
            await _answer_empty()
            return

        try:
            payload = get_practice_share_payload(practice_game_id, user.id)
        except Exception:
            logger.exception(
                "Inline Demo Duel share payload failed for game %s and user %s",
                practice_game_id,
                user.id,
            )
            await _answer_empty()
            return

        if not payload:
            await _answer_empty()
            return

        share_url = str(payload.get("url") or "").strip()
        message_text, inline_description = _waiting_duel_share_copy(payload, t=t, practice=True)
        if not message_text:
            message_text = t(
                "practice.share.message_legacy",
                default="🧪 Try a Demo Duel with me on Roll Duel — no deposit and no real GRAM.\n\nJoin this Demo Duel:\n{url}",
                url=share_url,
            ).strip()
            inline_description = t(
                "practice.share.inline_description",
                default="Invite a friend to this exact Demo Duel — no real GRAM needed.",
            )
        if not message_text or not share_url:
            await _answer_empty()
            return

        message_text, preview_url, preview_api_kwargs = _branded_waiting_share_message(
            message_text,
            payload=payload,
            kind="practice",
            entity_id=practice_game_id,
            language=language,
        )
        article = InlineQueryResultArticle(
            id=f"practice_{practice_game_id}_{user.id}",
            title=t("practice.share.inline_title", default="📨 Share Demo Duel"),
            description=str(inline_description)[:100],
            input_message_content=InputTextMessageContent(
                message_text=message_text,
                parse_mode=ParseMode.HTML,
                api_kwargs=preview_api_kwargs,
            ),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    t("shared_live.practice.join", default="🎲 Accept Demo Challenge"),
                    url=share_url,
                )
            ]]),
            url=share_url,
        )
        await query.answer([article], cache_time=0, is_personal=True)
        return

    if query_text.startswith("private_duel_"):
        game_id = _inline_game_id("private_duel_")
        if game_id is None:
            await _answer_empty()
            return
        try:
            payload = get_duel_share_payload(game_id=game_id, user_id=user.id)
        except Exception:
            logger.exception("Inline private duel share payload failed for game %s and user %s", game_id, user.id)
            await _answer_empty()
            return
        if not payload or not payload.get("isPrivate"):
            await _answer_empty()
            return
        message_text, inline_description = _waiting_duel_share_copy(payload, t=t)
        share_url = str(payload.get("url") or "").strip()
        if not message_text or not share_url:
            await _answer_empty()
            return
        message_text, preview_url, preview_api_kwargs = _branded_waiting_share_message(
            message_text,
            payload=payload,
            kind="duel",
            entity_id=game_id,
            language=language,
        )
        article = InlineQueryResultArticle(
            id=f"private_duel_{game_id}_{user.id}",
            title=t("duel.share.inline_title_private", default="📨 Share private challenge"),
            description=str(inline_description)[:100],
            input_message_content=InputTextMessageContent(
                message_text=message_text,
                parse_mode=ParseMode.HTML,
                api_kwargs=preview_api_kwargs,
            ),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    t("shared_live.duel.join", default="⚔️ Accept Challenge"),
                    url=share_url,
                )
            ]]),
            url=share_url,
        )
        await query.answer([article], cache_time=0, is_personal=True)
        return

    if query_text.startswith("result_"):
        game_id = _inline_game_id("result_")
        if game_id is None:
            await _answer_empty()
            return

        try:
            payload = get_result_share_payload(game_id=game_id, user_id=user.id, t=t)
        except Exception:
            logger.exception("Inline result share payload failed for game %s and user %s", game_id, user.id)
            await _answer_empty()
            return

        if not payload or payload.get("error"):
            await _answer_empty()
            return

        message_text = str(payload.get("composerText") or payload.get("text") or "").strip()
        share_url = str(payload.get("url") or "").strip()
        if not message_text:
            await _answer_empty()
            return

        article_kwargs = {
            "id": f"result_{game_id}_{user.id}",
            "title": t("btn.share_result", default="📨 Share result"),
            "description": str(payload.get("text") or message_text)[:100],
            "input_message_content": InputTextMessageContent(
                message_text=message_text,
                disable_web_page_preview=False,
            ),
        }
        if share_url:
            article_kwargs["reply_markup"] = InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    t("btn.join_roll_duel", default="🎲 Join Roll Duel"),
                    url=share_url,
                )
            ]])
            article_kwargs["url"] = share_url

        await query.answer(
            [InlineQueryResultArticle(**article_kwargs)],
            cache_time=0,
            is_personal=True,
        )
        return

    if query_text.startswith("duel_"):
        game_id = _inline_game_id("duel_")
        if game_id is None:
            await _answer_empty()
            return

        try:
            payload = get_duel_share_payload(game_id=game_id, user_id=user.id)
        except Exception:
            logger.exception("Inline duel share payload failed for game %s and user %s", game_id, user.id)
            await _answer_empty()
            return

        if not payload:
            await _answer_empty()
            return

        share_url = str(payload.get("url") or "").strip()
        message_text, inline_description = _waiting_duel_share_copy(payload, t=t)
        if not message_text:
            message_text = str(payload.get("composerText") or "").strip()
            if not message_text:
                text = str(payload.get("text") or "").strip()
                message_text = f"{text}\n\n{share_url}".strip()
            inline_description = str(payload.get("text") or message_text)
        if not message_text:
            await _answer_empty()
            return

        message_text, preview_url, preview_api_kwargs = _branded_waiting_share_message(
            message_text,
            payload=payload,
            kind="duel",
            entity_id=game_id,
            language=language,
        )
        article_kwargs = {
            "id": f"duel_{game_id}_{user.id}",
            "title": t("btn.share_duel", default="📨 Share duel"),
            "description": str(inline_description)[:100],
            "input_message_content": InputTextMessageContent(
                message_text=message_text,
                parse_mode=ParseMode.HTML,
                api_kwargs=preview_api_kwargs,
            ),
        }
        if share_url:
            article_kwargs["reply_markup"] = InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    t("shared_live.duel.join", default="⚔️ Accept Challenge"),
                    url=share_url,
                )
            ]])
            article_kwargs["url"] = share_url

        await query.answer(
            [InlineQueryResultArticle(**article_kwargs)],
            cache_time=0,
            is_personal=True,
        )
        return

    # Existing generic referral invite behavior remains the fallback for
    # "invite", an empty query, and unknown inline query text.
    snapshot = get_referral_snapshot(user.id)
    invite_link = str(snapshot.get("inviteLink") or "").strip()   # web OG URL if APP_BASE_URL set
    bot_deep_link = str(snapshot.get("botDeepLink") or invite_link).strip()  # always t.me link

    if not invite_link:
        await _answer_empty()
        return

    result = InlineQueryResultArticle(
        id=f"invite_{user.id}",
        title=t("invite.inline_title", default="Пригласить в Roll Duel 🎲"),
        description=t("invite.inline_description", default="Отправьте личную ссылку-приглашение в любой чат"),
        input_message_content=InputTextMessageContent(
            message_text=render_inline_invite_share_text(snapshot, t=t),
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=False,  # Enable: web URL has OG image
        ),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn.join_roll_duel", default="🎲 Join Roll Duel"), url=bot_deep_link)],
        ]),
        url=invite_link,
    )
    await query.answer([result], cache_time=0, is_personal=True)


@guarded
async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    snapshot = get_duel_history(user.id, limit=10)
    await update.message.reply_text(
        render_duel_history_text(snapshot, t=t),
        reply_markup=get_duel_history_keyboard(bool(snapshot.get('items')), t=t, demo_mode_enabled=_is_demo_mode_enabled()),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@guarded
async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    snapshot = get_referral_snapshot(user.id)
    await update.message.reply_text(
        render_referral_text(snapshot, t=t),
        reply_markup=get_referral_keyboard(snapshot.get('shareInvite'), t=t),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@guarded
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await update.message.reply_text(render_help_text(t=t), reply_markup=get_help_keyboard(t=t), parse_mode=ParseMode.HTML)


@guarded
async def support_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_states.pop(user.id, None)
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    await update.message.reply_text(render_support_text(t=t), reply_markup=get_support_keyboard(bool(SUPPORT_TON_ADDRESS), t=t), parse_mode=ParseMode.HTML)



@guarded
@require_admin_command
async def acquisition_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text, snapshot = _render_tg_acquisition_text(7)
    await update.message.reply_text(
        text,
        reply_markup=_tg_acquisition_keyboard(snapshot, period_days=7),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@guarded
@require_admin_command
async def campaigns_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await acquisition_command(update, context)


@guarded
@require_admin_command
async def campaign_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    code = str((context.args or [""])[0]).strip()
    if not code:
        await update.message.reply_text("Использование: /campaign CODE")
        return
    try:
        normalized = acquisition_service.normalize_campaign_code(code)
        text, _funnel = _render_tg_acquisition_campaign_text(normalized, 30)
    except acquisition_service.AcquisitionError:
        await update.message.reply_text("Кампания не найдена.")
        return
    await update.message.reply_text(
        text,
        reply_markup=_tg_acquisition_campaign_keyboard(normalized),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


@guarded
@require_admin_command
async def panel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_id = user.id if user else 0
    await update.message.reply_text(
        _render_tg_admin_overview_text(user_id),
        reply_markup=get_grouped_admin_panel_keyboard(_admin_web_url()),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def notify_cancelled_waiting_games(context, user_ids):
    for uid in user_ids:
        try:
            await context.bot.send_message(
                chat_id=uid,
                text="⏹️ Ваша дуэль была отменена оператором. Ставка возвращена на баланс."
            )
        except Exception as e:
            logger.exception(f"Failed to notify user {uid} about cancelled game: {e}")


# ============================================================
# ЕДИНЫЙ CALLBACK ROUTING (ПОСЛЕ ВСЕХ ФУНКЦИЙ — ИСПРАВЛЕНО)
# ============================================================

async def _leaderboard_global_handler(query, context):
    await handle_leaderboard_callback(query, context, scope="global")

async def _leaderboard_weekly_handler(query, context):
    await handle_leaderboard_callback(query, context, scope="weekly")

async def _leaderboard_workspace_handler(query, context):
    await handle_leaderboard_callback(query, context, scope="workspace")

async def _leaderboard_elo_handler(query, context):
    await handle_leaderboard_callback(query, context, scope="elo")


@guarded
async def rating_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user's personal ELO rating card."""
    if not await _is_allowed_in_chat(update, context):
        return
    user = update.effective_user
    create_or_update_user(user.id, user.username, user.first_name)
    from services.i18n import get_translator
    from services import settings as settings_svc
    t = context.user_data.get("t", get_translator("en"))

    elo_enabled = settings_svc.get_bool("elo_enabled")

    try:
        from services import elo as elo_service
        elo_info = elo_service.get_elo_stats(user.id)
        rating = elo_info.get("elo_rating", 1000)
        games = elo_info.get("games_count", 0)
        peak = elo_info.get("peak_rating", 1000)
        rank_name = elo_info.get("rank_name", "Bronze")
    except Exception:
        rating, games, peak, rank_name = 1000, 0, 1000, "Bronze"

    if not elo_enabled:
        text = t("rating.disabled", default=(
            "🏆 <b>ELO Rating</b>\n\n"
            "ELO rating is currently <b>disabled</b> on this platform.\n"
            "When enabled, your skill-based rating will update after every duel.\n\n"
            "Default rating: <b>1000</b> (Bronze)"
        ))
    else:
        text = t("rating.card", default=(
            "🏆 <b>ELO Rating Card</b>\n\n"
            "• Rating: <b>{rating}</b>\n"
            "• Rank: <b>{rank}</b>\n"
            "• Games played: <b>{games}</b>\n"
            "• Peak rating: <b>{peak}</b>\n\n"
            "ELO updates after every duel. Win against higher-rated opponents to climb faster!"
        ), rating=rating, rank=rank_name, games=games, peak=peak)

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.leaderboard", default="🥇 Leaderboard"), callback_data="leaderboard_elo")],
        [InlineKeyboardButton(t("btn.profile", default="👤 Profile"), callback_data="profile")],
        [InlineKeyboardButton(t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")],
    ])

    await update.message.reply_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


# ═══════════════════════════════════════════════════════════════
# VIP retired callback safety net
# ═══════════════════════════════════════════════════════════════

async def handle_vip_retired_callback(query, context):
    """Single retirement handler for every old VIP callback (vip_open,
    vip_club_info, vip_upgrade_menu, and the vip_buy_ prefix). VIP is
    retired as a product surface — this exists so any button a user
    still has cached in an old chat message (Telegram keeps inline
    keyboards live indefinitely) leads to an honest explanation instead
    of a stale purchase flow or a dead-benefit screen. purchase_vip_tier
    itself also independently refuses while vip_subscription_enabled is
    False, so this is a UX improvement on top of an already-safe backend,
    not the only thing preventing a real charge."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    text = t(
        "vip.retired",
        default=(
            "💎 <b>VIP is no longer part of Roll Duel.</b>\n\n"
            "There is no paid status to buy. The only way to earn extra "
            "rewards is the referral program — invite real players and your "
            "referral level grows as they actually play."
        ),
    )
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.ref_cabinet", default="🏆 Referral Cabinet"), callback_data="ref_cabinet")],
        [InlineKeyboardButton(t("btn.back_main", default=t("btn.back", default="◀️ Back")), callback_data="back_to_main")],
    ])
    await safe_edit_message(query.message, text, reply_markup=keyboard, parse_mode=ParseMode.HTML)


def _elo_admin_command_keyboard() -> InlineKeyboardMarkup:
    """Navigation for /eloadjust command replies."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🏆 ELO-панель", callback_data="admin_elo")],
        [InlineKeyboardButton("◀️ Назад в Админку", callback_data="admin_panel")],
    ])


@guarded
async def eloadjust_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin-only: adjust a user's ELO rating. /eloadjust USER_ID NEW_RATING"""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    user = update.effective_user
    if not _is_admin_user(user.id):
        await update.message.reply_text("❌ Admin only.")
        return

    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "ℹ️ <b>Как изменить ELO</b>\n\n"
            "Формат: <code>/eloadjust USER_ID NEW_RATING</code>\n"
            "Пример: <code>/eloadjust 1306626097 1500</code>",
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
        return

    try:
        target_user_id = int(context.args[0])
        new_rating = int(context.args[1])
    except (ValueError, IndexError):
        await update.message.reply_text(
            "❌ <b>Некорректные аргументы.</b>\n\n"
            "Используй формат: <code>/eloadjust USER_ID NEW_RATING</code>",
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
        return

    from services import elo as elo_service
    try:
        with database.transaction() as conn:
            result = elo_service.set_elo_rating(conn, target_user_id, new_rating, operator_id=user.id, reason="admin_command")
        await update.message.reply_text(
            "✅ <b>ELO обновлён</b>\n\n"
            f"Игрок: <code>{target_user_id}</code>\n"
            f"Новый рейтинг: <b>{result['new_rating']}</b>\n"
            f"Было: <b>{result['old_rating']}</b>",
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
    except elo_service.EloTargetUserNotFound:
        logger.warning("ELO adjust rejected for unknown user_id=%s by operator=%s", target_user_id, user.id)
        await update.message.reply_text(
            "❌ <b>Пользователь не найден.</b>\n\n"
            f"ID <code>{target_user_id}</code> ещё не зарегистрирован в Roll Duel.\n"
            "Возьми реальный ID в Web Admin → Пользователи или попроси игрока сначала открыть /start.",
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )
    except Exception as e:
        logger.exception("ELO adjust failed: %s", e)
        await update.message.reply_text(
            t("error.generic", default="❌ Не удалось выполнить действие. Попробуйте снова."),
            parse_mode=ParseMode.HTML,
            reply_markup=_elo_admin_command_keyboard(),
        )


async def safe_edit_message(message, text, reply_markup=None, parse_mode=None, disable_web_page_preview=None):
    """Edit a message, silently ignoring all stale/deleted-message errors.

    Swallowed silently (no reraise, no log noise):
    - Message is not modified
    - Message to edit not found   ← was crashing with unhandled BadRequest
    - There is no text in the message to edit
    - Query is too old / callback expired
    - Can't parse entities (bad HTML — fallback to plain text)
    """
    try:
        await message.edit_text(
            text,
            reply_markup=reply_markup,
            parse_mode=parse_mode,
            disable_web_page_preview=disable_web_page_preview,
        )
    except BadRequest as e:
        err = str(e).lower()
        # Silently skip all stale/ghost message errors
        if any(phrase in err for phrase in (
            "message is not modified",
            "message to edit not found",
            "there is no text in the message to edit",
            "query is too old",
            "message can't be edited",
            "message_id_invalid",
        )):
            return
        if "can't parse entities" in err or "can't parse" in err:
            # HTML parse error — retry without parse_mode as last resort
            try:
                import re as _re
                plain = _re.sub(r'<[^>]+>', '', text)
                await message.edit_text(plain, reply_markup=reply_markup)
            except Exception:
                pass
            return
        if "there is no text in the message to edit" in err:
            try:
                await message.reply_text(
                    text, reply_markup=reply_markup,
                    parse_mode=parse_mode,
                    disable_web_page_preview=disable_web_page_preview,
                )
            except Exception:
                pass
            return
        logger.warning("safe_edit_message unhandled BadRequest: %s", e)



async def handle_fair_play_info(query, context):
    """Fair Play Guarantee — объяснение честности игры."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    text = t("screen.help.fair_play_text", default=(
        "🎲 <b>Fair Play Guarantee</b>\n\n"
        "Roll Duel is built on <b>provably fair</b> randomness.\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🔒 <b>How it works</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "1. Before each duel, the server generates a secret <b>seed</b>.\n"
        "2. A <b>SHA-256 hash</b> is published to both players.\n"
        "3. After rolls, the seed is revealed for verification.\n"
        "4. Check: <code>sha256(seed) == published_hash</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🎲 <b>Dice rolls</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "• Telegram built-in dice used (not manipulable).\n"
        "• Results generated by Telegram — not Roll Duel.\n"
        "• Bot cannot influence or predict outcome.\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "💰 <b>Payouts</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "• Winner receives <b>95%</b> of the total pot.\n"
        "• Platform fee: <b>5%</b> (keeps servers running).\n"
        "• Draws: both players get <b>full refund</b>.\n"
        "• All transactions logged on ledger.\n\n"
        "✅ <b>Roll Duel never manipulates outcomes.</b>\n"
        "Contact support if you have any concerns."
    ))
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎫 Contact Support", callback_data="support")],
        [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="help")],
    ])
    await safe_edit_message(query.message, text, parse_mode=ParseMode.HTML, reply_markup=keyboard)


async def handle_ref_how_it_works(query, context):
    """How referral system works — compact for mobile."""
    from services.i18n import get_translator as _i18n_gt
    t = context.user_data.get("t") or _i18n_gt("en")
    await safe_answer_callback(query)
    lines = [t("ref.how.title", default="🤝 <b>How Referrals Work</b>"), "", "━━━━━━━━━━━━━━━━━━━━", t("ref.how.step1", default="📩 <b>Step 1 — Invite</b>"), t("ref.how.step1_body", default="Share your link. Your friend registers and becomes your referral."), "", t("ref.how.step2", default="🎲 <b>Step 2 — They Play</b>"), t("ref.how.step2_body", default="The platform receives a 5% fee from each duel pot."), "", t("ref.how.step3", default="💸 <b>Step 3 — You Earn</b>"), t("ref.how.step3_body", default="You automatically receive <b>20% of that rake</b> after every game."), "", "━━━━━━━━━━━━━━━━━━━━", t("ref.how.example_title", default="📊 <b>Example</b>"), t("ref.how.example_body", default="Your friend stakes 10 GRAM → pot 20 GRAM\nRake = 1 GRAM → your share = <b>0.20 GRAM</b>"), "", "━━━━━━━━━━━━━━━━━━━━", t("ref.how.tiers_title", default="🏅 <b>Tiers Increase Your Share</b>"), t("ref.how.tiers_body", default="🆕 Starter: 20%\n🥉 Bronze: 25%\n🥈 Silver: 30%\n🥇 Gold: 35%\n💎 Diamond: 40% + 50 GRAM\n👑 Legend: 45%, permanent"), "", t("ref.how.instant", default="⚡ Earnings are credited immediately after every game."), t("ref.how.withdraw", default="💰 Withdraw your earnings from your balance at any time.")]
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(t("ref.tab.tiers", default="🏅 Tiers"), callback_data="ref_tiers")], [InlineKeyboardButton(t("ref.tab.get_link", default="🔗 My Link"), callback_data="ref_show_link")], [InlineKeyboardButton(t("ref.back_to_cabinet", default="◀️ Back to cabinet"), callback_data="ref_cabinet")]])
    await safe_edit_message(query.message, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=keyboard, disable_web_page_preview=True)



async def terms_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show legal notice via /terms command."""
    text = (
        "⚖️ <b>Roll Duel – Legal Notice</b>\n\n"
        "• This is a <b>peer‑to‑peer dice game</b>, not a casino.\n"
        "• Players stake against each other; platform takes a 5% service fee.\n"
        "• <b>18+ only.</b> You must be at least 18 years old to use Roll Duel.\n"
        "• No warranty: use at your own risk.\n"
        "• You are responsible for compliance with your local laws.\n\n"
        "By using this bot, you confirm that you have read and accepted this notice.\n\n"
        "Full Terms: /terms  |  Support: /support"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def handle_legal_info(query, context):
    """Legal info screen from inline button."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    text = t("screen.help.legal_info_text", default=(
        "⚖️ <b>Legal Information</b>\n\n"
        "<b>What is Roll Duel?</b>\n"
        "A peer‑to‑peer dice game. Players compete directly — the platform never plays against you.\n\n"
        "<b>Service fee:</b> 5% of the total pot.\n\n"
        "<b>Age restriction:</b> 18+ only.\n\n"
        "<b>No warranty:</b> Use at your own risk. The platform is not liable for losses due to "
        "technical failures, user errors, or blockchain network issues.\n\n"
        "<b>Your responsibility:</b> You are solely responsible for compliance with the laws of your country.\n\n"
        "Send /terms for the full legal notice."
    ))
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.full_terms", default="⚖️ Полные правила"), callback_data="terms_full")],
        [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="help")],
    ])
    await safe_edit_message(query.message, text, parse_mode=ParseMode.HTML, reply_markup=keyboard)


async def handle_terms_full(query, context):
    """Show full terms text inline."""
    await safe_answer_callback(query)
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    text = t("screen.help.terms_full_text", default=(
        "⚖️ <b>Terms of Use</b>\n\n"
        "<b>1. Nature of service</b>\n"
        "Roll Duel is a peer‑to‑peer dice game. Players wager crypto against each other. "
        "The platform takes a fixed 5% service fee for matching and settlement.\n\n"
        "<b>2. Not a casino</b>\n"
        "This service is not a casino or bookmaker. We do not offer games against the house.\n\n"
        "<b>3. Age restriction</b>\n"
        "You must be at least 18 years old. By using this service you confirm you meet this requirement.\n\n"
        "<b>4. Jurisdiction</b>\n"
        "You are solely responsible for determining whether your use of Roll Duel complies with the laws of your country.\n\n"
        "<b>5. No warranty</b>\n"
        "The service is provided \"as is\". We are not liable for any losses including losses due to technical failures, "
        "user errors, or blockchain network issues.\n\n"
        "<b>6. Responsible play</b>\n"
        "Only play with funds you can afford to lose. If you feel you may have a problem, seek professional help."
    ))
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn.back", default="◀️ Back"), callback_data="legal_info")],
    ])
    await safe_edit_message(query.message, text, parse_mode=ParseMode.HTML, reply_markup=keyboard)


async def handle_accept_terms(query, context):
    """User accepts 18+ terms — update DB and show main menu."""
    await safe_answer_callback(query, "✅ Thank you!")
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    try:
        pending_state = pop_start_intent(user_id)
    except Exception:
        logger.exception("Failed to restore start intent for user %s", user_id)
        pending_state = None
        # Backward-compatible public-duel restore fallback. The canonical path
        # above is typed and also supports Demo Duel intents.
        try:
            from services.community_duel_feed import pop_pending_duel_start

            legacy_public = pop_pending_duel_start(user_id)
            if legacy_public and legacy_public.get("duel_id"):
                pending_state = {
                    "intent_type": "public_duel",
                    "start_arg": str(legacy_public.get("start_arg") or ""),
                    "target_id": int(legacy_public["duel_id"]),
                }
        except Exception:
            logger.exception("Legacy public duel intent restore failed for user %s", user_id)
    try:
        with get_connection() as conn:
            conn.execute(
                "UPDATE users SET accepted_terms_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                (user_id,),
            )
            conn.commit()
    except Exception as e:
        logger.exception("accept_terms DB update failed for user %s: %s", user_id, e)

    # STEP-REFERRAL-ONBOARDING-AND-STATUS-COHERENCE-001: referral attribution
    # + notification now happen unconditionally at the top of start_command,
    # before this gate is even shown — nothing to complete here anymore.

    chat_id = query.message.chat_id
    await context.bot.send_dice(chat_id, emoji='🎲')
    await context.bot.send_message(
        chat_id=chat_id,
        text=render_main_menu_text(user_id, t=t),
        reply_markup=_main_menu_markup(user_id, t=t),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    if pending_state:
        intent_type = str(pending_state.get("intent_type") or "")
        target_id = pending_state.get("target_id")
        if intent_type == "practice_duel" and target_id:
            await _send_practice_duel_join_prompt(
                bot=context.bot,
                chat_id=chat_id,
                user_id=user_id,
                practice_game_id=int(target_id),
                t=t,
            )
        elif intent_type == "demo_mode":
            if _is_demo_mode_enabled():
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=render_practice_menu_text(user_id, t=t),
                    reply_markup=get_practice_menu_keyboard(
                        t=t,
                        can_restore=can_restore_practice_balance(user_id),
                    ),
                    parse_mode=ParseMode.HTML,
                    disable_web_page_preview=True,
                )
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=_demo_mode_disabled_text(t),
                    parse_mode=ParseMode.HTML,
                    reply_markup=_main_menu_markup(user_id, t=t),
                )
        elif intent_type == "public_duel" and target_id:
            await _send_public_duel_join_prompt(
                bot=context.bot,
                chat_id=chat_id,
                user_id=user_id,
                duel_id=int(target_id),
                t=t,
            )


async def handle_decline_terms(query, context):
    """User declines terms — show a localized refusal and retry action."""
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator(get_user_language(query.from_user.id) or "en"))
    await safe_answer_callback(
        query,
        t("legal.declined_short", default="Access declined"),
        show_alert=False,
    )
    try:
        clear_start_intent(query.from_user.id)
    except Exception:
        pass
    await safe_edit_message(
        query.message,
        t(
            "legal.declined_message",
            default=(
                "❌ <b>Access declined.</b>\n\n"
                "You must confirm you are 18+ and agree to the Terms to use Roll Duel.\n\n"
                "Send /start to try again."
            ),
        ),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(
                t("legal.btn_try_again", default="↩️ Try again"),
                callback_data="start_terms_check",
            )
        ]]),
    )


async def handle_start_terms_check(query, context):
    """Re-show the 18+ confirmation screen."""
    await safe_answer_callback(query)
    user_id = query.from_user.id
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(t("legal.btn_confirm", default="✅ Подтверждаю (18+)"), callback_data="accept_terms")],
        [InlineKeyboardButton(t("legal.btn_decline", default="❌ Отклонить"), callback_data="decline_terms")],
    ])
    await safe_edit_message(
        query.message,
        t("legal.notice",
          default=(
              "⚠️ <b>Важное уведомление</b>\n\nRoll Duel — это P2P-игра с кубиком, не казино.\n"
              "Вам должно быть <b>18+</b> и вы берёте ответственность за соблюдение законов вашей страны.\n\n"
              "Вы подтверждаете, что вам 18+ и принимаете Условия использования?"
          )),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


CALLBACK_EXACT_HANDLERS = {
    "create_game": handle_create_game,
    "duel_format_menu": handle_duel_format_menu,
    "find_game": handle_find_game,
    "quick_duel": handle_quick_duel,
    "quick_duel_info": handle_quick_duel_info,
    "create_private_duel": handle_create_private_duel,
    "create_private_duel_single": handle_create_private_duel_single,
    "tournament_menu": handle_tournament_menu,
    "tournament_info": handle_tournament_info,
    "tournament_dice_help": handle_tournament_dice_help,
    "tournament_create_prompt": handle_tournament_create_prompt,
    "tournament_list": handle_tournament_list,
    "tsize_4": handle_tournament_size_chosen,
    "tsize_8": handle_tournament_size_chosen,
    "tstake_1": handle_tournament_stake_chosen,
    "tstake_5": handle_tournament_stake_chosen,
    "tstake_10": handle_tournament_stake_chosen,
    "tstake_custom": handle_tournament_custom_stake_prompt,
    "tcreate_confirm": handle_tournament_confirm,
    "practice_mode": handle_practice_mode_callback,
    "practice_create": handle_create_practice_game,
    "practice_format_menu": handle_practice_format_menu,
    "practice_bet_all": handle_practice_bet_selection,
    "practice_bet_custom": handle_practice_bet_selection,
    "practice_find": handle_find_practice_game,
    "practice_balance": handle_practice_balance_callback,
    "practice_restore_balance": handle_restore_practice_balance,
    "practice_about": handle_practice_about_callback,
    "balance": handle_balance_callback,
    "bet_select": _handle_bet_select_back,
    "bet_custom": handle_bet_selection,
    "deposit": handle_deposit_callback,
    "withdraw": handle_withdraw_callback,
    "stats": handle_stats_callback,
    "help": handle_help_callback,
    "community": handle_community_callback,
    "money_flow": handle_money_flow_callback,
    "support": handle_support_callback,
    "support_open": handle_support_open_callback,
    "donate_menu": handle_support_callback,
    "back_to_main": handle_back_to_main,
    "refresh_main": handle_back_to_main,
    "toggle_menu_mode": handle_toggle_menu_mode,
    "notice_open": handle_notice_open_callback,
    "leave_game": handle_leave_game,
    "game_status": handle_game_status,
    "profile": handle_profile_callback,
    "lang_toggle": handle_language_toggle_callback,
    "my_history": handle_history_callback,
    "my_chats": handle_my_chats_callback,
    "connect_how_to": handle_connect_how_to,
    "workspace_connect": handle_workspace_connect_callback,
    "transaction_history": handle_transaction_history,
    "invite_friends": handle_ref_cabinet,
    "ref_cabinet": handle_ref_cabinet,
    "ref_stats": handle_ref_stats,
    "ref_tiers": handle_ref_tiers,
    "ref_leaderboard": handle_ref_leaderboard,
    "ref_show_link": handle_ref_show_link,
    "ref_how_to_earn": handle_ref_how_to_earn,
    "ref_diamond_legend": handle_ref_diamond_legend,
    "ref_share_card": handle_ref_share_card,
    "ref_share_duel": handle_ref_share_duel,
    "ref_earnings": handle_ref_earnings,
    "fair_play_info": handle_fair_play_info,
    "ref_how_it_works": handle_ref_how_it_works,
    "invite_show_link": handle_invite_show_link,
    "invite_show_short_link": handle_invite_show_short_link,
    "invite_send_card": handle_invite_send_card,
    "invite_main": handle_invite_main,
    "wallet_open": handle_wallet_open,
    "wallet_disconnect": handle_wallet_disconnect,
    "wallet_telegram": handle_wallet_telegram,
    "wallet_info": handle_wallet_info_callback,
    "ton_connect_start": handle_ton_connect_start,
    "giveaway_browse_public": handle_giveaway_browse_public,
    "giveaway_dashboard": handle_giveaway_dashboard,
    "leaderboard": _leaderboard_global_handler,
    "leaderboard_global": _leaderboard_global_handler,
    "leaderboard_weekly": _leaderboard_weekly_handler,
    "leaderboard_workspace": _leaderboard_workspace_handler,
    "leaderboard_elo": _leaderboard_elo_handler,
    "legal_info": handle_legal_info,
    "terms_full": handle_terms_full,
    "accept_terms": handle_accept_terms,
    "decline_terms": handle_decline_terms,
    "start_terms_check": handle_start_terms_check,
    # --- VIP CLUB (retired — see handle_vip_retired_callback) ---
    "vip_open": handle_vip_retired_callback,
    "vip_club_info": handle_vip_retired_callback,
    "vip_upgrade_menu": handle_vip_retired_callback,
}

CALLBACK_PREFIX_HANDLERS = [
    # --- TOURNAMENTS ---
    ("join_tournament_", handle_join_tournament),
    ("tournament_status_", handle_tournament_status),
    ("tournament_history_", handle_tournament_history),
    ("tournament_start_", handle_tournament_start),
    ("tournament_cancel_", handle_tournament_cancel),
    ("vip_buy_", handle_vip_retired_callback),
    ("tcopy_", handle_tournament_copy_link),
    ("tstake_", handle_tournament_stake_chosen),  # catches any numeric stake e.g. tstake_2.5

    ("check_deposit_", handle_check_deposit_invoice),
    ("deposit_confirm_new_", _handle_deposit_confirm_new),

    # --- ИГРОВЫЕ ПРЕФИКСЫ ---
    ("duel_format_", handle_duel_format_selection),
    ("practice_format_", handle_practice_format_selection),
    ("bet_", handle_bet_selection),
    ("join_game_", _handle_join_game_safe),
    ("confirm_join_", handle_confirm_join),
    ("cancel_game_", handle_cancel_game),
    ("check_game_", handle_check_game),
    ("rematch_", handle_rematch),

    # --- PRACTICE ---
    ("pbet_", handle_practice_bet_selection),
    ("pjoin_game_", handle_join_practice_game_request),
    ("pconfirm_join_", handle_confirm_join_practice),
    ("pcancel_game_", handle_cancel_practice_game),
    ("prematch_", handle_practice_rematch),

    # --- GIVEAWAYS ---
    ("gw_edit_title_", _handle_gw_edit_field),
    ("gw_edit_prize_", _handle_gw_edit_field),
    ("gw_edit_winners_", _handle_gw_edit_field),
    ("gw_edit_deadline_", _handle_gw_edit_field),
    ("gw_edit_starts_", _handle_gw_edit_field),
    ("gw_activate_", _handle_gw_activate),
    ("gw_confirm_activate_", _handle_gw_confirm_activate),
    ("gw_end_", _handle_gw_end),
    ("gw_confirm_end_", _handle_gw_confirm_end),
    ("gw_draw_", _handle_gw_draw),
    ("gw_confirm_draw_", _handle_gw_confirm_draw),
    ("gw_publish_live_", _handle_gw_publish_live),
    ("gw_publish_results_", _handle_gw_publish_results),
    ("gw_results_", _handle_gw_results),
    ("gw_confirm_results_", _handle_gw_confirm_results),
    ("gw_cancel_", _handle_gw_cancel),
    ("gw_confirm_cancel_", _handle_gw_confirm_cancel),
    ("gw_join_", _handle_gw_join),
    ("gw_deadline_preset_", _handle_gw_deadline_preset),
    ("gw_start_preset_", _handle_gw_start_preset),
    ("gw_back_", _handle_gw_back),
    ("gw_toggle_sub_", _handle_gw_toggle_subscription_required),
    ("gw_toggle_real_duel_", _handle_gw_toggle_real_duel_required),
    ("gw_add_sponsor_", _handle_gw_add_sponsor),
    ("gw_confirm_remove_sponsor_", _handle_gw_confirm_remove_sponsor),
    ("gw_remove_sponsor_", _handle_gw_remove_sponsor),
    ("gw_check_eligibility_", _handle_gw_check_eligibility),
    ("giveaway_group_", _handle_giveaway_group_dashboard),
    ("gh_", _handle_giveaway_history),
    ("giveaway_history_", _handle_giveaway_history),
    ("giveaway_open_", _handle_giveaway_open),
    ("giveaway_create_", _handle_giveaway_create),
    ("giveaway_toggle_public_", _handle_gw_toggle_public),
    ("giveaway_join_public_", _handle_gw_join_public),
    ("giveaway_browse_prev", handle_giveaway_browse_public),
    ("giveaway_browse_next", handle_giveaway_browse_public),
    ("giveaway_sort_", handle_giveaway_browse_public),
    ("giveaways_page_", _handle_giveaways_page),
    ("my_giveaways_page_", _handle_my_giveaways_page),

    # --- WORKSPACES ---
    ("workspace_open_", _handle_workspace_open),
    ("workspace_toggle_duel_", _handle_ws_toggle),
    ("workspace_toggle_result_", _handle_ws_toggle),
    ("ws_toggle_lb_", _handle_ws_toggle),
    ("ws_toggle_weekly_", _handle_ws_toggle),
    ("workspace_set_default_", _handle_ws_set_default),
    ("workspace_test_", _handle_ws_test),
    ("workspace_refresh_", _handle_ws_refresh),
    ("workspace_disconnect_", _handle_ws_disconnect),
    ("workspace_disconnect_apply_", _handle_ws_disconnect_apply),
    ("ws_scope_", _handle_ws_scope),
    ("ws_pub_chat_", _handle_ws_publish),
    ("ws_pub_weekly_", _handle_ws_publish),
    ("ws_pub_champ_", _handle_ws_publish),
    ("ws_pub_preview_", _handle_ws_publish),

    # --- GROUPS ---
    ("group_play_", _handle_group_deeplink),
    ("group_leaderboard_", _handle_group_deeplink),
    ("group_giveaway_", _handle_group_deeplink),

    # --- REFERRALS ---
    ("ref_list_", handle_ref_list),

    # --- SUPPORT TICKETS ---
    ("ticket_close_", handle_ticket_close_callback),
    ("ticket_user_close_", handle_ticket_user_close_callback),
]


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Centralized callback query handler with exact + prefix routing."""
    query = update.callback_query
    if not query:
        return
    from services.i18n import get_translator
    t = context.user_data.get("t", get_translator("en"))

    # FIX: Group chat — redirect to private, only allow workspace/leaderboard callbacks
    if update.effective_chat and update.effective_chat.type in ("group", "supergroup"):
        callback_data_check = query.data or ""
        group_allowed = (
            callback_data_check.startswith("ws_")
            or callback_data_check.startswith("group_")
            or callback_data_check.startswith("leaderboard")
            or callback_data_check.startswith("gw_join_")
        )
        if not group_allowed:
            await query.answer(
                t("group.open_to_play", default="Откройте Roll Duel в личном чате чтобы играть!"),
                show_alert=False,
            )
            return

    await safe_answer_callback(query)
    user_id = query.from_user.id if query.from_user else 0

    # Block banned users from interacting via callbacks
    if user_id and is_user_blocked(user_id):
        return

    callback_data = query.data or ""

    # Динамический rate‑limit: админам 60/мин, остальным 20/мин
    max_calls = 60 if user_id in ADMIN_IDS else 20
    if check_rate_limit(user_id, max_calls, 60):
        logger.warning("Rate limit exceeded for user %s", user_id)
        await query.answer("⏳ Too many requests. Please slow down.", show_alert=True)
        from services.i18n import get_translator
        _t = context.user_data.get("t", get_translator("en"))
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=_t("rate_limit.message", default="⏳ You're tapping too fast. Please wait a moment and try again."),
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(
                    _t("btn.back_main", default="◀️ Main Menu"), callback_data="back_to_main")]]),
                parse_mode=ParseMode.HTML,
            )
        except Exception:
            pass
        return

    # 1. Exact match handlers
    if callback_data in CALLBACK_EXACT_HANDLERS:
        handler = CALLBACK_EXACT_HANDLERS[callback_data]
        if asyncio.iscoroutinefunction(handler):
            await handler(query, context)
        else:
            handler(query, context)
        return

    # 2. Prefix handlers
    for prefix, handler in CALLBACK_PREFIX_HANDLERS:
        if callback_data.startswith(prefix):
            if asyncio.iscoroutinefunction(handler):
                await handler(query, context)
            else:
                handler(query, context)
            return

    # 3. Admin callbacks
    if await _dispatch_admin_callback(query, context, user_id=user_id, callback_data=callback_data):
        return

    # 4. Unknown callback
    logger.warning("Unknown callback_data from user %s: %s", user_id, callback_data)
    await query.answer("❌ Unknown action", show_alert=True)
