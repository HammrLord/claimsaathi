// Synthetic sample cases. Insurer, people and numbers are fictional.
const POLICY_BASE = (opts) => `Insurer: ${opts.insurer}
Product: ${opts.product}
Grievance Redressal Officer: gro@${opts.domain} · 1800-000-0000
Policy number: ${opts.policyNo}
Continuous coverage since: ${opts.since}
Sum insured: Rs 5,00,000

1. Definitions. Pre-existing disease means any condition diagnosed by a physician within 36 months prior to the first policy issued by the insurer.
2.1 Room rent. Room rent is payable up to 1% of the sum insured per day. Associated medical expenses are not proportionately deducted for ICU charges.
3.1 In-patient treatment. The company will pay medical expenses for hospitalisation of more than 24 hours on the advice of a medical practitioner.
4.1 Initial waiting period. Expenses within 30 days from first policy commencement are excluded, except for accidents.
4.2 Pre-existing diseases. Expenses related to pre-existing diseases are excluded until the expiry of ${opts.ped} months of continuous coverage after the date of inception of the first policy.
4.3 Specified diseases and procedures. Expenses for cataract, hernia, joint replacement and benign prostatic hypertrophy are excluded until the expiry of ${opts.spec} of continuous coverage.
5.1 Cosmetic or plastic surgery. Expenses for cosmetic or plastic surgery are excluded unless required for reconstruction following an accident, burns or cancer, or as part of medically necessary treatment certified by the attending practitioner.
5.2 Obesity and weight control. Expenses for surgical treatment of obesity are excluded unless BMI criteria are met.
6.1 Moratorium period. After completion of sixty continuous months of coverage, no policy and claim shall be contestable on grounds of non-disclosure or misrepresentation, except on grounds of established fraud.
7.1 Claim settlement. The company shall settle or reject a claim within 30 days of receipt of the last necessary document.
7.2 Grievance redressal. The insured may approach the Grievance Redressal Officer, the IRDAI Bima Bharosa portal, or the Insurance Ombudsman.`;

export const SAMPLES = [
  {
    id: "moratorium",
    title: "Hypertension 'non-disclosure' after 5 years",
    tag: "Moratorium breach",
    policy: POLICY_BASE({ insurer: "Suraksha Health Insurance Co. Ltd. (fictional)", product: "Suraksha Family Shield", domain: "suraksha-example.in", policyNo: "SH/2021/448812", since: "01/03/2021", ped: "36", spec: "24 months" }),
    denial: `SURAKSHA HEALTH INSURANCE CO. LTD. — CLAIM DECISION LETTER
Date of decision: 14/06/2026
Claim number: CL-48213
Policy number: SH/2021/448812
Patient name: Ramesh Iyer
Date of admission: 10/06/2026
Diagnosis: Acute coronary syndrome, angioplasty
Amount repudiated: Rs 1,84,500

Dear Policyholder,
We regret to inform you that your claim has been repudiated under Clause 4.2 (Pre-existing diseases). Hospital records indicate that the insured was a known case of hypertension for 6 years, which was not disclosed at the time of proposal. This amounts to non-disclosure of material facts.
Final bill received: 11:00 AM
Decision time: 1:30 PM
Regards, Claims Department`,
  },
  {
    id: "waiting",
    title: "Cataract denied under a 48-month wait",
    tag: "Waiting cap + 3-hour TAT",
    policy: POLICY_BASE({ insurer: "Navjeevan General Insurance Ltd. (fictional)", product: "Navjeevan Health Classic (legacy wording)", domain: "navjeevan-example.in", policyNo: "NJ/HC/22/90311", since: "15/01/2023", ped: "48", spec: "48 months" }),
    denial: `NAVJEEVAN GENERAL INSURANCE — CASHLESS DISCHARGE DECISION
Date of decision: 22/08/2026
Claim ID: NJ-CL-77102
Policy no: NJ/HC/22/90311
Insured person: Sunita Deshpande
Date of admission: 21/08/2026
Procedure: Phacoemulsification with IOL (right eye)
Amount disallowed: Rs 62,000

Your cashless request for final discharge is rejected. As per Clause 4.3, cataract is subject to a waiting period of 48 months of continuous coverage, which has not been completed.
Final bill received: 10:15 AM
Decision time: 3:45 PM
Claims Team`,
  },
  {
    id: "valid",
    title: "Scar revision after burns, 'cosmetic'",
    tag: "Exclusion: check necessity",
    policy: POLICY_BASE({ insurer: "Arogya Mitra Insurance Ltd. (fictional)", product: "Arogya Mitra Individual", domain: "arogyamitra-example.in", policyNo: "AM/IND/24/11873", since: "05/07/2024", ped: "36", spec: "24 months" }),
    denial: `AROGYA MITRA INSURANCE — CLAIM REPUDIATION
Date of decision: 03/10/2026
Claim reference: AM-55190
Policy number: AM/IND/24/11873
Patient: Imran Sheikh
Date of admission: 28/09/2026
Procedure: Scar revision surgery (left forearm)
Amount claimed: Rs 48,750

Your claim is not payable as the procedure is cosmetic in nature and is excluded under Clause 5.1 (Cosmetic or plastic surgery). This decision was reviewed by the Claims Review Committee.
Claims Department`,
  },
];
