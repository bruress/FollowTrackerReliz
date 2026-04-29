class API {
    constructor (config) { 
        if (new.target === API) {
            throw new Error("Ошибка: нельзя создать экземпляр базового класса API");
        }
        this.config = config;
    }
    
    async fetchData(method, params = {}) {
        throw new Error("Ошибка: метод fetchData() должен быть реализован");
    }
};

export default API;
