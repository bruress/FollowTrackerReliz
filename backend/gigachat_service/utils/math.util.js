export function round(value) {
    return Number(Number(value || 0).toFixed(4));
}

export function calcEngagementRate(likes, comments, reposts, views) {
    const safeLikes = likes;
    const safeComments = comments;
    const safeReposts = reposts;
    const safeViews = views;
    if (safeViews<=0) {
        return 0;
    }
    return round((safeLikes+safeComments+safeReposts)/safeViews);
}
