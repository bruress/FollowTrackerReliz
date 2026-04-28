// округление
export function round(value) {
    // приводим значение к числу и округляем до 4 знаков
    return Number(Number(value || 0).toFixed(4));
}

// считаем engagementRate
export function calcEngagementRate(likes, comments, reposts, views) {
    // приводим все значения к безопасным числам
    const safeLikes = Number(likes || 0);
    const safeComments = Number(comments || 0);
    const safeReposts = Number(reposts || 0);
    const safeViews = Number(views || 0);

    // если просмотров нет, вовлеченность равна 0
    if (safeViews<=0) {
        return 0;
    }

    // считаем и округляем итог
    return round((safeLikes+safeComments+safeReposts)/safeViews);
}
