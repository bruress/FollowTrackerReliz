# auth_service

Микросервис регистрации и аутентификации пользователей.

## Возможности
- Регистрация пользователя
- Вход пользователя
- Выдача JWT в cookie
- Проверка текущего пользователя (`/me`)
- Выход (очистка cookie)

## Стек
- Node.js
- Express
- PostgreSQL
- `bcrypt`
- `jsonwebtoken`
- `cookie-parser`
- `cors`
- `dotenv`

## Установка
```bash
cd backend/auth_service
npm install
```

### Настройка окружения
Создайте `.env` со значениями:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_long_random_secret
PGHOST=localhost
PGPORT=5432
PGDATABASE=auth_service
PGUSER=postgres
PGPASSWORD=postgres
```

### Подготовка БД
```bash
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f migrations/init_db.sql
```

### Запуск
```bash
npm run dev
```

Сервис будет доступен на `http://localhost:3001`.

## Docker
```bash
cd backend/auth_service
docker build -t auth-service .
docker run --env-file .env -p 3001:3001 auth-service
```

## API
Базовый префикс: `/api/auth`

### `POST /registr`
Регистрация пользователя.

Request:
```json
{
  "username": "user",
  "email": "user@example.com",
  "password": "StrongPass123"
}
```

Response `201`:
```json
{
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com"
  }
}
```

### `POST /login`
Вход пользователя, установка cookie `token`.

Request:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123"
}
```

Response `200`:
```json
{
  "message": "Вход выполнен успешно",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com"
  }
}
```

### `GET /me`
Возвращает текущего авторизованного пользователя.
Требуется валидная cookie `token`.

### `POST /logout`
Очищает cookie `token`.

## Валидация
- `username`: от 2 до 64 символов
- `email`: regex-проверка + приведение к lower-case
- `password`: от 8 до 32 символов
- дубли email: защита на уровне БД (уникальность, включая `LOWER(email)`)

## Формат ошибки
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Пожалуйста заполните все поля",
    "details": null
  }
}
```

Типовые коды:
- `400` — ошибка валидации
- `401` — ошибка авторизации
- `409` — пользователь уже существует
- `500` — внутренняя ошибка

## Структура проекта
```text
auth_service/
├── controllers/
├── middleware/
├── migrations/
├── models/
├── routers/
├── utils/
├── server.js
├── package.json
└── Dockerfile
```
