from __future__ import annotations

from types import SimpleNamespace

import pytest

import handlers
from services import telegram_ephemeral as ephemeral


class _FakeResult:
    def __init__(self, payload=None):
        self.payload = payload or {"message_id": 1}

    def to_dict(self):
        return dict(self.payload)


class _FakeBot:
    token = "test-token"
    id = 777

    def __init__(self):
        self.sent = []
        self.deleted = []

    async def send_message(self, **kwargs):
        self.sent.append(kwargs)
        return _FakeResult()

    async def delete_message(self, **kwargs):
        self.deleted.append(kwargs)
        return True


@pytest.fixture
def enabled_group(monkeypatch):
    monkeypatch.setenv("TELEGRAM_EPHEMERAL_GROUP_UX_ENABLED", "1")
    monkeypatch.setenv("TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST", "@rollduelchat,-100123")


def test_allowlist_is_fail_closed_and_accepts_username(monkeypatch, enabled_group):
    assert ephemeral.is_chat_allowed(chat_id=-100999, username="rollduelchat") is True
    assert ephemeral.is_chat_allowed(chat_id=-100123, username=None) is True
    assert ephemeral.is_chat_allowed(chat_id=-100999, username="other") is False

    monkeypatch.setenv("TELEGRAM_EPHEMERAL_GROUP_ALLOWLIST", "")
    monkeypatch.setenv("TELEGRAM_EPHEMERAL_GROUP_CHAT_IDS", "")
    assert ephemeral.is_chat_allowed(chat_id=-100123, username="rollduelchat") is False


@pytest.mark.asyncio
async def test_raw_adapter_rejects_insecure_external_bot_api_url(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_API_BASE_URL", "http://example.com")
    with pytest.raises(ephemeral.EphemeralDeliveryError, match="invalid_or_insecure"):
        await ephemeral.raw_bot_api_call(_FakeBot(), "getMe", {})


@pytest.mark.asyncio
async def test_send_ephemeral_payload_preserves_receiver_and_topic(monkeypatch):
    captured = {}

    async def fake_raw(bot, method, payload):
        captured.update({"method": method, "payload": payload})
        return {"message_id": 42, "ephemeral_message_id": "ephemeral-42"}

    monkeypatch.setattr(ephemeral, "raw_bot_api_call", fake_raw)
    result = await ephemeral.send_ephemeral_text(
        _FakeBot(),
        chat_id=-100123,
        receiver_user_id=55,
        message_thread_id=41,
        callback_query_id="cb-1",
        text="private",
        reply_markup={"inline_keyboard": [[{"text": "Open", "url": "https://t.me/rollduelbot"}]]},
    )

    assert result["ephemeral_message_id"] == "ephemeral-42"
    assert captured["method"] == "sendMessage"
    assert captured["payload"]["chat_id"] == -100123
    assert captured["payload"]["receiver_user_id"] == 55
    assert captured["payload"]["message_thread_id"] == 41
    assert captured["payload"]["callback_query_id"] == "cb-1"


@pytest.mark.asyncio
async def test_failed_ephemeral_never_falls_back_to_public_group(monkeypatch, enabled_group):
    bot = _FakeBot()

    async def fail(*args, **kwargs):
        raise ephemeral.EphemeralDeliveryError("unsupported")

    monkeypatch.setattr(ephemeral, "send_ephemeral_text", fail)
    result = await ephemeral.send_ephemeral_or_private(
        bot,
        chat_id=-100123,
        chat_username="rollduelchat",
        receiver_user_id=55,
        text="secret balance",
    )

    assert result.ok is True
    assert result.channel == "private"
    assert bot.sent and bot.sent[0]["chat_id"] == 55
    assert all(item["chat_id"] != -100123 for item in bot.sent)


@pytest.mark.asyncio
async def test_group_commands_are_marked_ephemeral(monkeypatch, enabled_group):
    calls = []

    async def fake_raw(bot, method, payload):
        calls.append((method, payload))
        return {"value": True}

    monkeypatch.setattr(ephemeral, "raw_bot_api_call", fake_raw)
    result = await ephemeral.sync_group_commands(_FakeBot(), targets=("@rollduelchat",))

    assert result["ok"] is True
    assert result["updated"] == 3
    assert len(calls) == 3
    for method, payload in calls:
        assert method == "setMyCommands"
        assert payload["scope"] == {"type": "chat", "chat_id": "@rollduelchat"}
        assert {item["command"] for item in payload["commands"]} == {"play", "balance", "tournament", "help"}
        assert all(item["is_ephemeral"] is True for item in payload["commands"])


@pytest.mark.asyncio
async def test_balance_group_handler_is_private_and_topic_scoped(monkeypatch, enabled_group):
    bot = _FakeBot()
    captured = {}

    async def fake_send(bot_arg, **kwargs):
        captured.update(kwargs)
        return ephemeral.EphemeralDeliveryResult(ok=True, channel="ephemeral", result={"message_id": 9})

    monkeypatch.setattr(ephemeral, "send_ephemeral_or_private", fake_send)
    monkeypatch.setattr(handlers, "is_user_blocked", lambda user_id: False)
    monkeypatch.setattr(handlers, "create_or_update_user", lambda *args, **kwargs: None)
    monkeypatch.setattr(handlers, "get_user_language", lambda user_id: "ru")
    monkeypatch.setattr(handlers, "render_balance_screen_text", lambda user_id, t=None: "💰 <b>Баланс:</b> 5 GRAM")

    chat = SimpleNamespace(id=-100123, type="supergroup", username="rollduelchat")
    user = SimpleNamespace(id=55, username="tester", first_name="Test", language_code="ru")
    message = SimpleNamespace(chat_id=-100123, message_id=77, message_thread_id=41)
    update = SimpleNamespace(effective_chat=chat, effective_user=user, effective_message=message)
    context = SimpleNamespace(bot=bot, user_data={})

    await handlers.community_balance_command(update, context)

    assert captured["chat_id"] == -100123
    assert captured["receiver_user_id"] == 55
    assert captured["message_thread_id"] == 41
    assert "5 GRAM" in captured["text"]
    assert bot.deleted == [{"chat_id": -100123, "message_id": 77}]


def test_group_navigation_reuses_existing_topics(monkeypatch):
    monkeypatch.setenv("COMMUNITY_OPEN_DUELS_RU_URL", "https://t.me/rollduelchat/37")
    monkeypatch.setenv("COMMUNITY_CHAT_RU_URL", "https://t.me/rollduelchat/41")
    monkeypatch.setenv("COMMUNITY_SUPPORT_URL", "https://t.me/rollduelchat/45")
    monkeypatch.setenv("COMMUNITY_FEEDBACK_URL", "https://t.me/rollduelchat/47")
    from services.i18n import get_translator

    keyboard = handlers._community_ephemeral_keyboard("help", t=get_translator("ru"), language="ru")
    urls = [button.url for row in keyboard.inline_keyboard for button in row if button.url]
    assert "https://t.me/rollduelchat/37" in urls
    assert "https://t.me/rollduelchat/41" in urls
    assert "https://t.me/rollduelchat/45" in urls
    assert "https://t.me/rollduelchat/47" in urls


def test_community_deep_links_are_direct_and_money_safe():
    assert handlers._community_private_link("community_play") == "https://t.me/rollduelbot?start=community_play"
    assert handlers._community_private_link("community_balance") == "https://t.me/rollduelbot?start=community_balance"
    assert handlers._community_private_link("community_tournament") == "https://t.me/rollduelbot?start=community_tournament"
