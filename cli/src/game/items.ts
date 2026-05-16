// Static item catalog plus helpers to compute bonuses from an inventory.
// Items are addressed by id everywhere; the name is for display only.

import { STAMINA_BASE_MAX } from "./world";

export type ItemCategory = "attack" | "defense" | "stamina";
export type ItemRarity = "common" | "uncommon" | "rare";

export interface Item {
    id: string;
    name: string;
    category: ItemCategory;
    rarity: ItemRarity;
    stat: number;
}

export const INVENTORY_SIZE = 5;

export const ITEM_CATALOG: readonly Item[] = [
    // attack
    { id: "wooden_stick",   name: "wooden stick",   category: "attack",  rarity: "common",   stat: 10 },
    { id: "bent_nail",      name: "bent nail",      category: "attack",  rarity: "common",   stat: 10 },
    { id: "rock_shard",     name: "rock shard",     category: "attack",  rarity: "common",   stat: 10 },
    { id: "rusted_hammer",  name: "rusted hammer",  category: "attack",  rarity: "uncommon", stat: 15 },
    { id: "broken_crowbar", name: "broken crowbar", category: "attack",  rarity: "uncommon", stat: 15 },
    { id: "pickaxe",        name: "pickaxe",        category: "attack",  rarity: "rare",     stat: 25 },
    { id: "saw_blade",      name: "saw blade",      category: "attack",  rarity: "rare",     stat: 20 },
    // defense
    { id: "hard_hat",       name: "hard hat",       category: "defense", rarity: "common",   stat: 2 },
    { id: "leather_scraps", name: "leather scraps", category: "defense", rarity: "common",   stat: 2 },
    { id: "thick_gloves",   name: "thick gloves",   category: "defense", rarity: "common",   stat: 2 },
    { id: "miners_vest",    name: "miner's vest",   category: "defense", rarity: "uncommon", stat: 3 },
    { id: "shoulder_guard", name: "shoulder guard", category: "defense", rarity: "uncommon", stat: 3 },
    { id: "plate_fragment", name: "plate fragment", category: "defense", rarity: "rare",     stat: 5 },
    { id: "carapace_shard", name: "carapace shard", category: "defense", rarity: "rare",     stat: 5 },
    // stamina
    { id: "dried_meat",     name: "dried meat",     category: "stamina", rarity: "common",   stat: 5 },
    { id: "water_pouch",    name: "water pouch",    category: "stamina", rarity: "common",   stat: 5 },
    { id: "mystery_bottle", name: "mystery bottle", category: "stamina", rarity: "uncommon", stat: 10 },
    { id: "pouch_of_pills", name: "pouch of pills", category: "stamina", rarity: "uncommon", stat: 10 },
    { id: "mre_kit",        name: "MRE kit",        category: "stamina", rarity: "rare",     stat: 15 },
    { id: "mutant_frog",    name: "mutant frog",    category: "stamina", rarity: "rare",     stat: 20 },
];

export function findItem(id: string): Item | undefined {
    return ITEM_CATALOG.find((i) => i.id === id);
}

export function findItemByName(name: string): Item | undefined {
    const lower = name.trim().toLowerCase();
    return ITEM_CATALOG.find((i) => i.name === lower);
}

function bonus(inventory: string[], category: ItemCategory): number {
    let sum = 0;
    for (const id of inventory) {
        const item = findItem(id);
        if (item && item.category === category) sum += item.stat;
    }
    return sum;
}

export function attackBonus(inv: string[]): number  { return bonus(inv, "attack"); }
export function defenseBonus(inv: string[]): number { return bonus(inv, "defense"); }
export function staminaBonus(inv: string[]): number { return bonus(inv, "stamina"); }

export function maxStamina(inventory: string[]): number {
    return STAMINA_BASE_MAX + staminaBonus(inventory);
}

// Roll for an item to appear when entering a depth. Returns the item id, or null.
export function rollItemSpawn(depth: number): string | null {
    const SPAWN_CHANCE = 0.25;
    if (Math.random() >= SPAWN_CHANCE) return null;

    const pool = ITEM_CATALOG.filter((i) => {
        if (depth <= 40) return i.rarity === "common";
        if (depth <= 120) return i.rarity === "common" || i.rarity === "uncommon";
        if (depth <= 160) return true;
        return i.rarity === "uncommon" || i.rarity === "rare";
    });
    if (pool.length === 0) return null;

    return pool[Math.floor(Math.random() * pool.length)]!.id;
}
