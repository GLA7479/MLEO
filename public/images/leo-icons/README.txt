MLEO Icon Pack
=================
Generated: 2025-09-22T12:37:38.477852Z

Files:
- favicon.ico (multi-size 16,32,48,64)
- favicon-*.png (16–256)
- icon-*.png (96–512)
- apple-touch-icon*.png (120,152,167,180 default)
- android-chrome-*.png (192,512)
- android-chrome-maskable-*.png (maskable versions with 20% safe padding)
- mstile-150x150.png
- site.webmanifest
- browserconfig.xml
- snippet.html (HTML tags to paste into <head>)

How to use (Next.js):
1) Copy everything in this folder into your app's /public directory.
2) In your _app or next/head on each page, paste the tags from snippet.html (or from the message).
3) Deploy. Browsers and iOS should auto-detect the right icon sizes.

Notes:
- 'maskable' icons make Android install experience look perfect on all shapes.
- To customize theme color, edit site.webmanifest, browserconfig.xml, and the <meta name="theme-color"> tag.
