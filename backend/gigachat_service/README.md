# gigachat_service

Микросервис AI-анализа данных после парсинга api.

## Возможности
- Запуск анализа входного JSON-файла из `parser_service/data`
- Расчет числовых метрик по постам
- AI-анализ постов через GigaChat
- Переиспользование уже сохраненных результатов анализа по `domain` и диапазону дат
- Сохранение результата в `gigachat_service/data/*.json`
- Чтение сохраненного результата по имени файла

## Стек
- Node.js
- Express
- `gigachat`
- `dotenv`

## Установка
```bash
cd backend/gigachat_service
npm install
```

### Настройка окружения
Создайте `.env` со значениями:

```env
PORT=3002
GIGACHAT_AUTH_KEY=your_base64_auth_key
GIGACHAT_API_PERS=GIGACHAT_API_PERS
CA_CERT_PATH=./certs/ca-certificates.crt
```

`CA_CERT_PATH` обязателен. Сервис читает сертификат при старте.

### Подготовка сертификата
Положите CA-сертификат в `gigachat_service/certs/`.

Пример:
```bash
mkdir -p certs
cp /etc/ssl/certs/ca-certificates.crt certs/ca-certificates.crt
```

### Запуск
```bash
npm start
```

Сервис будет доступен на `http://localhost:3002`.

## Docker
```bash
cd backend/gigachat_service
docker build -t gigachat-service .
docker run --env-file .env -p 3002:3002 \
  -v "$(pwd)/../parser_service/data:/parser_service/data" \
  -v "$(pwd)/data:/app/data" \
  gigachat-service
```

## API
Базовый префикс: `/api/gigachat`

### `POST /analysis`
Запуск анализа входного файла.

Request:
```json
{
  "fileName": "vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json"
}
```

Response `200`:
```json
{
  "status": "success",
  "input": "vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json",
  "outputFile": "analysis_vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json",
  "durationMs": 15234
}
```

### `GET /reading/:file`
Чтение сохраненного результата анализа.

Пример:
```bash
curl "http://localhost:3002/api/gigachat/reading/analysis_vk_domain_2026-04-01_2026-04-30_month_1_comments_0.json"
```

## Валидация
- `fileName` обязателен для `POST /analysis`
- имя входного файла должно соответствовать шаблону:
  - `vk_<domain>_<from>_<to>_month_<0|1>_comments_<0|1>.json`
- `file` обязателен для `GET /reading/:file`
- чтение/запись файлов ограничено именем файла (через `path.basename`)

## Формат ошибки
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Имя файла обязательно"
  }
}
```

Типовые коды:
- `400` — ошибка валидации (`VALIDATION_ERROR`)
- `500` — внутренняя ошибка (`SERVER_ERROR`, `CONFIG_ERROR`)
- `502` — ошибка токена/доступа к GigaChat (`GIGACHAT_TOKEN_ERROR`, `GIGACHAT_EMPTY_TOKEN`)

## Структура проекта
```text
gigachat_service/
├── certs/
├── controllers/
├── routers/
├── services/
├── utils/
├── server.js
├── package.json
└── Dockerfile
```
