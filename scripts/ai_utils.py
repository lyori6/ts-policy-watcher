# scripts/ai_utils.py
"""Shared AI helpers: Cloudflare Workers AI (primary) with Gemini fallback,
prompt text and output cleanup."""

import json
import os
import re
import sys

import httpx
from google import genai

MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")  # 2.5-flash is closed to new users

# Cloudflare Workers AI. A mid-size model keeps a full regeneration inside the
# free daily allowance; override with CF_AI_MODEL if Cloudflare renames it.
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
CF_MODEL = os.environ.get("CF_AI_MODEL", "@cf/mistralai/mistral-small-3.1-24b-instruct")
CF_MAX_TOKENS = 2048

NO_PREAMBLE_RULES = (
    "Output rules: start directly with the substance. No preamble or meta text "
    "(never 'Here's a summary', 'As a Trust & Safety analyst', 'Summary for Product Manager'), "
    "no title or heading that restates the policy name, no closing remarks, and no '---' separators."
)

SUMMARY_PROMPT = """You are a Trust & Safety analyst writing for a product manager. {instruction}

{rules}

Policy content:
{policy_text}

Write concise markdown bullet points only."""

MATRIX_PROMPT = """You are a Trust & Safety analyst. Read the policy below and return ONLY a JSON object (no markdown fences, no commentary) with exactly these string keys:
- "coverage_areas": 2-4 short comma-separated topics the policy covers (e.g. "Hate speech, Harassment, Misinformation")
- "key_features": 1-3 short comma-separated user-facing features or mechanisms (e.g. "User blocking, Appeals")
- "enforcement_actions": 1-3 short comma-separated actions taken (e.g. "Content removal, Account suspension")
Each value must be under 60 characters.

Policy content:
{policy_text}"""

PREAMBLE_PATTERNS = [
    r"^here(?:'|’)?s\b.*",
    r"^here are\b.*",
    r"^here is\b.*",
    r"^as a trust\s*&\s*safety analyst.*",
    r"^(?:concise |brief |executive )?summary (?:for|of)\b.*",
    r"^\**(?:concise )?summary for (?:a |the )?product manager\**:?\**$",
    r"^\**(?:concise |policy )?summary\**:?\**$",
    r"^\**(?:key changes|overview|key information|policy overview|specific changes)\**:?\**$",
    r"^based on the (?:diff|policy|provided).*",
    r"^the key changes are\b.*",
    r"^(?:-{3,}|={3,}|\*{3,}|_{3,})$",
]
_PREAMBLE_RES = [re.compile(p, re.I) for p in PREAMBLE_PATTERNS]


def workers_ai_configured():
    return bool(CF_ACCOUNT_ID and CF_API_TOKEN)


def workers_ai_generate(prompt):
    """Single Workers AI call. Returns response text (may raise)."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{CF_MODEL}"
    response = httpx.post(
        url,
        headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
        json={"messages": [{"role": "user", "content": prompt}], "max_tokens": CF_MAX_TOKENS},
        timeout=120.0,
    )
    response.raise_for_status()
    data = response.json()
    text = (data.get("result") or {}).get("response")
    if isinstance(text, (dict, list)):
        # Workers AI returns JSON output already parsed
        text = json.dumps(text)
    if not data.get("success", True) or not text:
        raise RuntimeError(f"Workers AI returned no text: {data.get('errors')}")
    return text


def gemini_generate(api_key, prompt):
    """Single Gemini call with the given key. Returns response text (may raise)."""
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text


def generate(prompt, gemini_api_key=None):
    """Try Workers AI first; on any failure (including an exhausted free
    allocation) fall back to Gemini with the given key. May raise."""
    if workers_ai_configured():
        try:
            return workers_ai_generate(prompt)
        except Exception as e:
            print(f"WARNING: Workers AI failed ({e}); falling back to Gemini", file=sys.stderr)
    if not gemini_api_key:
        raise RuntimeError("No AI provider available (Workers AI failed or not configured, no Gemini key)")
    return gemini_generate(gemini_api_key, prompt)


def strip_preamble(text, strip_title=True):
    """Remove leading meta/preamble lines, separators and a leading title heading."""
    if not text:
        return text
    lines = text.strip().split("\n")
    out = []
    for line in lines:
        s = line.strip()
        plain = s.lstrip("#*> ").strip()
        if re.fullmatch(r"(?:-{3,}|={3,}|\*{3,}|_{3,})", s):
            continue
        if not out:
            if not s:
                continue
            if any(r.match(plain) or r.match(s) for r in _PREAMBLE_RES):
                continue
            # Leading markdown title heading (e.g. "## TikTok Community Guidelines Summary")
            if strip_title and s.startswith("#"):
                continue
        out.append(line.rstrip())
    return "\n".join(out).strip()


def parse_matrix(text):
    """Parse Gemini JSON into a matrix dict; return None if unusable."""
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    matrix = {}
    for key in ("coverage_areas", "key_features", "enforcement_actions"):
        val = data.get(key)
        if isinstance(val, list):
            val = ", ".join(str(v).strip() for v in val)
        if not isinstance(val, str) or not val.strip():
            return None
        matrix[key] = val.strip()
    return matrix
