# parser_service

Микросервис парсинга данных сообществ VK.

## Возможности
- Редирект на VK OAuth (`/auth`)
- Сохранение и удаление VK-токена пользователя
- Проверка статуса токена (`/statusToken`)
- Парсинг постов по диапазону дат (`/parse`)
- Опциональный сбор комментариев
- Сохранение результата в `data/*.json`

## Стек
- Node.js
- Express
- PostgreSQL
- `axios`
- `dotenv`
- `pg`
- `cryptr`

## Установка
```bash
cd backend/parser_service
npm install
```

### Настройка окружения
Создайте `.env` со значениями:

```env
PORT=3003
PGHOST=localhost
PGPORT=5432
PGDATABASE=parser_service
PGUSER=postgres
PGPASSWORD=postgres
PARSER_TOKEN_SECRET=your_long_random_secret
```

### Подготовка БД
```bash
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f migrations/init_db.sql
```

### Запуск
```bash
npm start
```

Сервис будет доступен на `http://localhost:3003`.

## Docker
```bash
cd backend/parser_service
docker build -t parser-service .
docker run --env-file .env -p 3003:3003 parser-service
```

## API
Базовый префикс: `/api/vk`

### `GET /auth`
Редирект на страницу авторизации VK.

### `POST /addToken`
Сохранение токена пользователя.

Request:
```json
{
  "user_id": 1,
  "vk_token": "vk1.a.xxxxx",
  "expires_in": 86400
}
```

Response `200`:
```json
{
  "message": "Токен успешно создан"
}
```

### `POST /deleteToken`
Удаление токена пользователя.

### `POST /statusToken`
Проверка наличия токена пользователя.

Response `200`:
```json
{
  "message": "Токен существует",
  "expires_in": 1745946000
}
```

### `POST /parse`
Запуск парсинга постов.

Request:
```json
{
  "user_id": 1,
  "domainId": "domain",
  "from": "2026-01-01",
  "to": "2026-01-31",
  "flagParsingMonth": true,
  "flagAllowComments": false
}
```

Response `200`:
```json
{
  "result": []
}
```

## Валидация
- `domainId`: обязательное поле
- `from`, `to`: формат `YYYY-MM-DD`
- `flagParsingMonth`: `boolean` (если передан)
- `flagAllowComments`: `boolean` (если передан, по умолчанию `false`)
- `expires_in`: целое число в секундах, больше 0
- диапазон дат:
  - `flagParsingMonth=true` (или не передан) — до 1 месяца
  - `flagParsingMonth=false` — до 2 недель

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
- `401` — токен отсутствует или истек
- `404` — токен/сообщество не найдены
- `429` — лимит VK API
- `500` — внутренняя ошибка

## Структура проекта
```text
parser_service/
├── controllers/
├── filters/
├── migrations/
├── models/
├── providers/
├── routers/
├── services/
├── utils/
├── server.js
├── package.json
└── Dockerfile
```
