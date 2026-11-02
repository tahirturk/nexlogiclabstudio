# Voice & Transcript Studio

A Next.js workspace for AI voiceover and audio transcription. Run the web app with:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
Configure Supabase first; see [User accounts](#user-accounts).

Production builds use Next.js Webpack mode (`next build --webpack`) for
compatibility with hosting environments where Turbopack's CSS worker may fail.

## Choose an AI engine

Open **Connect engine** in the studio to select a voice-generation provider.

## User accounts

The app uses Supabase Auth for email/password sign-up and sign-in. Create a
Supabase project, then set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in local `.env.local` and in the
production app environment. Never put a Supabase secret/service-role key in the
browser environment.

This first version intentionally has no email verification or password-reset
flow, as selected. On hosted Supabase projects, turn off email confirmations in
**Authentication → Providers → Email** so new users can sign in immediately.
There is no self-service account recovery in this version; users who forget a
password will need an administrator to help them regain access.

Runpod jobs and server-side history are now isolated by the authenticated
Supabase user ID. Browser-saved drafts and local history are also stored in
separate per-account browser databases. Existing history created before login
is not automatically migrated into a user account. Existing engine URLs and
tokens are not migrated either; reconnect your engine after signing in. Engine
settings are saved separately for each account.

### Admin packages and voice quotas

The admin panel is available at `/admin` to signed-in addresses listed in the
server-only `ADMIN_EMAILS` variable (comma-separated). Configure
`SUPABASE_SERVICE_ROLE_KEY` on the server; never prefix it with `NEXT_PUBLIC_`
or expose it in browser code. Apply
[the quota migration](./supabase/migrations/202611020001_user_tts_quotas.sql)
to the Supabase project using its SQL editor before opening the panel.

The two starting packages are:

- **Starter:** 50,000 Runpod voice characters.
- **Pro:** 250,000 Runpod voice characters.

Admins can assign either package and edit an account's character limit. New
accounts have no package until an admin assigns one. Quotas do not reset
automatically. Runpod scripts reserve their character count at submission and
are charged only when the job completes successfully; failed and cancelled
jobs release the reservation. The Colab/notebook engine is intentionally not
quota-limited in this version, as requested. Transcription does not consume
these voice-character quotas.

### Runpod Hub — Chatterbox Turbo

1. Set `RUNPOD_API_KEY` in the app server's environment (`.env.local` for local development), then restart the app. Do not use a `NEXT_PUBLIC_` variable for this key.
2. In the studio, choose **Runpod Hub — Chatterbox Turbo** and select **Check & use Runpod**.
3. Choose a preset voice, or select **Upload reference sample** and upload or record a voice sample, then click **Generate voiceover**.

The app submits generation jobs to Runpod from a server-side route, polls for
completion, and downloads completed audio into private app storage. The API key
is never sent to the browser. Runpod supports both its preset voices and
reference-audio cloning; transcription remains on the notebook engine.
Status polling starts at roughly two seconds, then backs off with jitter; the
app honors Runpod's `Retry-After` header when rate limited.

### Hostinger storage and history

Runpod reference uploads and completed audio are stored outside the public web
assets directory. Server-side Runpod history is scoped to the signed-in
Supabase account, not a browser cookie. Completed audio expires 12 hours after
generation. Reference uploads are removed when generation finishes and also
have a 12-hour fallback expiry.

Configure these server-side environment variables in the production app:

- `RUNPOD_API_KEY`: your Runpod API key.
- `APP_BASE_URL`: the app's public HTTPS origin (for example,
  `https://studio.example.com`). Reference uploads require this so Runpod can
  fetch the temporary audio URL.
- `RUNPOD_STORAGE_DIR`: an absolute, writable, persistent directory outside
  the public web root. If omitted, storage defaults to `.runpod-data` under
  the app's working directory; this default is suitable only if that location
  is persistent and private on your host.
- `RUNPOD_CLEANUP_SECRET`: a long random secret used to authorize scheduled
  cleanup requests.

Create a Hostinger scheduled task to call
`https://YOUR_DOMAIN/api/runpod/cleanup` hourly with this header:

```text
Authorization: Bearer YOUR_RUNPOD_CLEANUP_SECRET
```

For example, configure the task to run:

```bash
curl --fail --silent --show-error -H "Authorization: Bearer YOUR_RUNPOD_CLEANUP_SECRET" "https://YOUR_DOMAIN/api/runpod/cleanup"
```

Replace the placeholders with your domain and secret. Expired files are also
removed when history is read, but the scheduled task ensures cleanup happens
when no one is using the app.

Before deploying, confirm your Hostinger plan supports the app's Next.js
Node.js runtime, writable persistent storage, and scheduled tasks. Shared
hosting configurations vary; this setup has not been verified against your
specific Hostinger account. Add account-level generation limits before public
launch: the server-side generation route can incur Runpod charges.

### Current notebook engine

Voice generation with a reference voice and audio transcription use the
companion notebook at [`engine/Turk_Ai.ipynb`](./engine/Turk_Ai.ipynb):

1. Open it in Google Colab, select a GPU runtime, and run its setup and **Warm-Up Tools** cells.
2. Run the **Web App** cell and keep the Colab session running.
3. In the studio, choose **Current notebook engine**, paste the HTTPS tunnel URL printed by the notebook, and select **Test & connect**.

The notebook's existing Google Drive output-sharing behavior may make
generated files accessible to anyone with the link; review its sharing
settings before using sensitive content.

## Features

- Script editing, text-file import, narration estimates, and reference voice upload or microphone recording.
- AI voiceover generation with configurable controls, live job updates, playback, download, and transfer to transcription.
- Choose WAV or MP3 for voiceover downloads; MP3 is encoded in the browser from the WAV preview.
- Runpod reference-audio uploads and private, account-scoped generation history with 12-hour output retention.
- Email/password accounts with per-account Runpod storage and browser-local history isolation.
- Admin-managed Starter/Pro packages and server-enforced Runpod voice-character quotas.
- Audio transcription with language selection, timestamps, playback seeking, and TXT, SRT, VTT, or JSON export.
- Drafts and completed work saved locally in the browser.