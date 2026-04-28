import { round, calcEngagementRate } from "../utils/math.js";

// считаем сводные числовые метрики по паблику за выбранный диапазон
export function calculateNumericMetrics(posts) {
    const postsCount = posts.length;
    let engagementRateSum = 0;
    let totalLikes = 0;
    let totalReposts = 0;
    let totalViews = 0;

    // идем по каждому посту
    for (const post of posts) {
        const likes = post?.likes;
        const comments = post?.comments;
        const reposts = post?.reposts;
        const views = post?.views;

        const engagementRate = calcEngagementRate(likes, comments, reposts, views);

        // копим суммы
        totalLikes += likes;
        totalReposts += reposts;
        totalViews += views;
        engagementRateSum += engagementRate;
    }

    return {
        postsCount,
        engagementRateAvg: postsCount>0 ? round(engagementRateSum/postsCount) : 0,
        totalLikes,
        totalReposts,
        totalViews,
    };
}
