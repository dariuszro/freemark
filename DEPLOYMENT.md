# freemark deployment

freemark is a static browser app. Production output is created by Vite in the
`dist` directory and can be served by any static HTTPS host.

## Build

```powershell
npm run build
```

The production files are written to:

```text
dist/
```

Upload the complete contents of `dist` to a static host. Keep the `assets`
directory next to `index.html`.

## Recommended hosting

Use HTTPS hosting for the real app:

- Cloudflare Pages
- Netlify
- Vercel
- GitHub Pages
- any static hosting on your own server, for example Nginx or Caddy

The app does not need a Node server after build. Node is only used to build the
static files.

## Local production check

```powershell
npm run build
npm run preview
```

Then open the local preview URL printed by Vite.

## Portable folder

The Vite `base` path is set to `./`, so the generated `dist` folder uses
relative asset paths. This makes the build work both at a domain root and under
a subpath such as GitHub Pages.

Opening `dist/index.html` directly from disk can work for basic editing, but
full native file access should be tested from an HTTPS origin.

## Browser file access note

The native open/save/folder features use the File System Access API where it is
available. This API requires a secure context, usually HTTPS, and does not work
uniformly in every browser. freemark keeps fallback open/download behavior for
browsers without full support.
