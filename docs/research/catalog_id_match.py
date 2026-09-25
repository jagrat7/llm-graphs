"""Match DeepSWE model ids against public model catalogs (research for issue #5).

Usage:
    AA_API_KEY=... python3 docs/research/catalog_id_match.py

Fetches every catalog live. The AA key is read from the environment and is only
sent to artificialanalysis.ai; if it is unset the AA column is skipped.
Normalization (as specified in the issue): lowercase, "." -> "-", and drop any
"vendor/" prefix (everything up to the last "/").
"""

import json
import os
import urllib.request
from collections import defaultdict

UA = {"User-Agent": "llm-graphs-catalog-research"}
RECENT = ["gpt-6-astra", "claude-opus-5-5", "grok-4-6", "qwen3-8-max"]


def get(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def norm(model_id):
    return model_id.lower().split("/")[-1].replace(".", "-")


def deepswe_ids():
    d = get("https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json")
    return sorted({r["model"] for r in d["rows"]})


def load_catalogs():
    """Return {catalog: [(raw_id, vendor_key, vendor_name, display_name, release)]}."""
    cats = {}

    key = os.environ.get("AA_API_KEY")
    if key:
        rows, page = [], 1
        while True:
            d = get(
                f"https://artificialanalysis.ai/api/v2/language/models/free?page={page}",
                {"x-api-key": key},
            )
            rows += d["data"]
            if not d["pagination"]["has_more"]:
                break
            page += 1
        cats["AA free (slug)"] = [
            (m["slug"], m["model_creator"]["id"], m["model_creator"]["name"], m["name"], m["release_date"])
            for m in rows
        ]

    api = get("https://models.dev/api.json")
    canon = get("https://models.dev/models.json")
    cats["models.dev models.json"] = [
        (mid, mid.split("/")[0], api.get(mid.split("/")[0], {}).get("name"), m["name"], m.get("release_date"))
        for mid, m in canon.items()
    ]
    cats["models.dev api.json (any host)"] = [
        (mid, pid, p["name"], m["name"], m.get("release_date"))
        for pid, p in api.items()
        for mid, m in p["models"].items()
    ]

    orr = get("https://openrouter.ai/api/v1/models")["data"]
    cats["OpenRouter"] = [
        (m["id"], m["id"].split("/")[0], m["name"].split(": ")[0], m["name"].split(": ", 1)[-1], None)
        for m in orr
    ]

    vg = get("https://ai-gateway.vercel.sh/v1/models")["data"]
    cats["Vercel AI Gateway"] = [(m["id"], m["owned_by"], None, m["name"], m.get("released")) for m in vg]

    ll = get("https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json")
    cats["LiteLLM"] = [
        (k, v.get("litellm_provider"), None, None, None)
        for k, v in ll.items()
        if isinstance(v, dict) and k != "sample_spec"
    ]
    return cats


def main():
    ids = deepswe_ids()
    print(f"DeepSWE base ids: {len(ids)}\n")
    for name, rows in load_catalogs().items():
        idx = defaultdict(list)
        for row in rows:
            idx[norm(row[0])].append(row)
        hit = [i for i in ids if i in idx]
        miss = [i for i in ids if i not in idx]
        print(f"## {name}: {len(hit)}/{len(ids)} matched ({len(rows)} entries)")
        print("  recent:", {r: r in idx for r in RECENT})
        for i in miss:
            near = sorted({r[0] for k, v in idx.items() if k.startswith(i + "-") for r in v})[:4]
            print(f"  MISS {i}  near: {near}")
        vendors = sorted({(r[1], r[2]) for i in hit for r in idx[i][:1]}, key=str)
        print("  vendors (first hit):", vendors, "\n")


if __name__ == "__main__":
    main()
