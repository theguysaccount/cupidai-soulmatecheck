# Launch and distribution

Live since 2026-10-25 at https://theguysaccount.github.io/cupidai-soulmatecheck/. Machine channels only.

## Channels that run themselves

| Channel | How |
|---|---|
| Share loop | Making a check means sending a link (text, WhatsApp, email, native share, copy). Answering one ends with "send your result back" and "make your own". |
| Search | Home ("compatibility test for couples", "soulmate test", "relationship compatibility quiz") and the questions page ("compatibility questions to ask your partner", "questions to ask before getting serious"), with structured data and share cards. |
| IndexNow | Every deploy. |
| GitHub | Public repo, description, topics, README. |

## The first 1,000 users (machine plan)

Each check made brings in at least one more person (whoever it's sent to). With one responder per check and 30% of responders making their own, every 100 makers bring about 130 people. The questions page catches search traffic and points to "make my SoulmateCheck". Measurable once analytics are on (OPERATIONS.md key 3): checks created, answers per check, `own_from_result`.

## Production domain

`soulmatecheck.com` (owned, currently on SiteGround behind a robot challenge). Steps and DNS records: OPERATIONS.md key 1. Nothing changed.
