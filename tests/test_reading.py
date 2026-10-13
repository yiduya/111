"""Reader regression checks; serves static files through Playwright routing."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
COURSE = json.loads((ROOT / 'assets/course.json').read_text())
def edited_text(step):
    return ''.join(re.sub(r'(^\s*|[.!?]\s+)(?:very good|good|excellent|perfect)(?:[.!]+\s*|,?\s+(?=(?:so|and|but)\b))([a-z]?)', lambda m:m[1]+m[2].upper(), r['text'], flags=re.I) if r['lang']=='en' else r['text'] for r in step['audio']).strip()

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
    actual = page.locator('.reading-copy').evaluate_all('(els)=>els.map(el=>Array.from(el.querySelectorAll("p")).map(p=>p.textContent).join("").trim())')
    expected = [edited_text(s) for s in COURSE['tracks'][0]['steps']]
    assert actual == expected
    page.screenshot(path='/tmp/reading-ipad.png', full_page=False)
    page.locator('[data-read-complete="0"]').click()
    stored = lambda: page.evaluate('JSON.parse(localStorage.getItem("petit-french-progress-v1"))')
    assert len(stored()['completed']) == 6
    page.locator('[data-read-complete="0"]').click()
    assert len(stored()['completed']) == 6
    page.locator('#reading-1-8').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    assert len(stored()['completed']) >= 6
    page.locator('[data-read-bookmark="1-8"]').click()
    assert page.locator('[data-read-audio="1-8"]').first.is_visible()
    assert page.locator('[data-read-note]').count() == 0
    page.locator('[data-action="track-notes"]').click()
    page.locator('#track-note').fill('Remember this expression')
    page.locator('[data-action="close-dialog"]').click()
    assert '1-8' in stored()['bookmarks']
    assert stored()['trackNotes']['1'] == 'Remember this expression'
    page.locator('#reading-1-8').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    cursor = stored()['cursor']
    page.reload()
    page.locator('[data-action="begin"]').click()
    page.wait_for_timeout(250)
    assert stored()['cursor'] == cursor
    page.locator('[data-action="practice-mode"]').click()
    assert page.locator('.lesson-card').count() == 1
    page.locator('#note').fill('Practice note preserved')
    page.locator('[data-action="reading-mode"]').click()
    assert page.locator('.reading-stream').count() == 1
    # All 40 tracks retain text in order, even split passages and punctuation.
    for track in COURSE['tracks']:
        page.locator('[data-route="library"]').first.click()
        page.locator(f'[data-track="{track["id"]}"]').click()
        actual = page.locator('.reading-copy').evaluate_all('(els)=>els.map(el=>Array.from(el.querySelectorAll("p")).map(p=>p.textContent).join("").trim())')
        expected = [edited_text(s) for s in track['steps']]
        assert actual == expected, (track['id'], [(a,b) for a,b in zip(actual,expected) if a!=b][:1])
    page.locator('[data-route="library"]').first.click()
    page.locator('[data-track="3"]').click()
    paragraphs = lambda id: [t.strip() for t in page.locator(f'#reading-{id} .reading-copy p').all_text_contents()]
    assert paragraphs('3-7') == ['Quelque chose.', 'And these are two words in French –', 'quelque chose.', 'Do you want something?']
    assert page.locator('.student-reference').count() == 0
    assert 'Reservation.' in page.locator('#reading-3-2 .inline-response').inner_text()
    assert paragraphs('3-18') == ['Je veux commander quelque chose.', 'Do you want to order something?']
    assert page.locator('#reading-3-17 .inline-response').count() == 0
    assert page.locator('#reading-3-6').evaluate('(el)=>el.closest(".reading-section")===document.querySelector("#reading-3-7").closest(".reading-section")')
    assert paragraphs('3-8') == ['Tu veux quelque chose?', 'Do you want to reserve something?']
    assert paragraphs('3-16') == ['Tu veux recommander quelque chose.', 'And if we lose the RE, the /ruh/ at the beginning of recommander, we will get commander, which means to order.', 'Commander, to order.']
    # Scrolling updates both resume position and completion without manual buttons.
    page.evaluate("document.querySelector('#reading-3-17').scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    assert stored()['cursor'] == '3-17'
    assert stored()['readingPositions']['3']['id'] == '3-17'
    page.evaluate("document.querySelector('#reading-3-19').scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    assert '3-17' in stored()['completed']
    page.evaluate("document.querySelector('.reading-end').scrollIntoView({block:'center'})")
    page.wait_for_timeout(500)
    assert all(s['id'] in stored()['completed'] for s in COURSE['tracks'][2]['steps'])
    assert '100%' in page.locator('#reading-live-progress').inner_text()
    page.locator('[data-route="home"]').first.click()
    assert '31 of 31 steps explored' in page.locator('.continue-card').inner_text()
    page.locator('[data-action="begin"]').click()
    # Resume a point inside a long paragraph, not merely its original turn.
    page.evaluate("""() => {const el=document.querySelector('#reading-3-9');scrollTo(0,scrollY+el.getBoundingClientRect().top+el.offsetHeight*.45-innerHeight*.22)}""")
    page.wait_for_timeout(500)
    location = stored()['readingPositions']['3']
    assert location['id']=='3-9' and abs(location['offset']-.45)<.02
    page.reload()
    page.locator('[data-action="begin"]').click()
    page.wait_for_timeout(500)
    assert stored()['readingPositions']['3']['id'] == location['id']
    assert abs(stored()['readingPositions']['3']['offset']-location['offset'])<.02
    # Stub only the browser voice API to verify each visible Listen plays its own paragraph.
    page.evaluate("""() => {
      window.spoken = [];
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      speechSynthesis.getVoices = () => [{name:'English',lang:'en-US',voiceURI:'en'}, {name:'French',lang:'fr-FR',voiceURI:'fr'}];
      speechSynthesis.speak = u => { window.spoken.push(u.text); if(u.onend)u.onend(); };
    }""")
    page.locator('[data-read-audio="3-7"][data-read-block="2"]').click()
    page.wait_for_timeout(250)
    assert ''.join(page.evaluate('window.spoken')).strip() == 'quelque chose.'
    page.locator('#reading-3-7').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/refined-reading-ipad.png', full_page=False)
    for width in [390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#reading-3-16').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/refined-reading-mobile.png', full_page=False)
    page.reload()
    page.locator('[data-action="begin"]').click()
    assert stored()['trackNotes']['1'] == 'Remember this expression'
    assert 'Practice note preserved' in stored()['notes'].values()
    backup = stored()
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('[data-action="settings"]').last.click()
    page.locator('#import-file').set_input_files({'name':'progress.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.wait_for_timeout(200)
    assert stored()['trackNotes'] == backup['trackNotes']
    assert stored()['notes'] == backup['notes']
    assert stored()['readingPositions'] == backup['readingPositions']
    del backup['trackNotes']
    page.locator('[data-action="settings"]').last.click()
    page.locator('#import-file').set_input_files({'name':'old-progress.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.wait_for_timeout(200)
    assert stored()['trackNotes'] == {}
    assert stored()['notes'] == backup['notes']
    assert not errors, errors
    browser.close()
print('PASS: 40 tracks, edited teacher text, inline responses, automatic progress, track completion, exact resume, audio, notes and backup compatibility, responsive widths.')
