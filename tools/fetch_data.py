#!/usr/bin/env python3
"""
Pobiera i normalizuje dane zaklęć z 5e-bits/5e-database (SRD 5.1 i SRD 5.2).

Użycie:
    python tools/fetch_data.py                               # klonuje repo (wymaga git)
    python tools/fetch_data.py C:\\sciezka\\do\\5e-database   # używa lokalnej kopii

Wynik: src/data/srd-2014.json i src/data/srd-2024.json (wspólny, odchudzony format;
opis w README.md, sekcja „Format danych”).
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data")
REPO = "https://github.com/5e-bits/5e-database.git"

HL_2024 = "Using a Higher-Level Spell Slot."
CU_2024 = "Cantrip Upgrade."
ARCANUM = {11: 6, 13: 7, 15: 8, 17: 9}  # poziom Warlocka -> poziom Mystic Arcanum


def load(repo, ver, name):
    with open(os.path.join(repo, "src", ver, "en", f"5e-SRD-{name}.json"), encoding="utf-8") as f:
        return json.load(f)


def paras(text):
    return [p.strip() for p in re.split(r"\n+", text or "") if p.strip()]


def dice_add(base, count, die):
    """'8d6' + 2 kostki d6 -> '10d6'; inna kostka -> dopisek."""
    m = re.fullmatch(r"(\d+)d(\d+)(.*)", base.strip())
    if m and int(m.group(2)) == die:
        return f"{int(m.group(1)) + count}d{die}{m.group(3)}"
    return f"{base} + {count}d{die}"


def upcast_table(base, level, text):
    """Tabela {slot: kości} z bazy i zdania 'increases by XdY for each (spell) slot level above N'."""
    m = re.search(r"increases? by (\d+)d(\d+) for each (?:spell )?slot level above (\d)", text or "")
    if not base or not m:
        return None
    n, die, above = int(m.group(1)), int(m.group(2)), int(m.group(3))
    out = {}
    for slot in range(max(level, 1), 10):
        extra = (slot - above) * n
        out[str(slot)] = base if extra <= 0 else dice_add(base, extra, die)
    return out


def cantrip_table(text):
    """'increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10)'."""
    m = re.findall(r"(5|11|17) \((\d+d\d+)\)", text or "")
    return {lv: d for lv, d in m} if len(m) == 3 else None


def save_of(text):
    m = re.search(r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw", text or "", re.I)
    return m.group(1).upper()[:3] if m else None


def norm_spell(s, ver):
    out = {
        "id": s["index"], "n": s["name"], "l": s["level"], "s": s["school"]["name"],
        "c": sorted(k["index"] for k in s.get("classes", [])),
        "ct": s["casting_time"], "r": s["range"], "cp": s.get("components", []),
        "d": s["duration"], "co": bool(s.get("concentration")), "ri": bool(s.get("ritual")),
    }
    if s.get("material"):
        out["m"] = s["material"]
    # błąd w danych źródłowych (2024): komponenty wklejone do zasięgu, np. "Touch Component: V, S"
    m = re.match(r"(.*?)\s*Components?:\s*(.+)$", out["r"])
    if m:
        out["r"] = m.group(1).strip()
        if not out["cp"]:
            out["cp"] = [c.strip() for c in m.group(2).split(",") if c.strip() in ("V", "S", "M")]
    if ver == "2014":
        desc = list(s.get("desc", []))
        hl = " ".join(s.get("higher_level", []))
        hl_label = "At Higher Levels"
        if s["level"] == 0 and len(desc) > 1 and re.search(r"damage increases by", desc[-1]):
            hl = desc.pop(); hl_label = "Cantrip scaling"
        if s.get("subclasses"):
            out["sc"] = sorted(k["name"] for k in s["subclasses"])
        if s.get("dc"):
            out["sv"] = s["dc"]["dc_type"]["name"]
    else:
        full = s.get("description", "")
        hl, hl_label = s.get("higher_level") or "", "Using a Higher-Level Spell Slot"
        for marker, label in ((HL_2024, "Using a Higher-Level Spell Slot"), (CU_2024, "Cantrip Upgrade")):
            if marker in full:
                full, tail = full.split(marker, 1)
                hl, hl_label = tail.strip(), label
        desc = paras(full)
        sv = save_of(full)
        if sv:
            out["sv"] = sv
    out["x"] = desc
    if hl:
        out["hl"] = hl.strip(); out["hlL"] = hl_label
    if s.get("attack_type"):
        out["at"] = s["attack_type"]

    # --- obrażenia / leczenie w ujednoliconym formacie ---
    dmg = s.get("damage")
    if isinstance(dmg, list):
        dmg = dmg[0] if dmg else None
    if dmg:
        t = (dmg.get("damage_type") or {}).get("name")
        if dmg.get("damage_at_character_level"):
            out["dm"] = {"t": t, "ch": dmg["damage_at_character_level"]}
        elif dmg.get("damage_at_slot_level"):
            tab = dict(dmg["damage_at_slot_level"])
            if ver == "2024" and s["level"] == 0:
                base = tab.get("0")
                ct = cantrip_table(hl)
                out["dm"] = {"t": t, "ch": ({"1": base, **ct} if ct else {"1": base})}
            elif ver == "2024":
                base = tab.get(str(s["level"]))
                out["dm"] = {"t": t, "sl": upcast_table(base, s["level"], hl) or tab}
            else:
                out["dm"] = {"t": t, "sl": tab}
    if s.get("heal_at_slot_level"):
        out["he"] = s["heal_at_slot_level"]
    elif ver == "2024" and s["level"] > 0:
        joined = " ".join(desc)
        m = re.search(r"(?:regains?|restoring) [^.]*?(\d+d\d+)", joined)
        if m:
            base = m.group(1) + (" + MOD" if "spellcasting ability modifier" in joined else "")
            gen = upcast_table(base, s["level"], hl)
            if gen:
                out["he"] = gen
    return out


def norm_classes(repo, ver):
    classes = load(repo, ver, "Classes")
    levels = load(repo, ver, "Levels")
    out = {}
    for c in classes:
        sc = c.get("spellcasting")
        if not sc:
            continue
        idx = c["index"]
        mode = ("known" if idx in ("bard", "sorcerer", "warlock", "ranger") else "prepared") \
            if ver == "2014" else "prepared"
        tab = {}
        for L in levels:
            if L.get("class", {}).get("index") != idx or L.get("subclass"):
                continue
            sp = L.get("spellcasting") or {}
            row = {"c": sp.get("cantrips_known", 0),
                   "s": [sp.get(f"spell_slots_level_{i}", 0) for i in range(1, 10)]}
            if "spells_known" in sp:
                row["k"] = sp["spells_known"]
            if "prepared_spells" in sp:
                row["p"] = sp["prepared_spells"]
            tab[str(L["level"])] = row
        info = {"n": c["name"], "ab": sc["spellcasting_ability"]["index"].upper(),
                "mode": mode, "from": sc.get("level", 1), "t": tab}
        if idx == "warlock":
            info["pact"] = True
            info["arc"] = {str(k): v for k, v in ARCANUM.items()}
        if ver == "2014" and mode == "prepared":
            info["prep"] = "half" if idx == "paladin" else "full"  # mod + poziom (lub połowa)
        out[idx] = info
    return out


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else None
    if not repo:
        repo = os.path.join(tempfile.mkdtemp(), "5e-database")
        subprocess.run(["git", "clone", "--depth", "1", "-q", REPO, repo], check=True)
    commit = subprocess.run(["git", "-C", repo, "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True).stdout.strip() or "?"
    os.makedirs(OUT, exist_ok=True)
    for ver, srd in (("2014", "SRD 5.1"), ("2024", "SRD 5.2")):
        spells = sorted((norm_spell(s, ver) for s in load(repo, ver, "Spells")), key=lambda x: x["n"])
        data = {"ver": ver, "srd": srd, "source": f"5e-bits/5e-database@{commit}",
                "classes": norm_classes(repo, ver), "spells": spells}
        path = os.path.join(OUT, f"srd-{ver}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{ver}: {len(spells)} zaklęć, {len(data['classes'])} klas -> {path} "
              f"({os.path.getsize(path)//1024} KB)")


if __name__ == "__main__":
    main()
