// engine/Systems/ReproductionSystem.js
// Handles natural (unprompted) reproduction for fish and marine mammals.
// Bird breeding is intent-driven (triggered by BirdEntity._think()),
// so it stays in BirdEntity. This system handles the passive pair-finding
// for species that breed when close and conditions are met.

import { Events } from '../EventBus.js';

export class ReproductionSystem {
    constructor(world, entities, bus, spawners) {
        this.world    = world;
        this.entities = entities;
        this.bus      = bus;
        this.spawners = spawners; // Spawners instance for offspring creation
    }

    update(dt) {
        if (this.world.isPaused) return;

        // Fish reproduction (salmon, tropical, etc.)
        this._processFishReproduction(dt);

        // Marine mammal reproduction (dolphins, seals, etc.)
        this._processMammalReproduction(dt);

        // Shrimp reproduction (PreyEntity handles its own timing,
        // but we provide the pair-finding here)
        this._processShrimpReproduction(dt);
    }

    _processFishReproduction(dt) {
        const pool = [...this.entities.fish, ...this.entities.seaCreatures, ...this.entities.octopi];
        for (const a of pool) {
            if (!a.reproductionCooldown !== undefined) continue;
            a.reproductionCooldown = Math.max(0, (a.reproductionCooldown ?? 0) - dt);
            if (a.hunger < 70 || a.reproductionCooldown > 0) continue;
            if (Math.random() > 0.01) continue;

            for (const b of pool) {
                if (b === a || b.speciesDef?.id !== a.speciesDef?.id) continue;
                if ((b.reproductionCooldown ?? 0) > 0) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                if (dx * dx + dy * dy < 80 * 80) {
                    this._spawnFishOffspring(a, b);
                    break;
                }
            }
        }
    }

    _spawnFishOffspring(a, b) {
        a.reproductionCooldown = b.reproductionCooldown = 40;
        if (!this.entities.canSpawn(a.speciesDef)) return;
        const bx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 50;
        const by = (a.y + b.y) / 2 + (Math.random() - 0.5) * 50;
        const baby = this.spawners.spawnFish(a.speciesDef, bx, by);
        if (baby) {
            this.bus.emit(Events.LOG_EVENT,
                { message: `${a.speciesDef.name} #${a.id} & #${b.id} had offspring! ${a.speciesDef.emoji}💕` });
        }
    }

    _processMammalReproduction(dt) {
        for (const a of this.entities.seaCreatures) {
            if (!a.speciesDef || a.speciesDef.isPredator) continue;
            a.reproductionCooldown = Math.max(0, (a.reproductionCooldown ?? 0) - dt);
            if (a.hunger < 70 || a.reproductionCooldown > 0) continue;

            for (const b of this.entities.seaCreatures) {
                if (b === a || b.speciesDef?.id !== a.speciesDef?.id) continue;
                if ((b.reproductionCooldown ?? 0) > 0) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                if (dx * dx + dy * dy < 80 * 80) {
                    this._spawnMarineOffspring(a, b);
                    break;
                }
            }
        }
    }

    _spawnMarineOffspring(a, b) {
        a.reproductionCooldown = b.reproductionCooldown = 40;
        if (!this.entities.canSpawn(a.speciesDef)) return;
        const bx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 50;
        const by = (a.y + b.y) / 2 + (Math.random() - 0.5) * 50;
        this.spawners.spawnSeaCreature(a.speciesDef, bx, by);
        this.bus.emit(Events.LOG_EVENT,
            { message: `${a.speciesDef.name} #${a.id} & #${b.id} had offspring! ${a.speciesDef.emoji}💕` });
    }

    _processShrimpReproduction(dt) {
        for (const a of this.entities.food) {
            if (!a.speciesDef || a.speciesDef.isBaby) continue;
            a.reproductionCooldown = Math.max(0, (a.reproductionCooldown ?? 0) - dt);
            if (a.hunger < 60 || a.reproductionCooldown > 0) continue;
            if (Math.random() > 0.01) continue;

            for (const b of this.entities.food) {
                if (b === a || b.speciesDef?.isBaby || (b.reproductionCooldown ?? 0) > 0) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                if (dx * dx + dy * dy < 60 * 60) {
                    this._spawnShrimpBabies(a, b);
                    break;
                }
            }
        }
    }

    _spawnShrimpBabies(a, b) {
        a.reproductionCooldown = b.reproductionCooldown = 20;
        const num = Math.floor(Math.random() * 3) + 1;
        let spawned = 0;
        for (let i = 0; i < num; i++) {
            const baby = this.spawners.spawnBabyShrimp(
                (a.x + b.x) / 2 + (Math.random() - 0.5) * 30,
                (a.y + b.y) / 2 + (Math.random() - 0.5) * 30,
            );
            if (baby) spawned++;
        }
        if (spawned > 0) {
            this.bus.emit(Events.LOG_EVENT,
                { message: `Shrimp #${a.id} & #${b.id} had ${spawned} babies! 🦐💕` });
        }
    }
}
