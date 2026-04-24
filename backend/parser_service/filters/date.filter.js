// фильтр постов по дате
class FilterDate {
    // [posts] - массив постов VK
    // [from] - нижняя граница
    // [to] - верхняя нраница
    // return - посты, попадающие в период
    filter(posts, {from, to}) {
        // если период невалидный, отдаём пустой результат
        if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return [];
        }        
        // перевод в unix-секунды
        // получаем мс, делим на 1000 и округляем до целого
        const fromSec = Math.floor(from.getTime()/1000);
        const toSec = Math.floor(to.getTime()/1000);
        // возвращаем посты, попавшие в диапазон
        const safePosts = Array.isArray(posts) ? posts : [];
        return safePosts.filter((post)=> post.date >= fromSec && post.date <= toSec);
    };
};
// экспортируем класс для дальнейшего использования
export default FilterDate;