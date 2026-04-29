export function round(value) {
    return Number(Number(value || 0).toFixed(4));
}

export function calcEngagement(likes, comments, reposts, views) {
    if (views<=0) {
        return 0;
    }
    return round((likes+comments+reposts)/views);
}
