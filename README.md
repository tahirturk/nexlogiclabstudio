# Voice & Transcript Studio

A Next.js workspace for AI voiceover and audio transcription. Run the web app with:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production builds use Next.js Webpack mode (`next build --webpack`) for
compatibility with hosting environments where Turbopack's CSS worker may fail.

## Connect the AI engine

Voice generation and transcription use the companion Colab notebook at
[`engine/Turk_Ai.ipynb`](./engine/Turk_Ai.ipynb):

1. Open it in Google Colab, select a GPU runtime, and run its setup and **Warm-Up Tools** cells.
2. Run the **Web App** cell and keep the Colab session running.
3. In the studio, choose **Connect engine**, paste the HTTPS tunnel URL printed by the notebook, and select **Test & connect**.

The browser sends audio and scripts directly to that engine. The notebook's
existing Google Drive output-sharing behavior may make generated files
accessible to anyone with the link; review its sharing settings before using
sensitive content.

## Features

- Script editing, text-file import, narration estimates, and reference voice upload or microphone recording.
- AI voiceover generation with configurable controls, live job updates, playback, download, and transfer to transcription.
- Audio transcription with language selection, timestamps, playback seeking, and TXT, SRT, VTT, or JSON export.
- Drafts and completed work saved locally in the browser.
