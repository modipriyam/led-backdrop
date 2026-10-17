# Ice & Sugar — LED Backdrop

Fullscreen LED-stage site for the Ice & Sugar research paper deck, plus a backstage admin console.

## Live

After GitHub Pages is enabled:

- **Stage:** `https://<user>.github.io/led-backdrop/`
- **Admin:** `https://<user>.github.io/led-backdrop/admin.html`

Open both in the same browser. Admin talks to the stage over `BroadcastChannel` (same origin).

## Local (with command relay)

```bash
npm start
```

Then open:

- http://localhost:8765/index.html
- http://localhost:8765/admin.html

## Controls

| Where | Action |
| --- | --- |
| Stage | Arrows / space · `F` fullscreen · ON AIR dark mode · `B` blackout |
| Admin | Slide next/prev/jump · dark · ambient · blackout · fullscreen prompt |

Fullscreen from admin shows a one-click **Enter fullscreen** prompt on the stage (browsers block remote fullscreen).
