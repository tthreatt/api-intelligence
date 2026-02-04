# RAG Patterns: Products vs Provider Profiles

This document compares how **e-commerce product data** (`additional_example.json`) and **provider profile data** (`sample_proposed.json`, `why-sample-proposed-changes.md`) use tags, metadata, and derived blocks for RAG and “across entity” queries. The **data** is different (products vs providers), but the **patterns** are the same.

---

## 1. Filterable Dimensions (Metadata for Slicing)

Both shapes expose **discrete dimensions** so retrieval can filter (“by category,” “by state,” “by occasion”) and support “across X” queries.

| Products (`additional_example.json`) | Providers (`sample_proposed` / doc) |
|--------------------------------------|--------------------------------------|
| `tags`, `categoryIds` | `profileMetadata.categories`, `profileMetadata.issuers`, `profileMetadata.states` |
| `ai.styleAttributes` (occasion, season, formality, colorPalette) | `licenses[].category`, `licenses[].state`, `licenses[].issuer`, `resultStatus`, `hasBoardAction` |

**Same role:** dimensions you attach to every chunk (or every entity) so the system can filter before or after vector search.

---

## 2. Human-Queryable Labels (Semantic / Natural Language)

Both keep **codes/IDs** for machines and **labels/tags** for natural-language and semantic search.

| Products | Providers |
|----------|-----------|
| `tags` (“anti to-do list”, “builder energy”) | `providerTypeLabel`, `taxonomyLabel` (“Plastic and Reconstructive Surgery”) |
| `ai.semanticTags` (“focus on impact”, “builder energy”) | Taxonomy labels so “by provider type” works in natural language |
| `aiGenerated.description`, `seoKeywords` | Same idea: text the LLM or user can match against |

**Same role:** “find things like this” and “explain in natural language” without relying only on codes.

---

## 3. Canonical Code + Label

Both use a **canonical value** for filtering and consistency, plus **human-facing labels** for display and search.

| Products | Providers |
|----------|-----------|
| `categoryIds` (e.g. `cat_tshirts`) + `tags` / `semanticTags` | `taxonomyCode` (e.g. `2086S0122X`) + `taxonomyLabel` |
| `variants[].attributes.color` + `colorHex` | `state` (e.g. `CA`) instead of only “California” |

**Same role:** one token per concept for filters; labels for UI and natural-language context.

---

## 4. One Summary / Metadata Block per Entity

Both define a **derived block** that pulls the most important dimensions (and optionally narrative) into one place so every chunk (or every card) can use it without re-scanning the full entity.

| Products | Providers |
|----------|-----------|
| `agent`: `primaryUseCases`, `toneOfVoice`, `keySellingPoints` — one block per product for agent/LLM context | `profileMetadata`: `npi`, `providerType`, `resultStatus`, `hasBoardAction`, `states[]`, `categories[]`, `issuers[]` — one block per profile for RAG filters and context |

**Same role:** denormalized “summary” so retrieval and the LLM get consistent metadata and narrative in one place.

---

## 5. Embeddings / Vectors

Products include `ai.embeddings` (text, name, description, combined) for vector search. The provider docs don’t show embeddings in the sample, but the **flow** is the same: metadata for filters, vectors for similarity, labels/tags for semantic and natural-language use.

---

## Summary

| Pattern | Products | Providers |
|--------|----------|-----------|
| Filterable dimensions | tags, categoryIds, styleAttributes | categories, issuers, states, resultStatus, hasBoardAction |
| Human-queryable labels | tags, semanticTags, aiGenerated | providerTypeLabel, taxonomyLabel |
| Canonical + label | categoryIds + tags; color + colorHex | taxonomyCode + taxonomyLabel; state code (CA) |
| One summary block | `agent` (primaryUseCases, keySellingPoints) | `profileMetadata` (npi, providerType, states[], etc.) |
| Vectors | `ai.embeddings` | (same flow: metadata filters + vector search) |

The e-commerce example in `additional_example.json` is the **same RAG-ready shape** applied to a different domain: filterable dimensions, human-queryable tags/labels, canonical code + label, and a single summary/metadata block per entity.
