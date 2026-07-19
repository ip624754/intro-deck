#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Roll Duel bot entrypoint."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv
from telegram import BotCommand, BotCommandScopeAllPrivateChats, BotCommandScopeAllGroupChats, MenuButtonCommands
from telegram.ext import Application, CallbackQueryHandler, ChosenInlineResultHandler, CommandHandler, InlineQueryHandler, MessageHandler, filters

from database import cleanup_expired_user_runtime_states, init_database, using_postgres
from services.http_client import close_http_client
from services.i18n import load_translations
from services.i18n_middleware import i18n_middleware
from handlers import (
    balance_command,
    check_pending_invoices,
    handle_callback_query,
    handle_dice_roll,
    handle_message,
    handle_media_message,
    app_command,
    help_command,
    invite_command,
    connect_group_command,
    bind_duel_feed_command,
    community_status_command,
    community_play_command,
    community_balance_command,
    community_tournament_command,
    community_help_command,
    community_ephemeral_status_command,
    acquisition_command,
    campaigns_command,
    campaign_command,
    panel_command,
    profile_command,
    support_command,
    create_duel_command,
    find_duel_command,
    practice_command,
    start_command,
    handle_inline_query,
    handle_chosen_inline_result,
    init_runtime_scheduler,
    shutdown_runtime_scheduler,
    mode_command,
    terms_command,
    _createtournament_command,
    _jointournament_command,
    giveaways_command,
    join_giveaway_command,
    my_giveaways_command,
    # Support ticket system
    handle_support_chat_message,
    handle_ticket_close_callback,
    handle_ticket_user_close_callback,
    # i18n commands
    language_command,
    reload_locale_command,
    # ELO commands
    rating_command,
    leaderboard_command,
    eloadjust_command,
    # VIP Club commands (Stage 3C)
    # vip_command / vipclub_command removed entirely — STEP-VIP-FULL-REMOVAL-085
)
from health import start_health_server, stop_health_server
from rate_limiter import rate_limit, cleanup_old_entries
from infra.logging import configure_logging
from infra.runtime import WebhookRuntime
from routes.jetton_webhook import router as jetton_webhook_router

load_dotenv()
configure_logging()
logger = logging.getLogger(__name__)


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


async def prime_application_surface(application: Application) -> None:
    cleanup_expired_user_runtime_states(best_effort=True)
    if application.bot_data.get("surface_primed"):
        return

    try:
        await _sync_bot_metadata(application)
    except Exception as exc:
        logger.warning("Could not sync bot metadata: %s", exc)

    private_commands = [
        BotCommand("start", "Open the main menu"),
        BotCommand("create", "Create a new duel"),
        BotCommand("find", "Browse open duels"),
        BotCommand("practice", "Open Practice Mode"),
        BotCommand("balance", "Show your balance"),
        BotCommand("profile", "Show your profile"),
        BotCommand("rating", "Show your ELO rating"),
        BotCommand("leaderboard", "Open leaderboard"),
        BotCommand("invite", "Show your invite screen"),
        BotCommand("support", "Contact support"),
        BotCommand("connectgroup", "Connect a group chat"),
        BotCommand("help", "How Roll Duel works"),
    ]
    try:
        # Показывать команды только в личных сообщениях
        await application.bot.set_my_commands(private_commands, scope=BotCommandScopeAllPrivateChats())
        # В группах глобально ничего не показываем. Allowlisted community
        # получает отдельные Bot API 10.2 ephemeral commands ниже.
        await application.bot.set_my_commands([], scope=BotCommandScopeAllGroupChats())
    except Exception as exc:
        logger.warning("Could not set bot commands: %s", exc)

    try:
        from services.telegram_ephemeral import sync_group_commands
        sync_result = await sync_group_commands(application.bot)
        if sync_result.get("enabled"):
            logger.info(
                "Ephemeral group commands sync: targets=%s updated=%s errors=%s",
                sync_result.get("targets"),
                sync_result.get("updated"),
                len(sync_result.get("errors") or []),
            )
    except Exception as exc:
        logger.warning("Could not sync ephemeral community commands: %s", exc)

    try:
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    except Exception as exc:
        logger.warning("Could not restore command menu button: %s", exc)

    init_runtime_scheduler(application.bot)

    # Восстановление таймеров активных игр после рестарта
    from handlers import restore_active_game_timers
    await restore_active_game_timers(application.bot)
    logger.info("Restored active game timers after restart")

    # Очистка rate_limiter (раз в сутки)
    asyncio.create_task(cleanup_old_entries())
    logger.info("Started rate limiter cleanup task (daily)")

    # Start health check server (production monitoring)
    try:
        await start_health_server()
        logger.info("✅ Health check server started on port %s", os.getenv("HEALTH_PORT", "8080"))
    except Exception as exc:
        logger.warning("Failed to start health server: %s", exc)

    # Cleanup expired TON Connect sessions on startup
    try:
        from database import cleanup_expired_ton_connect_sessions
        cleaned = cleanup_expired_ton_connect_sessions()
        if cleaned > 0:
            logger.info("Cleaned %d expired TON Connect sessions", cleaned)
    except Exception as exc:
        logger.warning("Failed to cleanup TON Connect sessions: %s", exc)

    if os.getenv("ENABLE_INVOICE_POLLING", "0") == "1" and not using_postgres():
        existing_task = application.bot_data.get("invoice_poller_task")
        if existing_task is None or existing_task.done():
            application.bot_data["invoice_poller_task"] = asyncio.create_task(check_pending_invoices())
            logger.info("Legacy invoice polling enabled (fallback mode)")

    application.bot_data["surface_primed"] = True


async def _sync_bot_metadata(application: Application) -> None:
    """Keep Telegram-side bot descriptions aligned with the current product copy.

    Notes:
    - This updates text metadata used by t.me deep links / short previews.
    - Bot avatar/profile picture is still a manual BotFather step; it cannot be
      updated through the Bot API in the current Roll Duel setup.
    """

    description_en = (
        "Choose a stake, roll against real players, and win if your number is higher. "
        "No house, no fake opponents, no separate app."
    )
    description_ru = (
        "Выбирай ставку, бросай кубик против реального игрока и побеждай, если твоё число выше. "
        "Без казино, без фейковых соперников, без отдельного приложения."
    )
    short_description_en = "Fast GRAM dice duels inside Telegram"
    short_description_ru = "Быстрые GRAM-дуэли на кубиках в Telegram"

    try:
        await application.bot.set_my_description(description_en)
        await application.bot.set_my_description(description_ru, language_code="ru")
    except Exception as exc:
        logger.warning("Could not sync bot description: %s", exc)

    try:
        await application.bot.set_my_short_description(short_description_en)
        await application.bot.set_my_short_description(short_description_ru, language_code="ru")
    except Exception as exc:
        logger.warning("Could not sync bot short description: %s", exc)




async def shutdown_application_surface(application: Application) -> None:
    invoice_poller_task = application.bot_data.get("invoice_poller_task")
    if invoice_poller_task and not invoice_poller_task.done():
        invoice_poller_task.cancel()
    shutdown_runtime_scheduler()
    from database import close_pg_pool
    close_pg_pool()
    await close_http_client()
    from cryptopay import close_crypto_pay_client
    await close_crypto_pay_client()
    await stop_health_server()


def build_application() -> Application:
    bot_token = _require_env("TELEGRAM_BOT_TOKEN")
    application = Application.builder().token(bot_token).post_init(prime_application_surface).post_shutdown(shutdown_application_surface).build()

    # ── Global error handler — suppress expected stale-message/callback noise ──
    async def _global_error_handler(update, context):
        exc = context.error
        if exc is None:
            return
        err = str(exc).lower()
        # Known benign errors — log at DEBUG only, don't pollute WARNING/ERROR
        if any(phrase in err for phrase in (
            "query is too old",
            "response timeout expired",
            "message to edit not found",
            "message is not modified",
            "query_id_invalid",
            "query id is invalid",
            "message can't be edited",
        )):
            logging.getLogger("ptb.errors").debug("Suppressed benign PTB error: %s", exc)
            return
        # Everything else — log at WARNING with context
        logging.getLogger("ptb.errors").warning(
            "Unhandled PTB error for update %s: %s",
            getattr(update, "update_id", "?"),
            exc,
            exc_info=exc,
        )

    application.add_error_handler(_global_error_handler)

    # ── i18n middleware — must be group=-1 to fire before all other handlers ──
    application.add_handler(MessageHandler(filters.ALL, i18n_middleware), group=-1)
    application.add_handler(CallbackQueryHandler(i18n_middleware), group=-1)
    application.add_handler(InlineQueryHandler(i18n_middleware), group=-1)

    # Allowlisted Roll Duel community commands. Registered before their
    # private equivalents so a group /balance or /help never reaches the
    # public/private legacy handler. Replies are ephemeral or DM fallback.
    application.add_handler(CommandHandler("play", community_play_command, filters=filters.ChatType.GROUPS))
    application.add_handler(CommandHandler("balance", community_balance_command, filters=filters.ChatType.GROUPS))
    application.add_handler(CommandHandler("tournament", community_tournament_command, filters=filters.ChatType.GROUPS))
    application.add_handler(CommandHandler("help", community_help_command, filters=filters.ChatType.GROUPS))
    application.add_handler(CommandHandler("ephemeral_status", community_ephemeral_status_command, filters=filters.ChatType.GROUPS))

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("create", create_duel_command))
    application.add_handler(CommandHandler("find", find_duel_command))
    application.add_handler(CommandHandler("practice", practice_command))
    application.add_handler(CommandHandler("balance", balance_command))
    application.add_handler(CommandHandler("profile", profile_command))
    application.add_handler(CommandHandler("invite", invite_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("support", support_command))
    application.add_handler(CommandHandler("connectgroup", connect_group_command))
    application.add_handler(CommandHandler("bind_duel_feed", bind_duel_feed_command))
    application.add_handler(CommandHandler("community_status", community_status_command))
    application.add_handler(CommandHandler("acquisition", acquisition_command))
    application.add_handler(CommandHandler("campaigns", campaigns_command))
    application.add_handler(CommandHandler("campaign", campaign_command))
    application.add_handler(CommandHandler("admin", panel_command))
    application.add_handler(CommandHandler("panel_7x9LmQ2", panel_command))
    application.add_handler(CommandHandler("terms", terms_command))
    application.add_handler(CommandHandler("mode", mode_command))
    application.add_handler(CommandHandler("createtournament", _createtournament_command))
    application.add_handler(CommandHandler("jointournament", _jointournament_command))
    application.add_handler(CommandHandler("giveaways", giveaways_command))
    application.add_handler(CommandHandler("join_giveaway", join_giveaway_command))
    application.add_handler(CommandHandler("my_giveaways", my_giveaways_command))
    application.add_handler(CommandHandler("language", language_command))
    application.add_handler(CommandHandler("reload_locale", reload_locale_command))
    application.add_handler(CommandHandler("rating", rating_command))
    application.add_handler(CommandHandler("leaderboard", leaderboard_command))
    application.add_handler(CommandHandler("eloadjust", eloadjust_command))
    # /vip and /vipclub fully removed (STEP-VIP-FULL-REMOVAL-085) —
    # VIP has no product surface at all now, not even a retired-redirect
    # command. Product is pre-launch with zero real VIP usage history
    # (confirmed: volume_accumulated is 0 for all users), so there's no
    # muscle-memory user population to soften a landing for.
    application.add_handler(CallbackQueryHandler(handle_callback_query))
    application.add_handler(InlineQueryHandler(handle_inline_query))
    application.add_handler(ChosenInlineResultHandler(handle_chosen_inline_result))
    application.add_handler(MessageHandler(filters.Dice.DICE, handle_dice_roll))
    application.add_handler(MessageHandler((filters.PHOTO | filters.VIDEO | filters.ANIMATION | filters.Document.ALL) & ~filters.COMMAND, handle_media_message))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # ── Support ticket system ────────────────────────────────────────────────
    # Operator replies in the support group chat (reply to a bot ticket card)
    support_chat_id_env = os.getenv("SUPPORT_CHAT_ID", "0").strip()
    if support_chat_id_env and support_chat_id_env != "0":
        try:
            _sup_id = int(support_chat_id_env)
            application.add_handler(MessageHandler(
                filters.Chat(chat_id=_sup_id) & filters.TEXT & filters.REPLY & ~filters.COMMAND,
                handle_support_chat_message,
            ), group=1)  # group=1 so it doesn't conflict with the main TEXT handler
        except ValueError:
            logger.warning("Invalid SUPPORT_CHAT_ID value: %s", support_chat_id_env)

    # Operator closes ticket via button in support chat
    application.add_handler(CallbackQueryHandler(handle_ticket_close_callback, pattern=r"^ticket_close_\d+$"), group=1)
    # User closes their own ticket via button in bot chat
    application.add_handler(CallbackQueryHandler(handle_ticket_user_close_callback, pattern=r"^ticket_user_close_\d+$"), group=1)
    # ────────────────────────────────────────────────────────────────────────

    return application


async def _run_webhook_mode() -> None:
    application = build_application()
    runtime = WebhookRuntime(application)
    await runtime.start()
    await prime_application_surface(application)

    base_url = _require_env("APP_BASE_URL").rstrip("/")
    telegram_path = os.getenv("TELEGRAM_WEBHOOK_PATH", "/webhook/telegram")
    secret_token = _require_env("TELEGRAM_WEBHOOK_SECRET")
    webhook_url = f"{base_url}{telegram_path}"
    try:
        await application.bot.set_webhook(
            url=webhook_url,
            secret_token=secret_token,
            allowed_updates=["message", "callback_query", "inline_query", "chosen_inline_result"],
            drop_pending_updates=True,   # ← prevents stale callback flood after restart/crash
        )
    except TypeError:
        await application.bot.set_webhook(
            url=webhook_url,
            allowed_updates=["message", "callback_query", "inline_query", "chosen_inline_result"],
            drop_pending_updates=True,
        )
    logger.info("Telegram webhook configured: %s", webhook_url)

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    finally:
        await runtime.stop()


def main() -> None:
    delivery_mode = os.getenv("TELEGRAM_DELIVERY_MODE", "webhook" if using_postgres() else "polling").strip().lower()
    init_database()
    load_translations()
    logger.info("Roll Duel bootstrap complete | delivery_mode=%s | backend=%s", delivery_mode, "postgres" if using_postgres() else "sqlite")

    if delivery_mode == "webhook":
        asyncio.run(_run_webhook_mode())
        return

    application = build_application()
    application.run_polling(allowed_updates=["message", "callback_query", "inline_query", "chosen_inline_result"])


if __name__ == "__main__":
    main()
