// game/Entities/Algae.js
// Static plant life. Pollution is ticked by PollutionSystem.
// This entity just tracks lifetime and renders itself.

import { BaseEntity } from './BaseEntity.js';

export class AlgaeEntity extends BaseEntity {
    constructor(id, x, y, speciesDef) {
        super(id, x, y, speciesDef);
        this.lifetime = speciesDef.maxAge; // PollutionSystem decrements this
    }

    createElement(_container) {
        const el = document.createElement('div');
        el.className = 'algae fade-in';
        el.style.left     = this.x + 'px';
        el.style.top      = this.y + 'px';
        el.style.fontSize = this.speciesDef.size + 'px';
        el.style.opacity  = this.speciesDef.toxic ? '0.7' : '0.6';
        el.innerHTML      = this.speciesDef.emoji;
        return el;
    }

    syncToDOM(el) {
        // Algae don't move — no transform needed.
        // Fade near end of life
        const lifeRatio = this.lifetime / this.speciesDef.maxAge;
        if (lifeRatio < 0.2) el.style.opacity = String(lifeRatio * (this.speciesDef.toxic ? 3.5 : 3));
    }

    // PollutionSystem calls queueRemove when lifetime <= 0
    // so update() here is minimal
    update(dt, world, entities) {
        // Algae are sessile — no age/movement update needed.
        // PollutionSystem owns lifetime ticking.
    }
}
