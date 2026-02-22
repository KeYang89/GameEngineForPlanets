// game/Entities/Mammal.js
// Island predators (cat/dog) + marine mammals (dolphin/whale/seal/otter).
// Predator AI: hunt nearby ducks, patrol island, breed when fed.
// Marine AI: roam freely, reproduce via ReproductionSystem.

import { BaseEntity } from './BaseEntity.js';
import { Events }     from '../../engine/EventBus.js';
import { EntityManager } from '../../engine/EntityManager.js';

export class MammalEntity extends BaseEntity {
    constructor(id, x, y, speciesDef, island = null) {
        super(id, x, y, speciesDef);
        this.island              = island;
        this.hunger              = 50 + Math.random() * 30;
        this.energy              = 80 + Math.random() * 20;
        this.state               = 'idle';
        this.target              = null;
        this.ducksEaten          = 0;
        this.breedingCooldown    = 90;
        this.canBreed            = false;
        this.gender              = Math.random() < 0.5 ? 'M' : 'F';
        this.reproductionCooldown = 30 + Math.random() * 20;
        this.lastThinkTime       = 0;
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    createElement(_container) {
        const el = document.createElement('div');
        el.className = this.speciesDef.isPredator ? 'predator fade-in' : 'sea-creature fade-in';
        if (this.speciesDef.cssClass) el.classList.add(this.speciesDef.cssClass);
        el.style.left     = this.x + 'px';
        el.style.top      = this.y + 'px';
        el.style.fontSize = this.speciesDef.size + 'px';
        el.innerHTML      = this.speciesDef.emoji;
        el.title          = `${this.speciesDef.name} ${this.gender === 'M' ? '♂' : '♀'} #${this.id}`;
        return el;
    }

    syncToDOM(el) {
        el.style.transform = Math.cos(this.direction) < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        if (this.age > this.maxAge * 0.8) el.style.opacity = '0.7';
    }

    // ── Update ────────────────────────────────────────────────────────────────

    update(dt, world, entities, bus, config) {
        if (world.isPaused) return;

        this.age += dt;
        if (this.age >= this.maxAge) {
            bus.emit(Events.LOG_EVENT, { message: `${this.speciesDef.name} #${this.id} died of old age 💀` });
            this.dead = true;
            return;
        }

        this.hunger = Math.max(0, this.hunger - dt * (this.speciesDef.isPredator ? 1.2 : 0.5));
        this.energy = Math.max(0, this.energy - dt * 0.4);
        this.reproductionCooldown = Math.max(0, this.reproductionCooldown - dt);
        if (this.breedingCooldown > 0) this.breedingCooldown -= dt;
        if (this.ducksEaten > 0 && this.breedingCooldown <= 0 && !this.canBreed)
            this.canBreed = true;

        const now = Date.now();
        if (now - this.lastThinkTime > (config?.THINK_COOLDOWN ?? 3000)) {
            this.lastThinkTime = now;
            this._think(entities, bus);
        }

        if (this.speciesDef.isPredator)
            this._executePredatorBehaviour(dt, entities, bus);
        else
            this._executeMarineBehaviour(dt, world);
    }

    // ── Predator AI ───────────────────────────────────────────────────────────

    _think(entities, bus) {
        if (this.speciesDef.isPredator) {
            if (this.hunger < 40 && this.state !== 'hunting') {
                const duck = EntityManager.findNearest(this.x, this.y, entities.ducks, 300);
                if (duck) {
                    this.target = duck;
                    this.state  = 'hunting';
                    this.element?.classList.add('hunting');
                }
            }
            if (this.canBreed && this.breedingCooldown <= 0 && this.hunger > 50) {
                const mate = this._findPredatorMate(entities);
                if (mate) this._breedWithPredator(mate, entities, bus);
            }
        }
        // Marine mammal reproduction handled by ReproductionSystem
    }

    _findPredatorMate(entities) {
        for (const p of entities.predators) {
            if (p !== this &&
                p.speciesDef.id === this.speciesDef.id &&
                p.gender !== this.gender &&
                p.canBreed && p.breedingCooldown <= 0 &&
                p.hunger > 50 &&
                this.distanceTo(p) < 100) return p;
        }
        return null;
    }

    _breedWithPredator(mate, entities, bus) {
        this.breedingCooldown = mate.breedingCooldown = 90;
        this.canBreed = mate.canBreed = false;
        const bx  = (this.x + mate.x) / 2;
        const by  = (this.y + mate.y) / 2;
        const num = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < num; i++) {
            setTimeout(() => {
                if (!entities.canSpawn(this.speciesDef)) return;
                const baby = new MammalEntity(
                    entities.nextPredatorId++,
                    bx + (Math.random() - 0.5) * 40,
                    by + (Math.random() - 0.5) * 40,
                    this.speciesDef, this.island,
                );
                entities.add(baby, 'predators');
            }, i * 300);
        }
        bus.emit(Events.LOG_EVENT, { message: `${this.speciesDef.name} #${this.id} & #${mate.id} had ${num} offspring! 💕` });
    }

    _executePredatorBehaviour(dt, entities, bus) {
        if (this.state === 'hunting' && this.target) {
            if (this.distanceTo(this.target) < 30) {
                this._catchDuck(this.target, entities, bus);
            } else {
                this.moveTowards(this.target, dt);
            }
        } else {
            if (this.island && Math.random() < 0.02) {
                const off = this.island.size === 'small' ? 45 : this.island.size === 'medium' ? 70 : 90;
                this.target = {
                    x: this.island.x + off + (Math.random() - 0.5) * 60,
                    y: this.island.y + off + (Math.random() - 0.5) * 60,
                };
            }
            if (this.target) this.moveTowards(this.target, dt);
        }
    }

    _catchDuck(duck, entities, bus) {
        this.element?.classList.remove('hunting');
        this.element?.classList.add('eating');
        setTimeout(() => this.element?.classList.remove('eating'), 800);
        this.hunger = Math.min(100, this.hunger + 60);
        this.energy = Math.min(100, this.energy + 20);
        this.ducksEaten++;
        bus.emit(Events.LOG_EVENT, { message: `${this.speciesDef.name} #${this.id} caught ${duck.speciesDef.name} #${duck.id}! 🦆💔` });
        bus.emit(Events.DUCK_EATEN, { duck });
        entities.queueRemove(duck);
        this.target = null;
        this.state  = 'idle';
    }

    // ── Marine AI ─────────────────────────────────────────────────────────────

    _executeMarineBehaviour(dt, world) {
        this.wander();
        this.moveFreely(dt, world);
    }
}
