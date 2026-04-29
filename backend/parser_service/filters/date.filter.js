class FilterDate {
    filter(posts, {from, to}) {
        if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return [];
        }        
        const fromSec = Math.floor(from.getTime()/1000);
        const toSec = Math.floor(to.getTime()/1000);
        const safePosts = Array.isArray(posts) ? posts : [];
        return safePosts.filter((post)=> post.date >= fromSec && post.date <= toSec);
    };
};

export default FilterDate;