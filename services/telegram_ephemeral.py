"""Telegram Bot API 10.2 ephemeral group UX adapter.

This module intentionally uses the raw Bot API through the shared HTTP client.
The repository is pinned to python-telegram-bot 20.7, which predates Bot API
10.2 and therefore does not expose high-level ephemeral message methods.

Safety contract:
- feature flag OFF by default;
- fail-closed chat allowlist;
- ephemeral delivery is presentation-only;
- delivery failure falls back to private chat and never mutates game state;
- bot token is never logged.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import urlparse

from services.http_client import get_http_client

logger = logging.getLogger(__name__)


class EphemeralDeliveryError(RuntimeError):
    """Raised when Telegram rejects a raw Bot API request."""


@dataclass(frozen=True)
class EphemeralDeliveryResult:
    ok: bool
    channel: str
    result: dict[str, Any] | None = None
    error: str | None = None


def _env_bool(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0") or "").strip().lower()
    return raw in {"1", "true", "yes", "on", "enabled"}


def is_enabled() -> bool:
    return _env_bool("TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED", False)


def _normalize_chat_target(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    if raw.startswith("@"):  # public username
        username = raw[1:].strip().lower()
        return f"@{username}" if username else None
    if raw.lstrip("-").isdigit():
        return str(int(raw))
    return f"@{raw.lower()}"


def configured_allowlist() -> tuple[str, ...]:
    raw_values: list[str] = []
    for name in (
        "TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST",
        "TELEGRAM_EPHEMERAL_GROUP_CHAT_IDS",
    ):
        raw_values.extend(str(os.getenv(name, "") or "").split(","))
    values: list[str] = []
    for raw in raw_values:
        normalized = _normalize_chat_target(raw)
        if normalized and normalized not in values:
            values.append(normalized)
    return tuple(values)


def is_chat_allowed(*, chat_id: int | str | None, username: str | None = None) -> bool:
    if not is_enabled():
        return False
    allowlist = set(configured_allowlist())
    if not allowlist:  # fail closed
        return False
    candidates = {
        normalized
        for normalized in (
            _normalize_chat_target(chat_id),
            _normalize_chat_target(username),
            _normalize_chat_target(f"@{username}" if username else None),
        )
        if normalized
    }
    return bool(candidates & allowlist)


def _serialize_reply_markup(reply_markup: Any) -> dict[str, Any] | None:
    if reply_markup is None:
        return None
    if isinstance(reply_markup, dict):
        return reply_markup
    to_dict = getattr(reply_markup, "to_dict", None)
    if callable(to_dict):
        return to_dict()
    raise TypeError("reply_markup must be a dict or Telegram object with to_dict()")


async def raw_bot_api_call(bot: Any, method: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = str(getattr(bot, "token", "") or "").strip()
    if not token:
        raise EphemeralDeliveryError("telegram_bot_token_unavailable")
    base_url = str(os.getenv("TELEGRAM_BOT_API_BASE_URL", "https://api.telegram.org") or "").rstrip("/")
    parsed = urlparse(base_url)
    loopback_hosts = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme == "https" and parsed.netloc:
        pass
    elif parsed.scheme == "http" and (parsed.hostname or "").lower() in loopback_hosts:
        # A local Bot API server may intentionally use plain HTTP on loopback.
        pass
    else:
        raise EphemeralDeliveryError("invalid_or_insecure_bot_api_base_url")

    client = get_http_client()
    try:
        response = await client.post(f"{base_url}/bot{token}/{method}", json=payload)
    except Exception as exc:  # network failure only; no token in message
        raise EphemeralDeliveryError(f"telegram_transport_error:{type(exc).__name__}") from exc

    try:
        body = response.json()
    except Exception as exc:
        raise EphemeralDeliveryError(f"telegram_invalid_json:http_{response.status_code}") from exc

    if response.status_code >= 400 or not bool(body.get("ok")):
        description = str(body.get("description") or f"HTTP {response.status_code}")
        error_code = body.get("error_code")
        raise EphemeralDeliveryError(f"telegram_api_error:{error_code or response.status_code}:{description}")

    result = body.get("result")
    return result if isinstance(result, dict) else {"value": result}


async def send_ephemeral_text(
    bot: Any,
    *,
    chat_id: int | str,
    receiver_user_id: int,
    text: str,
    message_thread_id: int | None = None,
    callback_query_id: str | None = None,
    reply_markup: Any = None,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool = True,
) -> dict[str, Any]:
    if not text:
        raise ValueError("text is required")
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "receiver_user_id": int(receiver_user_id),
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": bool(disable_web_page_preview),
    }
    if message_thread_id:
        payload["message_thread_id"] = int(message_thread_id)
    if callback_query_id:
        payload["callback_query_id"] = str(callback_query_id)
    markup = _serialize_reply_markup(reply_markup)
    if markup:
        payload["reply_markup"] = markup
    return await raw_bot_api_call(bot, "sendMessage", payload)


async def get_chat_raw(bot: Any, chat_id: int | str) -> dict[str, Any]:
    return await raw_bot_api_call(bot, "getChat", {"chat_id": chat_id})


def _ephemeral_commands(language: str) -> list[dict[str, Any]]:
    ru = str(language or "").lower().startswith("ru")
    descriptions = {
        "play": "Открыть приватное игровое меню" if ru else "Open your private play menu",
        "balance": "Показать баланс только вам" if ru else "Show your balance privately",
        "tournament": "Открыть турниры приватно" if ru else "Open tournaments privately",
        "help": "Навигация по сообществу" if ru else "Community navigation and help",
    }
    return [
        {"command": command, "description": description, "is_ephemeral": True}
        for command, description in descriptions.items()
    ]


async def sync_group_commands(bot: Any, targets: Iterable[str] | None = None) -> dict[str, Any]:
    """Install ephemeral commands only for explicitly allowlisted group chats."""
    if not is_enabled():
        return {"ok": True, "enabled": False, "targets": 0, "updated": 0, "errors": []}
    normalized_targets = tuple(targets or configured_allowlist())
    errors: list[str] = []
    updated = 0
    for target in normalized_targets:
        for language_code in ("", "en", "ru"):
            payload: dict[str, Any] = {
                "commands": _ephemeral_commands(language_code or "en"),
                "scope": {"type": "chat", "chat_id": target},
            }
            if language_code:
                payload["language_code"] = language_code
            try:
                await raw_bot_api_call(bot, "setMyCommands", payload)
                updated += 1
            except EphemeralDeliveryError as exc:
                errors.append(f"{target}:{language_code or 'default'}:{exc}")
                logger.warning("Could not sync ephemeral commands for %s/%s: %s", target, language_code or "default", exc)
    return {
        "ok": not errors,
        "enabled": True,
        "targets": len(normalized_targets),
        "updated": updated,
        "errors": errors,
    }


async def send_ephemeral_or_private(
    bot: Any,
    *,
    chat_id: int | str,
    chat_username: str | None,
    receiver_user_id: int,
    text: str,
    message_thread_id: int | None = None,
    callback_query_id: str | None = None,
    reply_markup: Any = None,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool = True,
) -> EphemeralDeliveryResult:
    """Send privately inside the group, falling back only to the user's DM."""
    try:
        from services.observability import metrics
    except Exception:  # pragma: no cover - metrics are optional at import time
        metrics = None

    if is_chat_allowed(chat_id=chat_id, username=chat_username):
        if metrics:
            metrics.inc("telegram.ephemeral.attempted")
        try:
            result = await send_ephemeral_text(
                bot,
                chat_id=chat_id,
                receiver_user_id=receiver_user_id,
                text=text,
                message_thread_id=message_thread_id,
                callback_query_id=callback_query_id,
                reply_markup=reply_markup,
                parse_mode=parse_mode,
                disable_web_page_preview=disable_web_page_preview,
            )
            if metrics:
                metrics.inc("telegram.ephemeral.sent")
            return EphemeralDeliveryResult(ok=True, channel="ephemeral", result=result)
        except EphemeralDeliveryError as exc:
            if metrics:
                metrics.inc("telegram.ephemeral.failed")
            logger.info(
                "Ephemeral delivery failed for chat=%s user=%s; using private fallback: %s",
                chat_id,
                receiver_user_id,
                exc,
            )
            ephemeral_error = str(exc)
    else:
        ephemeral_error = "feature_disabled_or_chat_not_allowed"

    if metrics:
        metrics.inc("telegram.ephemeral.fallback_attempted")
    try:
        result = await bot.send_message(
            chat_id=int(receiver_user_id),
            text=text,
            reply_markup=reply_markup,
            parse_mode=parse_mode,
            disable_web_page_preview=disable_web_page_preview,
        )
        if metrics:
            metrics.inc("telegram.ephemeral.fallback_sent")
        result_dict = result.to_dict() if hasattr(result, "to_dict") else {"message": str(result)}
        return EphemeralDeliveryResult(ok=True, channel="private", result=result_dict, error=ephemeral_error)
    except Exception as exc:
        if metrics:
            metrics.inc("telegram.ephemeral.fallback_failed")
        logger.info(
            "Private fallback failed for user=%s after ephemeral error=%s: %s",
            receiver_user_id,
            ephemeral_error,
            type(exc).__name__,
        )
        return EphemeralDeliveryResult(
            ok=False,
            channel="none",
            error=f"{ephemeral_error};private_fallback:{type(exc).__name__}",
        )
