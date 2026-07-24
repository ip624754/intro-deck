# STEP064B3 — Admin Language & Diagnostic Consistency

## Objective

Unify operator-facing Telegram administration copy around one contract:

- Russian human-readable labels;
- immutable English state/event identifiers shown separately as inline code;
- consistent contextual Back and Home navigation;
- bounded diagnostics without exposing raw exceptions or changing mutations.

## Canonical baseline

- Artifact: `IntroDeck_STEP064B2_FULL_2026-07-24.zip`
- SHA-256: `2f76c704053a951f6256011915727bd2032528bc55d7599bfb21469838875ca2`

## Mode and risk

- CogniForge mode: STANDARD
- Risk score: 10/12
- Critical invariants preserved: callback IDs, admin authorization, storage mutations, payment logic, reward accounting, LinkedIn publishing.

## Implemented contract

### Human label and raw code

Operator state is rendered as:

```text
ошибка · код: `failed`
готов к повтору · код: `retry_due`
Рассылка · код: `broadcast`
```

Raw codes are sanitized and bounded before rendering. Raw SQL/provider exceptions remain in logs, not normal admin copy.

### Navigation

Canonical navigation:

```text
← Назад в <context>
🏠 Главная
‹ Предыдущая
Следующая ›
🔄 Обновить
```

### Administrative vocabulary

Canonical Russian labels include:

- `Карточка пользователя`
- `Личное сообщение`
- `Уведомление`
- `Рассылка`
- `Исходящие`
- `Готовы к повтору`
- `Попытки исчерпаны`
- `Повторные привязки`
- `Интро в ожидании`

### Safety copy

Bulk operations remain preparation-only until a separate confirmation:

```text
Безопасный режим: только подготовка шаблона.
Отправка требует отдельного подтверждения.
```

### Web boundary

No standalone admin web application exists in the canonical repository. STEP064B3 therefore changes:

- Telegram admin/operator surfaces;
- `/api/health` copy policy metadata;
- operator diagnostic formatting.

It does not invent or claim modifications to a missing web-admin surface.

## Out of scope

- callback changes;
- admin permission changes;
- mutations or state-machine changes;
- database migrations;
- ENV changes;
- member copy;
- interface-language switching;
- payment, invite, AI/news, or LinkedIn mechanism changes.
