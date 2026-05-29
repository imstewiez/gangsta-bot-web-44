#!/usr/bin/env python3
"""Atualiza config.json com os novos preços e materiais."""
import json
import os

path = os.path.join(os.path.dirname(__file__), "..", "config.json")
with open(path, "r", encoding="utf-8") as f:
    cfg = json.load(f)

items = cfg["items"]
recipes = cfg["recipes"]

# ── Armas Orange ───────────────────────────────────────────────────────────
orange_weapons = {
    "weapon_orange_minismg": {"buyPrice": 20000, "sellPrice": 30000},
    "weapon_orange_xm3": {"buyPrice": 20000, "sellPrice": 35000},
    "weapon_orange_micro_smg": {"buyPrice": 22000, "sellPrice": 40000},
    "weapon_orange_tec9": {"buyPrice": 22000, "sellPrice": 45000},
    "weapon_orange_tec_pistol": {"buyPrice": 27000, "sellPrice": 50000},
    "weapon_orange_ap_pistol": {"buyPrice": 27000, "sellPrice": 55000},
    "weapon_orange_compact_rifle": {"buyPrice": 60000, "sellPrice": 70000},
}
for k, v in orange_weapons.items():
    if k in items:
        items[k]["buyPrice"] = v["buyPrice"]
        items[k]["sellPrice"] = v["sellPrice"]
        items[k]["estimatedValue"] = v["buyPrice"]

# ── Nova arma: Espingarda de Assalto ──────────────────────────────────────
items["weapon_orange_espingarda_assalto"] = {
    "name": "Espingarda de Assalto",
    "type": "weapon",
    "tier": "orange",
    "buyPrice": 0,
    "sellPrice": 30000,
    "estimatedValue": 0,
    "stackable": True,
    "weight": 0,
    "xpPoints": 5,
    "side": "venda",
    "category": "armas_orange",
    "subcategory": "armas_orange"
}
# Receita para Espingarda de Assalto
recipes["recipe_espingarda_assalto"] = {
    "output": "weapon_orange_espingarda_assalto",
    "quantity": 1,
    "inputs": {
        "material_aco": 3,
        "material_pecas": 15,
        "print_laranja": 1
    }
}

# ── Armas Red ─────────────────────────────────────────────────────────────
red_weapons = {
    "weapon_red_heavy_pistol": {"buyPrice": 30000, "sellPrice": 30000},
    "weapon_red_50_pistol": {"buyPrice": 50000, "sellPrice": 50000},
    "weapon_red_p90": {"buyPrice": 60000, "sellPrice": 60000},
    "weapon_red_pdw": {"buyPrice": 60000, "sellPrice": 60000},
    "weapon_red_bullpup": {"buyPrice": 85000, "sellPrice": 85000},
    "weapon_red_carabina": {"buyPrice": 100000, "sellPrice": 100000},
}
for k, v in red_weapons.items():
    if k in items:
        items[k]["buyPrice"] = v["buyPrice"]
        items[k]["sellPrice"] = v["sellPrice"]
        items[k]["estimatedValue"] = v["buyPrice"]

# ── Prints ────────────────────────────────────────────────────────────────
prints = {
    "print_laranja": {"buyPrice": 0, "sellPrice": 10000},
    "print_azul": {"buyPrice": 0, "sellPrice": 50000},
    "print_vermelha": {"buyPrice": 0, "sellPrice": 70000},
    "print_amarela": {"buyPrice": 0, "sellPrice": 100000},
}
for k, v in prints.items():
    if k in items:
        items[k]["buyPrice"] = v["buyPrice"]
        items[k]["sellPrice"] = v["sellPrice"]
        items[k]["estimatedValue"] = v["buyPrice"]

# ── Corpos ────────────────────────────────────────────────────────────────
bodies = {
    "body_minismg": {"buyPrice": 8000, "sellPrice": 10000},
    "body_xm3": {"buyPrice": 8000, "sellPrice": 10000},
    "body_micro_smg": {"buyPrice": 10000, "sellPrice": 15000},
    "body_tec9": {"buyPrice": 10000, "sellPrice": 15000},
    "body_tec_pistol": {"buyPrice": 15000, "sellPrice": 20000},
    "body_ap_pistol": {"buyPrice": 15000, "sellPrice": 20000},
}
for k, v in bodies.items():
    if k in items:
        items[k]["buyPrice"] = v["buyPrice"]
        items[k]["sellPrice"] = v["sellPrice"]
        items[k]["estimatedValue"] = v["buyPrice"]

# ── Materiais existentes ─────────────────────────────────────────────────
# Atualizar preços
material_updates = {
    "material_polvora": {"buyPrice": 100},
    "material_aco": {"buyPrice": 1000},
}
for k, v in material_updates.items():
    if k in items:
        items[k]["buyPrice"] = v["buyPrice"]
        items[k]["estimatedValue"] = v["buyPrice"]

# ── Materiais novos ───────────────────────────────────────────────────────
new_materials = {
    "material_taninos": {"name": "Taninos", "buyPrice": 20, "xpPoints": 1, "category": "materiais"},
    "material_radio_estragado": {"name": "Radio Estragado", "buyPrice": 25, "xpPoints": 2, "category": "sucata_industria"},
    "material_telemovel_estragado": {"name": "Telemóvel Estragado", "buyPrice": 25, "xpPoints": 2, "category": "sucata_industria"},
    "material_serradura": {"name": "Serradura", "buyPrice": 40, "xpPoints": 1, "category": "materiais"},
    "material_carvao": {"name": "Carvão", "buyPrice": 40, "xpPoints": 1, "category": "materiais"},
    "material_tabua_pinho": {"name": "Tábua Pinho", "buyPrice": 40, "xpPoints": 2, "category": "madeiras"},
    "material_plastico_reciclado": {"name": "Plastico Reciclado", "buyPrice": 40, "xpPoints": 2, "category": "reciclagem"},
    "material_tabua_carvalho": {"name": "Tábua Carvalho", "buyPrice": 65, "xpPoints": 2, "category": "madeiras"},
    "material_borracha": {"name": "Borracha", "buyPrice": 65, "xpPoints": 1, "category": "materiais"},
    "material_tabua_cerejeira": {"name": "Tábua Cerejeira", "buyPrice": 60, "xpPoints": 2, "category": "madeiras"},
    "material_ferro": {"name": "Ferro", "buyPrice": 65, "xpPoints": 1, "category": "metais"},
    "material_tecido": {"name": "Tecido", "buyPrice": 65, "xpPoints": 1, "category": "texteis"},
    "material_lixo_eletronico": {"name": "Lixo Eletrônico", "buyPrice": 60, "xpPoints": 2, "category": "sucata_industria"},
    "material_tabua_ebano": {"name": "Tábua Ébano", "buyPrice": 200, "xpPoints": 3, "category": "madeiras"},
    "material_couro": {"name": "Couro", "buyPrice": 1500, "xpPoints": 1, "category": "texteis"},
}

for k, v in new_materials.items():
    items[k] = {
        "name": v["name"],
        "type": "material",
        "tier": None,
        "buyPrice": v["buyPrice"],
        "sellPrice": None,
        "estimatedValue": v["buyPrice"],
        "stackable": True,
        "weight": 0,
        "xpPoints": v["xpPoints"],
        "side": "compra",
        "category": v["category"],
        "subcategory": None
    }

# ── xpPoints ──────────────────────────────────────────────────────────────
xp = cfg["app"]["xpPoints"]
new_xp = {
    "taninos": 1,
    "radio estragado": 2,
    "telemóvel estragado": 2,
    "serradura": 1,
    "carvão": 1,
    "tábua pinho": 2,
    "plastico reciclado": 2,
    "tábua carvalho": 2,
    "borracha": 1,
    "tábua cerejeira": 2,
    "ferro": 1,
    "tecido": 1,
    "lixo eletrônico": 2,
    "tábua ébano": 3,
    "couro": 1,
    "carvao": 1,
    "tabua pinho": 2,
    "tabua carvalho": 2,
    "tabua cerejeira": 2,
    "tabua ebano": 3,
    "lixo eletronico": 2,
}
xp.update(new_xp)

# ── Escrever ──────────────────────────────────────────────────────────────
with open(path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)

print("Updated config.json")
print(f"Total items: {len(items)}")
print(f"Total recipes: {len(recipes)}")
