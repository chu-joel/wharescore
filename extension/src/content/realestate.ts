// Content script for realestate.co.nz/{id}/residential/sale/* listings.
import { mountBadge } from "./mount";
import { extractRealestate } from "@/lib/extractors";

mountBadge({ site: "realestate.co.nz", extractor: extractRealestate });
