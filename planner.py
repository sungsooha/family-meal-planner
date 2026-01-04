import json
import os
import random
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
RECIPES_DIR = DATA_DIR / "recipes"
LEGACY_RECIPES_FILE = DATA_DIR / "recipes.json"
PLAN_FILE = DATA_DIR / "weekly_plan.json"
HISTORY_FILE = DATA_DIR / "weekly_plans.json"
YOUTUBE_CACHE_FILE = DATA_DIR / "youtube_cache.json"
CONFIG_FILE = DATA_DIR / "config.json"
RECIPE_SOURCES_DIR = DATA_DIR / "recipe_sources"
SHOPPING_FILE = DATA_DIR / "shopping_list.json"


def _load_json(path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path, payload):
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True, ensure_ascii=False)


def load_config():
    return _load_json(
        CONFIG_FILE,
        {
            "family_size": 4,
            "max_repeat_per_week": 2,
            "allow_repeats_if_needed": True,
        },
    )


def _normalize_recipe(recipe):
    normalized = dict(recipe)
    if not normalized.get("recipe_id"):
        normalized["recipe_id"] = _slugify(normalized.get("name", "recipe"))
    if normalized.get("meal_types") is None:
        meal_type = normalized.get("meal_type")
        normalized["meal_types"] = [meal_type] if meal_type else []
    normalized["ingredients"] = _sanitize_ingredients(normalized.get("ingredients"))
    normalized["ingredients_original"] = _sanitize_ingredients(
        normalized.get("ingredients_original")
    )
    return normalized


def load_recipes():
    recipes = []
    if RECIPES_DIR.exists():
        for path in sorted(RECIPES_DIR.glob("*.json")):
            data = _load_json(path, None)
            if isinstance(data, list):
                recipes.extend([_normalize_recipe(item) for item in data])
            elif isinstance(data, dict):
                recipes.append(_normalize_recipe(data))
    if not recipes and LEGACY_RECIPES_FILE.exists():
        legacy = _load_json(LEGACY_RECIPES_FILE, [])
        if isinstance(legacy, list):
            recipes.extend([_normalize_recipe(item) for item in legacy])
    return recipes


def has_recipe_id(recipe_id):
    if not recipe_id:
        return False
    for recipe in load_recipes():
        if recipe.get("recipe_id") == recipe_id:
            return True
    return False


def get_recipe_by_id(recipe_id):
    if not recipe_id:
        return None
    for recipe in load_recipes():
        if recipe.get("recipe_id") == recipe_id:
            return recipe
    return None


def get_recipe_path(recipe_id):
    if not recipe_id or not RECIPES_DIR.exists():
        return None
    for path in RECIPES_DIR.glob("*.json"):
        data = _load_json(path, None)
        if isinstance(data, dict) and data.get("recipe_id") == recipe_id:
            return path
    return None


def update_recipe(recipe_id, payload):
    path = get_recipe_path(recipe_id)
    if not path:
        return False
    payload = _normalize_recipe(payload)
    _save_json(path, payload)
    return True


def load_recipe_source(recipe_id):
    if not recipe_id:
        return None
    path = RECIPE_SOURCES_DIR / f"{recipe_id}_source.json"
    if path.exists():
        return _load_json(path, None)
    matches = list(RECIPE_SOURCES_DIR.glob(f"*{recipe_id}*_source.json"))
    if not matches:
        return None
    return _load_json(matches[0], None)


def _slugify(text, max_len=60):
    text = text.strip().lower()
    text = re.sub(r"[^\w\s\-\uac00-\ud7a3]+", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s_]+", "-", text)
    text = text.strip("-")
    if not text:
        return "recipe"
    return text[:max_len]


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


def add_recipe(recipe):
    RECIPES_DIR.mkdir(parents=True, exist_ok=True)
    recipe = _normalize_recipe(recipe)
    name = recipe.get("name", "")
    slug = _slugify(name)
    path = _unique_path(RECIPES_DIR / f"{slug}.json")
    _save_json(path, recipe)
    return recipe


def load_youtube_cache():
    return _load_json(YOUTUBE_CACHE_FILE, {})


def save_youtube_cache(cache):
    _save_json(YOUTUBE_CACHE_FILE, cache)


def _parse_ingredients_from_comment(text):
    if not text:
        return []
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip().lstrip("-•*").strip()
        if line:
            lines.append(line)

    ingredients = []
    start_index = 0
    for idx, line in enumerate(lines):
        if "ingredient" in line.lower():
            if ":" in line:
                parts = line.split(":", 1)[1].strip()
                for item in parts.split(","):
                    name = item.strip()
                    if name:
                        ingredients.append({"name": name, "quantity": 0, "unit": ""})
                return ingredients
            start_index = idx + 1
            break

    for line in lines[start_index:]:
        lower = line.lower()
        if lower.startswith(("method", "instructions", "directions")):
            break
        if lower.startswith("http"):
            continue
        ingredients.append({"name": line, "quantity": 0, "unit": ""})
        if len(ingredients) >= 20:
            break
    return ingredients


def _extract_json_payload(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[1].strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in response.")
    return cleaned[start : end + 1]


def _normalize_recipe_payload(payload):
    ingredients = payload.get("ingredients") or []
    ingredients_original = payload.get("ingredients_original") or ingredients
    instructions = payload.get("instructions") or []
    instructions_original = payload.get("instructions_original") or instructions
    payload["ingredients"] = ingredients
    payload["ingredients_original"] = ingredients_original
    payload["instructions"] = instructions
    payload["instructions_original"] = instructions_original
    return payload


def _clean_field(value):
    if value is None:
        return ""
    text = str(value).strip()
    if "\\n" in text:
        text = text.split("\\n", 1)[0].strip()
    return text


def _sanitize_ingredients(items):
    sanitized = []
    for item in items or []:
        name = _clean_field(item.get("name"))
        unit = _clean_field(item.get("unit"))
        quantity = item.get("quantity", 0)
        sanitized.append({"name": name, "quantity": quantity, "unit": unit})
    return sanitized


def _normalize_unit(unit):
    unit = (unit or "").strip()
    unit_lower = unit.lower()
    aliases = {
        "g": "g",
        "gram": "g",
        "grams": "g",
        "그램": "g",
        "kg": "kg",
        "kilogram": "kg",
        "kilograms": "kg",
        "킬로그램": "kg",
        "ml": "ml",
        "milliliter": "ml",
        "milliliters": "ml",
        "밀리리터": "ml",
        "l": "l",
        "liter": "l",
        "liters": "l",
        "리터": "l",
        "tbsp": "tbsp",
        "tablespoon": "tbsp",
        "tablespoons": "tbsp",
        "큰술": "tbsp",
        "스푼": "tbsp",
        "tsp": "tsp",
        "teaspoon": "tsp",
        "teaspoons": "tsp",
        "작은술": "tsp",
        "t": "tbsp",
        "count": "count",
        "piece": "count",
        "pieces": "count",
        "pcs": "count",
        "ea": "count",
    }
    return aliases.get(unit_lower, unit_lower)


def _normalize_quantity_unit(quantity, unit):
    unit = _normalize_unit(unit)
    if unit == "kg":
        return quantity * 1000, "g"
    if unit == "l":
        return quantity * 1000, "ml"
    if unit == "tsp":
        return quantity / 3, "tbsp"
    return quantity, unit


def _unit_group(unit):
    if unit in ("g",):
        return "weight"
    if unit in ("ml",):
        return "volume"
    if unit in ("tbsp",):
        return "spoon"
    if unit in ("count", ""):
        return "count"
    return unit


def _round_quantity(value):
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return value

def _parse_recipe_with_openai(source_text, title):
    if not source_text:
        return None
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")

    try:
        import requests
    except ImportError as exc:
        raise RuntimeError("requests is not installed.") from exc

    prompt = (
        "Extract a recipe from the text. Return ONLY valid JSON with keys: "
        "name, meal_type, ingredients, ingredients_original, instructions, "
        "instructions_original. "
        "ingredients and ingredients_original are arrays of {name, quantity, unit}. "
        "instructions and instructions_original are arrays of strings. "
        "Translate to English for ingredients/instructions, keep original language "
        "in the *_original fields. If translation is unclear, repeat the original. "
        "Use meal_type in [breakfast, lunch, dinner]. "
        "Quantities should be numeric when possible, else 0.\n\n"
        f"Title: {title}\n\n"
        f"Text:\n{source_text[:5000]}"
    )

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "You output JSON only."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(f"OpenAI API error: {response.status_code} {response.text}")
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(_extract_json_payload(content))
    return _normalize_recipe_payload(parsed)


def fetch_recipe_from_youtube(url):
    try:
        import yt_dlp
    except ImportError as exc:
        raise RuntimeError("yt-dlp is not installed.") from exc
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extractor_args": {"youtube": {"comment_sort": "top"}},
        "getcomments": True,
        "max_comments": 1,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch YouTube data: {exc}") from exc

    title = info.get("title") or "YouTube recipe"
    comments = info.get("comments") or []
    comment_text = comments[0].get("text") if comments else ""
    description = info.get("description") or ""
    source_text = f"Top comment:\n{comment_text}\n\nDescription:\n{description}"
    recipe = _parse_recipe_with_openai(source_text, title)

    if not recipe:
        return None

    return {
        "name": recipe.get("name") or title,
        "meal_type": recipe.get("meal_type", "dinner"),
        "ingredients": recipe.get("ingredients", []),
        "ingredients_original": recipe.get("ingredients_original", []),
        "instructions": recipe.get("instructions", []),
        "instructions_original": recipe.get("instructions_original", []),
        "source_comment": comment_text,
    }


def extract_recipe_from_youtube(url):
    cache = load_youtube_cache()
    if url in cache:
        cached = cache.get(url)
        if cached and (cached.get("instructions") or cached.get("ingredients_original")):
            return cached

    recipe = fetch_recipe_from_youtube(url)
    if recipe:
        cache[url] = recipe
        save_youtube_cache(cache)
    return recipe


def _week_start(target_date=None):
    target_date = target_date or date.today()
    return target_date - timedelta(days=target_date.weekday())


def _parse_date(date_str):
    try:
        return datetime.fromisoformat(date_str).date()
    except (TypeError, ValueError):
        return None


def _pick_recipe(candidates, usage_counts, max_repeat):
    random.shuffle(candidates)
    for recipe in candidates:
        if usage_counts[recipe["name"]] < max_repeat:
            return recipe
    return None


def generate_weekly_plan(start_date=None):
    config = load_config()
    recipes = load_recipes()
    if not recipes:
        raise ValueError("No recipes available in data/recipes.json")

    by_meal = defaultdict(list)
    for recipe in recipes:
        meal_types = recipe.get("meal_types") or []
        legacy = recipe.get("meal_type")
        if legacy and legacy not in meal_types:
            meal_types.append(legacy)
        for meal_type in meal_types:
            by_meal[meal_type].append(recipe)

    week_start = start_date or _week_start()
    usage_counts = defaultdict(int)
    days = []

    for day_offset in range(7):
        day_date = week_start + timedelta(days=day_offset)
        meals = {}
        used_ids = set()
        for meal_type in ("breakfast", "lunch", "dinner"):
            candidates = by_meal.get(meal_type, [])
            if not candidates:
                meals[meal_type] = None
                continue
            available = [
                recipe
                for recipe in candidates
                if usage_counts[recipe["name"]] < config["max_repeat_per_week"]
                and recipe.get("recipe_id") not in used_ids
            ]
            recipe = _pick_recipe(
                available,
                usage_counts,
                config["max_repeat_per_week"],
            )
            if recipe is None:
                meals[meal_type] = None
                continue
            usage_counts[recipe["name"]] += 1
            used_ids.add(recipe.get("recipe_id"))
            meals[meal_type] = {
                "recipe_id": recipe.get("recipe_id"),
                "name": recipe["name"],
                "ingredients": recipe["ingredients"],
                "locked": False,
            }
        days.append({"date": day_date.isoformat(), "meals": meals})

    plan = {"start_date": week_start.isoformat(), "days": days}
    _save_json(PLAN_FILE, plan)
    append_plan_history(plan)
    return plan


def load_weekly_plan():
    return _load_json(PLAN_FILE, None)


def save_weekly_plan(plan):
    _save_json(PLAN_FILE, plan)


def _item_key(name, unit, language=None):
    if language:
        return f"{language}|{name}|{unit}"
    return f"{name}|{unit}"


def load_shopping_state():
    return _load_json(SHOPPING_FILE, {})


def save_shopping_state(state):
    _save_json(SHOPPING_FILE, state)


def sync_shopping_state(weekly_items, language=None):
    state = load_shopping_state()
    if not weekly_items:
        return state
    weekly_keys = {_item_key(item["name"], item["unit"], language) for item in weekly_items}
    legacy_keys = {_item_key(item["name"], item["unit"]) for item in weekly_items}
    updated = {}
    for key, value in state.items():
        if language and value.get("lang") and value.get("lang") != language:
            updated[key] = value
        elif value.get("manual"):
            updated[key] = value
        elif key in weekly_keys or key in legacy_keys:
            updated[key] = value
    if updated != state:
        save_shopping_state(updated)
    return updated


def initialize_weekly_plan(start_date=None):
    week_start = _parse_date(start_date) or _week_start()
    days = []
    for day_offset in range(7):
        day_date = week_start + timedelta(days=day_offset)
        meals = {meal_type: None for meal_type in ("breakfast", "lunch", "dinner")}
        days.append({"date": day_date.isoformat(), "meals": meals})
    plan = {"start_date": week_start.isoformat(), "days": days}
    _save_json(PLAN_FILE, plan)
    return plan


def auto_generate_weekly_plan(plan=None, start_date=None):
    config = load_config()
    recipes = load_recipes()
    if not recipes:
        raise ValueError("No recipes available in data/recipes/*.json")

    if plan is None:
        plan = initialize_weekly_plan(start_date)
    elif start_date and plan.get("start_date") != start_date:
        plan = initialize_weekly_plan(start_date)

    by_meal = defaultdict(list)
    for recipe in recipes:
        meal_types = recipe.get("meal_types") or []
        legacy = recipe.get("meal_type")
        if legacy and legacy not in meal_types:
            meal_types.append(legacy)
        for meal_type in meal_types:
            by_meal[meal_type].append(recipe)

    usage_counts = defaultdict(int)
    for day in plan.get("days", []):
        for meal in day.get("meals", {}).values():
            if meal and meal.get("locked"):
                usage_counts[meal.get("name")] += 1

    for day in plan.get("days", []):
        for meal_type in ("breakfast", "lunch", "dinner"):
            meal = day.get("meals", {}).get(meal_type)
            if meal and meal.get("locked"):
                continue
            candidates = by_meal.get(meal_type, [])
            if not candidates:
                day["meals"][meal_type] = None
                continue
            used_ids = {
                m.get("recipe_id")
                for m in day.get("meals", {}).values()
                if m and m.get("recipe_id")
            }
            available = [
                recipe
                for recipe in candidates
                if usage_counts[recipe["name"]] < config["max_repeat_per_week"]
                and recipe.get("recipe_id") not in used_ids
            ]
            recipe = _pick_recipe(
                available,
                usage_counts,
                config["max_repeat_per_week"],
            )
            if recipe is None:
                day["meals"][meal_type] = None
                continue
            usage_counts[recipe["name"]] += 1
            day["meals"][meal_type] = {
                "recipe_id": recipe.get("recipe_id"),
                "name": recipe.get("name"),
                "ingredients": recipe.get("ingredients", []),
                "locked": False,
            }

    _save_json(PLAN_FILE, plan)
    append_plan_history(plan)
    return plan


def assign_meal(plan, date_str, meal_type, recipe):
    for day in plan.get("days", []):
        if day.get("date") == date_str:
            day.setdefault("meals", {})
            for existing in day.get("meals", {}).values():
                if existing and existing.get("recipe_id") == recipe.get("recipe_id"):
                    return False
            day["meals"][meal_type] = {
                "recipe_id": recipe.get("recipe_id"),
                "name": recipe.get("name"),
                "ingredients": recipe.get("ingredients", []),
                "source_url": recipe.get("source_url"),
                "locked": False,
            }
            return True
    return False


def clear_meal(plan, date_str, meal_type):
    for day in plan.get("days", []):
        if day.get("date") == date_str:
            if meal_type in day.get("meals", {}):
                day["meals"][meal_type] = None
                return True
    return False


def load_plan_history():
    return _load_json(HISTORY_FILE, [])


def append_plan_history(plan):
    history = load_plan_history()
    history.append(
        {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "plan": plan,
        }
    )
    _save_json(HISTORY_FILE, history)


def get_today_meals(plan=None):
    plan = plan or load_weekly_plan()
    if not plan:
        return None
    today = date.today().isoformat()
    for day in plan.get("days", []):
        if day.get("date") == today:
            return day
    return None


def compute_shopping_list(plan=None, language="en"):
    plan = plan or load_weekly_plan()
    if not plan:
        return None

    config = load_config()
    target_servings = config.get("family_size", 4) or 1
    totals = {}
    recipes_by_id = {r.get("recipe_id"): r for r in load_recipes()}
    for day in plan.get("days", []):
        for meal in day.get("meals", {}).values():
            if not meal:
                continue
            ingredients = meal.get("ingredients", [])
            recipe_id = meal.get("recipe_id")
            servings = None
            if recipe_id and recipe_id in recipes_by_id:
                recipe = recipes_by_id[recipe_id]
                if language == "original":
                    ingredients = recipe.get("ingredients_original", [])
                else:
                    ingredients = recipe.get("ingredients", [])
                servings = recipe.get("servings")
            scale = 1
            try:
                if servings:
                    scale = target_servings / float(servings)
            except (TypeError, ValueError, ZeroDivisionError):
                scale = 1
            for item in ingredients:
                display_name = item.get("name")
                if not display_name:
                    continue
                unit = item.get("unit", "")
                qty = item.get("quantity", 0)
                try:
                    qty = float(qty)
                except (TypeError, ValueError):
                    qty = 0
                qty *= scale
                qty, unit = _normalize_quantity_unit(qty, unit)

                _, key_unit = _normalize_quantity_unit(1, unit)
                key = _item_key(display_name, key_unit, language)
                group = _unit_group(unit)

                if key not in totals:
                    totals[key] = {
                        "quantity": 0,
                        "unit": unit,
                        "groups": set([group]),
                        "recipes": set(),
                        "display_name": display_name,
                        "key_unit": key_unit,
                    }
                totals[key]["quantity"] += qty
                totals[key]["groups"].add(group)
                if recipe_id:
                    totals[key]["recipes"].add(recipe_id)
                if len(totals[key]["groups"]) > 1:
                    totals[key]["unit"] = "mixed"

    shopping_list = []
    for key in sorted(totals.keys()):
        entry = totals[key]
        unit = entry["unit"]
        shopping_list.append(
            {
                "name": entry["display_name"],
                "unit": unit,
                "quantity": _round_quantity(entry["quantity"]),
                "recipes_count": len(entry["recipes"]),
                "recipe_ids": sorted(entry["recipes"]),
                "key": key,
            }
        )
    return shopping_list


def format_date(iso_date):
    return datetime.fromisoformat(iso_date).strftime("%A, %b %d")
