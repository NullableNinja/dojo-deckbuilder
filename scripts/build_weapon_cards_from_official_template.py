#!/usr/bin/env python3
"""Build a five-card Weapon micro-batch from the supplied official ORA template.

The source template is never reconstructed: each output starts from its exact
OpenRaster package and replaces only the CONTENT text layers and the designated
ARTWORK / graphic layer. All card-stock, panel, fastener, frame, icon, and
scrap layers are retained byte-for-byte from the approved source template.
"""
from __future__ import annotations

import io
import json
import os
import re
import unicodedata
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "app/assets/templates/05_Item_Equipable.ora"
CATALOG = json.loads((ROOT / "content/cards.json").read_text(encoding="utf-8"))["cards"]
SIZE = (825, 1125)
BATCH_NUMBER = os.environ.get("DDB_BATCH_NUMBER", "001")
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"
SERIF = FONT_DIR / "DejaVuSerif.ttf"
INK = "#26383c"

def empty(): return Image.new("RGBA", SIZE, (0, 0, 0, 0))
def font(size, face=BOLD): return ImageFont.truetype(str(face), size)
def slug(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
def wrap(draw, text, typeface, width):
    rows, current = [], ""
    for word in text.replace("\n", " ").split():
        candidate = f"{current} {word}".strip()
        if not current or draw.textbbox((0, 0), candidate, font=typeface)[2] <= width: current = candidate
        else: rows.append(current); current = word
    return rows + ([current] if current else [])
def text_layer(text, box, initial, minimum, *, face=BOLD, fill=INK, align="left", leading=3):
    image, draw = empty(), ImageDraw.Draw(empty())
    image = empty(); draw = ImageDraw.Draw(image)
    x, y, width, height = box
    for size in range(initial, minimum - 1, -1):
        typeface = font(size, face); rows = wrap(draw, text, typeface, width)
        if len(rows) * typeface.size + max(0, len(rows) - 1) * leading <= height: break
    used = len(rows) * typeface.size + max(0, len(rows) - 1) * leading
    start_y = y + max(0, (height - used) // 2)
    for index, row in enumerate(rows):
        row_width = draw.textbbox((0, 0), row, font=typeface)[2]
        draw_x = x if align == "left" else x + (width - row_width) // 2
        draw.text((draw_x, start_y + index * (typeface.size + leading)), row, font=typeface, fill=fill)
    return image
def art_layer(card):
    source = list((ROOT / "app/assets/art/weapons/source").glob(f"{card['catalogId'].lower()}_*.png"))
    if len(source) != 1: raise RuntimeError(f"Expected one source image for {card['catalogId']}; found {len(source)}")
    raw = Image.open(source[0]).convert("RGBA")
    raw.thumbnail((470, 405), Image.Resampling.LANCZOS)
    image = empty(); image.alpha_composite(raw, ((SIZE[0] - raw.width) // 2, 310 + (405 - raw.height) // 2))
    return image
def chip_values(card):
    image = empty(); draw = ImageDraw.Draw(image)
    stats = card.get("stats") or {}; values = [str(card["fpCost"]), f"+{stats.get('Attack Bonus', '—')}", f"{stats.get('Hands', '—')} HANDS"]
    boxes = [(207,744,89,48), (410,744,112,48), (590,744,120,48)]
    for value, (x,y,w,h) in zip(values, boxes):
        value_font = font(28 if len(value) < 5 else 17)
        value_width = draw.textbbox((0,0), value, font=value_font)[2]
        draw.text((x + (w - value_width)//2, y + (h-value_font.size)//2), value, font=value_font, fill="#fff9df")
    return image
def footer(card):
    image = empty(); draw = ImageDraw.Draw(image)
    draw.text((100,1030), card["catalogId"], font=font(11), fill="#516169")
    return image
def timing(card):
    hands = str((card.get("stats") or {}).get("Hands", "1"))
    label = f"EQUIP — {'TWO-HANDED' if hands == '2' else 'ONE-HANDED'}"
    return text_layer(label, (111,839,365,25), 17, 12, fill="#fff8d7")
def replacements(card):
    return {
        "data/layer_001.png": footer(card),
        "data/layer_002.png": text_layer(card["rulesText"], (117,887,565,103), 22, 14, leading=4),
        "data/layer_003.png": timing(card),
        "data/layer_005.png": chip_values(card),
        "data/layer_008.png": text_layer(card.get("flavorText") or "", (157,217,505,33), 15, 11, face=SERIF, fill="#5a554a", align="center", leading=1),
        "data/layer_010.png": text_layer(card["name"].upper(), (108,116,570,42), 30, 16, align="center"),
        "data/layer_015.png": art_layer(card),
    }
def composite(entries):
    image = empty()
    # The official ORA stack lists topmost layers first, so render in reverse.
    for path in reversed([f"data/layer_{number:03d}.png" for number in range(1, 21)]):
        if path == "data/layer_013.png": continue  # Starter tag group is hidden in source template.
        image.alpha_composite(entries[path])
    return image
def write_ora(card, destination):
    with zipfile.ZipFile(TEMPLATE) as source:
        entries = {name: Image.open(io.BytesIO(source.read(name))).convert("RGBA") for name in source.namelist() if name.startswith("data/") and name.endswith(".png")}
        entries.update(replacements(card)); merged = composite(entries); thumbnail = merged.copy(); thumbnail.thumbnail((160, 160), Image.Resampling.LANCZOS)
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            for name in source.namelist():
                if name == "mimetype": output.writestr(name, source.read(name), compress_type=zipfile.ZIP_STORED)
                elif name == "mergedimage.png":
                    data = io.BytesIO(); merged.save(data, "PNG"); output.writestr(name, data.getvalue())
                elif name == "Thumbnails/thumbnail.png":
                    data = io.BytesIO(); thumbnail.save(data, "PNG"); output.writestr(name, data.getvalue())
                elif name in entries:
                    data = io.BytesIO(); entries[name].save(data, "PNG"); output.writestr(name, data.getvalue())
                else: output.writestr(name, source.read(name))
    return merged
def main():
    requested = {item.strip().upper() for item in os.environ.get("DDB_CARD_IDS", "").split(",") if item.strip()}
    cards = [item for item in CATALOG if item.get("catalogId") in requested and item.get("subtype") == "Weapon"]
    if not cards or len(cards) > 5 or {item["catalogId"] for item in cards} != requested: raise RuntimeError("Use one canonical Weapon micro-batch of one to five cards")
    if not TEMPLATE.exists(): raise FileNotFoundError(f"Official Item Equipable template is missing: {TEMPLATE}")
    final_dir = ROOT / "app/assets/cards/weapons"; source_dir = ROOT / ".generated-editable-cards/weapons"; final_dir.mkdir(parents=True, exist_ok=True); source_dir.mkdir(parents=True, exist_ok=True)
    built = []
    for card in sorted(cards, key=lambda item: item["catalogId"]):
        stem = f"{card['catalogId'].lower()}_{slug(card['name'])}"; merged = write_ora(card, source_dir / f"{stem}.ora"); merged.convert("RGB").save(final_dir / f"{stem}.webp", "WEBP", quality=95, method=6); built.append(stem)
    download_dir = ROOT / "public/downloads"; download_dir.mkdir(parents=True, exist_ok=True)
    for stem in built:
        archive = download_dir / f"Dojo_Deckbuilder_Weapons_Batch_{BATCH_NUMBER}_{stem}_Editable_ORA.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            output.writestr("README.txt", f"Weapon Batch {BATCH_NUMBER}. This editable ORA was built directly from the official 05_Item_Equipable.ora template, retained at app/assets/templates/05_Item_Equipable.ora. Open the ORA in GIMP for the original layer groups and editable artwork/text layers.\n")
            output.write(source_dir / f"{stem}.ora", f"Layered Sources/Weapons/{stem}.ora")
    print(f"Built {len(built)} Weapon cards directly from the official Item Equipable template.")
if __name__ == "__main__": main()
