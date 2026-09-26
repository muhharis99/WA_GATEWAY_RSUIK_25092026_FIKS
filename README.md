# WA_GATEWAY_RSUIK_25092026_FIKS

Unified RSUIK gateway repository containing the existing Reminder Dokter, LAB, and Ijin WA applications plus their PHP reporting/dashboard layer.

## Architecture

The repository is organized into an application layer and public/runtime entrypoints. The WhatsApp gateway refactor remains under `src/`, while the PHP dashboard infrastructure is now isolated under `app/`.

```text
app/
├── Config/
│   └── config.php
├── Database/
│   └── db.php
└── Support/
    ├── functions.php
    └── report_functions.php

src/
├── config/
├── controllers/
├── entrypoints/
├── http/
├── repositories/
├── services/
├── utils/
└── whatsapp/
```

The legacy PHP page URLs are intentionally retained so the dashboard/API contracts do not change. Those pages now consume configuration, database bootstrap, and helper code from `app/` rather than keeping infrastructure files in the repository root.

### Root files that intentionally stay at root

`.env` / `.env.example` and `composer.json` are intentionally root-level:

- Composer expects `composer.json` at the project root for normal PHP dependency management.
- Environment files are intentionally loaded from the project root and `.env` remains ignored by Git.

The application code/configuration itself is no longer stored in root-level `config.php`, `db.php`, or `functions.php` files.

## Preserved runtime contracts

The existing gateway ports are preserved:

- Reminder: `3210`
- LAB: `9000`
- IJIN: `3000`

Existing PHP API bridge contracts remain:

- `api/lab-send.php` → `http://127.0.0.1:9000/send`
- `api/ijin-send.php` → `http://127.0.0.1:3000/send`

Existing legacy Node entrypoints are retained under `services/*/server.js` for compatibility during migration.

## Configuration

Copy:

```bash
cp .env.example .env
```

Do not commit `.env` or WhatsApp LocalAuth/session directories.

The refactored entrypoints read the existing database and gateway environment variable names. The established ports are not changed.

## Run

```bash
npm install

npm run start:reminder
npm run start:lab
npm run start:ijin

# optional supervisor
npm run start:alternatif
```

## Static verification

```bash
npm run check
npm run test:contract
```

GitHub Actions validates Node source syntax, PHP syntax, structural guards, compatibility contracts, and secret-file guards.

## WhatsApp lifecycle

The shared lifecycle abstraction centralizes:

- QR handling
- authenticated / ready state
- authentication failure
- disconnect handling
- recoverable Puppeteer/browser errors
- guarded re-initialization
- graceful shutdown

A disconnect in an individual service is handled inside that service process and does not require changing the other gateway ports or their contracts.

## Scope of verification

Repository/static checks can be verified through GitHub Actions. Live WhatsApp QR scanning, browser startup, database connectivity to the hospital network, and real message delivery require the deployment/runtime environment and are not inferred from source inspection alone.
## Frontend JavaScript standard

Browser-side JavaScript now uses **jQuery 3.7.1** as the standard DOM/event/AJAX layer. Page scripts use `$(function(){ ... })`, jQuery selectors, `.on()`, `.val()`, `.text()`, `.prop()`, `.attr()`, `.html()`, `$.ajax()`, and the jQuery integrations of DataTables/Select2. Native DOM APIs such as `document.getElementById()`, `querySelector()`, `addEventListener()`, `fetch()`, and the DataTables constructor API are not used by the browser-side application code.

The Node.js WhatsApp gateway processes under `services/` and `src/` remain server-side JavaScript and are intentionally not converted to jQuery, because jQuery is a browser-side library and is not an appropriate replacement for Node.js HTTP/WhatsApp runtime code.
