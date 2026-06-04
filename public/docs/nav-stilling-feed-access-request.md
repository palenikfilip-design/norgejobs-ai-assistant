# NAV Stilling Feed — API Access Request

**To:** nav.team.arbeidsplassen@nav.no
**Subject:** Request for read-only API token for pam-stilling-feed (Leslie job-matching service)

---

Hello NAV Arbeidsplassen team,

My name is Filip Palenik and I'm the founder of **Leslie**
(https://leslie.app), an AI-assisted job-matching service that helps
Czech- and Slovak-speaking professionals find work in Norway and other
European countries.

I would like to request a read-only access token for the
**pam-stilling-feed** API so that Leslie can ingest currently published
job postings from arbeidsplassen.nav.no and present them to our users
with proper attribution and a direct link back to the original posting
on arbeidsplassen.nav.no.

I have read and **explicitly agree to the terms of use** documented at
https://navikt.github.io/pam-stilling-feed, including:

- Using the feed only for the agreed purpose (presenting NAV job
  postings to job seekers)
- Linking back to the original posting on arbeidsplassen.nav.no
- Not redistributing the raw data to third parties
- Respecting any rate limits and pause/stop requests from NAV
- Removing postings from our index when they disappear from the feed

**About Leslie**
- Target audience: Czech and Slovak professionals interested in working
  abroad, with Norway as one of our priority markets
- Volume: a few thousand active users; the feed will be polled at the
  recommended interval (we plan once per hour, happy to adjust)
- Use: jobs are matched against each user's profile and shown with the
  NAV posting as the canonical source

Could you please issue a read-only Bearer token for the feed, or let me
know what additional information you need from us?

Thank you very much for maintaining this excellent open data service.

Kind regards,
Filip Palenik
Founder, Leslie
filip@leslie.app
https://leslie.app