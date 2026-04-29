class FilterDate {
    filter(posts, { from, to }) {
        const fromSec = Math.floor(from.getTime()/1000);
        const toSec = Math.floor(to.getTime()/1000);
        return posts.filter((post) => post.date >= fromSec && post.date <= toSec);
    }
}

export default FilterDate;
