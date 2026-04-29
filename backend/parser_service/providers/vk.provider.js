import axios from "axios";
import API from './api.provider.js';
import { buildError } from "../utils/error.utils.js";

const NUMBER_PATTERN = /^-?\d+$/;
const GROUP_TYPES = new Set(["group", "page", "event"]);

function throwVkError(method, vkError) {
    const errorCode = Number(vkError?.error_code);
    const errorMsg = vkError?.error_msg || "Ошибка VK API";
    // невалидный токен
    if (errorCode === 5) {
        throw buildError("Неверный VK токен или срок его действия истек", 401, "VK_AUTH_ERROR");
    }
    // нет доступа
    if (errorCode === 15) {
        throw buildError("Нет доступа к запрошенному ресурсу VK", 403, "VK_ACCESS_DENIED");
    }
    // нет группы
    if (errorCode === 100 || errorCode === 113 || errorCode === 18) {
        throw buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND");
    }
    // частые запросы
    if (errorCode === 6 || errorCode === 9 || errorCode === 29) {
        throw buildError("Превышен лимит запросов к VK API, попробуйте позже", 429, "VK_RATE_LIMIT");
    }
    throw buildError(`Ошибка VK API: ${errorMsg}`, 502, "SERVER_ERROR");
}

class VKAPI extends API {
    constructor (config) {
        super(config);
        this.baseURL='https://api.vk.com/method/';
        this.version='5.199';
        this.accessToken=null;
    }

    setToken(token) {
        this.accessToken=token;
    }

    async fetchData (method, params = {}) {
        try {
            const response = await axios.get(`${this.baseURL}${method}`, {
                params: {
                    ...params, 
                    access_token: this.accessToken,
                    v: this.version
                }
            });
            if (response.data.error) {
                throwVkError(method, response.data.error);
            };
            return response.data.response;
        } catch (error) {
            if (error.status && error.code) {
                throw error;
            }
            if (error.response?.data?.error) {
                throwVkError(method, error.response.data.error);
            }
            throw buildError(`Сетевой сбой при запросе VK ${method}`, 502, "SERVER_ERROR");
        }
    };

    async getWall (owner_id, fromTime = null) { 
        const owner = String(owner_id ?? "").trim();
        if (!owner) {
            throw buildError("Поле domainId обязательно", 400, "VALIDATION_ERROR");
        }
        let ownerId;
        if (NUMBER_PATTERN.test(owner)) {
            const numericOwner = Math.abs(Number(owner));
            let groupId = null;

            // проверка, что это группа по id
            try {
                groupId = await this.fetchData("utils.resolveScreenName", {
                    screen_name: `club${numericOwner}`
                });
            } catch (error) {
                if (error?.code!=="DOMAIN_NOT_FOUND") {
                    throw error;
                }
            }
            if (groupId?.object_id && GROUP_TYPES.has(groupId.type)) {
                ownerId = -Number(groupId.object_id);
            } else {
                let userId = null;
                try {
                    userId = await this.fetchData("utils.resolveScreenName", {
                        screen_name: `id${numericOwner}`
                    });
                } catch (error) {
                    if (error?.code !== "DOMAIN_NOT_FOUND") {
                        throw error;
                    }
                }
                // если это пользователь - возвращаем понятную ошибку
                if (userId?.type === "user" && Number(userId.object_id) === numericOwner) {
                    throw buildError("Поддерживается только анализ групп VK", 400, "ONLY_GROUPS_SUPPORTED");
                }
                throw buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND");
            }
        } 
        else {
            const groupId = await this.fetchData("utils.resolveScreenName", {
                screen_name: owner
            });
            if (!groupId?.object_id || !groupId?.type) {
                throw buildError("Некорректный domainId или сообщество не найдено", 404, "DOMAIN_NOT_FOUND");
            }
            if (!GROUP_TYPES.has(groupId.type)) {
                throw buildError("Поддерживается только анализ групп VK", 400, "ONLY_GROUPS_SUPPORTED");
            } 
            ownerId = -Number(groupId.object_id);
        }

        const allPosts = [];
        const seenPostIds = new Set();
        const count = 100;
        let offset = 0;
        let totalCount = null;
        const batchCount = 5;
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
        while (true) {
            const offsets = [];

            for (let i=0; i<batchCount; i++) {
                offsets.push(offset+i*count);
            } 

            const response = await this.fetchData('execute', {
                code,
                owner_id: ownerId,
                count,
                offsets: offsets.join(","),
                filter: 'owner'
            });

            const chunks = Array.isArray(response) ? response : [];
            if (chunks.length === 0 ) break;
            let stopByDate = false;
            let hasItemsInBatch = false;

            for (const chunk of chunks) {
                const items = Array.isArray(chunk?.items) ? chunk.items : [];
                if (totalCount === null) {
                    const chunkTotal = Number(chunk?.count);
                    if (Number.isFinite(chunkTotal)) totalCount = chunkTotal;
                }
                if (items.length === 0) continue;
                hasItemsInBatch = true;
                for (const post of items) {
                    const postId = Number(post?.id);
                    if (Number.isInteger(postId) && !seenPostIds.has(postId)) {
                        seenPostIds.add(postId);
                        allPosts.push(post);
                    }
                }

                // чтобы захватить и pinned пост
                if (fromTime) {
                    const nonPinned = items.filter((post) => !post.is_pinned);
                    const hasPinnedInRange = items.some((post) => post.is_pinned && post.date >= fromTime);
                    const allOlder = nonPinned.length > 0 && nonPinned.every((post) => post.date < fromTime);
                    if (allOlder && !hasPinnedInRange) {
                        stopByDate = true;
                        break;
                    }
                }
            }
            
            if (!hasItemsInBatch || stopByDate) break;
            offset=offset+(batchCount*count);
            if (totalCount !== null && offset >= totalCount) break;
        };
        return allPosts;
    };

    async getWallComments(ownerId, postIds, countComm) {
        if (!ownerId) {
            throw buildError("Некорректный ownerId", 400, "VALIDATION_ERROR");
        }
        if (!Array.isArray(postIds) || postIds.length === 0) {
            return {};
        }
        const safePostIds = postIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id));
        if (safePostIds.length === 0) {
            return {};
        }
        const safeCount = Number(countComm);
        const count = Math.max(1, Math.min(20, Number.isFinite(safeCount) ? safeCount : 20));
        const batchSize = 20;
        const result = {};
        const code = `
            var ids = Args.post_ids.split(",");
            var i=0;
            var out = [];
            while (i<ids.length) {
                var post_id = ids[i];
                var comms = API.wall.getComments({
                    owner_id: Args.owner_id,
                    post_id: post_id,
                    count: Args.count,
                    offset: 0,
                    sort: "asc",
                    preview_length: 0,
                    need_likes: 1 //для передачи кол-ва лайков
                });
                out.push({"post_id": post_id, "items": comms.items});
                i=i+1;
            }
            return out;
        `

        for (let i=0; i<safePostIds.length; i+=batchSize) {
            const chunk = safePostIds.slice(i, i+batchSize);
            const postIdsParam = chunk.join(",");
            const response = await this.fetchData('execute', {
                code,
                owner_id: ownerId,
                post_ids: postIdsParam,
                count,
            });
            const items = Array.isArray(response) ? response: [];
            for (const comm of items) {
                const postId = Number(comm?.post_id);
                if (!Number.isInteger(postId)) {
                    continue;
                }
                result[postId] = comm?.items || [];
            }
        }
        return result;
    }
};

export default VKAPI;
