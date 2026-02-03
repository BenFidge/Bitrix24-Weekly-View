# Bitrix24 Online Booking REST API (Quick Notes)

Generated: 2026-02-02

These Markdown files summarize the **Online Booking** (booking.v1.*) REST API sections:

- Resources
- Bookings
- Waitlist

> **Note:** The official Bitrix24 docs pages for Booking are heavily client-rendered, so in this environment
> I couldn't reliably extract the full parameter tables verbatim.  
> Each file therefore includes:
> - method names + what they do
> - the most important identifiers/parameters (where discoverable)
> - direct links back to the official docs for the authoritative parameter/response schemas

## Base REST call shape

Bitrix24 REST methods are typically called as:

- `POST https://<your-domain>.bitrix24.com/rest/<userId>/<webhookToken>/<method>.json`
- or OAuth: `POST https://<your-domain>.bitrix24.com/rest/<method>.json` with `Authorization: Bearer <token>`

The method name in this section is the REST method string, e.g. `booking.v1.booking.add`.

## Table of contents

- [Booking overview](booking/README.md)
- [Resources overview](resource/README.md)
- [Waitlist overview](waitlist/README.md)
