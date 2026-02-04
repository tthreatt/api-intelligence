# Profile Data Prep for RAG: What Has to Happen to the Data

How to prepare structured profile data so it can be queried by an LLM via RAG—and why “just put a chatbot on the dataset” usually isn’t enough.

---

## Do You Need “Just a Chatbot on Top of the Dataset”?

**Usually no.** A chatbot over raw profile JSON can do single-profile lookups and fuzzy semantic search, but it won’t reliably support “across providers” or “by provider type” unless you:

1. **Attach the right parameters to every unit you index**
2. **Optionally add derived layers** (summaries, aggregates) so cross-cutting questions have something to retrieve

So the real work is **data preparation and indexing design**, not only wiring an LLM to the existing dataset.

---

## What Must Happen to the Data for RAG to Work

### 1. Parameters Must Exist and Be Attached to Each Indexed Unit

RAG retrieves **chunks** (or documents). For “query by provider type” or “across issuers,” every chunk that comes from a profile must carry the **query dimensions** as:

- **Metadata** (for filters): e.g. `provider_type`, `issuer`, `category`, `state`, `result_status`, `has_board_action`
- **And/or in the text** (for semantic search): so the model can see “California,” “STATE_LICENSE,” “board action,” etc.

**Gap in raw data:**  
Provider type lives in **NPI Validation** (taxonomy), while licenses are in **Licenses**. So a chunk that is “one license” doesn’t, by itself, have provider type. You have to **denormalize**: when building chunks from licenses, attach profile-level fields (e.g. NPI, taxonomy/provider type, `resultStatus`, `hasBoardAction` at profile level). Same idea for “jurisdiction” if you derive it from Primary Source Checked Dates or license state.

**Concrete:**  
For every indexed unit, ensure it has (or can be joined to) at least: **npi**, **provider_type** (taxonomy code or label), **issuer**, **category**, **state/jurisdiction** (where applicable), **result_status**, **has_board_action**. Then your retrieval layer can filter (e.g. “only STATE_LICENSE, only California”) and the LLM can reason about “across providers / provider types.”

---

### 2. Decide the Queryable Unit and Derive It

- **Option A – One document per profile (summary)**  
  You don’t index raw JSON; you **derive** a summary per profile that includes: provider type, list of issuers/categories/states, result status, board action yes/no, and a short narrative. That derived summary is what you index (and optionally store the full JSON elsewhere). So the “data prep” step is: **build that summary + metadata** (npi, provider_type, result_status, has_board_action, states[], categories[], issuers[]).

- **Option B – One chunk per license (or per section)**  
  You index each license (or each logical section) as a chunk. Then **each chunk must carry** both license-level fields (issuer, category, state) and **profile-level fields** (npi, provider_type, result_status) in metadata (and optionally in the text). So the data prep is: **slice profiles into chunks + attach profile-level attributes to every chunk.**

- **Option C – Aggregates as documents**  
  You precompute tables or reports (e.g. “count of licenses by issuer and state,” “board action rate by provider type”) and index those as separate documents. So the data prep is: **compute and persist those aggregates** in a form that can be turned into text (or structured text) for indexing.

For RAG to support both “single provider” and “across providers,” you typically need **at least A or B**, and **C** if you want the LLM to answer distribution/gap questions from retrieved context rather than only from the DB.

---

### 3. Normalize and Standardize

For “across providers” and “by provider type” to be consistent:

- **Canonical values**: Same concept, same token—e.g. state “CA” vs “California” → pick one (or store both with a canonical code). Same for issuer (“DEA” vs “Drug Enforcement Administration”).
- **Taxonomy**: Codes like `2086S0122X` are not human-queryable. Either **store labels** (e.g. “Plastic and Reconstructive Surgery”) in the indexed data or provide a **mapping in the LLM context** so the model (and users) can say “provider type” in natural language.

So the data pipeline should **normalize** state, issuer, category, and provider type before you build chunks/summaries and index them.

---

### 4. Schema and Semantics in LLM Context

The data can have all the right parameters, but if the LLM doesn’t know what they mean, it will guess. So “what needs to happen” also includes **context you give the model** (not only the indexed data):

- Short **schema/data dictionary**: what `issuer`, `category`, `origin`, `resultStatus`, `primarySourceCheckedDate` mean.
- **Taxonomy mapping**: code → label (or a subset that’s relevant to queries).
- **Risk/result semantics**: e.g. ISSUE_FOUND, hasBoardAction, Exclusions, Preclusion.

That can live in system prompt or in a small “schema” doc you retrieve once per session. It doesn’t change the *content* of the data but it makes the *parameters* you’ve added actually usable by the LLM.

---

## Checklist: Data Prep for RAG-Queryable Profiles

| Step | Purpose |
|------|--------|
| **1. Denormalize profile → chunk** | Every chunk (license or section) carries npi, provider_type, result_status, has_board_action, plus license-level issuer, category, state. |
| **2. Normalize** | Canonical state, issuer, category; taxonomy code + label (or mapping in context). |
| **3. Choose unit** | Profile-level summary (A), section-level chunks (B), or both; optionally aggregates (C). |
| **4. Build derived layer** | If (A): write a summary + metadata per profile. If (C): compute and store aggregate stats/reports. |
| **5. Index with metadata** | Store the parameters as metadata in your vector store (or search index) so retrieval can filter before/after vector search. |
| **6. Provide schema/context** | Give the LLM a short schema and taxonomy so “provider type,” “issuer,” “jurisdiction” are well-defined. |

---

## Summary

- **Determine what needs to happen** by: (1) ensuring every indexed unit has the **parameters** (provider type, issuer, category, jurisdiction, result status, board action) as metadata/text; (2) **denormalizing** so profile-level attributes are on license/section chunks; (3) **normalizing** and adding taxonomy labels (or a mapping); (4) optionally **deriving** profile summaries and aggregate views for cross-provider questions.
- **Don’t** assume “just put an LLM chatbot on the dataset” is enough—that only works well if the dataset is already in the form above (per-unit parameters, consistent units, optional aggregates). So: design the **data pipeline and indexing** first, then the chatbot sits on top of *that* prepared, parameter-rich layer, not on the raw profile JSON alone.
