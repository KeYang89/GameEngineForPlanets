// engine/SpatialGrid.js
// Fast proximity queries via uniform spatial hashing.
// No game dependencies — safe to use in any project.

export class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    _key(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    add(obj) {
        const key = this._key(obj.x, obj.y);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(obj);
    }

    remove(obj) {
        const cell = this.grid.get(this._key(obj.x, obj.y));
        if (cell) { const i = cell.indexOf(obj); if (i > -1) cell.splice(i, 1); }
    }

    /** Call after moving obj so the grid stays current. */
    update(obj, oldX, oldY) {
        const oldKey = this._key(oldX, oldY);
        const newKey = this._key(obj.x, obj.y);
        if (oldKey === newKey) return;
        const old = this.grid.get(oldKey);
        if (old) { const i = old.indexOf(obj); if (i > -1) old.splice(i, 1); }
        if (!this.grid.has(newKey)) this.grid.set(newKey, []);
        this.grid.get(newKey).push(obj);
    }

    getNearby(x, y, radius) {
        const results = [];
        const cr = Math.ceil(radius / this.cellSize);
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        for (let dx = -cr; dx <= cr; dx++)
            for (let dy = -cr; dy <= cr; dy++) {
                const cell = this.grid.get(`${cx + dx},${cy + dy}`);
                if (cell) results.push(...cell);
            }
        return results;
    }
}
