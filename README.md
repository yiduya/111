# Petit à petit

A calm, touch-friendly study companion for the supplied **Language Transfer — Introduction to French** transcript. It covers **40 tracks, 157 PDF pages, 2,856 dialogue turns and 1,535 learning steps**, in the original English and French.

## Open the hosted website

After GitHub Pages finishes deployment, open **https://yiduya.github.io/111/**.

Publish from `main` → `/ (root)` in Settings → Pages. The repository includes the complete `assets/` directory; keep it alongside `index.html`. Check the repository's Actions tab for a successful **pages build and deployment** run before using the URL. Saving the Pages source alone does not confirm a completed deployment.

## Use it on iPad

1. Host the contents of `dist/petit-a-petit-website.zip` on an HTTPS static website. Upload the **extracted contents**, with `index.html` at the website root. No build command, server backend, API key, login or paid AI service is needed.
2. Open that website in Safari on iPad. Tap **Begin a small session**.
3. To keep it on your Home Screen, use **Share → Add to Home Screen**.
4. Before going offline, open **Audio → Audio & preferences** and check that the course is cached. Reload once while online, then check a track offline. System voices may require an initial download through iPad settings.

The app has not been published to a public URL automatically. A generated local file or a cloud machine's `localhost` address is **not** an iPad-accessible website. The actual device's Safari, voice installation and Home Screen installation still need an on-device check.

For a quick test on a computer, open `dist/petit-a-petit.html` in a browser. It embeds all lesson text, styles and logic and does not require a server. iPad Files/Quick Look may not execute local HTML; use the hosted website on iPad. The standalone file's original PDF link needs the PDF alongside it; the website bundle includes it. Use export/import to move progress between the standalone and hosted versions.

## Learning flow

- **Continuous reading is the default.** Read a complete track by scrolling, without reveal gates, next-step buttons or forced breaks.
- Explanations appear once in source order, grouped into reading sections that keep prompts and their following answers together. Complete French expressions and questions get their own paragraphs; vocabulary embedded in explanations stays inline. French phrases have a pale green highlight. Necessary student responses appear next to their prompts in purple, with explicit labels. French expressions also serve as section signposts. These are reading aids, not rewritten lesson summaries.
- The reading view removes brief praise and duplicate answers. When the next teacher passage already supplies the answer, it is shown only once; otherwise the student response stays beside its prompt, clearly identified as potentially incorrect. Teacher corrections remain in order. The original transcript, practice text and PDF remain unchanged.
- Scrolling saves a per-track reading location, including the position within a long passage. Viewed passages count as read after scrolling past them; reaching the end marks the track read. A live indicator shows both the current reading step and completion percentage. Importing backups and resetting progress stop the previous reader before replacing its saved state. **Mark entire track read** can restore a track that an older version failed to record. Section marking remains available; revisiting cannot earn duplicate points.
- Use the visible **Listen** button beside any paragraph to hear just that paragraph, or save a passage in **My practice**. **Lesson notes** provides one notebook per track. Practice still has passage scratchpads; earlier passage notes remain available inside Lesson notes. Existing notes, bookmarks, progress and backups remain compatible.
- Switch to **speaking practice** for the original think/reveal flow and 5-, 10- or 20-step sessions. The chosen mode is saved. Saved practice leaves the main course position unchanged.

“Explored” records reading progress, manual completion and completed practice steps. It does not grade correctness or certify mastery. All tracks are available from the start.

Reader regression checks (Python Playwright and Chromium required):

```sh
node --check app.js
python tests/test_reading.py
```

These checks cover all 40 tracks for edited-text preservation, contextual responses, automatic reading progress, whole-track and section completion, precise saved position, bookmarks, notes, mode switching and mobile/tablet/desktop overflow. They use local request routing and need no running web server.

## Voice

The browser's Web Speech API provides bilingual playback, voice selection, speed, pause, resume and stop. Teacher passages **and follow-ups automatically switch between English and French voices**. French spans are recovered from the PDF's bold typography, with repairs for plain/italic French attempts and English student interjections. The original words are unchanged. French spans in teacher passages are underlined. Missing or inconsistent source formatting may still need a manual override: select a phrase and tap **Read selected text in French**. Student responses retain their original mistakes.

Before playback, the app refreshes the voice list and selects an actual voice whose language matches each segment. A missing or stale French preference cannot fall back to English. If no French voice is available, playback stops with setup instructions. On iPad, open Settings → Accessibility → Read & Speak (called Spoken Content in some versions) → Voices and download a French voice; reopen Safari and try **Audio → Test French voice**. The exact settings labels depend on iPadOS.

Speech synthesis is **not the original Language Transfer audio**, and cannot reliably reproduce phonetic notation or every pronunciation detail. Download a French voice on your iPad if needed. Original recordings are available through [Language Transfer](https://www.languagetransfer.org/french). Audio never autoplays, and no microphone or speech recognition is used. A voice may use the device's online service; choose an on-device voice for offline playback.

## Encouragement and milestones

Every newly explored step earns **10 learning points**. The home screen shows total points, steps, precise course percentage and fully explored tracks. The current lesson also shows your total, and the break screen makes your progress visible before you decide whether to continue.

Milestone badges unlock at 1, 5, 10, 25, 50, 100, 250, 500, 1,000 and all 1,535 steps. A quiet, dismissible banner celebrates each milestone. **My milestones** shows all badges and exactly how many steps remain to the next one. There are no deadlines, lost points or broken streaks. These reward participation, not proven language mastery.

Rewards are derived from unique completed step IDs. Existing progress and imported backups count immediately; revisiting a step cannot farm points. No change to the existing progress format is required.

## Progress and privacy

Progress, bookmarks, notes, voice preferences and session size are stored in this browser's `localStorage`. There are no analytics or uploaded answers. Private browsing, clearing site data, changing the website address, or switching browsers/devices can remove or separate progress. iPad can also evict website storage.

Use **Audio → Export progress** to save a JSON backup to Files, and **Import progress** to restore it on another device. Import replaces the current progress after confirmation. Export before switching devices or clearing storage. Keep one active tab for learning.

## Run locally

Use the existing checkout; no additional Git worktree is needed.

```sh
cd /workspace/111
python -m http.server 8000 --bind 0.0.0.0
```

On your own computer, use the directory where you extracted the website instead. Open `http://localhost:8000` on that computer. An iPad on the same Wi-Fi can use `http://<computer-LAN-address>:8000` for a temporary online test if the computer firewall permits it. Offline service workers require HTTPS or localhost; a LAN HTTP address does not meet that requirement.

Everything is static. All dependencies needed to **run** the app are included or provided by the browser. Use a recent Safari with `<dialog>`, `localStorage` and Web Speech support. Text learning remains usable when voice playback is unavailable.

## Rebuild and validate

Only rebuilding lesson data requires Poppler's `pdftotext` and Python's `PyMuPDF` (`fitz`) package; Python 3 is required for the scripts. `course_audio.py` aligns PDF typography with the original extracted characters, requires over 99% alignment on each page, and creates language-tagged audio runs. Source extraction retains teacher/student wording and attributions, normalizes layout whitespace, and splits teacher turns at sentence boundaries. `R:` in the original Track 7 is retained as its original label and treated as a student turn.

```sh
python scripts/build_course.py
python tests/test_content.py
node --check app.js
python scripts/package_app.py
# With a local server running and Python Playwright installed:
python tests/test_browser.py
```

Browser tests use the existing `/usr/bin/chromium` by default. Override `BROWSER_EXECUTABLE` and `APP_URL` as needed. Browser tests exercise iPad-sized touch layouts in Chromium; they are not a substitute for physical Safari/voice testing.

`package_app.py` fingerprints the app content into the service-worker cache version, generates the standalone HTML, and creates a hosting ZIP. Run it again after changes. The service worker atomically caches the app, course and original PDF; it does not claim offline readiness until the full install succeeds. Avoid caching `sw.js` indefinitely at your hosting provider.

## Updating an existing installation

Export a progress backup first. Replace the hosted site with the contents of the newly generated ZIP **at the same site address**, then reload after the new service worker finishes installing. If an old offline copy is still displayed, close and reopen the site and reload once online. Do not clear website data just to update; that deletes local progress. For the standalone app, use the new HTML file and import the backup if the browser gives the new file separate storage.

## Attribution

Course: **Language Transfer, Introduction to French**. Transcript: volunteers and editors credited in the supplied PDF. The original introduction, editor notes, contents and full PDF are accessible through the app. The independent companion's interface and navigation are new; the teaching text is from the supplied document. This project is not affiliated with or endorsed by Language Transfer. Course/transcript rights remain with their respective creators; no new license over their material is claimed.
