# WA_GATEWAY_RSUIK_25092026_FIKS

Unified RSUIK gateway repository containing the existing Reminder Dokter, LAB, and Ijin WA applications plus their PHP reporting/dashboard layer.

## Architecture

The legacy HTTP contracts and existing service directories remain available. New modular Node architecture is introduced under `src/`:

```text
src/
├── config/          environment/configuration
├── controllers/     HTTP/controller adapters
├── entrypoints/     Reminder, LAB, IJIN and supervisor processes
├── http/            HTTP helpers, UI and graceful shutdown
├── repositories/    database access abstraction
├── services/        gateway/business logic
├── utils/           shared utilities
└── whatsapp/        WhatsApp Web lifecycle and client construction
```

The WhatsApp engine remains `whatsapp-web.js`; the refactor separates its lifecycle from HTTP and business logic rather than replacing the underlying engine.

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

GitHub Actions runs the same source syntax and compatibility checks on pushes and pull requests.

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
