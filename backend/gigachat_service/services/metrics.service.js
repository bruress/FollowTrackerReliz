import { round, calcEngagement } from "../utils/math.util.js";

export function calculateMetrics(posts) {
    const postsCount = posts.length;
    let engagementRateSum = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalReposts = 0;
    let totalViews = 0;
    let totalReactions = 0;
    let weightedReactions = 0;
    let firstHalfReactions = 0;
    let secondHalfReactions = 0;
    let firstHalfCount = 0;
    let secondHalfCount = 0;
    const halfIndex = Math.floor(postsCount/2);

    for (let i=0; i<posts.length; i+=1) {
        const post = posts[i];
        const likes = post.likes;
        const comments = post.comments;
        const reposts = post.reposts;
        const views = post.views;
        const reactions = likes+comments+reposts;

        const engagementRate = calcEngagement(likes, comments, reposts, views);

        totalLikes += likes;
        totalComments += comments;
        totalReposts += reposts;
        totalViews += views;
        totalReactions += reactions;
        weightedReactions += likes+comments*2+reposts*3;
        engagementRateSum += engagementRate;
        if (i<halfIndex) {
            firstHalfReactions += reactions;
            firstHalfCount += 1;
        } else {
            secondHalfReactions += reactions;
            secondHalfCount += 1;
        }
    }

    const firstHalfAvg = firstHalfCount>0 ? firstHalfReactions/firstHalfCount : 0;
    const secondHalfAvg = secondHalfCount>0 ? secondHalfReactions/secondHalfCount : 0;
    const dynamicActivity = firstHalfAvg>0 ? round((secondHalfAvg-firstHalfAvg)/firstHalfAvg) : 0;

    return {
        postsCount,
        engagementRateAvg: postsCount>0 ? round(engagementRateSum/postsCount) : 0,
        totalLikes,
        totalComments,
        totalReposts,
        totalViews,
        averageReactions: postsCount>0 ? round(totalReactions/postsCount) : 0,
        responseIntensity: postsCount>0 ? round(weightedReactions/postsCount) : 0,
        dynamicActivity,
        reachRate: postsCount>0 ? round(totalViews/postsCount) : 0,
    };
}
