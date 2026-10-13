"""Reader regression checks; serves static files through Playwright routing."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
COURSE = json.loads((ROOT / 'assets/course.json').read_text())
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1024, 'height': 1366}, service_workers='block')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def respond(route):
        path = route.request.url.split('http://reader.test/')[1].split('?')[0] or 'index.html'
        file = ROOT / path
        if file.is_file():
            route.fulfill(path=str(file))
        else:
            route.fulfill(status=404, body='Not found')
    page.route('http://reader.test/**', respond)
    page.goto('http://reader.test/')
    page.locator('[data-action="begin"]').click()
    page.wait_for_selector('.reading-stream')
    assert page.locator('[data-action="reveal"]').count() == 0
    assert page.locator('.reading-passage').count() == len(COURSE['tracks'][0]['steps'])
    # Every teacher passage is rendered once, with exact text and language runs intact.
    actual = page.locator('.reading-copy').evaluate_all('(els)=>els.map(el=>el.textContent)')
    expected = [''.join(r['text'] for r in s['audio']) for s in COURSE['tracks'][0]['steps']]
    assert actual == expected
    page.screenshot(path='/tmp/reading-ipad.png', full_page=False)
    page.locator('[data-read-complete="0"]').click()
    stored = lambda: page.evaluate('JSON.parse(localStorage.getItem("petit-french-progress-v1"))')
    assert len(stored()['completed']) == 6
    page.locator('[data-read-complete="0"]').click()
    assert len(stored()['completed']) == 6
    page.locator('#reading-1-8').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    assert len(stored()['completed']) == 6
    page.locator('#reading-1-8 summary').click()
    page.locator('[data-read-bookmark="1-8"]').click()
    page.locator('[data-read-note="1-8"]').fill('Remember this expression')
    assert '1-8' in stored()['bookmarks']
    assert stored()['notes']['1-8'] == 'Remember this expression'
    cursor = stored()['cursor']
    page.reload()
    page.locator('[data-action="begin"]').click()
    page.wait_for_timeout(250)
    assert stored()['cursor'] == cursor
    page.locator('[data-action="practice-mode"]').click()
    assert page.locator('.lesson-card').count() == 1
    page.locator('[data-action="reading-mode"]').click()
    assert page.locator('.reading-stream').count() == 1
    # All 40 tracks retain text in order, even split passages and punctuation.
    for track in COURSE['tracks']:
        page.locator('[data-route="library"]').first.click()
        page.locator(f'[data-track="{track["id"]}"]').click()
        actual = page.locator('.reading-copy').evaluate_all('(els)=>els.map(el=>el.textContent)')
        expected = [''.join(r['text'] for r in s['audio']) for s in track['steps']]
        assert actual == expected, (track['id'], [(a,b) for a,b in zip(actual,expected) if a!=b][:1])
    for width in [390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    browser.close()
print('PASS: 40 tracks, source fidelity, progress, notes, bookmarks, resume, mode switching, responsive widths.')
