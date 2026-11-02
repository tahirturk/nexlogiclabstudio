# Voice & Transcript Studio

A Next.js workspace for AI voiceover and audio transcription. Run the web app with:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production builds use Next.js Webpack mode (`next build --webpack`) for
compatibility with hosting environments where Turbopack's CSS worker may fail.

## Choose an AI engine

Open **Connect engine** in the studio to select a voice-generation provider.

### Runpod Hub — Chatterbox Turbo

1. Set `RUNPOD_API_KEY` in the app server's environment (`.env.local` for local development), then restart the app. Do not use a `NEXT_PUBLIC_` variable for this key.
2. In the studio, choose **Runpod Hub — Chatterbox Turbo** and select **Check & use Runpod**.
3. Choose a preset voice, or select **Upload reference sample** and upload or record a voice sample, then click **Generate voiceover**.

The app submits generation jobs to Runpod from a server-side route, polls for
completion, and downloads completed audio into private app storage. The API key
is never sent to the browser. Runpod supports both its preset voices and
reference-audio cloning; transcription remains on the notebook engine.

### Hostinger storage and history

Runpod reference uploads and completed audio are stored outside the public web
assets directory. Runpod history is scoped to the same browser using an
HttpOnly cookie; clearing that cookie loses access to that browser's saved
history. Completed audio expires 12 hours after generation. Reference uploads
are removed when generation finishes and also have a 12-hour fallback expiry.

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
specific Hostinger account. Also add app authentication and per-user generation
limits before public launch: the server-side generation route can incur Runpod
charges.

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
- Runpod reference-audio uploads and private, browser-scoped generation history with 12-hour output retention.
- Audio transcription with language selection, timestamps, playback seeking, and TXT, SRT, VTT, or JSON export.
- Drafts and completed work saved locally in the browser.
