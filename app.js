import { parsePolicy, parseDenial, analyse, timeline, letters } from "./engine.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
let current = null, drafts = null, active = "gro";

const sampleBox = $("samples");
SAMPLES.forEach((s) => {
  const b = document.createElement("button");
  b.className = "sample"; b.dataset.id = s.id; b.dataset.testid = "sample-" + s.id;
  b.innerHTML = `<b>${s.title}</b><span class="tag ${s.id === "valid" ? "ok" : ""}">${s.tag}</span>`;
  b.onclick = () => { document.querySelectorAll(".sample").forEach((x) => x.classList.remove("on")); b.classList.add("on"); current = s; $("policyText").value = s.policy; $("denialText").value = s.denial; };
  sampleBox.appendChild(b);
});

async function readFile(file) {
  if (!file) return "";
  if (file.name.toLowerCase().endsWith(".pdf") && window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      let lastY = null;
      for (const it of tc.items) { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 3) out += "\n"; out += it.str; lastY = it.transform[5]; }
      out += "\n";
    }
    return out;
  }
  return await file.text();
}
$("policyFile").onchange = async (e) => ($("policyText").value = await readFile(e.target.files[0]));
$("denialFile").onchange = async (e) => ($("denialText").value = await readFile(e.target.files[0]));

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const ICON = { breach: "!", warn: "?", pass: "✓", na: "–" };
const LABEL = { STRONG: ["Strong case", "Rule breaches found"], POSSIBLE: ["Possible case", "Gaps worth challenging"], WEAK: ["Needs evidence", "Denial looks procedurally sound"] };

function highlight(text, words) {
  let t = esc(text);
  words.forEach((w) => { t = t.replace(new RegExp("(" + w + ")", "gi"), "<mark>$1</mark>"); });
  return t;
}

$("decode").onclick = () => {
  const ptxt = $("policyText").value.trim(), dtxt = $("denialText").value.trim();
  if (!ptxt || !dtxt) { alert("Pick a sample case or add both documents."); return; }
  const policy = parsePolicy(ptxt), denial = parseDenial(dtxt), r = analyse(policy, denial);
  drafts = letters(policy, denial, r);
  $("empty").hidden = true; $("out").hidden = false;
  const [lab, sub] = LABEL[r.strength];
  $("verdict").innerHTML = `<div class="badge ${r.strength}" data-testid="verdict">${lab}<small>${sub}</small></div>
    <div class="vmeta"><b>${esc(policy.insurer || "Insurer")} · Claim ${esc(denial.claimNo || "—")}</b>
    <p>${denial.reasons.map((x) => x.label).join(", ") || "Reason not detected"} · cites ${denial.cited.length ? "Clause " + denial.cited.join(", ") : "no clause"}</p></div>
    <div class="kpis"><div class="kpi"><b>${denial.amount ? "₹" + denial.amount.toLocaleString("en-IN") : "—"}</b><span>in dispute</span></div>
    <div class="kpi"><b>${r.tenure ?? "—"}</b><span>months of cover</span></div>
    <div class="kpi"><b style="color:var(--coral)">${r.breaches}</b><span>breaches</span></div></div>`;
  $("checks").innerHTML = r.checks.map((c, i) => `<li class="${c.status}" style="animation-delay:${i * 0.18}s"><span class="dot">${ICON[c.status]}</span><div><b>${esc(c.title)}</b><p>${esc(c.detail)}</p></div><span class="rule">${esc(c.rule)}</span></li>`).join("");
  $("cited").innerHTML = r.citedClauses.length ? r.citedClauses.map((c) => c.clause
    ? `<div class="clause"><b>Clause ${c.id} · ${esc(c.clause.title)}</b>${highlight(c.clause.text, ["\\d+ months", "unless[^.]+", "excluded"])}</div>`
    : `<div class="clause"><b>Clause ${c.id}</b>Not found in your policy wording.</div>`).join("") : `<div class="clause">No clause cited in the denial.</div>`;
  $("helpful").innerHTML = r.helpful.map((h) => `<div class="clause"><b>Clause ${h.clause.id} · ${esc(h.clause.title)}</b>${highlight(h.clause.text, ["sixty continuous months", "Ombudsman", "established fraud"])}</div>`).join("") || `<div class="clause">No other relevant clauses found.</div>`;
  $("timeline").innerHTML = timeline(denial).map((t) => `<li><span class="when">${t.when}</span><b>${t.step}</b><span>${t.note}</span></li>`).join("");
  showLetter("gro");
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
};

function showLetter(k) {
  active = k;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.k === k));
  $("letter").textContent = drafts[k];
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => showLetter(b.dataset.k)));
$("copy").onclick = async () => { try { await navigator.clipboard.writeText(drafts[active]); $("copy").textContent = "Copied ✓"; setTimeout(() => ($("copy").textContent = "Copy"), 1500); } catch {} };
$("dl").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([drafts[active]], { type: "text/plain" }));
  a.download = `ClaimSaathi_${active}.txt`; a.click();
};
