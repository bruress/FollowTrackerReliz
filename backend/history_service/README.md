# history_service

Микросервис истории операций парсинга и анализа.

## Возможности
- Создание записи истории парсинга/анализа
- Получение списка истории пользователя
- Получение одной записи истории по `id`
- Обновление статуса истории (`in_process`, `parsing`, `analysing`, `completed`, `failed`)
- Хранение имен файлов (`parser_file`, `analysis_file`) и текста ошибки

## Стек
- Node.js
- Express
- PostgreSQL
- `dotenv`
- `pg`

## Установка
```bash
cd backend/history_service
npm install
```

### Настройка окружения
Создайте `.env` со значениями:

```env
PORT=3004
PGHOST=localhost
PGPORT=5432
PGDATABASE=history_service
PGUSER=postgres
PGPASSWORD=postgres
```

### Подготовка БД
```bash
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f migrations/init_db.sql
```

### Запуск
```bash
npm start
```

Сервис будет доступен на `http://localhost:3004`.

## Docker
```bash
cd backend/history_service
docker build -t history-service .
docker run --env-file .env -p 3004:3004 history-service
```

## API
Базовый префикс: `/api/history`

### `POST /add`
Создание записи истории.

Request:
```json
{
  "user_id": 1,
  "api": "vk",
  "domain": "domain",
  "from_date": "2026-04-01",
  "to_date": "2026-04-30",
  "flag_comments": false,
  "flag_month": true
}
```

Response `201`:
```json
{
  "message": "История успешно создана",
  "already_exists": false,
  "history": {}
}
```

Response `200` (если запись уже есть):
```json
{
  "message": "Такая история уже существует",
  "already_exists": true,
  "history": {}
}
```

### `POST /list`
Получение списка истории пользователя.

Request:
```json
{
  "user_id": 1,
  "page": 1,
  "limit": 20
}
```

Response `200`:
```json
{
  "message": "История пользователя получена",
  "histories": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "total_pages": 1
  }
}
```

### `POST /one/:id`
Получение одной записи истории по `id`.

Request:
```json
{
  "user_id": 1
}
```

Response `200`:
```json
{
  "message": "История успешно получена",
  "history": {}
}
```

### `POST /update/:id`
Обновление статуса записи истории.

Request:
```json
{
  "user_id": 1,
  "status": "failed",
  "parser_file": "vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json",
  "analysis_file": "analysis_vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json",
  "error": "Ошибка анализа"
}
```

## Валидация
- `user_id`: обязательный
- `id` в `:id`: обязательный
- `status`: только `in_process`, `parsing`, `analysing`, `completed`, `failed`
- при `status = failed` поле `error` обязательно и должно быть непустой строкой
- `from_date`/`to_date`: корректные даты, диапазон до 1 месяца
- `page`, `limit`: обязательные поля для `/list`

## Формат ошибки
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Текст ошибки"
  }
}
```

Типовые коды:
- `400` — ошибка валидации
- `404` — история не найдена
- `500` — внутренняя ошибка

## Структура проекта
```text
history_service/
├── controllers/
├── migrations/
├── models/
├── routers/
├── utils/
├── server.js
├── package.json
└── Dockerfile
```
