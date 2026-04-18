// Content script for homes.co.nz/address/* listings.
// Selector evidence lives in extension/src/lib/extractors.ts and
// extension/tests/fixtures/homes/*.html.
import { mountBadge } from "./mount";
import { extractHomes } from "@/lib/extractors";

mountBadge({ site: "homes.co.nz", extractor: extractHomes });
