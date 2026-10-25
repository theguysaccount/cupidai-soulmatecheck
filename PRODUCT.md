# Product: SoulmateCheck (CupidAI's consumer wedge)

**User.** Singles on dating apps who want to know if a match is worth a date, beyond photos; new couples who want the big conversations without making them awkward; and the curious friend who forwards it.

**Painful job.** The questions that decide whether two people last (children, money, conflict, family, time together) come up months in, after the investment. Asking them on date one feels like an interrogation.

**Promise.** Three minutes, one link: see how compatible you are on what matters, and get the conversation starters for where you differ. Nothing stored.

**Wedge.** Every check is an invitation: making one means sending it to someone, and answering one ends with "send your result back" and "make your own". The questions page answers searches like "compatibility questions to ask your partner".

**Why now.** Dating-app fatigue is high and "date-me docs" showed people will share a link to a structured self. No backend means it can't leak anyone's answers.

**Activation metric.** For makers, `check_created` (a link was made); for the loop, `check_answered` per check created, and `own_from_result` (a responder makes their own).

**First revenue event.** A couple buys a keepsake of their result (`KEEPSAKE_URL` slot). The paid matchmaking service comes later, if ever.

**What v1 deliberately won't do.**
- Store answers, run a matching pool or introduce strangers.
- Record video dates, analyze faces or photos, or use AI clones.
- Claim scientific prediction: the score is a conversation tool and says so.
- Ask about health, sexuality or anything identifying. Every question can be skipped.
