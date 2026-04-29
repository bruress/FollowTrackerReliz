# скачиваем лайт версию node и присваиваем переменную builder
FROM node:25-alpine AS builder
# созадем рабочую папку /app и сразу же в нее заходим
WORKDIR /app
# копируем первым делом все package.json для установки зависимостей
# и для того, чтобы не переносить большую папку /node_modules
COPY package*.json ./
# скачиваем зависимости
RUN npm install
# копируем из текущей папки в /app
COPY . .
# запускаем сборку для папки /dist
RUN npm run build
# скачиваем лайт версию nginx и присваиваем переменную runner
# для того, чтобы фронт мало весил и отображался статично
FROM nginx:alpine AS runner
# копируем конфиг nginx в папку для конфигов
COPY nginx.conf /etc/nginx/conf.d/default.conf
# переходим в папку для показа веб-страницы в браузере
WORKDIR /usr/share/nginx/html
# идем в этап с builder и копируем /app/dist в рабочую папку
COPY --from=builder /app/dist .
# указываем, что работает на порту 8080
EXPOSE 8080
# запускаем ядро nginx
CMD [ "nginx", "-g", "daemon off;" ]
