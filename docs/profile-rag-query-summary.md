# Profile Data: Cross-Provider Querying & RAG Summary

Summary of how to query structured profile data across providers/provider types, design RAG on top of it, and what context to provide. Based on `research/sample.json` and `docs/260203_meetingnotes.md`.

---

## 1. Data Shape (Profile)

Each **profile** is one provider (one NPI) with:

- **Licenses**: array of items with `category` (STATE_LICENSE, CONTROLLED_SUBSTANCE_REGISTRATION, BOARD_CERTIFICATION), `issuer`, `origin` (PT_NETWORK, NPPES), `source`, `status`, `hasBoardAction`, `boardActionData` / `boardActionDetails`, and category-specific `additionalInfo`.
- **NPI Validation**: single object with NPI, taxonomy codes, provider name, addresses.
- **Primary Source Checked Dates**: per-source verification dates (by state/federal source and record type).
- **Result / flags**: `resultStatus` (e.g. ISSUE_FOUND), CMS Preclusion, Exclusions, OFAC, Opt Out.

---

## 2. Querying “Across” Providers / Provider Types

“Across” means slicing by:

| Dimension | Where it lives | Example |
|-----------|----------------|--------|
| **Issuer / source** | Licenses `issuer`, `source` | DEA vs state boards vs ABMS |
| **Category** | Licenses `category` | State license vs DEA vs board cert |
| **Provider type** | NPI Validation taxonomy | 2086S0122X vs 208600000X (specialty) |
| **Jurisdiction** | Primary Source Checked Dates, license state | State vs federal, or by state |
| **Risk / outcome** | `hasBoardAction`, `resultStatus`, Exclusions, Preclusion | Clean vs issue profiles |

Use **structured queries** (DB/OLAP) for counts, filters, and lists of NPIs. Use **RAG** for “why,” “what’s the pattern,” and “how do we compare across providers/types.”

---

## 3. RAG on Top: What to Index

**Goals**: Answer aggregate and interpretive questions (e.g. “Where do we have gaps?”, “How do board actions differ by state?”, “What does a typical issue profile look like?”), not only single-profile lookup.

**Chunking options:**

| Option | Unit | Best for |
|--------|------|----------|
| **A – Profile summary** | One doc per provider: short narrative + key facts | “Find providers like this,” “What does an issue profile look like?” |
| **B – Section-level** | One chunk per section per profile (e.g. Licenses–STATE_LICENSE–CA, NPI Validation) | “Which sources/issuers/categories,” “Where are we missing data?” |
| **C – Aggregates** | Precomputed reports (e.g. “Licenses: 60% STATE_LICENSE, 25% DEA…; board actions in 12%”) | Distribution and gap questions |

**Recommendation**: Hybrid of A + B (and optionally C). Attach **metadata** to every chunk: `npi`, `category`, `issuer`, `origin`, `provider_type`, `has_board_action`, `result_status`, `state` (where applicable) so retrieval can filter (e.g. “only STATE_LICENSE” or “only DEA” or “only ISSUE_FOUND”) before or after semantic search.

**Retrieval**: Metadata filters + vector search. Use the **database** for exact counts and NPI lists; use **RAG** for explanations and pattern-finding.

---

## 4. Context to Provide

So the model interprets the data correctly and “across provider types” is meaningful, provide this context explicitly.

### 4.1 Schema / data dictionary

- Top-level keys: Licenses, NPI Validation, Primary Source Checked Dates, Exclusions, etc.
- Per license: `category`, `issuer`, `origin`, `source`, `status`, `hasBoardAction`, `boardActionDetails` / `boardActionData`, `additionalInfo` (category-specific).
- NPI Validation: `npi`, `licenses` (taxonomy codes + state), `taxonomyGroup`, `providerNameDetails`, `entityType`.
- Primary Source Checked Dates: `source`, `jurisdiction`, `recordType`, `primarySourceCheckedDate` / `primarySourceLastVerifiedDate`.

### 4.2 Provider type / taxonomy

- Mapping of taxonomy codes (e.g. 2086S0122X, 208600000X) to human-readable labels so “by provider type” and “across provider types” are grounded.

### 4.3 Source and verification semantics

- **Origin**: e.g. PT_NETWORK vs NPPES (and that NPPES is often the canonical federal source).
- **primarySourceCheckedDate** / **primarySourceLastVerifiedDate**: what they mean (freshness); that null can mean “not checked” or “N/A.”

### 4.4 Result and risk semantics

- What `resultStatus` (e.g. ISSUE_FOUND) means.
- That `hasBoardAction` and `boardActionData` indicate disciplinary history; Exclusions / CMS Preclusion / OFAC are serious flags.

### 4.5 Per-query context

- **Single-provider**: Full profile or narrative summary + the specific licenses/sections retrieved; optionally a short schema snippet.
- **Cross-provider / aggregate**: Prefer **aggregate stats or precomputed facets** (counts by issuer, category, state, provider type; board action rates; exclusion counts) plus a few **example profiles** (or summaries). Optionally a **data-quality summary** (e.g. “primary source last checked in last 30 days for X% of STATE_LICENSE in California”).
- **Temporal**: For any chunk/summary, include “as of” or “last verified” (e.g. max `primarySourceLastVerifiedDate` on the profile) so the model doesn’t treat stale data as current.

### 4.6 Use-case-specific context (from meeting notes)

- **Rules engine / eligibility**: How “eligible” is defined (exclusions, preclusion, board action rules, state vs federal) so RAG can explain which profile parts matter and how they vary by provider type.
- **Statistical analyses / gaps**: What “gap” means (e.g. missing DEA for a prescribing specialty, missing primary source check for a state, stale verification) so the model can tie “where we have gaps” to issuers, provider types, and jurisdictions.
- **Provider narrative**: Template (board actions, state Medicaid sanctions, federal exclusion) so the model consistently pulls `boardActionData`, Exclusions, CMS Preclusion, OFAC and summarizes them.

---

## 5. Summary

| Topic | Summary |
|-------|--------|
| **Querying across** | Slice by issuer, category, taxonomy (provider type), jurisdiction, and risk flags; combine structured (DB) and semantic (RAG) queries. |
| **RAG design** | Index profile summaries + section-level chunks (+ optional aggregates); use metadata filters + vector search; use DB for exact counts and NPI lists. |
| **Context** | Schema, taxonomy mapping, source/verification and result/risk semantics, and per-query context (single profile vs aggregates + examples + freshness). |

This makes “across providers / provider types” and “gaps / rules / narrative” queries answerable in a consistent way.
