## Стек
- Node.js (ES Modules)
- Express

## Возможности
- OAuth-редирект на VK (`/vk/auth`)
- Парсинг постов по диапазону дат
- Получение комментариев к постам
- Сортировка комментариев по лайкам и выбор топ-10
- Сохранение результата в `data/*.json`


## Установка
```bash
npm install
```

## Настройка окружения
Создайте `.env` в корне проекта:

```env
PORT=3003
```

## Запуск
```bash
npm start
```

## API

### OAuth redirect
`GET /vk/auth`

Редиректит пользователя на страницу авторизации VK OAuth.

### Парсинг
`POST /api/vk/parse`

#### Тело запроса
```bash
curl -i -X POST http://localhost:3003/api/vk/parse \
  -H 'Content-Type: application/json' \
  -d '{"vkToken":"token","domainId":"domain","from":"2026-01-01","to":"2026-01-31", "flag": boolean}'
```

## Куда сохраняется результат
После успешного запроса создается файл:
- `data/vk_<domainId>_<YYYY-MM-DD>.json`

## Структура проекта
- `server.js` — точка входа
- `routers/vk.router.js` — маршруты
- `controllers/vk.controller.js` — обработчики
- `services/analytic.service.js` — аналитика постов
- `providers/vk.provider.js` — клиент VK API
- `providers/api.proviider.js` — базовый API-класс
- `providers/file.provider.js` — запись JSON в файл
- `filters/date.filter.js` — фильтрация постов по дате
- `data/` — выходные файлы


