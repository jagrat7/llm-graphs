#!/usr/bin/env python3
"""Catalogue how DeepSWE and Artificial Analysis encode model identity and reasoning effort.

Reproduces the numbers in docs/research/source-conventions.md (GitHub issue #6).

Usage:
    python3 docs/research/source_conventions.py [--cache DIR] [--env PATH] [--history DIR] [--refresh]

- DeepSWE is public. Artificial Analysis (AA) needs AA_API_KEY, read from the environment or
  from the --env file (default: ./.env). The key is only sent as the x-api-key header.
- Raw payloads are cached in --cache (default: $TMPDIR/source-conventions), never in the repo.
- --history DIR is optional: a directory of daily AA snapshots named YYYY-MM-DD.json, taken from
  https://github.com/antoniovho/artificial-analysis-leaderboards (data/<date>/llms.json).
  With it, the script reports slug renames, slug repointing, and name changes per AA id.

Stdlib only. Output is Markdown on stdout.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import tempfile
import urllib.request
from collections import Counter, defaultdict

DEEPSWE_URL = "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json"
AA_URL = "https://artificialanalysis.ai/api/v2/language/models/free?page={page}"

# The app's current parser (src/server/services/provider/artificial-analysis.ts).
TODAY_SUFFIX = re.compile(r"-(low|medium|high|xhigh|max)$")

LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"]
LEVEL_RANK = {"non-reasoning": -1, **{level: i for i, level in enumerate(LEVELS)}}

# Dates DeepSWE says each model's results were added (https://deepswe.datacurve.ai/changelog).
# Used to spot AA entries released after the DeepSWE run (a sign of a different snapshot).
# glm-5-3 and glm-5-3-flash have no changelog entry.
DEEPSWE_ADDED = {
    "claude-fable-5": "2026-06-15",
    "claude-opus-4-8": "2026-06-15",
    "claude-sonnet-4-6": "2026-06-15",
    "gemini-3-1-pro-preview": "2026-06-15",
    "gemini-3-5-flash": "2026-06-15",
    "gpt-5-4": "2026-06-15",
    "gpt-5-5": "2026-06-15",
    "kimi-k2-7-code": "2026-06-15",
    "glm-5-2": "2026-06-21",
    "claude-sonnet-5": "2026-07-02",
    "gpt-5-6-sol": "2026-07-10",
    "gpt-5-6-terra": "2026-07-10",
    "gpt-5-6-luna": "2026-07-10",
    "muse-spark-1-1": "2026-07-14",
    "grok-4-5": "2026-07-16",
    "kimi-k3": "2026-07-18",
    "gemini-3-6-flash": "2026-07-22",
    "claude-opus-5": "2026-07-25",
    "qwen3-8-max": "2026-08-04",
    "deepseek-v4-flash": "2026-08-06",
    "muse-spark-1-2": "2026-08-07",
    "deepseek-v4-pro": "2026-08-12",
    "grok-4-6": "2026-08-12",
    "gemini-3-7-flash": "2026-08-13",
    "gemini-3-8-flash": "2026-09-01",
    "gpt-6-astra": "2026-09-03",
}

MONTHS = "jan|feb|mar|apr|may|jun|june|jul|aug|sep|sept|oct|nov|dec"
MONTH_WORDS = (
    "january|february|march|april|may|june|july|august|september|october|november|december"
    "|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)

# Structural slug suffixes, peeled from the end of the slug in order.
SLUG_RULES = [
    ("non-reasoning", re.compile(r"-non-reasoning(-low-effort)?$")),
    ("effort", re.compile(r"-(minimal|low|medium|high|xhigh|max)$")),
    ("reasoning", re.compile(r"-(reasoning|thinking|adaptive)$")),
    (
        "date",
        re.compile(
            # YYYY-MM-DD | MM-YYYY | MM-DD / MM-YY | MMDD or YYMM | month-YY(YY) | decDD
            r"-(20\d{2}-(?:0[1-9]|1[0-2])-\d{2}|(?:0[1-9]|1[0-2])-20\d{2}|(?:0[1-9]|1[0-2])-\d{2}"
            r"|(?:0[1-9]|1[0-2])\d{2}|\d{2}(?:0[1-9]|1[0-2])|(?:%s)-\d{2,4}|dec\d{2})$" % MONTHS
        ),
    ),
    ("preview", re.compile(r"-(preview|exp|experimental)$")),
    ("pin", re.compile(r"-\d{3}$")),
    ("instruct", re.compile(r"-(instruct|chat)$")),
]
MODE_CATEGORIES = {"non-reasoning", "effort", "reasoning"}


# --------------------------------------------------------------------------- loading


def read_key(env_path: str) -> str | None:
    if os.environ.get("AA_API_KEY"):
        return os.environ["AA_API_KEY"]
    if not os.path.exists(env_path):
        return None
    for line in open(env_path):
        match = re.match(r"\s*AA_API_KEY\s*=\s*['\"]?([^'\"\n]*)['\"]?", line)
        if match:
            return match.group(1).strip()
    return None


def get_json(url: str, headers: dict[str, str] | None = None):
    request = urllib.request.Request(
        url, headers={"User-Agent": "llm-graphs-research", **(headers or {})}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def load_sources(cache: str, env_path: str, refresh: bool):
    os.makedirs(cache, exist_ok=True)
    deepswe_path = os.path.join(cache, "deepswe.json")
    if refresh or not os.path.exists(deepswe_path):
        json.dump(get_json(DEEPSWE_URL), open(deepswe_path, "w"))
    deepswe = json.load(open(deepswe_path))

    aa: list[dict] = []
    page = 1
    while True:
        path = os.path.join(cache, f"aa_{page}.json")
        if refresh or not os.path.exists(path):
            key = read_key(env_path)
            if not key:
                raise SystemExit("AA_API_KEY not found (set it or pass --env)")
            json.dump(get_json(AA_URL.format(page=page), {"x-api-key": key}), open(path, "w"))
        body = json.load(open(path))
        aa.extend(body["data"])
        if not body["pagination"]["has_more"]:
            break
        page += 1
    return deepswe, aa


# --------------------------------------------------------------------------- AA parsing


def paren_groups(name: str) -> list[str]:
    return re.findall(r"\(([^()]*)\)", name)


def classify_token(token: str) -> tuple[str, str]:
    """Return (class, normalised value) for one comma-separated token inside a parenthetical."""
    t = token.strip()
    low = t.lower()
    if low in LEVELS:
        return "level", low
    match = re.fullmatch(r"(minimal|low|medium|high|xhigh|max) effort", low)
    if match:
        return "level-effort", match.group(1)
    if low == "reasoning":
        return "reasoning", "Reasoning"
    if low == "non-reasoning":
        return "non-reasoning", "Non-reasoning"
    if low == "adaptive reasoning":
        return "adaptive-reasoning", "Adaptive Reasoning"
    if low.endswith(" fallback"):
        return "fallback", t
    if low == "preview":
        return "preview", "Preview"
    if low.startswith("based on "):
        return "based-on", "based on <model>"
    if (
        re.fullmatch(r"[a-z]{3,5}\s?'\s?\d{2}", low)
        or re.fullmatch(r"\d{4}", low)
        or re.fullmatch(r"(%s) \d{4}" % MONTH_WORDS, low)
    ):
        return "date", t
    if low in ("vision",):
        return "modality", t
    if low in ("chatgpt", "chatgpt-4o-latest"):
        return "product-channel", t
    if low in ("experimental", "beta"):
        return "maturity", t
    if re.fullmatch(r"\d+(\.\d+)?b", low):
        return "size", t
    return "other", t


def name_tokens(name: str) -> list[tuple[str, str]]:
    return [classify_token(tok) for group in paren_groups(name) for tok in group.split(",") if tok.strip()]


def name_shape(name: str) -> str:
    """Abstract each parenthetical into its token-class pattern, e.g. '(Adaptive Reasoning, X Effort)'."""
    shapes = []
    for group in paren_groups(name):
        parts = []
        for tok in group.split(","):
            if not tok.strip():
                continue
            cls, value = classify_token(tok)
            parts.append(
                {
                    "level": "<level>",
                    "level-effort": "<Level> Effort",
                    "reasoning": "Reasoning",
                    "non-reasoning": "Non-reasoning",
                    "adaptive-reasoning": "Adaptive Reasoning",
                    "fallback": "<X> Fallback",
                    "preview": "Preview",
                    "based-on": "based on <model>",
                    "date": "<date>",
                }.get(cls, f"<{cls}>")
            )
        shapes.append("(" + ", ".join(parts) + ")")
    return " ".join(shapes) if shapes else "(none)"


INLINE_MARKERS = {
    "Preview": r"\bPreview\b",
    "Thinking/Think/Thinker": r"\b(Thinking|Think|Thinker)\b",
    "Reasoning (inline)": r"\bReasoning\b",
    "Instruct": r"\bInstruct\b",
    "Experimental/Exp": r"\b(Experimental|Exp)\b",
    "4-digit stamp (MMDD/YYMM)": r"\b(0[1-9]|1[0-2])\d{2}\b|\b2[3-6](0[1-9]|1[0-2])\b",
    "Code/Coder/Codex": r"\b(Code|Coder|Codex)\b",
    "Flash": r"\bFlash\b",
    "Max (tier)": r"\bMax\b",
}


def inline_markers(name: str) -> list[str]:
    outside = re.sub(r"\([^()]*\)", "", name)
    return [label for label, pattern in INLINE_MARKERS.items() if re.search(pattern, outside)]


def name_effort(name: str) -> str:
    """Effort as stated by the AA display name.

    Returns a level ('low'..'max'), 'non-reasoning' or 'non-reasoning/<level>' (Anthropic's effort
    parameter without thinking), 'reasoning' (reasoning with no level), or 'unlabelled'.
    """
    tokens = name_tokens(name)
    level = next((v for c, v in tokens if c in ("level", "level-effort")), None)
    if any(c == "non-reasoning" for c, _ in tokens):
        return f"non-reasoning/{level}" if level else "non-reasoning"
    if level:
        return level
    if any(c in ("reasoning", "adaptive-reasoning") for c, _ in tokens):
        return "reasoning"
    if re.search(r"\b(Thinking|Think|Thinker|Reasoning)\b", re.sub(r"\([^()]*\)", "", name)):
        return "reasoning"
    return "unlabelled"


def name_level(name: str) -> str | None:
    effort = name_effort(name)
    if effort in LEVELS:
        return effort
    if "/" in effort:
        return effort.split("/")[1]
    return None


def slug_parse(slug: str, name: str) -> tuple[str, list[tuple[str, str]]]:
    """Peel structural suffixes off a slug.

    An '-<level>' suffix is only treated as effort when the name states that level; otherwise it
    is part of the model identity (qwen3-8-max, magistral-medium, ...).
    Returns (stem, [(category, suffix), ...] outermost first).
    """
    stem, peeled = slug, []
    level = name_level(name)
    changed = True
    while changed:
        changed = False
        for category, pattern in SLUG_RULES:
            match = pattern.search(stem)
            if not match:
                continue
            if category == "effort" and match.group(1) != level:
                continue
            peeled.append((category, match.group(0)))
            stem = stem[: match.start()]
            changed = True
            break
    return stem, peeled


def family_of(slug: str, name: str) -> str:
    """Slug minus effort / reasoning-mode suffixes only (dates and previews stay: they are identity)."""
    stem = slug
    level = name_level(name)
    while True:
        for category, pattern in SLUG_RULES:
            if category not in MODE_CATEGORIES:
                continue
            match = pattern.search(stem)
            if match and not (category == "effort" and match.group(1) != level):
                stem = stem[: match.start()]
                break
        else:
            return stem


def undated_family(slug: str, name: str) -> str:
    stem = family_of(slug, name)
    match = SLUG_RULES[3][1].search(stem)
    return stem[: match.start()] if match else stem


def today_parse(slug: str) -> tuple[str, str]:
    match = TODAY_SUFFIX.search(slug)
    return (slug[: match.start()], match.group(1)) if match else (slug, "default")


# --------------------------------------------------------------------------- report helpers


def table(headers: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join(out)


def counter_rows(counter: Counter, examples: dict | None = None, limit: int = 3) -> list[list]:
    rows = []
    for key, count in counter.most_common():
        row = [key, count]
        if examples is not None:
            row.append(", ".join(f"`{e}`" for e in examples.get(key, [])[:limit]))
        rows.append(row)
    return rows


def ex_append(store: dict, key, value, limit: int = 4):
    bucket = store.setdefault(key, [])
    if len(bucket) < limit and value not in bucket:
        bucket.append(value)


# --------------------------------------------------------------------------- sections


def section_aa_slugs(aa: list[dict]):
    print("## AA slug suffixes\n")
    categories, signatures = Counter(), Counter()
    cat_ex, sig_ex = {}, {}
    suffix_values = defaultdict(Counter)
    for m in aa:
        _, peeled = slug_parse(m["slug"], m["name"])
        signature = " + ".join(c for c, _ in peeled) or "(bare: no structural suffix)"
        signatures[signature] += 1
        ex_append(sig_ex, signature, m["slug"])
        for category, suffix in peeled:
            categories[category] += 1
            ex_append(cat_ex, category, m["slug"])
            value = suffix
            if category == "date":
                value = re.sub(r"\d", "N", suffix)
            suffix_values[category][value] += 1
    print(f"{len(aa)} AA models.\n")
    print("Suffix categories (a slug can carry several):\n")
    print(table(["category", "slugs", "examples"], counter_rows(categories, cat_ex)))
    print("\nSuffix values per category:\n")
    rows = [[c, ", ".join(f"`{v}` {n}" for v, n in suffix_values[c].most_common())] for c in categories]
    print(table(["category", "values (count)"], rows))
    print("\nSuffix signatures (outermost suffix first):\n")
    print(table(["signature", "slugs", "examples"], counter_rows(signatures, sig_ex)))

    # The app's current regex.
    print("\n### The app's `-(low|medium|high|xhigh|max)$` regex against every slug\n")
    outcome, out_ex = Counter(), {}
    for m in aa:
        model, effort = today_parse(m["slug"])
        stated = name_effort(m["name"])
        if effort == "default":
            unrecognised = re.search(r"-(minimal)$", m["slug"])
            key = "no suffix -> 'default'" + (" (but '-minimal' effort suffix missed)" if unrecognised else "")
        elif name_level(m["name"]) == effort:
            key = f"suffix stripped, name agrees ({effort})"
        else:
            key = f"suffix stripped but name has no '{effort}' effort (tier word, misparsed)"
        outcome[key] += 1
        ex_append(out_ex, key, f"{m['slug']} -> {model}:{effort}", 6)
    print(table(["outcome", "slugs", "examples"], counter_rows(outcome, out_ex, 6)))


def section_aa_names(aa: list[dict]):
    print("\n## AA name parentheticals\n")
    token_classes, token_values = Counter(), Counter()
    class_ex, value_ex, shapes, shape_ex = {}, {}, Counter(), {}
    n_paren = Counter(len(paren_groups(m["name"])) for m in aa)
    for m in aa:
        shape = name_shape(m["name"])
        shapes[shape] += 1
        ex_append(shape_ex, shape, m["name"], 2)
        for cls, value in name_tokens(m["name"]):
            token_classes[cls] += 1
            ex_append(class_ex, cls, value, 6)
            token_values[f"{cls}: {value}"] += 1
    print("Parenthetical groups per name: " + ", ".join(f"{k} groups: {v}" for k, v in sorted(n_paren.items())) + "\n")
    print("Token classes (comma-separated tokens inside parentheses):\n")
    rows = [[c, n, ", ".join(f"`{v}`" for v in class_ex[c])] for c, n in token_classes.most_common()]
    print(table(["class", "tokens", "values seen"], rows))
    print("\nToken values:\n")
    print(table(["class: value", "count"], [[k, v] for k, v in token_values.most_common()]))
    print("\nParenthetical shapes:\n")
    rows = [[f"`{s}`", n, "; ".join(shape_ex[s])] for s, n in shapes.most_common()]
    print(table(["shape", "names", "examples"], rows))
    inline, inline_ex = Counter(), {}
    for m in aa:
        for marker in inline_markers(m["name"]):
            inline[marker] += 1
            ex_append(inline_ex, marker, m["name"], 3)
    print("\nMarkers outside parentheses:\n")
    print(table(["marker", "names", "examples"], counter_rows(inline, inline_ex)))
    stated, stated_ex = Counter(), {}
    for m in aa:
        effort = name_effort(m["name"])
        stated[effort] += 1
        ex_append(stated_ex, effort, m["slug"])
    print("\nEffort as stated by the name (all AA models):\n")
    print(table(["stated effort", "models", "examples"], counter_rows(stated, stated_ex)))
    quirks = {
        "'Non-Reasoning' (capital R) instead of 'Non-reasoning'": [m["name"] for m in aa if "Non-Reasoning" in m["name"]],
        "'Xhigh Effort' (title case) vs '(xhigh)'": [m["name"] for m in aa if "Xhigh" in m["name"]],
        "apostrophe after month (\"May' 25\")": [m["name"] for m in aa if re.search(r"[A-Za-z]' \d{2}", m["name"])],
        "dots in slug": [m["slug"] for m in aa if "." in m["slug"]],
        "uppercase in slug": [m["slug"] for m in aa if m["slug"] != m["slug"].lower()],
    }
    print("\nFormatting inconsistencies:\n")
    print(table(["quirk", "count", "examples"], [[k, len(v), "; ".join(v[:4])] for k, v in quirks.items()]))


def build_families(aa: list[dict]):
    families = defaultdict(list)
    for m in aa:
        families[(m["model_creator"]["name"], family_of(m["slug"], m["name"]))].append(m)
    return families


def mode_rank(name: str) -> int:
    """Order configs: non-reasoning < reasoning(unlabelled level) < low < ... < max."""
    effort = name_effort(name)
    if effort.startswith("non-reasoning"):
        return -2
    if effort in LEVELS:
        return LEVELS.index(effort)
    if effort == "reasoning":
        return -1
    return -3  # unlabelled


def half_year(date: str | None) -> str:
    if not date:
        return "unknown"
    return f"{date[:4]}-H{1 if int(date[5:7]) <= 6 else 2}"


def section_bare_slugs(aa: list[dict]):
    print("\n## What the bare slug means, per vendor\n")
    families = build_families(aa)
    per_vendor = defaultdict(Counter)
    vendor_ex = defaultdict(dict)
    singles = defaultdict(Counter)
    single_ex = defaultdict(dict)
    by_era = defaultdict(Counter)
    position, position_ex = Counter(), {}
    no_bare = []
    for (vendor, family), members in sorted(families.items()):
        bare = next((m for m in members if m["slug"] == family), None)
        if len(members) == 1:
            effort = name_effort(members[0]["name"])
            singles[vendor][effort] += 1
            ex_append(single_ex[vendor], effort, family, 4)
            continue
        if bare is None:
            no_bare.append((vendor, family, [m["slug"] for m in members]))
            continue
        bare_effort = name_effort(bare["name"])
        per_vendor[vendor][bare_effort] += 1
        by_era[half_year(bare.get("release_date"))][bare_effort] += 1
        ex_append(vendor_ex[vendor], bare_effort, family, 6)
        top = max(mode_rank(m["name"]) for m in members)
        bare_rank = mode_rank(bare["name"])
        if bare_rank == -3:
            key = "bare slug has no effort label"
        elif bare_rank == top:
            key = "bare slug = highest config in family"
        elif bare_effort.startswith("non-reasoning"):
            key = "bare slug = non-reasoning, reasoning sibling(s) exist"
        else:
            key = "bare slug = a level below a higher sibling"
        position[key] += 1
        ex_append(position_ex, key, family, 8)
    print("Families = slugs sharing a stem once effort/reasoning suffixes are removed (date/preview suffixes")
    print("stay part of the stem). 'Bare slug' = the family member with no effort/reasoning suffix.\n")
    rows = []
    for vendor in sorted(set(per_vendor) | set(singles)):
        counts = per_vendor[vendor]
        consistent = "-" if not counts else ("yes" if len(counts) == 1 else "no")
        detail = "; ".join(
            f"{effort} x{n}: " + ", ".join(f"`{f}`" for f in vendor_ex[vendor][effort])
            for effort, n in counts.most_common()
        ) or "-"
        single = ", ".join(f"{effort} {n}" for effort, n in singles[vendor].most_common()) or "-"
        rows.append([vendor, sum(counts.values()), consistent, detail, single])
    print(
        table(
            ["vendor", "families w/ variants", "one meaning?", "bare slug means (families)", "single-entry models: stated effort"],
            rows,
        )
    )
    print("\nWhere the bare slug sits inside its family:\n")
    print(table(["position", "families", "examples"], counter_rows(position, position_ex, 8)))
    print("\nBare-slug meaning by release half-year (all vendors, families with variants):\n")
    efforts = sorted({e for c in by_era.values() for e in c})
    print(table(["release", *efforts], [[era, *[by_era[era].get(e, 0) for e in efforts]] for era in sorted(by_era)]))
    if no_bare:
        print("\nFamilies with variants but no bare slug:\n")
        print(table(["vendor", "family stem", "members"], [[v, f, ", ".join(ms)] for v, f, ms in no_bare]))
    total = Counter()
    for counter in singles.values():
        total.update(counter)
    print("\nSingle-entry models (no siblings), stated effort, all vendors:\n")
    print(table(["stated effort", "models"], [[k, v] for k, v in total.most_common()]))


def section_dated_siblings(aa: list[dict]):
    print("\n## Dated slugs next to an undated sibling\n")
    by_slug = {m["slug"]: m for m in aa}
    rows, verdict = [], Counter()
    for m in aa:
        stem = family_of(m["slug"], m["name"])
        match = SLUG_RULES[3][1].search(stem)
        if not match:
            continue
        undated_stem = stem[: match.start()]
        # Rebuild the undated sibling slug with the same mode/effort suffix.
        sibling_slug = undated_stem + m["slug"][len(stem):]
        sibling = by_slug.get(sibling_slug)
        if not sibling:
            continue
        newer = (sibling.get("release_date") or "") > (m.get("release_date") or "")
        key = "undated slug is the newer snapshot" if newer else "dated slug is the newer snapshot"
        verdict[key] += 1
        rows.append([f"`{m['slug']}`", m["name"], m.get("release_date"), f"`{sibling_slug}`", sibling["name"], sibling.get("release_date"), key.split(" is")[0]])
    print(table(["verdict", "pairs"], [[k, v] for k, v in verdict.most_common()]))
    print()
    print(table(["dated slug", "name", "released", "undated sibling", "name", "released", "newer"], rows))


def section_today_collisions(aa: list[dict]):
    print("\n## Key collisions under the app's current AA parser\n")
    keys = defaultdict(list)
    for m in aa:
        model, effort = today_parse(m["slug"])
        keys[f"{model}:{effort}"].append(m["slug"])
    rows = [[f"`{k}`", ", ".join(v)] for k, v in keys.items() if len(v) > 1]
    print(table(["key", "slugs (last wins)"], rows) if rows else "None.")


def section_deepswe(deepswe: dict):
    rows = deepswe["rows"]
    print("\n## DeepSWE rows\n")
    print(f"generated_at {deepswe['generated_at']}; {len(rows)} rows; {len({r['model'] for r in rows})} models.\n")
    print("scope: " + deepswe.get("scope", "") + "\n")
    fields = ["harness", "provider", "source", "reasoning_effort", "n_runs"]
    out = []
    for f in fields:
        c = Counter(str(r.get(f)) for r in rows)
        out.append([f, ", ".join(f"`{k}` {v}" for k, v in c.most_common())])
    print(table(["field", "values (count)"], out))
    mismatches = [
        r["config"]
        for r in rows
        if r["config"]
        != f"{r['harness'].replace('-', '_')}_{r['model'].replace('-', '_')}_{r['reasoning_effort'] or 'default'}"
    ]
    print(f"\n`config` == `<harness>_<model>_<effort or 'default'>` with '-' -> '_': {len(rows) - len(mismatches)}/{len(rows)} rows.")
    dup_pairs = [k for k, v in Counter((r["model"], r["reasoning_effort"]) for r in rows).items() if v > 1]
    dup_model_harness = [k for k, v in Counter((r["model"], r["reasoning_effort"], r["harness"]) for r in rows).items() if v > 1]
    print(f"Duplicate (model, effort) pairs: {len(dup_pairs)}; duplicate (model, effort, harness): {len(dup_model_harness)}.")
    sparse = Counter()
    for r in rows:
        for k, v in r.items():
            if v is not None:
                sparse[k] += 1
    partial = [f"`{k}` {n}" for k, n in sorted(sparse.items()) if n < len(rows)]
    print("Fields present on only some rows: " + ", ".join(partial) + ".")
    per_model = defaultdict(list)
    for r in rows:
        per_model[r["model"]].append(r["reasoning_effort"])
    print("\nEfforts per model:\n")
    order = {None: -1, **{lv: i for i, lv in enumerate(LEVELS)}}
    print(
        table(
            ["model", "efforts"],
            [[f"`{m}`", ", ".join(str(e) for e in sorted(es, key=lambda e: order[e]))] for m, es in sorted(per_model.items())],
        )
    )


def simulate_join(deepswe: dict, aa: list[dict]):
    """Replay src/ui/lib/use-models.ts and grade each DeepSWE row against the AA name."""
    by_key = {}
    for m in aa:  # Map semantics: last entry for a key wins.
        model, effort = today_parse(m["slug"])
        by_key[f"{model}:{effort}"] = m
    by_undated = defaultdict(list)
    for m in aa:
        by_undated[undated_family(m["slug"], m["name"])].append(m)

    results = []
    for r in deepswe["rows"]:
        model = r["model"]
        effort = r["reasoning_effort"] or "default"
        lookup = "default" if effort == "max" else effort
        hit, via = by_key.get(f"{model}:{lookup}"), "direct"
        if hit is None:
            hit, via = by_key.get(f"{model}:default"), "fallback to bare slug"
        if hit is None:
            via = "none"

        added = DEEPSWE_ADDED.get(model)
        want_level = r["reasoning_effort"]

        def pick(pool):
            # Several snapshots of one model: prefer the latest released on/before the DeepSWE
            # results date. A single candidate is taken as-is (labs give DeepSWE early access).
            if len(pool) > 1 and added:
                pool = [m for m in pool if (m.get("release_date") or "") <= added] or pool
            return max(pool, key=lambda m: m.get("release_date") or "") if pool else None

        # Best counterpart: same undated family, stated effort == DeepSWE effort (reasoning on).
        family = by_undated.get(model, [])
        best = pick(
            [
                m
                for m in family
                if (name_effort(m["name"]) == want_level if want_level else name_effort(m["name"]) in ("unlabelled", "reasoning"))
            ]
        ) or pick([m for m in family if name_effort(m["name"]) == "unlabelled"])

        if hit is None:
            status = "unmatched"
        else:
            stated = name_effort(hit["name"])
            if r["reasoning_effort"] is None:
                status = "clean (both unlabelled)" if stated == "unlabelled" else f"effort unknown on DeepSWE side ({stated})"
            elif stated == "unlabelled":
                status = "unverifiable (AA name has no effort)"
            elif stated.startswith("non-reasoning"):
                status = "wrong reasoning mode (AA non-reasoning)"
            elif stated != r["reasoning_effort"]:
                status = f"wrong effort (AA = {stated})"
            elif added and (hit.get("release_date") or "") > added and best and best["id"] != hit["id"]:
                status = "wrong version (AA entry newer than DeepSWE results)"
            elif via == "direct" and effort == "max":
                status = "clean (max -> bare slug)"
            elif via == "direct":
                status = "clean (suffix match)"
            else:
                status = "clean (by fallback)"
        results.append(
            {
                "model": model,
                "effort": r["reasoning_effort"],
                "hit": hit["slug"] if hit else None,
                "hit_name": hit["name"] if hit else None,
                "via": via,
                "status": status,
                "best": best["slug"] if best else None,
                "best_name": best["name"] if best else None,
            }
        )
    return results


def section_join(deepswe: dict, aa: list[dict]):
    results = simulate_join(deepswe, aa)
    print("\n## DeepSWE -> AA join under today's rules\n")
    summary = Counter(re.sub(r" \(AA = .*\)", " (AA = other level)", x["status"]) for x in results)
    print(table(["status", "rows"], [[k, v] for k, v in summary.most_common()]))
    print("\nPer row:\n")
    rows = []
    for x in results:
        best = x["best"] if x["best"] != x["hit"] else "same"
        rows.append(
            [
                f"`{x['model']}`",
                x["effort"],
                f"`{x['hit']}`" if x["hit"] else "-",
                x["hit_name"] or "-",
                x["via"],
                x["status"],
                f"`{best}`" if best and best != "same" else (best or "none"),
            ]
        )
    print(table(["DeepSWE model", "effort", "AA hit", "AA name", "via", "status", "better AA match"], rows))
    print("\nPer model:\n")
    per_model = defaultdict(Counter)
    for x in results:
        per_model[x["model"]][x["status"].split(" (")[0]] += 1
    print(table(["model", "rows by status"], [[f"`{m}`", ", ".join(f"{k} {v}" for k, v in c.items())] for m, c in sorted(per_model.items())]))


def section_history(history_dir: str):
    files = sorted(glob.glob(os.path.join(history_dir, "20*.json")))
    if not files:
        return
    print("\n## AA history: what a stable `id` shows\n")
    id_slugs, id_names, slug_ids = defaultdict(list), defaultdict(list), defaultdict(list)
    last_seen, sources, dates = {}, Counter(), []
    for f in files:
        date = os.path.basename(f)[:-5]
        body = json.load(open(f))
        sources[body.get("meta", {}).get("source_type")] += 1
        dates.append(date)
        for m in body["models"]:
            i, s, n = m["id"], m["slug"], m["name"]
            if not id_slugs[i] or id_slugs[i][-1][1] != s:
                id_slugs[i].append((date, s))
            if not id_names[i] or id_names[i][-1][1] != n:
                id_names[i].append((date, n))
            if not slug_ids[s] or slug_ids[s][-1][1] != i:
                slug_ids[s].append((date, i))
            last_seen[i] = date
    print(f"{len(files)} daily snapshots {dates[0]}..{dates[-1]} (sources: {dict(sources)}); {len(id_slugs)} ids, {len(slug_ids)} slugs.\n")
    renamed = [(i, h) for i, h in id_slugs.items() if len(h) > 1]
    print(f"Ids whose slug changed: {len(renamed)}\n")
    print(table(["id", "slug history (first seen)"], [[i[:8], " -> ".join(f"`{s}` ({d})" for d, s in h)] for i, h in renamed]))
    repointed = [(s, h) for s, h in slug_ids.items() if len(h) > 1]
    print(f"\nSlugs that pointed at more than one id: {len(repointed)}\n")
    print(
        table(
            ["slug", "id history (first seen) and name"],
            [[f"`{s}`", " -> ".join(f"{i[:8]} ({d}, {id_names[i][-1][1]})" for d, i in h)] for s, h in repointed],
        )
    )
    changed = [(i, h) for i, h in id_names.items() if len(h) > 1]
    print(f"\nIds whose name changed: {len(changed)}\n")
    print(
        table(
            ["slug (latest)", "name history"],
            [[f"`{id_slugs[i][-1][1]}`", " => ".join(f"[{d}] {n.strip()}" for d, n in h).replace("\n", " ")] for i, h in changed],
        )
    )
    gone = [(id_slugs[i][-1][1], d) for i, d in last_seen.items() if d != dates[-1]]
    print(f"\nIds that disappeared before {dates[-1]}: " + ", ".join(f"`{s}` (last {d})" for s, d in sorted(gone, key=lambda x: x[1])))


def section_deepswe_v1(cache: str, refresh: bool):
    """The older v1 artifact is still served; it shows how DeepSWE's own labels drifted."""
    path = os.path.join(cache, "deepswe_v1.json")
    try:
        if refresh or not os.path.exists(path):
            json.dump(get_json(DEEPSWE_URL.replace("/v1.1/", "/v1/")), open(path, "w"))
    except OSError:
        return
    v1 = json.load(open(path))
    print("\n## DeepSWE v1 artifact (still served)\n")
    print(f"generated_at {v1.get('generated_at')}; latest_job {v1.get('latest_job')}; {len(v1['rows'])} rows.\n")
    print(table(["model", "reasoning_effort", "config"], [[f"`{r['model']}`", r.get("reasoning_effort"), f"`{r['config']}`"] for r in v1["rows"]]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "source-conventions"))
    parser.add_argument("--env", default=".env")
    parser.add_argument("--history", default=None)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    deepswe, aa = load_sources(args.cache, args.env, args.refresh)
    print("# Source conventions: generated tables\n")
    print(f"DeepSWE generated_at {deepswe['generated_at']}; AA models {len(aa)}.\n")
    section_aa_slugs(aa)
    section_aa_names(aa)
    section_bare_slugs(aa)
    section_dated_siblings(aa)
    section_today_collisions(aa)
    section_deepswe(deepswe)
    section_join(deepswe, aa)
    section_deepswe_v1(args.cache, args.refresh)
    if args.history:
        section_history(args.history)


if __name__ == "__main__":
    main()
