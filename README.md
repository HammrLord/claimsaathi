# ClaimSaathi

**Your health-insurance claim was denied. That is not the final answer.**

ClaimSaathi decodes a denied health-insurance claim, tests the denial against IRDAI's Master Circular on Health Insurance Business (29 May 2024), and drafts a clause-cited appeal in minutes.

- **Live demo:** https://hammrlord.github.io/claimsaathi/
- **Pitch deck:** https://hammrlord.github.io/claimsaathi/deck.html ([PDF](https://hammrlord.github.io/claimsaathi/deck.pdf))
- **Demo video:** https://hammrlord.github.io/claimsaathi/demo.mp4

Built for **CODEFESTTHON 2026** (HealthTech · AI/ML · Open Innovation).

## Why
- ₹26,037 crore of health claims were denied in FY24 (₹10,937 Cr repudiated + ₹15,100 Cr disallowed; Lok Sabha USQ 93).
- 36.3 lakh claims were rejected outright, but only 31,490 health complaints reached the Insurance Ombudsman, under 1%.
- IRDAI's 2024 rules favour patients: every rejection must cite the policy clause (Para 17b); after 60 months of cover, non-disclosure can't be raised except for fraud (Para 13); waiting periods are capped at 36 months.

## What it does
1. **Upload**: a policy wording plus a denial letter (PDF, text, or a sample case).
2. **Decode**: clause-aware parsing, BM25 clause retrieval, and 6 deterministic IRDAI rule tests:
   - clause citation
   - moratorium
   - waiting-period cap and waiting period already served
   - Claims Review Committee approval
   - 3-hour discharge turnaround
   - exclusion relevance
3. **Act**: a strength verdict, quoted evidence, a dated escalation plan, and ready-to-send drafts (insurer GRO, Bima Bharosa, Insurance Ombudsman).

Everything runs in the browser. Nothing is uploaded.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
No build step. The app uses `engine.js` (rules + retrieval + letters), `samples.js` (fictional cases) and `app.js` (UI).

## Disclaimer
Decision support, not legal advice. Sample insurers, people and numbers are fictional.
