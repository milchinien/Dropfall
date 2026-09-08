"""Turn the generated upgrade atlases into transparent, game-ready PNGs."""

from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "upgrade-icons"
OUTPUT = ROOT / "public" / "assets" / "upgrade-icons"

SHEETS = [
    (
        "upgrade-atlas-01.png",
        [
            "whiteBall", "whiteValue", "whiteValueII", "whiteCombo", "whiteComboCap",
            "whiteRest", "whiteReturn", "whiteSeek", "sparkStart", "workshop",
            "shardLuck", "shardHarvest", "ballMastery", "ballMasteryII", "payout",
            "payoutII", "pegBounty", "pegBountyII", "payMult", "payMultII",
            "pulseBall", "pulseTempo", "pulseTempoII", "pulseRange", "pulseRangeII",
            "pulsePush",
        ],
    ),
    (
        "upgrade-atlas-02.png",
        [
            "pulseValue", "pulseEcho", "pulseCharge", "bounceValue", "bounceValueII",
            "bumperValue", "bumperKick", "yieldAll", "yieldAllII", "fireBall",
            "fireDur", "fireDurII", "fireCount", "fireCountII", "fireValue",
            "fireTick", "fireStackFall", "fireSpread", "lifeHeal", "lifeHealII",
            "royalLife", "royalLifeII", "slowDrain", "secondWind", "buffBall",
            "buffDur",
        ],
    ),
    (
        "upgrade-atlas-03.png",
        [
            "buffDurII", "buffPower", "buffPowerII", "buffSplash", "buffCarry",
            "buffSelf", "buffMark", "dropSpeed", "dropSpeedII", "launchPower",
            "markBall", "markValue", "markValueII", "markTube", "markHeal",
            "markShard", "markGrowth", "lightningBall", "boltChance", "boltChanceII",
            "boltTargets", "boltTargetsII", "boltRange", "boltValue", "boltFork",
            "boltFalloff",
        ],
    ),
]


def extract_cell(sheet: Image.Image, index: int) -> Image.Image:
    col, row = index % 5, index // 5
    left = round(col * sheet.width / 5)
    top = round(row * sheet.height / 6)
    right = round((col + 1) * sheet.width / 5)
    bottom = round((row + 1) * sheet.height / 6)
    cell = sheet.crop((left, top, right, bottom)).convert("RGB")

    # Generated atlases use white art on black. Luminance becomes alpha so the
    # live node fill can show through and automatically follow its state/color.
    alpha = cell.convert("L")
    alpha = ImageEnhance.Contrast(alpha).enhance(1.35)
    alpha = alpha.point(lambda value: 0 if value < 18 else value)
    # A few generated shapes slightly cross a grid boundary. Clear only the
    # outermost pixels so neighboring cells cannot leave slivers in the icon.
    edge = max(4, min(cell.size) // 32)
    alpha.paste(0, (0, 0, alpha.width, edge))
    alpha.paste(0, (0, alpha.height - edge, alpha.width, alpha.height))
    alpha.paste(0, (0, 0, edge, alpha.height))
    alpha.paste(0, (alpha.width - edge, 0, alpha.width, alpha.height))
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"empty atlas cell {index}")

    alpha = alpha.crop(bbox)
    icon = Image.new("RGBA", alpha.size, (255, 255, 255, 255))
    icon.putalpha(alpha)
    icon.thumbnail((104, 104), Image.Resampling.LANCZOS)

    result = Image.new("RGBA", (128, 128), (255, 255, 255, 0))
    x = (128 - icon.width) // 2
    y = (128 - icon.height) // 2
    result.alpha_composite(icon, (x, y))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, ids in SHEETS:
        with Image.open(SOURCE / filename) as sheet:
            for index, upgrade_id in enumerate(ids):
                extract_cell(sheet, index).save(
                    OUTPUT / f"{upgrade_id}.png", optimize=True
                )
    print(f"Wrote {sum(len(ids) for _, ids in SHEETS)} icons to {OUTPUT}")


if __name__ == "__main__":
    main()
