#!/usr/bin/env python3
"""Render Paper-Fu Defense Equipment card faces and GIMP-compatible ORA sources.

Each ORA keeps the card's paper construction, art, typography, stats, rules, and
catalog ID on separate layers.  The site consumes only the flattened WebP export;
the downloadable archives contain the editable source files.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import sys
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CARDS = json.loads((ROOT / "app/data/cards.json").read_text(encoding="utf-8"))["cards"]
WIDTH, HEIGHT = 550, 750
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
FONT_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"
FONT_REGULAR = FONT_DIR / "DejaVuSans.ttf"
FONT_ITALIC = FONT_DIR / "DejaVuSerif.ttf"

INK = "#28363a"
PAPER = "#fff2c4"
PAPER_LIGHT = "#fff8db"
ORANGE = "#e66e2f"
ORANGE_DARK = "#cf5128"
TEAL = "#258e8e"
PURPLE = "#8363a5"
GOLD = "#e4a747"
SHADOW = "#51483b"


@dataclass(frozen=True)
class Layer:
    name: str
    image: Image.Image
    visible: bool = True


def rgba() -> Image.Image:
    return Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def fit_font(draw: ImageDraw.ImageDraw, value: str, target: int, minimum: int, width: int, path: Path = FONT_BOLD) -> ImageFont.FreeTypeFont:
    for size in range(target, minimum - 1, -1):
        candidate = font(path, size)
        if draw.textbbox((0, 0), value, font=candidate)[2] <= width:
            return candidate
    return font(path, minimum)


def wrapped_lines(draw: ImageDraw.ImageDraw, value: str, typeface: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = value.replace("\n", " ").split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or draw.textbbox((0, 0), candidate, font=typeface)[2] <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_layer(name: str, value: str, box: tuple[int, int, int, int], typeface: ImageFont.FreeTypeFont, color: str = INK, *, align: str = "center", spacing: int = 2) -> Layer:
    image = rgba()
    draw = ImageDraw.Draw(image)
    x, y, w, h = box
    lines = wrapped_lines(draw, value, typeface, w)
    bbox = draw.multiline_textbbox((0, 0), "\n".join(lines), font=typeface, spacing=spacing, align=align)
    total_height = bbox[3] - bbox[1]
    start_y = y + max(0, (h - total_height) // 2)
    for index, line in enumerate(lines):
        line_bbox = draw.textbbox((0, 0), line, font=typeface)
        line_width = line_bbox[2] - line_bbox[0]
        draw_x = x if align == "left" else x + (w - line_width) // 2
        draw.text((draw_x, start_y + index * (typeface.size + spacing)), line, font=typeface, fill=color)
    return Layer(name, image)


def fitted_text_layer(name: str, value: str, box: tuple[int, int, int, int], target_size: int, minimum_size: int, color: str = INK, *, align: str = "left", spacing: int = 1) -> Layer:
    """Keep printed card text inside its paper panel without clipping."""
    x, y, w, h = box
    image = rgba()
    draw = ImageDraw.Draw(image)
    chosen_font = font(FONT_BOLD, minimum_size)
    chosen_lines: list[str] = []
    for size in range(target_size, minimum_size - 1, -1):
        candidate = font(FONT_BOLD, size)
        lines = wrapped_lines(draw, value, candidate, w)
        used_height = len(lines) * candidate.size + max(0, len(lines) - 1) * spacing
        if used_height <= h:
            chosen_font, chosen_lines = candidate, lines
            break
    else:
        chosen_lines = wrapped_lines(draw, value, chosen_font, w)
    used_height = len(chosen_lines) * chosen_font.size + max(0, len(chosen_lines) - 1) * spacing
    start_y = y + max(0, (h - used_height) // 2)
    for index, line in enumerate(chosen_lines):
        line_width = draw.textbbox((0, 0), line, font=chosen_font)[2]
        draw_x = x if align == "left" else x + (w - line_width) // 2
        draw.text((draw_x, start_y + index * (chosen_font.size + spacing)), line, font=chosen_font, fill=color)
    return Layer(name, image)


def polygon(draw: ImageDraw.ImageDraw, coords: list[tuple[int, int]], fill: str, outline: str = INK, width: int = 4) -> None:
    draw.polygon(coords, fill=fill)
    draw.line(coords + [coords[0]], fill=outline, width=width, joint="curve")


def rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, outline: str = INK, width: int = 4, radius: int = 0) -> None:
    if radius:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    else:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def shifted(points: list[tuple[int, int]], x: int = 5, y: int = 7) -> list[tuple[int, int]]:
    return [(px + x, py + y) for px, py in points]


def paper_shape(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: str, *, shadow_offset: tuple[int, int] = (6, 8)) -> None:
    sx, sy = shadow_offset
    draw.polygon(shifted(points, sx, sy), fill="#51483b80")
    polygon(draw, points, fill)


def card_shell(card: dict, kind: str) -> list[Layer]:
    base = rgba()
    draw = ImageDraw.Draw(base)
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=ORANGE)
    draw.rectangle((20, 20, WIDTH - 20, HEIGHT - 20), outline="#f4a259", width=2)
    draw.rectangle((26, 31, 504, 700), fill="#443f38")
    draw.rectangle((48, 48, 494, 697), fill=PAPER)
    draw.rectangle((49, 49, 492, 694), outline=INK, width=4)
    draw.rectangle((50, 51, 491, 55), fill="#f6d978")
    return [Layer("00 · Orange field", base)]

    
def template_layers(card: dict, kind: str) -> list[Layer]:
    shell = card_shell(card, kind)
    structure = rgba()
    draw = ImageDraw.Draw(structure)
    header = [(57, 56), (475, 56), (485, 70), (474, 122), (65, 122), (51, 99)]
    flavor = [(64, 132), (483, 130), (488, 172), (60, 174)]
    art = [(56, 178), (493, 178), (493, 467), (439, 478), (350, 467), (268, 482), (192, 467), (108, 478), (56, 467)]
    rules = [(64, 546), (487, 544), (491, 672), (64, 672)]
    paper_shape(draw, header, PAPER_LIGHT, shadow_offset=(2, 3))
    paper_shape(draw, flavor, "#fff9df", shadow_offset=(1, 2))
    paper_shape(draw, art, "#fff4ca", shadow_offset=(2, 3))
    paper_shape(draw, rules, "#fff8d6", shadow_offset=(2, 3))
    draw.line((72, 113, 443, 113), fill="#ea9a56", width=5)
    draw.line((72, 115, 443, 115), fill="#f7d47a", width=2)
    return shell + [Layer("01 · Paper card template", structure)]


def tab_layer(kind: str) -> Layer:
    image = rgba()
    draw = ImageDraw.Draw(image)
    polygon(draw, [(23, 203), (53, 194), (60, 372), (30, 383)], ORANGE_DARK)
    label = "ITEM · DEFENSE EQUIPMENT" if kind == "defense_equipment" else "ITEM · CONSUMABLE"
    label_image = Image.new("RGBA", (190, 30), (0, 0, 0, 0))
    label_draw = ImageDraw.Draw(label_image)
    typeface = fit_font(label_draw, label, 14, 9, 175)
    label_draw.text((8, 5), label, font=typeface, fill="#fff7d4")
    label_image = label_image.rotate(90, expand=True)
    image.alpha_composite(label_image, (20, 204))
    return Layer("02 · Card category tab", image)


def illustrated_art(card: dict) -> Layer:
    image = rgba()
    draw = ImageDraw.Draw(image)
    name = card["name"].lower()
    cx, cy = 276, 324
    # Every prop uses a small offset shadow and a bright paper cutout; tailored
    # cues keep cards recognizable even when they share an equipment slot.
    def ellipse(box, fill, outline=INK, width=4):
        draw.ellipse(box, fill=fill, outline=outline, width=width)
    def rrect(box, fill, radius=14, outline=INK, width=4):
        draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)
    def line(points, fill=INK, width=5):
        draw.line(points, fill=fill, width=width, joint="curve")
    def shadow_polygon(points):
        draw.polygon(shifted(points, 7, 9), fill="#4d453f55")
        polygon(draw, points, "#f6a54a")
    def helmet(color="#f5a24b", stripe="#fff1bc"):
        ellipse((cx - 105, cy - 80, cx + 105, cy + 90), "#4d453f55", outline="#4d453f55", width=1)
        ellipse((cx - 112, cy - 93, cx + 94, cy + 78), color)
        rrect((cx - 120, cy + 25, cx + 105, cy + 78), stripe, 12)
        line([(cx - 90, cy - 15), (cx + 78, cy - 15)], stripe, 9)
        rrect((cx + 28, cy - 80, cx + 78, cy - 27), "#ffcc66", 8)
    def chest(color="#3c9c98", accent="#f7bf55"):
        points = [(cx - 94, cy - 105), (cx + 94, cy - 105), (cx + 128, cy + 122), (cx, cy + 154), (cx - 128, cy + 122)]
        draw.polygon(shifted(points, 8, 9), fill="#4d453f55")
        polygon(draw, points, color)
        rrect((cx - 18, cy - 100, cx + 18, cy + 150), accent, 4)
        rrect((cx - 109, cy - 22, cx + 109, cy + 12), accent, 4)
        line([(cx - 84, cy + 40), (cx + 84, cy + 40)], "#dceccd", 4)
    def bracer(color="#9b6aa8"):
        pts = [(cx - 116, cy - 78), (cx + 88, cy - 128), (cx + 125, cy + 77), (cx - 77, cy + 125)]
        draw.polygon(shifted(pts, 8, 9), fill="#4d453f55")
        polygon(draw, pts, color)
        for t in (-38, 18, 73): line([(cx - 70 + t, cy - 63 + t // 4), (cx - 37 + t, cy + 78 + t // 4)], "#f7d78a", 5)
    def shield(color="#399b9a", circle=True):
        if circle:
            ellipse((cx - 115, cy - 115, cx + 115, cy + 115), "#4d453f55", outline="#4d453f55", width=1)
            ellipse((cx - 122, cy - 128, cx + 102, cy + 96), color)
            ellipse((cx - 69, cy - 76, cx + 48, cy + 40), "#f7d77b")
        else:
            pts = [(cx - 108, cy - 132), (cx + 103, cy - 112), (cx + 75, cy + 130), (cx - 87, cy + 110)]
            draw.polygon(shifted(pts, 8, 9), fill="#4d453f55")
            polygon(draw, pts, color)
            line([(cx - 73, cy - 63), (cx + 66, cy - 50)], "#f7d77b", 8)
    if any(key in name for key in ("helmet", "headgear", "kendo men", "traffic cone")):
        if "traffic cone" in name:
            shadow_polygon([(cx - 82, cy + 112), (cx + 88, cy + 112), (cx + 28, cy - 130), (cx - 28, cy - 130)])
            for offset in (18, 70): line([(cx - 60, cy + offset), (cx + 62, cy + offset)], "#fff0b8", 10)
        else:
            helmet("#f39a41" if "budget" in name else "#437f95", "#fff1bd")
            if "smaller" in name:
                for dx, dy in ((-65, -83), (28, -103), (75, -48)):
                    ellipse((cx + dx - 26, cy + dy - 20, cx + dx + 26, cy + dy + 20), "#f6ca62")
    elif any(key in name for key in ("bracer", "forearm", "kote", "cookie sheet", "mirror")):
        bracer("#8e6ca7" if "mirror" not in name else "#72b4c7")
        if "cookie" in name: rrect((cx - 74, cy - 51, cx + 80, cy + 62), "#c9d3d5", 10)
        if "mirror" in name: line([(cx - 82, cy - 46), (cx + 77, cy + 52)], "#f8efbc", 8)
    elif any(key in name for key in ("shin", "knee", "foot guard")):
        bracer("#4f9b98")
        rrect((cx - 122, cy + 62, cx + 105, cy + 102), "#f4be59", 10)
    elif any(key in name for key in ("shield", "buckler", "tupperware", "trash can lid", "pool noodle", "trophy")):
        shield("#27939a" if "pool" not in name else "#e5ba50", circle="pool" not in name)
        if "pool noodle" in name:
            ellipse((cx - 82, cy - 66, cx + 76, cy + 70), "#fff0bf", width=16)
        if "trophy" in name:
            rrect((cx - 47, cy - 62, cx + 50, cy + 34), "#f5bf53", 10)
            line([(cx, cy + 34), (cx, cy + 90)], "#f5bf53", 12)
    elif any(key in name for key in ("door", "clipboard", "sign", "phone book", "binder", "rope barrier")):
        shield("#b0675e" if "door" in name else "#6aa1b4", circle=False)
        if "clipboard" in name:
            rrect((cx - 35, cy - 132, cx + 36, cy - 90), "#e7bd57", 8)
        if "rope" in name:
            line([(cx - 110, cy + 55), (cx + 110, cy + 55)], "#9b6287", 14)
            for dx in (-105, 105): rrect((cx + dx - 15, cy + 50, cx + dx + 15, cy + 136), "#e8b85a", 6)
    elif any(key in name for key in ("pillow", "mouthguard", "stunt double", "cutout", "stare", "exit", "yoga mat", "groin")):
        if "pillow" in name:
            rrect((cx - 125, cy - 80, cx + 120, cy + 95), "#a06fac", 28)
            line([(cx - 65, cy - 30), (cx + 65, cy + 40)], "#f3d37b", 5)
        elif "mouthguard" in name:
            rrect((cx - 105, cy - 35, cx + 100, cy + 52), "#f1b959", 42)
            line([(cx - 69, cy + 10), (cx + 66, cy + 10)], "#fff6cf", 7)
        elif "stunt" in name or "cutout" in name:
            ellipse((cx - 43, cy - 123, cx + 43, cy - 36), "#f7d078")
            rrect((cx - 78, cy - 28, cx + 78, cy + 113), "#6ea4b0", 16)
            line([(cx - 62, cy + 34), (cx + 62, cy + 34)], "#f7d078", 7)
        elif "stare" in name:
            ellipse((cx - 126, cy - 72, cx + 126, cy + 82), "#fff6d3")
            for dx in (-55, 55): ellipse((cx + dx - 28, cy - 21, cx + dx + 28, cy + 34), "#e87534")
        elif "exit" in name:
            rrect((cx - 130, cy - 65, cx + 130, cy + 65), "#69af69", 10)
            polygon(draw, [(cx - 68, cy), (cx + 30, cy), (cx + 30, cy - 47), (cx + 118, cy + 8), (cx + 30, cy + 62), (cx + 30, cy + 18), (cx - 68, cy + 18)], "#fff4c4")
        elif "yoga" in name:
            rrect((cx - 70, cy - 145, cx + 70, cy + 145), "#4f9e9a", 26)
            line([(cx - 55, cy - 82), (cx + 55, cy - 82)], "#f1c665", 7)
        else:
            shield("#cf7b58", circle=True)
    else:
        color = "#3b9995" if "gi" in name or "hogu" in name else "#d8803b"
        chest(color)
        if "bubble" in name:
            for dx in (-64, 0, 64):
                for dy in (-55, 2, 58): ellipse((cx + dx - 17, cy + dy - 17, cx + dx + 17, cy + dy + 17), "#fff8df", outline="#8bc4c8", width=3)
        if "hoodie" in name:
            for offset in (-24, 0, 24): line([(cx - 95, cy - 77 + offset), (cx + 95, cy - 77 + offset)], "#795a9d", 7)
        if "sumo" in name:
            ellipse((cx - 147, cy - 135, cx + 147, cy + 151), "#e5b75e")
            ellipse((cx - 97, cy - 90, cx + 97, cy + 108), "#f8d57d")
    return Layer("04 · Paper-cut equipment illustration", image)


def stat_layer(card: dict, kind: str) -> Layer:
    image = rgba()
    draw = ImageDraw.Draw(image)
    stats = card.get("stats") or {}
    guard = str(stats.get("Guard", stats.get("Use", stats.get("Uses", "—"))))
    slot = str(stats.get("Slot", "Item"))
    cost = str(card.get("fpCost", "—"))
    blocks = [((62, 478, 196, 540), TEAL, "◎", cost), ((204, 478, 343, 540), PURPLE, "▣", guard), ((351, 478, 486, 540), GOLD, "▰", slot)]
    for box, color, symbol, value in blocks:
        rect(draw, box, color, radius=9)
        draw.text((box[0] + 13, box[1] + 14), symbol, font=font(FONT_BOLD, 26), fill="#fff6d4")
        typeface = fit_font(draw, value, 27 if len(value) < 5 else 18, 12, box[2] - box[0] - 52)
        draw.text((box[0] + 53, box[1] + (62 - typeface.size) // 2), value, font=typeface, fill="#fff8d8")
    return Layer("07 · Focus, Guard, and slot stats", image)


def footer_layer(card: dict) -> Layer:
    image = rgba()
    draw = ImageDraw.Draw(image)
    draw.text((65, 681), card["catalogId"], font=font(FONT_BOLD, 10), fill=INK)
    value = f"FOCUS VALUE {card.get('focusValue', '—')}"
    w = draw.textbbox((0, 0), value, font=font(FONT_BOLD, 9))[2]
    draw.text(((WIDTH - w) // 2, 684), value, font=font(FONT_BOLD, 9), fill=INK)
    draw.rectangle((386, 677, 482, 697), fill="#f5df83")
    draw.text((401, 682), "PAPER-FU v2.3", font=font(FONT_BOLD, 8), fill=INK)
    return Layer("12 · Catalog ID and footer", image)


def source_art_from_flat(card: dict) -> Layer:
    """Recover the existing Consumable illustration as a separate transparent layer."""
    card_id = card["catalogId"].lower()
    candidates = list((ROOT / "app/assets/cards/consumables").glob(f"{card_id}_*.webp"))
    if not candidates:
        raise FileNotFoundError(f"Missing published card face for {card['catalogId']}")
    flat = Image.open(candidates[0]).convert("RGBA")
    crop = flat.crop((56, 178, 494, 478))
    pixels = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, a = pixels[x, y]
            # The illustration field is warm cream; strip it while retaining the
            # colored cutouts and their narrow shadows.
            if r > 225 and g > 212 and b < 210 and abs(r - g) < 34:
                pixels[x, y] = (r, g, b, 0)
    image = rgba()
    image.alpha_composite(crop, (56, 178))
    return Layer("04 · Recovered paper-cut illustration", image)


def card_layers(card: dict, kind: str) -> list[Layer]:
    layers = template_layers(card, kind)
    layers.append(tab_layer(kind))
    layers.append(illustrated_art(card) if kind == "defense_equipment" else source_art_from_flat(card))
    title_canvas = rgba()
    title_draw = ImageDraw.Draw(title_canvas)
    title_font = fit_font(title_draw, card["name"].upper(), 29, 15, 380)
    title = text_layer("05 · Card title", card["name"].upper(), (70, 65, 390, 45), title_font)
    flavor = text_layer("06 · Flavor text", card.get("flavorText") or "", (72, 136, 402, 30), font(FONT_ITALIC, 13), color="#51453e", spacing=0)
    layers += [title, flavor, stat_layer(card, kind)]
    timing = text_layer("10 · Timing window", str(card.get("timing") or "EQUIP").upper(), (76, 550, 244, 28), font(FONT_BOLD, 15), color="#fff7d6", align="left")
    timing.image.alpha_composite(Image.new("RGBA", (260, 38), ORANGE), (62, 546))
    timing.image.alpha_composite(text_layer("timing copy", str(card.get("timing") or "EQUIP").upper(), (76, 550, 244, 28), font(FONT_BOLD, 15), color="#fff7d6", align="left").image)
    rules = fitted_text_layer("11 · Rules text", card.get("rulesText") or "", (79, 584, 383, 77), 16, 11, color=INK, align="left", spacing=1)
    layers += [timing, rules, footer_layer(card)]
    return layers


def merged(layers: Iterable[Layer]) -> Image.Image:
    image = rgba()
    for layer in layers:
        if layer.visible:
            image.alpha_composite(layer.image)
    return image


def write_ora(destination: Path, card: dict, layers: list[Layer]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    merged_image = merged(layers)
    thumbnail = merged_image.copy()
    thumbnail.thumbnail((128, 128), Image.Resampling.LANCZOS)
    xml = [f'<image w="{WIDTH}" h="{HEIGHT}" name="{card["catalogId"]} · {card["name"]}"><stack name="Paper-Fu editable card">']
    # ORA stacks are bottom-to-top, while GIMP displays topmost first.
    for index, layer in enumerate(layers):
        xml.append(f'<layer name="{layer.name}" src="data/layer{index:02d}.png" opacity="1.0" visibility="{"visible" if layer.visible else "hidden"}" composite-op="svg:src-over"/>')
    xml.append("</stack></image>")
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.writestr("mimetype", "image/openraster", compress_type=zipfile.ZIP_STORED)
        archive.writestr("stack.xml", "\n".join(xml))
        for index, layer in enumerate(layers):
            buffer = __import__("io").BytesIO()
            layer.image.save(buffer, format="PNG")
            archive.writestr(f"data/layer{index:02d}.png", buffer.getvalue())
        buffer = __import__("io").BytesIO()
        merged_image.save(buffer, format="PNG")
        archive.writestr("mergedimage.png", buffer.getvalue())
        buffer = __import__("io").BytesIO()
        thumbnail.save(buffer, format="PNG")
        archive.writestr("Thumbnails/thumbnail.png", buffer.getvalue())


def archive_ora(source_dir: Path, destination: Path, title: str) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.writestr("README.txt", f"{title}\n\nOpen any .ora file in GIMP. Each card has independent template, illustration, title, flavor, stat, timing, rules, and catalog-ID layers.\n")
        for source in sorted(source_dir.glob("*.ora")):
            archive.write(source, source.name)


def build_defense_equipment(output: Path) -> None:
    source_dir = output / "defense-equipment"
    web_dir = ROOT / "app/assets/cards/defense-equipment"
    web_dir.mkdir(parents=True, exist_ok=True)
    cards = [card for card in CARDS if card.get("catalogId", "").startswith("DDB-DEQ-CORE-")]
    if len(cards) != 46:
        raise RuntimeError(f"Expected 46 Defense Equipment cards, found {len(cards)}")
    for card in cards:
        base = f"{card['catalogId'].lower()}_{slug(card['name'])}"
        layers = card_layers(card, "defense_equipment")
        write_ora(source_dir / f"{base}.ora", card, layers)
        merged(layers).convert("RGB").save(web_dir / f"{base}.webp", "WEBP", quality=88, method=6)
    archive_ora(source_dir, ROOT / "public/downloads/Dojo_Deckbuilder_v2.3_Defensive_Equipment_Editable_ORA.zip", "Dojo Deckbuilder v2.3 — Defensive Equipment Editable Sources")


def build_consumable_sources(output: Path) -> None:
    source_dir = output / "consumables"
    cards = [card for card in CARDS if card.get("catalogId", "").startswith("DDB-CON-CORE-")]
    if len(cards) != 62:
        raise RuntimeError(f"Expected 62 Consumable cards, found {len(cards)}")
    for card in cards:
        base = f"{card['catalogId'].lower()}_{slug(card['name'])}"
        write_ora(source_dir / f"{base}.ora", card, card_layers(card, "consumable"))
    archive_ora(source_dir, ROOT / "public/downloads/Dojo_Deckbuilder_v2.3_Consumable_Cards_Editable_ORA.zip", "Dojo Deckbuilder v2.3 — Consumable Editable Sources")


def main() -> int:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".generated-editable-cards"
    if output.exists():
        shutil.rmtree(output)
    build_defense_equipment(output)
    build_consumable_sources(output)
    print("Created 46 Defense Equipment card faces and 108 editable ORA source files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
