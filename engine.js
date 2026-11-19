// ClaimSaathi engine: parse policy + denial, run IRDAI rule checks, retrieve clauses, draft letters.
// Pure functions, no network. Rules reference IRDAI Master Circular on Health Insurance Business
// (IRDAI/HLT/CIR/PRO/84/5/2024, 29 May 2024) and IRDAI Health FAQs.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); // dd/mm/yyyy
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}
const fmt = (d) => d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
function monthsBetween(a, b) {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return m;
}
function findLabel(text, labels) {
  for (const l of labels) {
    const re = new RegExp(l + "\\s*[:\\-]?\\s*([^\\n]+)", "i");
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}
function parseTime(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1]; const min = +m[2];
  if (m[3]) { const pm = m[3].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return h * 60 + min;
}

// ---------- Policy parsing ----------
export function parsePolicy(text) {
  const clauses = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(?:clause\s+)?(\d{1,2}(?:\.\d{1,2}){0,2})[\s.)]+(.+)$/i);
    if (m && m[2].length > 3) {
      if (cur) clauses.push(cur);
      cur = { id: m[1], title: m[2].split(/[:.]\s/)[0].trim().slice(0, 80), text: m[2] };
    } else if (cur && line) cur.text += " " + line;
  }
  if (cur) clauses.push(cur);
  const insurer = findLabel(text, ["Insurer", "Company"]);
  const product = findLabel(text, ["Product", "Plan name", "Plan"]);
  const inception = parseDate(findLabel(text, ["Continuous coverage since", "First policy inception date", "Policy inception date", "Inception date", "Policy commencement date"]) || "");
  const sumInsured = findLabel(text, ["Sum insured", "Sum Insured"]);
  const gro = findLabel(text, ["Grievance Redressal Officer", "Grievance officer", "GRO email"]);
  return { clauses, insurer, product, inception, sumInsured, gro };
}

// ---------- Denial parsing ----------
const REASONS = [
  { key: "PED", label: "Pre-existing disease / non-disclosure", re: /pre-?existing|non-?disclosure|not disclosed|misrepresent|concealment/i },
  { key: "WAIT", label: "Waiting period not completed", re: /waiting period|within the first|not completed/i },
  { key: "EXCL", label: "Permanent exclusion", re: /exclu|cosmetic|not payable|outside the scope/i },
  { key: "ROOM", label: "Room-rent / proportionate deduction", re: /room rent|proportionate|room category/i },
  { key: "DOCS", label: "Missing documents", re: /document|papers|not submitted/i },
];
export function parseDenial(text) {
  const cited = [...new Set([...text.matchAll(/clause\s*(?:no\.?\s*)?(\d{1,2}(?:\.\d{1,2}){0,2})/gi)].map((m) => m[1]))];
  const reasons = REASONS.filter((r) => r.re.test(text));
  const claimNo = findLabel(text, ["Claim number", "Claim no\\.?", "Claim ID", "Claim ref"]);
  const patient = findLabel(text, ["Patient name", "Insured person", "Patient"]);
  const policyNo = findLabel(text, ["Policy number", "Policy no\\.?"]);
  const admission = parseDate(findLabel(text, ["Date of admission", "Admission date", "Admitted on"]) || "");
  const decisionDate = parseDate(findLabel(text, ["Date of decision", "Decision date", "Date"]) || "");
  const reqTime = parseTime(findLabel(text, ["Final bill received", "Discharge request received", "Discharge request time"]) || "");
  const decTime = parseTime(findLabel(text, ["Decision time", "Decision communicated at", "Time of decision"]) || "");
  const amtMatch = text.match(/(?:amount (?:disallowed|repudiated|claimed)|claimed amount|claim amount)\s*[:\-]?\s*(?:rs\.?|inr|₹)\s*([\d,]+)/i);
  const amount = amtMatch ? +amtMatch[1].replace(/,/g, "") : null;
  const crc = /claims? review committee|product management committee|reviewed by (the )?committee/i.test(text);
  const fraud = /fraud/i.test(text);
  return { cited, reasons, claimNo, patient, policyNo, admission, decisionDate, reqTime, decTime, amount, crc, fraud, text };
}

// ---------- Retrieval (BM25 over clauses) ----------
const STOP = new Set("the a an of to and or in on for is are be by with any this that shall will as at from under such which".split(" "));
const tok = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
export function retrieve(policy, query, k = 3) {
  const docs = policy.clauses.map((c) => tok(c.title + " " + c.text));
  const N = docs.length || 1, avg = docs.reduce((a, d) => a + d.length, 0) / N;
  const df = {}; docs.forEach((d) => new Set(d).forEach((w) => (df[w] = (df[w] || 0) + 1)));
  const q = tok(query);
  const scores = docs.map((d, i) => {
    const tf = {}; d.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
    let s = 0;
    for (const w of q) {
      if (!tf[w]) continue;
      const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
      s += idf * (tf[w] * 2.2) / (tf[w] + 1.2 * (0.25 + 0.75 * d.length / avg));
    }
    return { clause: policy.clauses[i], score: s };
  });
  return scores.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

// ---------- Rule checks ----------
export function analyse(policy, denial) {
  const checks = [];
  const ref = denial.admission || denial.decisionDate || new Date();
  const tenure = policy.inception ? monthsBetween(policy.inception, ref) : null;
  const citedClauses = denial.cited.map((id) => ({ id, clause: policy.clauses.find((c) => c.id === id) || null }));
  const isPED = denial.reasons.some((r) => r.key === "PED");
  const MONTHS_RE = /(\d{1,3})\s*(months?|years?)/i;
  const isWait = denial.reasons.some((r) => r.key === "WAIT") || (isPED && citedClauses.some((c) => c.clause && MONTHS_RE.test(c.clause.text)));

  // 1. Clause citation (Para 17b)
  if (!denial.cited.length) checks.push({ id: "cite", status: "breach", title: "No policy clause cited", rule: "Para 17(b)", detail: "IRDAI requires a repudiation to give full details referencing the specific terms and conditions of the policy. This letter cites none." });
  else {
    const missing = citedClauses.filter((c) => !c.clause).map((c) => c.id);
    if (missing.length) checks.push({ id: "cite", status: "breach", title: `Cited clause ${missing.join(", ")} not found in your policy`, rule: "Para 17(b)", detail: "The clause number in the denial does not exist in the policy wording you provided. Ask the insurer to identify the exact clause." });
    else checks.push({ id: "cite", status: "pass", title: `Clause ${denial.cited.join(", ")} cited and found in policy`, rule: "Para 17(b)", detail: "The denial references a clause that exists in your policy. Read it below to check whether it really applies.", quote: citedClauses[0].clause.text });
  }

  // 2. Moratorium (Para 13)
  if (isPED) {
    if (tenure === null) checks.push({ id: "mor", status: "warn", title: "Moratorium: policy start date unknown", rule: "Para 13", detail: "Add the date of first policy inception (continuous cover, including portability) to test the 60-month moratorium." });
    else if (tenure >= 60 && !denial.fraud) checks.push({ id: "mor", status: "breach", title: `Moratorium applies: ${tenure} months of continuous cover`, rule: "Para 13", detail: `Cover has run since ${fmt(policy.inception)}. After 60 continuous months, no policy or claim can be contested on grounds of non-disclosure or misrepresentation, except established fraud. The letter alleges non-disclosure, not fraud.` });
    else if (tenure >= 60) checks.push({ id: "mor", status: "warn", title: `Moratorium crossed (${tenure} months) but fraud alleged`, rule: "Para 13", detail: "The moratorium does not protect established fraud. The insurer must prove it; ask for the evidence relied on." });
    else checks.push({ id: "mor", status: "pass", title: `Moratorium not yet reached (${tenure} of 60 months)`, rule: "Para 13", detail: `Moratorium protection starts on ${fmt(new Date(policy.inception.getFullYear(), policy.inception.getMonth() + 60, policy.inception.getDate()))}.` });
  } else checks.push({ id: "mor", status: "na", title: "Moratorium: not relevant to this denial reason", rule: "Para 13", detail: "Only applies to non-disclosure / misrepresentation grounds." });

  // 3. Waiting period cap (36 months)
  if (isWait) {
    const wc = citedClauses.find((c) => c.clause && MONTHS_RE.test(c.clause.text)) || { clause: policy.clauses.find((c) => /waiting/i.test(c.text) && MONTHS_RE.test(c.text)) };
    const wm = wc && wc.clause ? wc.clause.text.match(MONTHS_RE) : null;
    const months = wm ? (+wm[1]) * (/year/i.test(wm[2]) ? 12 : 1) : null;
    if (months && months > 36) checks.push({ id: "wait", status: "breach", title: `Waiting period of ${months} months exceeds the 36-month cap`, rule: "IRDAI FAQ 9", detail: `Clause ${wc.clause.id} applies a ${months}-month wait. IRDAI caps any waiting period at 36 months. With ${tenure ?? "?"} months of cover, the cap has ${tenure !== null && tenure >= 36 ? "already been crossed" : "not yet been crossed"}.`, quote: wc.clause.text });
    else if (months && tenure !== null && tenure >= months) checks.push({ id: "wait", status: "breach", title: `Waiting period of ${months} months already served (${tenure} months of cover)`, rule: `Clause ${wc.clause.id}`, detail: `The clause the insurer relies on stops applying after ${months} months of continuous cover. Cover has run ${tenure} months, so the exclusion no longer applies.`, quote: wc.clause.text });
    else checks.push({ id: "wait", status: months ? "pass" : "warn", title: months ? `Waiting period ${months} m within cap; ${tenure ?? "?"} m served` : "Waiting period length not found", rule: "IRDAI FAQ 9", detail: "Check the policy schedule for the exact waiting period that applies." });
  } else checks.push({ id: "wait", status: "na", title: "Waiting-period cap: not relevant", rule: "IRDAI FAQ 9", detail: "The denial does not rely on a waiting period." });

  // 4. Claims Review Committee (Para 17a)
  checks.push(denial.crc
    ? { id: "crc", status: "pass", title: "Claims Review Committee approval stated", rule: "Para 17(a)", detail: "The letter says the repudiation was reviewed by the committee." }
    : { id: "crc", status: "warn", title: "No Claims Review Committee approval mentioned", rule: "Para 17(a)", detail: "No claim may be repudiated without approval of the Product Management Committee / Claims Review Committee. Ask for a copy of that approval." });

  // 5. Discharge TAT (Para 16a)
  if (denial.reqTime !== null && denial.decTime !== null) {
    const mins = denial.decTime - denial.reqTime;
    checks.push(mins > 180
      ? { id: "tat", status: "breach", title: `Discharge decision took ${(mins / 60).toFixed(1)} h (limit 3 h)`, rule: "Para 16(a)", detail: "Final discharge authorisation must be given within 3 hours of the request. Any extra hospital charges caused by the delay should be borne by the insurer." }
      : { id: "tat", status: "pass", title: `Discharge decision within 3 h (${(mins / 60).toFixed(1)} h)`, rule: "Para 16(a)", detail: "Turnaround time complied with." });
  } else checks.push({ id: "tat", status: "na", title: "Discharge turnaround: times not provided", rule: "Para 16(a)", detail: "Add the bill-sent and decision times to test the 3-hour rule." });

  // 6. Exclusion relevance (retrieval)
  if (denial.reasons.some((r) => r.key === "EXCL")) {
    const c = citedClauses.find((x) => x.clause);
    checks.push({ id: "excl", status: c ? "warn" : "breach", title: c ? `Exclusion clause ${c.id} cited — check medical necessity` : "Exclusion claimed without a valid clause", rule: "Policy terms", detail: c ? "Exclusions such as cosmetic surgery usually do not apply when treatment is medically necessary (e.g., after an accident or burns). Ask your doctor for a necessity certificate." : "The insurer must point to the exact exclusion.", quote: c && c.clause.text });
  }

  const helpful = retrieve(policy, "moratorium sixty continuous months grievance ombudsman " + denial.reasons.map((r) => r.label).join(" "), 3)
    .filter((h) => !denial.cited.includes(h.clause.id));

  const breaches = checks.filter((c) => c.status === "breach").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const strength = breaches >= 1 ? "STRONG" : warns >= 2 ? "POSSIBLE" : "WEAK";
  return { checks, breaches, warns, strength, tenure, citedClauses, helpful };
}

// ---------- Escalation timeline ----------
export function timeline(denial) {
  const d0 = denial.decisionDate || new Date();
  return [
    { step: "Grievance to insurer's GRO", when: fmt(d0), note: "Send today. Insurer must acknowledge and resolve within 14 days." },
    { step: "Bima Bharosa (IRDAI portal)", when: fmt(addDays(d0, 15)), note: "If no satisfactory reply in 14 days." },
    { step: "Insurance Ombudsman", when: fmt(addDays(d0, 31)), note: `After the insurer rejects or fails to reply within 1 month. File before ${fmt(addDays(d0, 365))}. Free; awards up to ₹50 lakh.` },
    { step: "Consumer Commission (e-Daakhil)", when: "If needed", note: "Last resort; ClaimSaathi exports the full evidence bundle." },
  ];
}

// ---------- Letters ----------
export function letters(policy, denial, result, who = { name: "[Your name]", phone: "[Phone]", email: "[Email]" }) {
  const grounds = result.checks.filter((c) => c.status === "breach" || c.status === "warn");
  const pts = grounds.map((g, i) => `${i + 1}. ${g.title}. ${g.detail} (Ref: IRDAI Master Circular on Health Insurance Business, 29 May 2024, ${g.rule}.)`).join("\n\n");
  const amt = denial.amount ? `₹${denial.amount.toLocaleString("en-IN")}` : "the disallowed amount";
  const head = `Claim number: ${denial.claimNo || "[Claim no.]"}\nPolicy number: ${denial.policyNo || "[Policy no.]"}\nInsured person: ${denial.patient || "[Name]"}\nDate of admission: ${fmt(denial.admission)}`;
  const gro = `To,\nThe Grievance Redressal Officer\n${policy.insurer || "[Insurer name]"}${policy.gro ? "\n" + policy.gro : ""}\n\nSubject: Grievance against repudiation of health claim ${denial.claimNo || ""}\n\n${head}\n\nDear Sir/Madam,\n\nI write to contest your decision dated ${fmt(denial.decisionDate)} rejecting/partly disallowing my claim for ${amt}, citing ${denial.cited.length ? "Clause " + denial.cited.join(", ") : "no specific clause"}. The decision is not sustainable for the following reasons:\n\n${pts}\n\nI request that you (a) reconsider and settle the claim in full, (b) share a copy of the Claims Review Committee approval and all documents relied upon, and (c) respond within 14 days as required under IRDAI's grievance redressal guidelines.\n\nIf I do not receive a satisfactory resolution, I will escalate the matter to IRDAI's Bima Bharosa portal and the Insurance Ombudsman.\n\nYours faithfully,\n${who.name}\n${who.phone} · ${who.email}`;
  const bima = `Complaint type: Claim — Repudiation / partial settlement (Health)\nInsurer: ${policy.insurer || "[Insurer]"}\n${head}\nAmount in dispute: ${amt}\n\nDescription:\nMy health claim was rejected/partly disallowed on ${fmt(denial.decisionDate)} citing ${denial.cited.length ? "Clause " + denial.cited.join(", ") : "no clause"}. I filed a grievance with the insurer's GRO on [date] and have not received a satisfactory reply within 14 days.\n\nGrounds:\n${grounds.map((g) => "- " + g.title + " (" + g.rule + ")").join("\n")}\n\nRelief sought: Settlement of ${amt} with interest as applicable.`;
  const omb = `Before the Insurance Ombudsman, [City]\n(Complaint under Rule 14 of the Insurance Ombudsman Rules, 2017)\n\nComplainant: ${who.name}, ${who.phone}, ${who.email}\nRespondent insurer: ${policy.insurer || "[Insurer]"}\n${head}\nNature of complaint: Repudiation / partial repudiation of health claim\nAmount of relief sought: ${amt}\n\nFacts:\n1. Continuous health cover since ${fmt(policy.inception)} (${result.tenure ?? "?"} months at admission).\n2. Claim decision dated ${fmt(denial.decisionDate)} citing ${denial.cited.length ? "Clause " + denial.cited.join(", ") : "no clause"}.\n3. Grievance filed with the insurer on [date]; no reply / unsatisfactory reply on [date].\n\nGrounds:\n${pts}\n\nDeclaration: The complaint is not pending before any court, consumer forum or arbitrator.\n\nEnclosures: Policy schedule and wording, claim rejection letter, discharge summary, bills, grievance copy and reply.`;
  return { gro, bima, omb };
}
