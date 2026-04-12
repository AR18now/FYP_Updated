from pathlib import Path
from PIL import Image, ImageFilter, ImageOps


def remove_light_bg(img: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (r, g, b, 0)
    return rgba


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def enhance(img: Image.Image, scale: int = 2) -> Image.Image:
    up = img.resize((img.width * scale, img.height * scale), Image.Resampling.LANCZOS)
    up = up.filter(ImageFilter.UnsharpMask(radius=1.6, percent=180, threshold=2))
    return up


def main() -> None:
    src = Path(
        r"c:\Users\hamal\.cursor\projects\c-Users-hamal-Music-FYP\assets\c__Users_hamal_AppData_Roaming_Cursor_User_workspaceStorage_681ab12078798706c00323ed838122e3_images_logo-820af38d-f45e-4b8e-8233-e8caf9e18b8d.png"
    )
    out_dir = Path(r"c:\Users\hamal\Music\FYP\frontend\public")
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(src)
    cleaned = trim_transparent(remove_light_bg(img, threshold=244))
    enhanced = enhance(cleaned, scale=2)

    cleaned_path = out_dir / "req2design_logo_clean.png"
    enhanced_path = out_dir / "req2design_logo_clean_2x.png"
    cleaned.save(cleaned_path, format="PNG")
    enhanced.save(enhanced_path, format="PNG")

    print(f"Saved: {cleaned_path}")
    print(f"Saved: {enhanced_path}")


if __name__ == "__main__":
    main()
