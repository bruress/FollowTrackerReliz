class WallAnalytic {
    constructor(vkAPI, periodFilter) {
        // сохраняем зависиомсти
        // vkAPI - клиент внешнего API
        // periodFilter - фильт по диапозону дат
        this.vkAPI = vkAPI;
        this.periodFilter = periodFilter;
    }

    // получение всех постов, а также последующий их анализ
    // [domen] - айди группы
    // [period] - объект диапазона {from, to}
    // return - массив необходимых данных
    async getData(domainId, period) {
        // нижняя граница в unix
        const start = Math.floor(period.from.getTime() / 1000);
        // получаем посты
        const posts = await this.vkAPI.getWall(domainId, start);
        // фильтруем посты по периоду
        const filtered = this.periodFilter.filter(posts, period);
        if (filtered.length === 0) {
            const error = new Error("В выбранном периоде посты не найдены");
            error.status = 404;
            error.code = "NO_POSTS_IN_PERIOD";
            throw error;
        }
        // выбираем только посты, где реально есть комментарии, чтобы не слать лишние запросы
        const postsWithComments = filtered.filter((post) => (post.comments?.count ?? 0) > 0);
        // берем id этих постов для одного батч-вызова
        const postIds = postsWithComments.map((post) => post.id);
        // берем маленькую порцию старых комментариев под каждый пост
        const batchCount = 5;
        // объект {postId: comments[]} 
        let commentsByPostId = {};
        // если есть хотя бы один пост с комментариями
        if (postIds.length > 0) {
            // делаем один execute-запрос и получаем комментарии сразу по всем постам
            commentsByPostId = await this.vkAPI.getWallComments(postsWithComments[0].owner_id, postIds, batchCount); 
        }
        // если постов с комментариями нет, оставляем пустой объект и идем дальше

        // массив готовых постов
        const preparedPosts = [];
        // перебираем посты и собираем итоговые поля
        for (const post of filtered) {
            // создаем массив комментариев
            const comments = commentsByPostId[post.id] || [];
            // массив готовых комментариев
            const preparedComments = [];
            
            // нормализуем комментарии
            for (const comment of comments) {
                // пропускаем пустые/удаленные комментарии
                if (!comment || !comment.text) {
                    continue;
                }
                const likesCount = Number(comment.likes?.count) || 0;
                // добавляем в массив
                preparedComments.push({
                    id: comment.id,
                    text: comment.text,
                    likesCount: likesCount,
                });
            }
            // сортируем комментарии по лайкам по убыванию
            preparedComments.sort((a, b) => b.likesCount - a.likesCount);
            // берем топ-5
            const topComments = preparedComments.slice(0, 5);
            // перевод из unix-секунд в YYYY-MM-DD
            const postDate = new Date(post.date * 1000).toISOString().slice(0, 10);
            // собираем все данные вместе
            preparedPosts.push({
                id: post.id,
                date: postDate,
                text: post.text ?? '',
                comments: post.comments?.count ?? 0,
                likes: post.likes?.count ?? 0,
                reposts: post.reposts?.count ?? 0,
                views: post.views?.count ?? 0,
                isAd: Boolean(post.marked_as_ads),
                topComments,
            });
        }
        return preparedPosts;   // возвращаем данные
    }
}
// экспортируем класс для дальнейшего использования
export default WallAnalytic;
