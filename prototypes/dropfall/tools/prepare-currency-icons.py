"""Prepare the generated currency art as exact two-color UI assets."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "currency-icons"
OUTPUT = ROOT / "public" / "assets" / "currency-icons"

# Thresholds separate the deliberately brighter face from the darker accent.
ICONS = {
    "spark": ("spark-source.png", "#2ed3ae", "#1b9c80", 145),
    "money": ("money-source.png", "#edb443", "#b8871f", 168),
    "shard": ("shard-source.png", "#6fa8ff", "#3c6dc0", 130),
    "crown": ("crown-source.png", "#e4348f", "#a61f66", 78),
}


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def prepare(source: Path, light: str, dark: str, threshold: int) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"No visible art in {source}")

    image = image.crop(bbox)
    light_rgb, dark_rgb = hex_rgb(light), hex_rgb(dark)
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            luminance = round(0.2126 * r + 0.7152 * g + 0.0722 * b)
            color = light_rgb if luminance >= threshold else dark_rgb
            pixels[x, y] = (*color, a)

    image.thumbnail((112, 112), Image.Resampling.LANCZOS)
    # Lanczos may introduce intermediary RGB values at facet boundaries.
    # Snap them back to the same two-color palette while retaining soft alpha.
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            light_distance = sum((v - p) ** 2 for v, p in zip((r, g, b), light_rgb))
            dark_distance = sum((v - p) ** 2 for v, p in zip((r, g, b), dark_rgb))
            pixels[x, y] = (*(light_rgb if light_distance <= dark_distance else dark_rgb), a)

    result = Image.new("RGBA", (128, 128), (255, 255, 255, 0))
    result.alpha_composite(image, ((128 - image.width) // 2, (128 - image.height) // 2))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (filename, light, dark, threshold) in ICONS.items():
        prepare(SOURCE / filename, light, dark, threshold).save(
            OUTPUT / f"{name}.png", optimize=True
        )
    print(f"Wrote {len(ICONS)} currency icons to {OUTPUT}")


if __name__ == "__main__":
    main()
