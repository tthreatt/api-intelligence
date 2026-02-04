# Why the Proposed Profile Shape (`sample_proposed.json`) Differs from `sample.json`

This document explains the rationale for each change applied when transforming raw profile data (`sample.json`) into the RAG-ready proposed shape (`sample_proposed.json`). The changes align with the project’s data-prep and RAG design described in `docs/profile-data-prep-for-rag.md`, `docs/profile-rag-query-summary.md`, and `diagrams/profile-rag-flow.mmd`.

---

## 1. Consistent camelCase Top-Level Keys

**Change:**  
- `"CMS Preclusion List"` → `cmsPreclusionList`  
- `"Exclusions"` → `exclusions`  
- `"Licenses"` → `licenses`  
- `"NPI Validation"` → `npiValidation`  
- `"OFAC"` → `ofac`  
- `"Opt Out"` → `optOut`  
- `"Primary Source Checked Dates"` → `primarySourceCheckedDates`

**Why:**  
Stable, programmatic keys make pipelines and retrieval code predictable. Spaces and title case in keys are brittle for filtering, indexing, and schema documentation. CamelCase matches common API/JSON conventions and keeps the schema easy to reference in prompts and code.

---

## 2. New `profileMetadata` Block

**Change:**  
A new top-level object `profileMetadata` was added with:  
`npi`, `providerTypeCode`, `providerTypeLabel`, `resultStatus`, `hasBoardAction`, `states`, `categories`, `issuers`.

**Why:**  
RAG and “across providers” queries need **one place per profile** that carries the dimensions you slice and filter on. In the raw data, provider type lives only in NPI Validation (taxonomy), while licenses live in Licenses—so a single license chunk doesn’t carry provider type or profile-level risk.  

By **denormalizing** those dimensions into `profileMetadata`, every indexed unit (profile summary or license chunk) can attach this same block as metadata. That enables:

- **Metadata filters** before/after vector search (e.g. “only ISSUE_FOUND,” “only STATE_LICENSE in CA,” “only providers with board action”).
- **Consistent context** for the LLM so “by provider type” and “across issuers” are well-defined.

So `profileMetadata` is the derived summary layer that makes Option A (profile summary) and Option B (section-level chunks) both work without re-scanning the full profile each time.

---

## 3. Canonical `state` on Every License (Where Applicable)

**Change:**  
Each license now has a `state` field (e.g. `CA`, `OK`, `MI`, `PA`, `WV`) when it can be derived from `additionalInfo.licenseState` or from the issuer name (e.g. “California” → `CA`).

**Why:**  
Query dimensions in the docs include **jurisdiction** (state vs federal, and by state). Slicing “by state” or “licenses in California” requires a **canonical state code** on each license. In the raw data, state is sometimes only in `additionalInfo.licenseState` (DEA) or only implied by issuer (“California,” “Oklahoma”). Putting an explicit `state` on each license:

- Makes filter semantics clear (“state = CA”).
- Avoids mixing “California” and “CA” in the same dimension.
- Supports “where do we have gaps by state?” and jurisdiction-level analytics.

---

## 4. Normalized Board Action: `boardActionData` Only

**Change:**  
Board action is represented in a single shape: `boardActionData` with `boardActionScreenshotIds` and `boardActionTexts`. Where the raw data had only `boardActionDetails` (string) and `boardActionScreenshotId` (single id), those were folded into `boardActionData` (arrays). The old `boardActionDetails` / `boardActionScreenshotId` fields were removed.

**Why:**  
The raw profile mixed two representations (a string + single id vs an object with arrays). One consistent structure:

- Simplifies **retrieval and chunking** (one path for “board action” content).
- Makes it easier for the LLM and downstream code to handle “board action present” the same way everywhere.
- Keeps semantics clear: “board action” = `boardActionData` with optional screenshot ids and text snippets.

---

## 5. NPI Validation: Taxonomy and Naming

**Changes:**  
- `otherLastNameTypecode` → `otherLastNameTypeCode` (consistent camelCase).  
- Added `providerTypeCode` and `providerTypeLabel` at the NPI Validation level (from the primary taxonomy).  
- In `npiValidation.licenses`, added `taxonomyCode` and `taxonomyLabel` by parsing the existing `code` string (e.g. `"2086S0122X - Allopathic & Osteopathic Physicians - Surgery - ..."` → code `2086S0122X`, label `"Allopathic & Osteopathic Physicians - Surgery - ..."`).

**Why:**  
- **Taxonomy codes** (e.g. `2086S0122X`) are not human-queryable; **labels** are. Storing both lets the system filter by code and still show or reason about “Plastic and Reconstructive Surgery” in natural language.  
- The docs say: either store labels in the data or provide a mapping in context. We do both: labels on the profile and in taxonomy entries so “by provider type” and “across provider types” work in RAG and in UI.  
- `providerTypeCode` / `providerTypeLabel` at the profile level mirror what goes into `profileMetadata` and support “what is this provider’s type?” without re-parsing.

---

## 6. Primary Source Checked Dates Key Rename Only

**Change:**  
Only the top-level key was renamed to `primarySourceCheckedDates` (camelCase). The structure and field names inside each entry were already consistent (`jurisdiction`, `primarySourceCheckedDate`, `recordType`, `source`, etc.).

**Why:**  
Same as §1: consistent top-level naming for pipelines and schema. The content of this section is already suitable for “when was this source checked?” and jurisdiction/source-level queries.

---

## Summary Table

| Change | Purpose |
|--------|--------|
| CamelCase top-level keys | Stable schema; easier pipelines and retrieval. |
| `profileMetadata` | One place with npi, provider type, result status, board action, states/categories/issuers for RAG filters and “across providers” queries. |
| `state` on each license | Canonical jurisdiction for filtering and gap/jurisdiction analytics. |
| Normalized `boardActionData` | Single representation for board action; simpler chunking and LLM context. |
| Taxonomy code + label (NPI Validation) | Human-queryable provider type; supports “by provider type” and taxonomy-aware context. |

Together, these changes turn the raw profile into a **normalized, denormalized** shape that supports the indexing and query flow in the project: metadata filters + vector search, with schema and taxonomy available so the LLM can interpret “issuer,” “category,” “provider type,” and “jurisdiction” consistently.
