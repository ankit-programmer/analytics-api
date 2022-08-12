interface String {
    splitAndTrim(delimiter?: string): string[];
}

String.prototype.splitAndTrim = function (delimiter: string = ',') {
    if (!this.trim().length) return [];
    const arr = this.split(delimiter);
    return arr.map(val => val.trim());
};