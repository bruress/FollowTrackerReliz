import { buildError } from "../utils/error.utils.js";

class WallAnalytic {
    constructor(vkAPI, periodFilter) {
        this.vkAPI = vkAPI;
        this.periodFilter = periodFilter;
    }

    async getData(domainId, period, includeComments = false) {
        const start = Math.floor(period.from.getTime()/1000);
        const posts = await this.vkAPI.getWall(domainId, start);
        const filtered = this.periodFilter.filter(posts, period);
        if (filtered.length === 0) {
            throw buildError("В выбранном периоде посты не найдены", "NO_POSTS_IN_PERIOD", 404);
        }
        // выбираем только посты, где реально есть комментарии, чтобы не слать лишние запросы
        const postsWithComments = includeComments ? filtered.filter((post) => post.comments.count > 0) : [];
        const baseOwnerId = Number(postsWithComments[0]?.owner_id);
        const postIds = postsWithComments.map((post) => post.id);
        const batchCount = 5;
        let commentsByPostId = {};

        if (includeComments && postIds.length > 0) {
            // делаем один execute-запрос и получаем комментарии сразу по всем постам
            commentsByPostId = await this.vkAPI.getWallComments(baseOwnerId, postIds, batchCount);
        }

        // перебираем посты и собираем итоговые поля
        const preparedPosts = [];
        for (const post of filtered) {
            // создаем массив комментариев
            const comments = includeComments ? commentsByPostId[post.id] || [] : [];
            const topComments = [];
            for (const comment of comments) {
                if (!comment || !comment.text) {
                    continue;
                }
                const normalizedComment = {
                    id: comment.id,
                    text: comment.text,
                    likesCount: comment.likes.count,
                };

                // поддерживаем топ-5 без полной сортировки массива
                let insertIndex = 0;
                while (insertIndex < topComments.length && topComments[insertIndex].likesCount >= normalizedComment.likesCount) {
                    insertIndex+=1;
                }
                if (insertIndex < 5) {
                    topComments.splice(insertIndex, 0, normalizedComment);
                    if (topComments.length > 5) {
                        topComments.pop();
                    }
                }
            }
            const postDate = new Date(post.date*1000).toISOString().slice(0, 10);

            // собираем все данные вместе
            preparedPosts.push({
                id: post.id,
                date: postDate,
                text: post.text ?? "",
                comments: post.comments?.count ?? 0,
                likes: post.likes?.count ?? 0,
                reposts: post.reposts?.count ?? 0,
                views: post.views?.count ?? 0,
                isAd: Boolean(post.marked_as_ads),
                topComments,
            });
        }
        return preparedPosts;
    }
}

export default WallAnalytic;
