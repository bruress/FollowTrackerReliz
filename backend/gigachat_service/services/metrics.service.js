import { round, calcEngagement } from "../utils/math.util.js";

export function calculateMetrics(posts) {
    const postsCount = posts.length;
    let engagementRateSum = 0;
    let totalLikes = 0;
    let totalReposts = 0;
    let totalViews = 0;

    for (const post of posts) {
        const likes = post.likes;
        const comments = post.comments;
        const reposts = post.reposts;
        const views = post.views;

        const engagementRate = calcEngagement(likes, comments, reposts, views);

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
