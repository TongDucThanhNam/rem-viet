export class GetAllProductsRequest {
    page: number;
    limit: number;
    search: string;
    sort: string;
    order: string;

    constructor(page: number, limit: number, search: string, sort: string, order: string) {
        this.page = page;
        this.limit = limit;
        this.search = search;
        this.sort = sort;
        this.order = order;
    }
}