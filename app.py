from datetime import date

from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

from dotenv import load_dotenv
import json

import uuid

from flask import Flask, redirect, render_template, request, url_for

from planner import (
    add_recipe,
    assign_meal,
    auto_generate_weekly_plan,
    clear_meal,
    compute_shopping_list,
    extract_recipe_from_youtube,
    format_date,
    generate_weekly_plan,
    get_recipe_by_id,
    get_today_meals,
    has_recipe_id,
    initialize_weekly_plan,
    load_recipe_source,
    load_plan_history,
    load_recipes,
    load_shopping_state,
    load_weekly_plan,
    save_shopping_state,
    save_weekly_plan,
    sync_shopping_state,
    update_recipe,
)

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def _parse_ingredients(text):
    ingredients = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split(",")]
        name = parts[0]
        quantity = 0
        unit = ""
        if len(parts) > 1 and parts[1]:
            try:
                quantity = float(parts[1])
            except ValueError:
                quantity = 0
        if len(parts) > 2:
            unit = parts[2]
        ingredients.append({"name": name, "quantity": quantity, "unit": unit})
    return ingredients


def _format_ingredients_lines(ingredients):
    lines = []
    for item in ingredients:
        name = item.get("name", "")
        qty = item.get("quantity", "")
        unit = item.get("unit", "")
        lines.append(f"{name},{qty},{unit}".strip(","))
    return "\n".join(lines)


def _parse_instructions(text):
    return [line.strip() for line in text.splitlines() if line.strip()]


def _format_instructions_lines(instructions):
    if not instructions:
        return ""
    return "\n".join([line.strip() for line in instructions if line.strip()])


def _youtube_id(url):
    if not url:
        return ""
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if "v" in query:
        return query["v"][0]
    if parsed.path.startswith("/shorts/"):
        return parsed.path.split("/shorts/")[1].split("/")[0]
    if parsed.netloc.endswith("youtu.be"):
        return parsed.path.strip("/")
    return ""

app = Flask(__name__)


@app.route("/")
def index():
    return redirect(url_for("plan_view"))


@app.route("/plan")
def plan_view():
    plan = load_weekly_plan()
    start_date = request.args.get("start_date")
    if start_date:
        plan = initialize_weekly_plan(start_date)
    elif not plan:
        plan = initialize_weekly_plan()
    recipes = load_recipes()
    recipes_by_id = {r.get("recipe_id"): r for r in recipes}
    return render_template(
        "plan.html",
        plan=plan,
        format_date=format_date,
        recipes=recipes,
        recipes_by_id=recipes_by_id,
        today=date.today().isoformat(),
    )


@app.route("/generate", methods=["POST"])
def generate():
    plan = load_weekly_plan()
    start_date = request.form.get("start_date")
    if start_date and plan and plan.get("start_date") != start_date:
        plan = initialize_weekly_plan(start_date)
    auto_generate_weekly_plan(plan, start_date=start_date)
    return redirect(url_for("plan_view"))


@app.route("/shopping-list")
def shopping_list_view():
    plan = load_weekly_plan()
    lang = request.args.get("lang", "en")
    weekly_items = compute_shopping_list(plan, language=lang) or []
    state = sync_shopping_state(weekly_items, language=lang)
    weekly_by_key = {item["key"]: item for item in weekly_items}
    for item in weekly_items:
        key = item["key"]
        if key.startswith(f"{lang}|"):
            parts = key.split("|", 2)
            if len(parts) == 3:
                legacy_key = f"{parts[1]}|{parts[2]}"
                weekly_by_key.setdefault(legacy_key, item)
    shopping_items = []
    for key, stored in state.items():
        weekly = weekly_by_key.get(key)
        if weekly:
            shopping_items.append(
                {
                    "name": stored.get("name", weekly["name"]),
                    "unit": stored.get("unit", weekly["unit"]),
                    "quantity": stored.get("quantity", weekly["quantity"]),
                    "recipes_count": weekly.get("recipes_count", 0),
                    "recipe_ids": weekly.get("recipe_ids", []),
                    "key": key,
                    "manual": stored.get("manual", False),
                }
            )
        elif stored.get("manual"):
            shopping_items.append(
                {
                    "name": stored.get("name", ""),
                    "unit": stored.get("unit", ""),
                    "quantity": stored.get("quantity", ""),
                    "recipes_count": 0,
                    "recipe_ids": [],
                    "key": key,
                    "manual": True,
                }
            )
    weekly_list = [item for item in weekly_items if item["key"] not in state]
    recipes_by_id = {r.get("recipe_id"): r for r in load_recipes()}
    return render_template(
        "shopping_list.html",
        weekly_list=weekly_list,
        shopping_items=shopping_items,
        lang=lang,
        recipes_by_id=recipes_by_id,
    )


@app.route("/shopping-list/add", methods=["POST"])
def shopping_list_add():
    key = request.form.get("key", "")
    name = request.form.get("name", "")
    unit = request.form.get("unit", "")
    quantity = request.form.get("quantity", "")
    lang = request.form.get("lang", "en")
    if not key or not name:
        return redirect(url_for("shopping_list_view", lang=lang))
    state = load_shopping_state()
    state[key] = {
        "name": name,
        "unit": unit,
        "quantity": quantity,
        "manual": False,
        "lang": lang,
    }
    save_shopping_state(state)
    return redirect(url_for("shopping_list_view", lang=lang))


@app.route("/shopping-list/remove", methods=["POST"])
def shopping_list_remove():
    key = request.form.get("key", "")
    lang = request.form.get("lang", "en")
    state = load_shopping_state()
    if key in state:
        state.pop(key, None)
        save_shopping_state(state)
    return redirect(url_for("shopping_list_view", lang=lang))


@app.route("/shopping-list/update", methods=["POST"])
def shopping_list_update():
    key = request.form.get("key", "")
    quantity = request.form.get("quantity", "")
    lang = request.form.get("lang", "en")
    state = load_shopping_state()
    if key in state:
        state[key]["quantity"] = quantity
        save_shopping_state(state)
    return redirect(url_for("shopping_list_view", lang=lang))


@app.route("/shopping-list/add-manual", methods=["POST"])
def shopping_list_add_manual():
    name = request.form.get("name", "").strip()
    unit = request.form.get("unit", "").strip()
    quantity = request.form.get("quantity", "").strip()
    lang = request.form.get("lang", "en")
    if not name:
        return redirect(url_for("shopping_list_view", lang=lang))
    key = f"manual:{uuid.uuid4().hex}"
    state = load_shopping_state()
    state[key] = {
        "name": name,
        "unit": unit,
        "quantity": quantity,
        "manual": True,
        "lang": lang,
    }
    save_shopping_state(state)
    return redirect(url_for("shopping_list_view", lang=lang))


@app.route("/history")
def history_view():
    history = load_plan_history()
    return render_template("history.html", history=history, format_date=format_date)


@app.route("/recipes")
def recipes_view():
    recipes = load_recipes()
    filters = request.args.getlist("meal_type")
    if filters:
        recipes = [
            recipe
            for recipe in recipes
            if any(meal in recipe.get("meal_types", []) for meal in filters)
        ]
    return render_template("recipes.html", recipes=recipes, filters=filters)


@app.route("/recipes/<recipe_id>")
def recipe_detail(recipe_id):
    recipe = get_recipe_by_id(recipe_id)
    if not recipe:
        return redirect(url_for("recipes_view"))
    source_url = recipe.get("source_url")
    if not source_url:
        source = load_recipe_source(recipe_id)
        if source:
            source_url = source.get("source_url")
            recipe["source_url"] = source_url
    youtube_id = _youtube_id(source_url)
    embed_url = f"https://www.youtube.com/embed/{youtube_id}" if youtube_id else None
    return render_template(
        "recipe_detail.html",
        recipe=recipe,
        youtube_id=youtube_id,
        embed_url=embed_url,
    )


@app.route("/recipes/<recipe_id>/edit", methods=["GET", "POST"])
def recipe_edit(recipe_id):
    recipe = get_recipe_by_id(recipe_id)
    if not recipe:
        return redirect(url_for("recipes_view"))
    error = None
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if not name:
            error = "Name is required."
        else:
            meal_types_raw = request.form.get("meal_types", "")
            meal_types = [t.strip() for t in meal_types_raw.split(",") if t.strip()]
            servings = request.form.get("servings", "").strip()
            source_url = request.form.get("source_url", "").strip()
            recipe.update(
                {
                    "name": name,
                    "meal_types": meal_types,
                    "servings": int(servings) if servings.isdigit() else recipe.get("servings"),
                    "source_url": source_url or None,
                    "ingredients": _parse_ingredients(request.form.get("ingredients", "")),
                    "ingredients_original": _parse_ingredients(
                        request.form.get("ingredients_original", "")
                    ),
                    "instructions": _parse_instructions(
                        request.form.get("instructions", "")
                    ),
                    "instructions_original": _parse_instructions(
                        request.form.get("instructions_original", "")
                    ),
                }
            )
            if not update_recipe(recipe_id, recipe):
                error = "Unable to save recipe. Try again."
            else:
                return redirect(url_for("recipe_detail", recipe_id=recipe_id))
    return render_template("recipe_edit.html", recipe=recipe, error=error)


@app.route("/plan/select")
def plan_select():
    date_str = request.args.get("date")
    meal_type = request.args.get("meal")
    recipes = load_recipes()
    plan = load_weekly_plan() or initialize_weekly_plan()
    used_ids = set()
    for day in plan.get("days", []):
        if day.get("date") == date_str:
            for meal in day.get("meals", {}).values():
                if meal and meal.get("recipe_id"):
                    used_ids.add(meal.get("recipe_id"))
            break
    available = [
        recipe
        for recipe in recipes
        if recipe.get("recipe_id") not in used_ids
        and (not meal_type or meal_type in recipe.get("meal_types", []))
    ]
    return render_template(
        "plan_select.html",
        recipes=available,
        date=date_str,
        meal_type=meal_type,
        format_date=format_date,
    )


@app.route("/plan/assign", methods=["POST"])
def plan_assign():
    date_str = request.form.get("date")
    meal_type = request.form.get("meal_type")
    recipe_id = request.form.get("recipe_id")
    if not (date_str and meal_type and recipe_id):
        return redirect(url_for("plan_view"))
    plan = load_weekly_plan() or initialize_weekly_plan()
    recipe = get_recipe_by_id(recipe_id)
    if not recipe:
        return redirect(url_for("plan_view"))
    assign_meal(plan, date_str, meal_type, recipe)
    save_weekly_plan(plan)
    return redirect(url_for("plan_view"))


@app.route("/plan/toggle-lock", methods=["POST"])
def plan_toggle_lock():
    date_str = request.form.get("date")
    meal_type = request.form.get("meal_type")
    if not (date_str and meal_type):
        return redirect(url_for("plan_view"))
    plan = load_weekly_plan() or initialize_weekly_plan()
    for day in plan.get("days", []):
        if day.get("date") == date_str:
            meal = day.get("meals", {}).get(meal_type)
            if meal:
                meal["locked"] = not meal.get("locked", False)
                save_weekly_plan(plan)
            break
    return redirect(url_for("plan_view"))


@app.route("/plan/clear", methods=["POST"])
def plan_clear():
    date_str = request.form.get("date")
    meal_type = request.form.get("meal_type")
    if not (date_str and meal_type):
        return redirect(url_for("plan_view"))
    plan = load_weekly_plan() or initialize_weekly_plan()
    clear_meal(plan, date_str, meal_type)
    save_weekly_plan(plan)
    return redirect(url_for("plan_view"))


@app.route("/plan/lock-all", methods=["POST"])
def plan_lock_all():
    plan = load_weekly_plan() or initialize_weekly_plan()
    for day in plan.get("days", []):
        for meal in day.get("meals", {}).values():
            if meal:
                meal["locked"] = True
    save_weekly_plan(plan)
    return redirect(url_for("plan_view"))


@app.route("/plan/unlock-all", methods=["POST"])
def plan_unlock_all():
    plan = load_weekly_plan() or initialize_weekly_plan()
    for day in plan.get("days", []):
        for meal in day.get("meals", {}).values():
            if meal:
                meal["locked"] = False
    save_weekly_plan(plan)
    return redirect(url_for("plan_view"))


@app.route("/recipes/new", methods=["GET", "POST"])
def recipes_new():
    error = request.args.get("error")
    prefill = {
        "source_url": request.args.get("source_url", ""),
        "name": request.args.get("name", ""),
        "meal_type": request.args.get("meal_type", "dinner"),
        "ingredients": request.args.get("ingredients", ""),
        "ingredients_original": request.args.get("ingredients_original", ""),
        "instructions": request.args.get("instructions", ""),
        "instructions_original": request.args.get("instructions_original", ""),
    }
    if request.method == "POST":
        url = request.form.get("source_url", "").strip()
        name = request.form.get("name", "").strip() or "Untitled recipe"
        meal_type = request.form.get("meal_type", "").strip() or "dinner"
        ingredients = _parse_ingredients(request.form.get("ingredients", ""))
        ingredients_original = _parse_ingredients(
            request.form.get("ingredients_original", "")
        )
        instructions = _parse_instructions(request.form.get("instructions", ""))
        instructions_original = _parse_instructions(
            request.form.get("instructions_original", "")
        )
        recipe = {
            "name": name,
            "meal_type": meal_type,
            "ingredients": ingredients,
            "ingredients_original": ingredients_original,
            "instructions": instructions,
            "instructions_original": instructions_original,
            "source_url": url or None,
        }
        add_recipe(recipe)
        return redirect(url_for("recipes_view"))
    return render_template("recipe_new.html", error=error, prefill=prefill)


@app.route("/recipes/extract", methods=["POST"])
def recipes_extract():
    url = request.form.get("source_url", "").strip()
    if not url:
        return redirect(url_for("recipes_new", error="Please provide a YouTube URL."))

    try:
        recipe = extract_recipe_from_youtube(url)
    except RuntimeError as exc:
        return redirect(
            url_for("recipes_new", error=str(exc), source_url=url)
        )
    if not recipe:
        return redirect(
            url_for(
                "recipes_new",
                error="No recipe text found in the top comment.",
                source_url=url,
            )
        )

    params = {
        "source_url": url,
        "name": recipe.get("name", ""),
        "meal_type": recipe.get("meal_type", "dinner"),
        "ingredients": _format_ingredients_lines(recipe.get("ingredients", [])),
        "ingredients_original": _format_ingredients_lines(
            recipe.get("ingredients_original", [])
        ),
        "instructions": _format_instructions_lines(recipe.get("instructions", [])),
        "instructions_original": _format_instructions_lines(
            recipe.get("instructions_original", [])
        ),
    }
    return redirect(f"{url_for('recipes_new')}?{urlencode(params)}")


@app.route("/recipes/import", methods=["GET", "POST"])
def recipes_import():
    error = None
    raw_json = ""
    recipe_id = ""
    source_url = ""
    if request.method == "POST":
        raw_json = request.form.get("recipe_json", "").strip()
        recipe_id = request.form.get("recipe_id", "").strip()
        source_url = request.form.get("source_url", "").strip()
        if not raw_json:
            error = "Please paste recipe JSON."
        else:
            try:
                payload = json.loads(raw_json)
                if not isinstance(payload, dict):
                    error = "Recipe JSON must be an object."
                elif not payload.get("name"):
                    error = "Recipe JSON must include a name."
                else:
                    if not payload.get("recipe_id"):
                        payload["recipe_id"] = recipe_id or uuid.uuid4().hex
                    if not payload.get("source_url") and source_url:
                        payload["source_url"] = source_url
                    if has_recipe_id(payload["recipe_id"]):
                        error = (
                            "Recipe ID already exists. Please use a new ID or edit "
                            "the existing recipe."
                        )
                        return render_template(
                            "recipe_import.html",
                            error=error,
                            raw_json=raw_json,
                            recipe_id=payload["recipe_id"],
                            source_url=source_url,
                        )
                    add_recipe(payload)
                    return redirect(url_for("recipes_view"))
            except json.JSONDecodeError as exc:
                error = f"Invalid JSON: {exc}"
    return render_template(
        "recipe_import.html",
        error=error,
        raw_json=raw_json,
        recipe_id=recipe_id,
        source_url=source_url,
    )


if __name__ == "__main__":
    app.run(debug=True)
