# backend/app/services/abbreviations.py
from __future__ import annotations
import re
import unicodedata

# Road type abbreviations — only expand when preceded by another word
# to avoid "St Heliers" → "Street Heliers"
ROAD_ABBREVS = {
    "st": "street", "rd": "road", "ave": "avenue", "dr": "drive",
    "pl": "place", "cres": "crescent", "tce": "terrace", "ct": "court",
    "ln": "lane", "hwy": "highway", "esp": "esplanade", "pde": "parade",
    "sq": "square", "gr": "grove", "cl": "close", "way": "way",
    "bvd": "boulevard", "blvd": "boulevard", "cct": "circuit",
}

# Suburb/city abbreviations — always expand
GENERAL_ABBREVS = {
    "wgtn": "wellington", "wlg": "wellington", "welly": "wellington",
    "chch": "christchurch", "akl": "auckland", "dn": "dunedin",
    "hb": "hawkes bay", "bop": "bay of plenty",
    "nth": "north", "sth": "south", "mt": "mount",
}


def strip_diacritics(text: str) -> str:
    """Remove macrons and other diacritics: 'Māori' → 'Maori'."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def expand_abbreviations(query: str) -> str:
    """Expand common NZ address abbreviations.
    Road types only expand when preceded by another word."""
    words = query.strip().split()
    if not words:
        return query

    result = []
    for i, word in enumerate(words):
        lower = word.lower().rstrip(".,")
        # Road type abbreviation — only expand if not first word
        if i > 0 and lower in ROAD_ABBREVS:
            result.append(ROAD_ABBREVS[lower])
        # General abbreviation — always expand
        elif lower in GENERAL_ABBREVS:
            result.append(GENERAL_ABBREVS[lower])
        else:
            result.append(word)

    return " ".join(result)


def sanitize_tsquery_token(token: str) -> str:
    """Strip characters that break to_tsquery. Keep only alphanumeric + hyphens."""
    cleaned = re.sub(r"[^a-zA-Z0-9\-]", "", token)
    return cleaned


def build_tsquery(query: str) -> str:
    """Build a tsquery string for PostgreSQL full-text search.
    All tokens joined with & (AND). Last token gets :* (prefix match).
    Example: 'cuba str' → 'cuba & str:*'
    """
    stripped = strip_diacritics(query)
    tokens = stripped.strip().split()
    sanitized = [sanitize_tsquery_token(t) for t in tokens]
    sanitized = [t for t in sanitized if t]  # remove empties

    if not sanitized:
        return ""
    if len(sanitized) == 1:
        return f"{sanitized[0]}:*"

    # All tokens except last are exact, last gets prefix
    parts = [t for t in sanitized[:-1]]
    parts.append(f"{sanitized[-1]}:*")
    return " & ".join(parts)
