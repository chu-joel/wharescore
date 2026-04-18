// Content script for oneroof.co.nz/property/* listings.
import { mountBadge } from "./mount";
import { extractOneRoof } from "@/lib/extractors";

mountBadge({ site: "oneroof.co.nz", extractor: extractOneRoof });
