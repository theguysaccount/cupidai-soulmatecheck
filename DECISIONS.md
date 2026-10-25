# Decisions

1. **Viral shareable check first, paid matchmaking later.** Settles the open question. The check runs with no server and spreads by itself; matchmaking needs a member database, consent flows for recorded dates, signed releases for marketing videos and biometric-data compliance (BIPA, GDPR), none of which a machine can take on alone.
2. **Answers live only in the URL fragment.** No database means nothing to breach and no personal data held. The `#` part never reaches a server. The trade-off, stated in the UI: anyone with a link can read the answers in it.
3. **Bit-packed links with a checksum.** 24 answers × 5 bits plus name and a 2-byte checksum make a 32-character fragment, short enough for any chat app. The checksum turns a link truncated by a messenger into a friendly "this link looks incomplete" instead of a wrong score.
4. **Question set 1 is frozen.** Links made today must decode forever. Changes go into a new numbered set; the self-test fails if the live set 1 ever differs from the repo.
5. **Two-sided weighted scoring.** Each person's satisfaction uses their own importance weights; the match is the geometric mean, so it's high only when both get what matters to them. Symmetric by construction, tested on random pairs.
6. **No calibration claim.** "Calibrated on married couples" needs real couples and stored answers. Until then the method is published in full and the result says it's for conversation, not prediction (OPERATIONS.md key 4).
7. **Dealbreakers lead, differences framed as conversations.** Every gap comes with a question to ask, so a low score prompts talking rather than rejection.
8. **No sensitive categories beyond faith.** Faith is asked because it's a major compatibility factor; it's optional like every question. No health, sexuality, politics or photos.
9. **Adults only, stated, not gated.** There's no account or data, so there's nothing to gate; the footer and About page say it's for adults and link the National Domestic Violence Hotline.
10. **Advice for dating-app links.** Some apps' terms ban links in profiles, so the share screen suggests sending the link in chat after matching.
