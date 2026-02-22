// game/Entities/Bird.js
// Covers mallards, ducklings, pelicans, swans, geese, and flamingos.
// Full AI state machine: hunger → breeding → socializing → energy → explore.
// Flamingos use islandOnly mode: orbit the nearest island, skip all other AI.
// Spawning children (eggs) is done via bus events caught by Spawners.

import { BaseEntity }    from './BaseEntity.js';
import { Events }        from '../../engine/EventBus.js';
import { EntityManager } from '../../engine/EntityManager.js';

const PERSONALITIES = ['Curious','Lazy','Social','Shy','Brave','Cautious','Energetic','Calm'];
const COLORS = [
    { name:'Yellow', hex:'#ffd700', emoji:'🦆' }, { name:'White',  hex:'#ffffff', emoji:'🦆' },
    { name:'Brown',  hex:'#8b6f47', emoji:'🦆' }, { name:'Orange', hex:'#ff8c42', emoji:'🦆' },
    { name:'Green',  hex:'#4a7c59', emoji:'🦆' }, { name:'Blue',   hex:'#5b9bd5', emoji:'🦆' },
    { name:'Pink',   hex:'#ff69b4', emoji:'🦆' }, { name:'Purple', hex:'#9370db', emoji:'🦆' },
];

export class BirdEntity extends BaseEntity {
    constructor(id, x, y, speciesDef, parentColor = null) {
        super(id, x, y, speciesDef);
        this.hunger           = Math.random() * 50 + 25;
        this.energy           = Math.random() * 50 + 50;
        this.social           = Math.random() * 100;
        this.personality      = PERSONALITIES[Math.floor(Math.random() * 8)];
        this.state            = 'idle';
        this.target           = null;
        this.isSwimming       = false;
        this.canBreed         = false;
        this.breedingCooldown = 0;
        this.gender           = Math.random() < 0.5 ? 'M' : 'F';
        this.color            = parentColor ?? COLORS[Math.floor(Math.random() * 8)];
        this.mealsEaten       = 0;
        this.fertility        = 0;
        this.onIsland         = false;
        this.friends          = [];
        this.thinkingTimer    = 0;
        this.lastDecisionTime = 0;
        // Flamingo orbit state
        this._islandTarget    = null;
        this._orbitAngle      = Math.random() * Math.PI * 2;
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    createElement(_container) {
        const duck = document.createElement('div');
        duck.className  = 'duck fade-in';
        duck.style.left = this.x + 'px';
        duck.style.top  = this.y + 'px';
        const isDuckling = this.age < 10 || this.speciesDef.isBaby;
        const emoji = this.speciesDef.islandOnly
            ? this.speciesDef.emoji               // flamingo always uses species emoji
            : (isDuckling ? '🐥' : this.color.emoji);
        const size  = isDuckling ? '36px' : this.speciesDef.size + 'px';
        duck.innerHTML = `
            <div class="duck-body" style="filter:drop-shadow(0 0 8px ${this.color.hex});font-size:${size};">${emoji}</div>
            <div class="duck-ripple"></div>
            <div class="duck-thinking"></div>
            <div class="duck-stats">
                <div><strong>${this.personality}</strong> ${this.color.name} ${this.gender === 'M' ? '♂️' : '♀️'} #${this.id} <em style="opacity:.7">${this.speciesDef.name}</em></div>
                <div style="margin-top:4px;font-size:9px;">Age:<span class="duck-age">0</span>s | Fertility:<span class="duck-fertility">0</span>%</div>
                <div>Hunger:<div class="stat-bar"><div class="stat-fill stat-hunger" style="width:${this.hunger}%"></div></div></div>
                <div>Energy:<div class="stat-bar"><div class="stat-fill stat-energy" style="width:${this.energy}%"></div></div></div>
                <div>Social:<div class="stat-bar"><div class="stat-fill stat-social" style="width:${this.social}%"></div></div></div>
            </div>`;
        duck.addEventListener('click', () => this.onInteract());
        return duck;
    }

    syncToDOM(el) {
        const body = el.querySelector('.duck-body');
        if (body) {
            const isDuckling = this.age < 10 || this.speciesDef.isBaby;
            if (!this.speciesDef.islandOnly) {
                body.textContent  = isDuckling ? '🐥' : this.color.emoji;
                body.style.fontSize = isDuckling ? '36px' : this.speciesDef.size + 'px';
            }
        }
        const q = s => el.querySelector(s);
        const hB = q('.stat-hunger'), eB = q('.stat-energy'), sB = q('.stat-social');
        const aE = q('.duck-age'),    fE = q('.duck-fertility');
        if (hB) hB.style.width = this.hunger   + '%';
        if (eB) eB.style.width = this.energy   + '%';
        if (sB) sB.style.width = this.social   + '%';
        if (aE) aE.textContent = Math.floor(this.age);
        if (fE) fE.textContent = Math.floor(this.fertility);

        el.classList.toggle('swimming', this.isSwimming);
        el.classList.toggle('breeding', this.state === 'breeding');
        if (this.age > this.maxAge * 0.8) el.classList.add('old');
    }

    onInteract() {
        this.social = Math.min(100, this.social + 15);
        this.showThought(`Hello! I'm feeling ${this._emotionalState()}! 😊`);
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

        if (this.age >= 10 && !this.canBreed) {
            this.canBreed = true;
            this.showThought('I\'m mature now! 🎂');
        }
        if (this.breedingCooldown > 0) this.breedingCooldown -= dt;

        this.hunger = Math.max(0, this.hunger - dt * 0.8);
        this.energy = Math.max(0, this.energy - dt * 0.5);
        this.social = Math.max(0, this.social - dt * 0.3);

        if (this.thinkingTimer > 0) {
            this.thinkingTimer -= dt;
            if (this.thinkingTimer <= 0) this._hideThought();
        }

        if (this.speciesDef.islandOnly) {
            this._flamingoWalk(dt, entities);
        } else {
            this._think(entities, bus, config);
            this._executeBehaviour(dt, world, entities, bus);
        }
    }

    // ── Flamingo ──────────────────────────────────────────────────────────────

    _flamingoWalk(dt, entities) {
        if (!this._islandTarget || !entities.islands.includes(this._islandTarget)) {
            this._islandTarget = entities.islands.length > 0
                ? entities.islands[Math.floor(Math.random() * entities.islands.length)]
                : null;
            this._orbitAngle = Math.random() * Math.PI * 2;
        }
        if (!this._islandTarget) return;

        const island = this._islandTarget;
        const off    = island.size === 'small' ? 45 : island.size === 'medium' ? 70 : 90;
        const radius = island.size === 'small' ? 60 : island.size === 'medium' ? 90 : 120;
        const cx = island.x + off, cy = island.y + off;

        this._orbitAngle += dt * 0.4;
        const tx = cx + Math.cos(this._orbitAngle) * radius;
        const ty = cy + Math.sin(this._orbitAngle) * radius;
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const spd = this.speed * dt * 40;
            this.x += (dx / dist) * spd;
            this.y += (dy / dist) * spd;
            const body = this.element?.querySelector('.duck-body');
            if (body) body.style.transform = dx < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }
    }

    // ── AI ────────────────────────────────────────────────────────────────────

    _think(entities, bus, config) {
        const now = Date.now();
        if (now - this.lastDecisionTime < (config?.THINK_COOLDOWN ?? 3000)) return;
        this.lastDecisionTime = now;

        // Priority 1: lay eggs on island
        if (this.canBreed && this.breedingCooldown <= 0 &&
            this.hunger > 60 && this.energy > 60 && this.fertility > 70) {
            const island = EntityManager.findNearest(this.x, this.y, entities.islands);
            if (island && !this.onIsland) {
                this.target = { type: 'island', obj: island };
                this.state  = 'seeking-island';
                this.showThought('Going to lay eggs! 🏝️');
                return;
            }
        }

        // Priority 2: find mate
        if (this.canBreed && this.breedingCooldown <= 0 &&
            this.hunger > 50 && this.energy > 50) {
            const mate = this._findMate(entities);
            if (mate) {
                this.target = { type: 'duck', obj: mate };
                this.state  = 'breeding';
                this.showThought('Time to breed! 💕');
                return;
            }
        }

        // Priority 3: urgent needs
        const need = this._urgentNeed();
        if (need === 'hunger') {
            const nearFood = EntityManager.findNearest(this.x, this.y, entities.food);
            const nearFish = EntityManager.findNearest(this.x, this.y, entities.fish);
            if (nearFish && this.personality !== 'Lazy' &&
                (!nearFood || this.distanceTo(nearFish) < this.distanceTo(nearFood))) {
                this.target = { type: 'fish', obj: nearFish };
                this.state  = 'seeking-fish';
                this.showThought('Hunting fish! 🎣');
            } else if (nearFood) {
                this.target = { type: 'food', obj: nearFood };
                this.state  = 'seeking-food';
                this.showThought('Looking for shrimp... 🦐');
            }
        } else if (need === 'social') {
            const buddy = EntityManager.findNearest(this.x, this.y,
                entities.ducks.filter(d => d !== this));
            if (buddy) {
                this.target = { type: 'duck', obj: buddy };
                this.state  = 'socializing';
                this.showThought('Let\'s hang out! 🤝');
            }
        } else if (need === 'energy') {
            this.state = 'resting';
            this.showThought('Taking a nap... 💤');
        } else {
            this._explore();
        }
    }

    _findMate(entities) {
        for (const d of entities.ducks)
            if (d !== this && d.canBreed && d.breedingCooldown <= 0 &&
                d.hunger > 50 && d.energy > 50 && this.distanceTo(d) < 200)
                return d;
        return null;
    }

    _urgentNeed() {
        const n = {
            hunger: 100 - this.hunger,
            energy: 100 - this.energy,
            social: this.personality === 'Social' ? 100 - this.social : 0,
        };
        if (this.personality === 'Lazy')   n.energy *= 1.5;
        if (this.personality === 'Social') n.social *= 2;
        const max = Math.max(...Object.values(n));
        return max < 40 ? 'none' : Object.keys(n).find(k => n[k] === max);
    }

    _explore() {
        if (Math.random() < 0.3) {
            // Birds know about the world height/width from their element's container,
            // but we approximate from the DOM rather than storing a world ref.
            const c  = this.element?.parentElement ?? document.getElementById('game-container');
            const isDuckling = this.age < 10;
            const ty = isDuckling
                ? c.clientHeight * 0.35 + Math.random() * c.clientHeight * 0.15
                : c.clientHeight * 0.10 + Math.random() * c.clientHeight * 0.40;
            this.target = { type: 'position', x: Math.random() * (c.clientWidth - 100), y: ty };
            this.state  = 'exploring';
            this.showThought(['What\'s over there? 🔍', 'Time to explore! 🗺️', 'I wonder...'][Math.floor(Math.random() * 3)]);
        }
    }

    // ── Behaviour execution ───────────────────────────────────────────────────

    _executeBehaviour(dt, world, entities, bus) {
        const wasSwimming = this.isSwimming;
        this.isSwimming = false;

        switch (this.state) {
            case 'seeking-food':
                this.isSwimming = true;
                this._moveToTarget(dt);
                if (this.target && this.distanceTo(this.target.obj) < 30)
                    this._eatFood(this.target.obj, entities, bus);
                break;
            case 'seeking-fish':
                this.isSwimming = true;
                this._moveToTarget(dt * 1.3);
                if (this.target && this.distanceTo(this.target.obj) < 40)
                    this._catchFish(this.target.obj, entities, bus);
                break;
            case 'socializing':
                this.isSwimming = true;
                this._moveToTarget(dt);
                if (this.target && this.distanceTo(this.target.obj) < 50)
                    this._socialize(this.target.obj);
                break;
            case 'breeding':
                this.isSwimming = true;
                this._moveToTarget(dt);
                if (this.target && this.distanceTo(this.target.obj) < 50)
                    this._breed(this.target.obj, entities, bus);
                break;
            case 'seeking-island':
                this.isSwimming = true;
                this._moveToTarget(dt);
                if (this.target && this.distanceTo(this.target.obj) < 60)
                    this._layEggsOnIsland(this.target.obj, bus);
                break;
            case 'resting':
                this.energy = Math.min(100, this.energy + dt * 3);
                if (this.energy > 80) { this.state = 'idle'; this.showThought('Feeling refreshed! ✨'); }
                break;
            case 'exploring':
                this.isSwimming = true;
                this._moveToTarget(dt);
                if (this.target &&
                    Math.abs(this.x - this.target.x) < 10 &&
                    Math.abs(this.y - this.target.y) < 10) {
                    this.state = 'idle'; this.target = null;
                }
                break;
            default:
                // idle — gentle wander in water
                if (Math.random() < 0.005) {
                    this.isSwimming = true;
                    this.wander(0.05);
                    this.moveFreely(dt, world, 0.5);
                }
        }
    }

    _moveToTarget(dt) {
        if (!this.target) return;
        const tx = this.target.x ?? this.target.obj?.x ?? 0;
        const ty = this.target.y ?? this.target.obj?.y ?? 0;
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const spd = this.speed * dt * 60;
            this.x += (dx / dist) * spd;
            this.y += (dy / dist) * spd;
            const body = this.element?.querySelector('.duck-body');
            if (body) body.style.transform = dx < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    _eatFood(food, entities, bus) {
        this.element?.classList.add('eating');
        setTimeout(() => this.element?.classList.remove('eating'), 600);
        this.hunger = Math.min(100, this.hunger + 35);
        this.energy = Math.min(100, this.energy + 10);
        this.mealsEaten++;
        this.fertility = Math.min(100, this.fertility + 15);
        this.showThought('Yummy shrimp! 😋');
        bus.emit(Events.FOOD_EATEN, { food });
        entities.queueRemove(food);
        this.target = null; this.state = 'idle';
    }

    _catchFish(fish, entities, bus) {
        this.element?.classList.add('eating');
        setTimeout(() => this.element?.classList.remove('eating'), 600);
        this.hunger = Math.min(100, this.hunger + 50);
        this.energy = Math.min(100, this.energy + 15);
        this.mealsEaten++;
        this.fertility = Math.min(100, this.fertility + 25);
        this.showThought('Caught a fish! 🎣');
        bus.emit(Events.FISH_EATEN, { fish });
        entities.queueRemove(fish);
        this.target = null; this.state = 'idle';
    }

    _socialize(other) {
        this.element?.classList.add('meeting');
        other.element?.classList.add('meeting');
        setTimeout(() => {
            this.element?.classList.remove('meeting');
            other.element?.classList.remove('meeting');
        }, 1000);
        this.social = Math.min(100, this.social + 15);
        other.social = Math.min(100, other.social + 15);
        if (!this.friends.includes(other.id)) this.friends.push(other.id);
        this.showThought(['Nice to meet you!', 'Quack quack! 🗣️', 'Great weather!', 'Let\'s be friends! 🤝'][Math.floor(Math.random() * 4)]);
        this.target = null; this.state = 'idle';
    }

    _breed(mate, entities, bus) {
        if (!mate.canBreed || mate.breedingCooldown > 0 || this.gender === mate.gender) {
            this.state = 'idle'; this.target = null; return;
        }
        const female = this.gender === 'F' ? this : mate;
        female.element?.classList.add('laying-egg');
        setTimeout(() => female.element?.classList.remove('laying-egg'), 2000);
        this.breedingCooldown = mate.breedingCooldown = 30;
        this.showThought('💕 Love is in the air! 💕');
        mate.showThought('💕 Love is in the air! 💕');
        const avgF    = (this.fertility + mate.fertility) / 2;
        const numEggs = avgF > 75 ? 3 : avgF > 50 ? 2 : 1;
        const px = (this.x + mate.x) / 2, py = (this.y + mate.y) / 2;
        const parentColor = Math.random() < 0.5 ? this.color : mate.color;
        for (let i = 0; i < numEggs; i++) {
            setTimeout(() => {
                bus.emit(Events.EGG_HATCHED, {
                    x: px + (Math.random() - 0.5) * 40,
                    y: py + (Math.random() - 0.5) * 40,
                    parentColor, create: true,
                });
            }, i * 300);
        }
        this.fertility = Math.max(0, this.fertility - 30);
        mate.fertility = Math.max(0, mate.fertility - 30);
        bus.emit(Events.LOG_EVENT, { message: `${female.color.name} ${female.speciesDef.name} #${female.id} ♀️ & #${mate.id} ♂️ laid ${numEggs} egg(s)! 🥚` });
        this.target = null; this.state = 'idle';
    }

    _layEggsOnIsland(island, bus) {
        this.onIsland = true;
        this.element?.classList.add('laying-egg');
        setTimeout(() => this.element?.classList.remove('laying-egg'), 2000);
        const numEggs = Math.floor(this.fertility / 25) + 1;
        const off = island.size === 'small' ? 45 : island.size === 'medium' ? 70 : 90;
        for (let i = 0; i < numEggs; i++) {
            setTimeout(() => {
                bus.emit(Events.EGG_HATCHED, {
                    x: island.x + off + (Math.random() - 0.5) * 60,
                    y: island.y + off + (Math.random() - 0.5) * 40,
                    parentColor: this.color, create: true,
                });
            }, i * 400);
        }
        this.breedingCooldown = 40;
        this.fertility = Math.max(0, this.fertility - 50);
        this.showThought(`Laid ${numEggs} eggs! 🥚🏝️`);
        bus.emit(Events.LOG_EVENT, { message: `${this.speciesDef.name} #${this.id} laid ${numEggs} egg(s) on Island #${island.id}!` });
        setTimeout(() => { this.onIsland = false; this.state = 'idle'; this.target = null; }, 3000);
    }

    // ── Thought bubbles ───────────────────────────────────────────────────────

    showThought(text) {
        this.thinkingTimer = 600 + Math.random() * 600;
        const bubble = this.element?.querySelector('.duck-thinking');
        if (bubble) { bubble.textContent = text; bubble.classList.add('show'); }
    }

    _hideThought() {
        this.element?.querySelector('.duck-thinking')?.classList.remove('show');
    }

    _emotionalState() {
        if (this.hunger > 70 && this.energy > 70) return 'happy';
        if (this.hunger < 30) return 'hungry';
        if (this.energy < 30) return 'tired';
        if (this.social < 30) return 'lonely';
        return 'content';
    }
}
