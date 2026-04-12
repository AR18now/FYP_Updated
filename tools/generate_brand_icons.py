from pathlib import Path
from PIL import Image


def main() -> None:
    public_dir = Path(r"c:\Users\hamal\Music\FYP\frontend\public")
    src = public_dir / "req2design_logo_clean_2x.png"
    if not src.exists():
        raise FileNotFoundError(f"Missing source logo: {src}")

    img = Image.open(src).convert("RGBA")

    # Crop transparent margins first.
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    def make_square_icon(size: int) -> Image.Image:
        # Fit logo with padding into square transparent canvas.
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        max_side = int(size * 0.78)
        tmp = img.copy()
        tmp.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        x = (size - tmp.width) // 2
        y = (size - tmp.height) // 2
        canvas.paste(tmp, (x, y), tmp)
        return canvas

    icon64 = make_square_icon(64)
    icon192 = make_square_icon(192)
    icon512 = make_square_icon(512)

    icon64.save(public_dir / "favicon.png", format="PNG")
    icon192.save(public_dir / "logo192.png", format="PNG")
    icon512.save(public_dir / "logo512.png", format="PNG")

    print("Generated favicon.png, logo192.png, logo512.png")


if __name__ == "__main__":
    main()
