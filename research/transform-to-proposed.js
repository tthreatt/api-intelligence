#!/usr/bin/env node
/**
 * Transforms sample.json to RAG-ready proposed shape:
 * - camelCase top-level keys
 * - profileMetadata (npi, providerType, resultStatus, hasBoardAction, states, categories, issuers)
 * - Each license gets state (canonical code) for slicing
 * - Normalize boardAction to boardActionData only
 * - npiValidation: otherLastNameTypeCode, providerTypeLabel, taxonomyCode/taxonomyLabel on licenses
 */
const fs = require('fs');
const path = require('path');

const ISSUER_TO_STATE = {
  'California': 'CA', 'Oklahoma': 'OK', 'Michigan': 'MI', 'Pennsylvania': 'PA',
  'West Virginia': 'WV', 'Texas': 'TX', 'Florida': 'FL', 'New York': 'NY'
};

function licenseState(lic) {
  const ai = lic.additionalInfo || {};
  if (ai.licenseState) return ai.licenseState;
  return ISSUER_TO_STATE[lic.issuer] || null;
}

function normalizeLicense(lic) {
  const state = licenseState(lic);
  const out = { ...lic };
  if (state != null) out.state = state;

  // Normalize board action: always use boardActionData; fold boardActionDetails + boardActionScreenshotId into it if needed
  if (out.boardActionDetails || out.boardActionScreenshotId) {
    out.boardActionData = out.boardActionData || {
      boardActionScreenshotIds: out.boardActionScreenshotId ? [out.boardActionScreenshotId] : [],
      boardActionTexts: out.boardActionDetails ? [out.boardActionDetails] : []
    };
    delete out.boardActionDetails;
    delete out.boardActionScreenshotId;
  }

  return out;
}

function extractTaxonomy(codeStr) {
  if (!codeStr || typeof codeStr !== 'string') return { taxonomyCode: null, taxonomyLabel: null };
  const match = codeStr.match(/^(\d+[A-Z0-9]*)\s*[-–]\s*(.+)$/);
  if (match) return { taxonomyCode: match[1], taxonomyLabel: match[2].trim() };
  return { taxonomyCode: codeStr, taxonomyLabel: codeStr };
}

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample.json'), 'utf8'));

const licenses = (raw['Licenses'] || raw.licenses || []).map(normalizeLicense);
const npiVal = raw['NPI Validation'] || raw.npiValidation || {};
const npiLicenses = (npiVal.licenses || []).map(l => {
  const { taxonomyCode, taxonomyLabel } = extractTaxonomy(l.code);
  return { ...l, taxonomyCode, taxonomyLabel };
});

const primaryTax = npiLicenses.find(l => l.switch === 'Yes') || npiLicenses[0];
const providerTypeLabel = primaryTax ? (primaryTax.taxonomyLabel || primaryTax.code) : null;
const providerTypeCode = primaryTax ? (primaryTax.taxonomyCode || null) : null;

const hasBoardAction = licenses.some(l => l.hasBoardAction === true);
const states = [...new Set(licenses.map(l => licenseState(l)).filter(Boolean))].sort();
const categories = [...new Set(licenses.map(l => l.category))].sort();
const issuers = [...new Set(licenses.map(l => l.issuer))].sort();

const npiValidation = {
  ...npiVal,
  otherLastNameTypeCode: npiVal.otherLastNameTypecode || npiVal.otherLastNameTypeCode,
  providerTypeLabel,
  providerTypeCode,
  licenses: npiLicenses
};
if (npiValidation.otherLastNameTypecode !== undefined) delete npiValidation.otherLastNameTypecode;

const proposed = {
  profileMetadata: {
    npi: npiVal.npi || raw.searchRequest?.npis?.[0],
    providerTypeCode,
    providerTypeLabel,
    resultStatus: raw.resultStatus,
    hasBoardAction,
    states,
    categories,
    issuers
  },
  cmsPreclusionList: raw['CMS Preclusion List'] ?? raw.cmsPreclusionList ?? [],
  exclusions: raw.Exclusions ?? raw.exclusions ?? [],
  licenses,
  npiValidation,
  ofac: raw.OFAC ?? raw.ofac ?? [],
  optOut: raw['Opt Out'] ?? raw.optOut ?? {},
  primarySourceCheckedDates: raw['Primary Source Checked Dates'] ?? raw.primarySourceCheckedDates ?? [],
  resultStatus: raw.resultStatus,
  searchHistoryId: raw.searchHistoryId,
  searchRequest: raw.searchRequest
};

fs.writeFileSync(
  path.join(__dirname, 'sample_proposed.json'),
  JSON.stringify(proposed, null, 2),
  'utf8'
);
console.log('Wrote sample_proposed.json');
