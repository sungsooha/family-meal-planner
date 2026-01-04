
import argparse
import json
import uuid
from datetime import datetime
from pathlib import Path

import yt_dlp

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "recipe_sources"


def _unique_path(base_path):
    if not base_path.exists():
        return base_path
    stem = base_path.stem
    suffix = base_path.suffix
    for idx in range(2, 100):
        candidate = base_path.with_name(f"{stem}-{idx}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Too many duplicate filenames.")


def _clean_text(text):
    if not text:
        return ""
    return text.replace("\u2800", "").strip()


def _build_prompt(title, comment_text, description):
    title = _clean_text(title)
    comment_text = _clean_text(comment_text)
    description = _clean_text(description)
    return (
        "Extract a recipe from the text below. Use recipe information from the "
        "video description or the top comment (whichever actually contains "
        "ingredients/steps). Ignore promotions, shopping links, and unrelated "
        "announcements. If both contain recipe info, merge them.\n\n"
        "Return ONLY valid JSON with keys: name, meal_types, servings, ingredients, "
        "ingredients_original, instructions, instructions_original.\n"
        "- meal_types is an array of one or more values like breakfast, lunch, dinner, snack.\n"
        "- servings is a number indicating how many people the recipe serves.\n"
        "- ingredients and ingredients_original are arrays of {name, quantity, unit}.\n"
        "- instructions and instructions_original are arrays of strings.\n"
        "- Translate to English for ingredients/instructions and keep the original "
        "language in the *_original fields. If translation is unclear, repeat the "
        "original.\n"
        "- Quantities should be numeric when possible, else 0.\n\n"
        f"Title:\n{title}\n\n"
        f"Top comment:\n{comment_text}\n\n"
        f"Description:\n{description}"
    )


def collect_youtube(url):
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extractor_args": {"youtube": {"comment_sort": "top"}},
        "getcomments": True,
        "max_comments": 1,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    title = _clean_text(info.get("title") or "YouTube recipe")
    description = _clean_text(info.get("description") or "")
    comments = info.get("comments") or []
    comment_text = _clean_text(comments[0].get("text") if comments else "")
    thumbnail = info.get("thumbnail") or ""
    return title, description, comment_text, thumbnail


def _existing_source(url):
    if not DATA_DIR.exists():
        return None
    for path in DATA_DIR.glob("*_source.json"):
        try:
            with path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
            if payload.get("source_url") == url:
                return path
        except (json.JSONDecodeError, OSError):
            continue
    return None


def main():
    parser = argparse.ArgumentParser(description="Collect recipe source text.")
    parser.add_argument("url", help="YouTube URL")
    parser.add_argument(
        "--source", default="youtube", choices=["youtube"], help="Source type"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-collect even if the source already exists.",
    )
    args = parser.parse_args()

    if args.source != "youtube":
        raise SystemExit("Only youtube is supported for now.")

    existing = _existing_source(args.url)
    if existing and not args.force:
        print(f"Source already collected: {existing}")
        return

    title, description, comment_text, thumbnail = collect_youtube(args.url)
    recipe_id = uuid.uuid4().hex
    payload = {
        "recipe_id": recipe_id,
        "source": args.source,
        "source_url": args.url,
        "title": title,
        "description": description,
        "top_comment": comment_text,
        "thumbnail_url": thumbnail,
        "collected_at": datetime.now().isoformat(timespec="seconds"),
        "prompt": _build_prompt(title, comment_text, description),
    }

    base_name = recipe_id
    target = _unique_path(DATA_DIR / f"{base_name}_source.json")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True, ensure_ascii=False)

    prompt_path = _unique_path(DATA_DIR / f"{base_name}_prompt.txt")
    with prompt_path.open("w", encoding="utf-8") as f:
        f.write(payload["prompt"])

    print(f"Saved: {target}")
    print(f"Prompt: {prompt_path}")


if __name__ == "__main__":
    main()
