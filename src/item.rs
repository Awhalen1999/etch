//! Item definitions and inventory helpers.
//!
//! Items are static data — each has a unique ID, category, rarity, and stat.
//! Inventory is stored in the DB as (player_name, item_id) rows, max 5.

use sqlx::SqlitePool;

/// Max items a player can carry.
pub const INVENTORY_SIZE: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Category {
    Attack,
    Defense,
    Stamina,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
}

#[derive(Debug, Clone)]
pub struct ItemDef {
    pub id: &'static str,
    pub name: &'static str,
    pub category: Category,
    pub rarity: Rarity,
    pub stat: u32,
}

/// All items in the game.
pub const ITEMS: &[ItemDef] = &[
    // Attack — common
    ItemDef { id: "wooden_stick",  name: "wooden stick",   category: Category::Attack,  rarity: Rarity::Common,   stat: 10 },
    ItemDef { id: "bent_nail",     name: "bent nail",      category: Category::Attack,  rarity: Rarity::Common,   stat: 10 },
    ItemDef { id: "rock_shard",    name: "rock shard",     category: Category::Attack,  rarity: Rarity::Common,   stat: 10 },
    // Attack — uncommon
    ItemDef { id: "rusted_hammer", name: "rusted hammer",  category: Category::Attack,  rarity: Rarity::Uncommon, stat: 15 },
    ItemDef { id: "broken_crowbar",name: "broken crowbar", category: Category::Attack,  rarity: Rarity::Uncommon, stat: 15 },
    // Attack — rare
    ItemDef { id: "pickaxe",       name: "pickaxe",        category: Category::Attack,  rarity: Rarity::Rare,     stat: 25 },
    ItemDef { id: "saw_blade",     name: "saw blade",      category: Category::Attack,  rarity: Rarity::Rare,     stat: 20 },

    // Defense — common
    ItemDef { id: "hard_hat",      name: "hard hat",       category: Category::Defense, rarity: Rarity::Common,   stat: 2 },
    ItemDef { id: "leather_scraps",name: "leather scraps",  category: Category::Defense, rarity: Rarity::Common,   stat: 2 },
    ItemDef { id: "thick_gloves",  name: "thick gloves",   category: Category::Defense, rarity: Rarity::Common,   stat: 2 },
    // Defense — uncommon
    ItemDef { id: "miners_vest",   name: "miner's vest",   category: Category::Defense, rarity: Rarity::Uncommon, stat: 3 },
    ItemDef { id: "shoulder_guard",name: "shoulder guard",  category: Category::Defense, rarity: Rarity::Uncommon, stat: 3 },
    // Defense — rare
    ItemDef { id: "plate_fragment",name: "plate fragment",  category: Category::Defense, rarity: Rarity::Rare,     stat: 5 },
    ItemDef { id: "carapace_shard",name: "carapace shard",  category: Category::Defense, rarity: Rarity::Rare,     stat: 5 },

    // Stamina — common
    ItemDef { id: "dried_meat",    name: "dried meat",     category: Category::Stamina, rarity: Rarity::Common,   stat: 5 },
    ItemDef { id: "water_pouch",   name: "water pouch",    category: Category::Stamina, rarity: Rarity::Common,   stat: 5 },
    // Stamina — uncommon
    ItemDef { id: "mystery_bottle",name: "mystery bottle",  category: Category::Stamina, rarity: Rarity::Uncommon, stat: 10 },
    ItemDef { id: "pouch_of_pills",name: "pouch of pills",  category: Category::Stamina, rarity: Rarity::Uncommon, stat: 10 },
    // Stamina — rare
    ItemDef { id: "mre_kit",       name: "MRE kit",        category: Category::Stamina, rarity: Rarity::Rare,     stat: 15 },
    ItemDef { id: "mutant_frog",   name: "mutant frog",    category: Category::Stamina, rarity: Rarity::Rare,     stat: 20 },
];

/// Look up an item definition by ID.
pub fn find(id: &str) -> Option<&'static ItemDef> {
    ITEMS.iter().find(|i| i.id == id)
}

/// Load a player's inventory from DB. Returns item IDs.
pub async fn load(db: &SqlitePool, player_name: &str) -> Vec<String> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT item_id FROM inventory WHERE player_name = ? ORDER BY created_at",
    )
    .bind(player_name)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.into_iter().map(|(id,)| id).collect()
}

/// Count items in a player's inventory.
pub async fn count(db: &SqlitePool, player_name: &str) -> usize {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM inventory WHERE player_name = ?",
    )
    .bind(player_name)
    .fetch_one(db)
    .await
    .unwrap_or((0,));

    row.0 as usize
}

/// Add an item to a player's inventory. Returns false if full.
pub async fn add(db: &SqlitePool, player_name: &str, item_id: &str) -> bool {
    if count(db, player_name).await >= INVENTORY_SIZE {
        return false;
    }

    let _ = sqlx::query(
        "INSERT INTO inventory (player_name, item_id) VALUES (?, ?)",
    )
    .bind(player_name)
    .bind(item_id)
    .execute(db)
    .await;

    true
}

/// Remove one instance of an item from a player's inventory. Returns false if not found.
pub async fn remove(db: &SqlitePool, player_name: &str, item_id: &str) -> bool {
    let result = sqlx::query(
        "DELETE FROM inventory WHERE id = (
            SELECT id FROM inventory WHERE player_name = ? AND item_id = ? LIMIT 1
        )",
    )
    .bind(player_name)
    .bind(item_id)
    .execute(db)
    .await;

    result.is_ok_and(|r| r.rows_affected() > 0)
}

/// Clear all items from a player's inventory (on death).
pub async fn clear(db: &SqlitePool, player_name: &str) {
    let _ = sqlx::query("DELETE FROM inventory WHERE player_name = ?")
        .bind(player_name)
        .execute(db)
        .await;
}

/// Calculate total attack bonus from inventory.
pub async fn attack_bonus(db: &SqlitePool, player_name: &str) -> u32 {
    let items = load(db, player_name).await;
    items.iter()
        .filter_map(|id| find(id))
        .filter(|i| i.category == Category::Attack)
        .map(|i| i.stat)
        .sum()
}

/// Calculate total defense bonus from inventory.
pub async fn defense_bonus(db: &SqlitePool, player_name: &str) -> u32 {
    let items = load(db, player_name).await;
    items.iter()
        .filter_map(|id| find(id))
        .filter(|i| i.category == Category::Defense)
        .map(|i| i.stat)
        .sum()
}

/// Calculate total stamina bonus from inventory.
pub async fn stamina_bonus(db: &SqlitePool, player_name: &str) -> u32 {
    let items = load(db, player_name).await;
    items.iter()
        .filter_map(|id| find(id))
        .filter(|i| i.category == Category::Stamina)
        .map(|i| i.stat)
        .sum()
}
