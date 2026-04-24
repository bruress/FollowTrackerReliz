// [axios] - бибилиотека для http-запросов (get, post, put и т.п.)
// [API] - базовый класс от которого будет наследоваться реализация для VK
import axios from "axios";
import API from './api.proviider.js';
const NUMBER_PATTERN = /^-?\d+$/;
const GROUP_TYPES = new Set(["group", "page", "event"]);

// конструктор ошибок для фронта и бека
// [message] - текст для фронта
// [status] - http-статус для бека
// [code] - код ошибки
// [details] - детали
function buildError(message, status, code, details = null) {
    // объект ошибка с сообщение
    const error = new Error(message);
    // добавляем статус
    error.status = status;
    // добавляем код
    error.code = code;
    // добавляем детали, если они есть
    error.details = details;
    // возвращаем ошибку
    return error;
}

// собираем объект ошибок 
// [method] - метод, который вызвал ошибку
// [vkError] - исходный код ошибки
function VKError(method, vkError) {
    // превращаем код ошибки VK в число
    const errorCode = Number(vkError?.error_code);
    // берем текст от ошибки VK, либо дефолт
    const errorMsg = vkError?.error_msg || "Ошибка VK API";
    // объект с деталями
    const details = { method, vkErrorCode: errorCode };
    // невалидный токен
    if (errorCode === 5) {
        return buildError("Неверный VK токен или срок его действия истек", 401, "VK_AUTH_ERROR", details);
    }
    // нет доступа
    if (errorCode === 15) {
        return buildError("Нет доступа к запрошенному ресурсу VK", 403, "VK_ACCESS_DENIED", details);
    }
    // нет группы
    if (errorCode === 100 || errorCode === 113 || errorCode === 18) {
        return buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND", details);
    }
    // частые запросы
    if (errorCode === 6 || errorCode === 9 || errorCode === 29) {
        return buildError("Превышен лимит запросов к VK API, попробуйте позже", 429, "VK_RATE_LIMIT", details);
    }
    return buildError(`Ошибка VK API: ${errorMsg}`, 502, "VK_API_ERROR", details);
}

// класс VKAPI наследуется от API
class VKAPI extends API {
    // настройки VKAPI (ПАРАМЕТРЫ)
    constructor (config) {
        // чтобы сначала вызвался конструктор родителя для корректного заполнения this.config
        super(config);
        // базовый URL VKAPI
        this.baseURL='https://api.vk.com/method/';
        // версия VKAPI
        this.version='5.199';
        // токен пока пустой
        this.accessToken=null;
    }

    // МЕТОДЫ VKAPI: 

    // устанавливаем токен
    // [token] - токен, который получаем от пользователя
    setToken(token) {
        this.accessToken=token;
    }

    // универсальный запрос VKAPI
    // [method] - имя метода VKAPI
    // [params] - параметры для метода
    // return - необходимые данные
    async fetchData (method, params = {}) {
        try {
            // запрашиваем метод
            const response = await axios.get(`${this.baseURL}${method}`, {
                // передача всех необходимых параметров для вызоыва метода
                params: {
                    ...params, 
                    access_token: this.accessToken,
                    v: this.version
                }
            });
            // чтобы в теле не было ошибок
            if (response.data.error) {
                throw VKError(method, response.data.error);
            };
            // возвращаем данные, которые получили
            return response.data.response;
        // ловим ошибку, чтобы сервер не упал, а продолжал работу
        } catch (error) {
            if (error.status && error.code) {
                throw error;
            }
            if (error.response?.data?.error) {
                throw VKError(method, error.response.data.error);
            }
            throw buildError(`Сетевой сбой при запросе VK ${method}`, 502, "VK_NETWORK_ERROR", { method });
        }
    };

    // получение постов со стены
    // [owner_id] - айди группы
    // return - массив постов
    async getWall (owner_id, fromTime = null) { 
        //const startedAt = Date.now();
        const owner = String(owner_id ?? "").trim();
        if (!owner) {
            throw buildError("Поле domainId обязательно", 400, "VALIDATION_ERROR");
        }
        // поддержка короткого имени сообщества
        let ownerId;
        // это уже цифры?
        if (NUMBER_PATTERN.test(owner)) {
            // превращаем в число и работаем с положительным id
            const numericOwner = Math.abs(Number(owner));
            let groupId = null;

            // сначала проверяем, что это группа по id
            try {
                groupId = await this.fetchData("utils.resolveScreenName", {
                    screen_name: `club${numericOwner}`
                });
            } catch (error) {
                // если ошибка не про "не найдено", пробрасываем ее дальше
                if (error?.code!=="DOMAIN_NOT_FOUND") {
                    throw error;
                }
            }

            // если найдена группа - используем ее owner_id
            if (groupId?.object_id && GROUP_TYPES.has(groupId.type)) {
                ownerId = -Number(groupId.object_id);
            } else {
                let userId = null;
                // если группа не найдена, проверяем, не user ли это
                try {
                    userId = await this.fetchData("utils.resolveScreenName", {
                        screen_name: `id${numericOwner}`
                    });
                } catch (error) {
                    // если ошибка не про "не найдено", пробрасываем ее дальше
                    if (error?.code !== "DOMAIN_NOT_FOUND") {
                        throw error;
                    }
                }

                // если это пользователь - возвращаем понятную ошибку
                if (userId?.type === "user" && Number(userId.object_id) === numericOwner) {
                    throw buildError("Поддерживается только анализ групп VK", 400, "ONLY_GROUPS_SUPPORTED", {
                        method: "utils.resolveScreenName",
                        type: userId.type
                    });
                }
                // иначе считаем, что домен не найден
                throw buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND", {
                    method: "utils.resolveScreenName"
                });
            }
        } 
        // если нет
        else {
            // превращаем в цифры методом VK
            const groupId = await this.fetchData("utils.resolveScreenName", {
                screen_name: owner
            });
            // если не смог распознать
            if (!groupId?.object_id || !groupId?.type) {
                throw buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND", { method: "utils.resolveScreenName" });
            }
            // если это пользователь, то +
            if (groupId.type === "user") {
                throw buildError("Поддерживается только анализ групп VK", 400, "ONLY_GROUPS_SUPPORTED", {
                    method: "utils.resolveScreenName",
                    type: groupId.type
                });
            } 
            // если это группа, то -
            ownerId = -Number(groupId.object_id);
        }

        const allPosts = [];    // массив всех постов
        const count = 100;      // сколько получаем постов за один запрос у VK (лимит)
        let offset = 0;         // смещение
        let totalCount = null;  // общее кол-во постов на стене
        const batchCount = 5;   // количество посто в одной пачке
        const code = `
            var offsets  = Args.offsets.split(",");
            var i=0;
            var out = []; 
            while (i<offsets.length) {
                var currentOffset = offsets[i]*1;
                var wall = API.wall.get({
                    owner_id: Args.owner_id,
                    count: Args.count,
                    offset: currentOffset,
                    filter: Args.filter
                });
                out.push({
                    "offset": currentOffset,
                    "count": wall.count,
                    "items": wall.items
                });
                i=i+1;
            }
            return out;
        `
        //пока не достигли конца
        while (true) {
            const offsets = [];
            // смещение для пачки
            for (let i=0; i<batchCount; i++) {
                offsets.push(offset+i*count);
            } 

            // вызываем универсальные fetchData и передаем метод с необходимыми параметрами
            // [code] - код для Vk Script
            // [owner_id] - айди группы
            // [count] - кол-во постов за запрос
            // [offset] - сколько постов уже было пройдено
            // [filter: 'owner'] - фильтруем посты только от сообщества
            const response = await this.fetchData('execute', {
                code,
                owner_id: ownerId,
                count,
                offsets: offsets.join(","),
                filter: 'owner'
            });
            // проверяем, ответ вообще массив?
            const chunks = Array.isArray(response) ? response : [];
            // если пустой, то выходим
            if (chunks.length === 0 ) break;
            // стоп по дате
            let stopByDate = false;
            // были вообще посты?
            let hasItemsInBatch = false;
            // проходим по каждому чанку из чанков
            for (const chunk of chunks) {
                // сохраняем все посты и информация о них из items
                const items = Array.isArray(chunk?.items) ? chunk.items : [];
                // общее число постов на стене
                if (totalCount === null) {
                    const chunkTotal = Number(chunk?.count);
                    if (Number.isFinite(chunkTotal)) totalCount = chunkTotal;
                }
                // если пустое, то скипаем
                if (items.length === 0) continue;
                // посты были
                hasItemsInBatch = true;
                // перебираем текущие посты по одному
                // сохраняем все посты до from, после from - нет смысла
                for (const post of items) {
                    allPosts.push(post);
                }
                // останавливаемся только если вся страница уже старше нижней границы (ПОДРОБНЕЕ???)/а если закрепленный пост входит в эту дату?
                if (fromTime) {
                    const nonPinned = items.filter((post) => !post.is_pinned);
                    const allOlder = nonPinned.length > 0 && nonPinned.every((post) => post.date < fromTime);
                    if (allOlder) {
                        stopByDate = true;
                        break;
                    }
                }
            }
            // если в батче все чанки пустые
            if (!hasItemsInBatch || stopByDate) break;
            // постоянно увеличиваем смещение на кол-во полученных эл.
            offset=offset+(batchCount*count);
            if (totalCount !== null && offset >= totalCount) break;
        };
        //const parsingMs = Date.now() - startedAt;
        //console.log(`[getWall] ownerId=${ownerId} time=${parsingMs}ms`);
        // возвращаем все посты
        return allPosts;
    };

    // получение комментариев под постом пачкой!!!
    async getWallComments(ownerId, postIds, countComm) {
        // если айди постов не переданы, сразу возвращаем пустой объект
        if (!Array.isArray(postIds) || postIds.length === 0) {
            return {};
        }
        const safeCount = Number(countComm);
        const count = Math.max(1, Math.min(20, Number.isFinite(safeCount) ? safeCount : 20)); // сколько получаем комментариев за один запрос у VK (лимит)
        const batchSize = 20;
        const result = {};
        const code = `
            // Args - переменные внутри execute у VK
            // разбитие строку айдишников в массив по запятой ["id", "id"]
            // var - синтаксис объявления переменной VK Script
            var ids = Args.post_ids.split(",");
            var i=0;
            var out = []; // массив результатов по каждому посту [{object}, {object}]
            // обход всех постов
            while (i<ids.length) {
                var post_id = ids[i];   // текущий айди поста
                // получаем данные для одного поста
                // API - объект, который VK Script создает сам для методов VK API
                var comms = API.wall.getComments({
                    owner_id: Args.owner_id,
                    post_id: post_id,
                    count: Args.count,
                    offset: 0,
                    sort: "asc",
                    preview_length: 0,
                    need_likes: 1 //для передачи кол-ва лайков
                });
                // добавляем в массив один постик и все его данные из wall.getComments
                out.push({"post_id": post_id, "items": comms.items});
                i=i+1;
            }
            return out; // возвращаем массив
        `

        // режем post_id на пачки
        for (let i=0; i<postIds.length; i+=batchSize) {
            // массив текущей пачки
            const chunk = postIds.slice(i, i+batchSize);
            // слеиваем айдишники в строку, т.к. execute принимает только строку
            const postIdsParam = chunk.join(",");
            // вызываем универсальный fetchData и передаем метод с необходимыми параметрами
            // [code] - код, который выполняется на стороне вк
            // [wall.getComments] - метод получения информации о комментариях под постами
            // [owner_id] - айди группы
            // [post_id] - айди поста, под которым смотрим комментарии
            const response = await this.fetchData('execute', {
                code,
                owner_id: ownerId,
                post_ids: postIdsParam,
                count,
            });
            const items = Array.isArray(response) ? response: [];
            for (const comm of items) {
                // превращаем из строки в число
                const postId = Number(comm?.post_id);
                // сохраняем результат под ключ post_id
                result[postId] = comm?.items || [];
            }
        }
        return result;
    }
};
// экспортируем класс для дальнейшего использования
export default VKAPI;
