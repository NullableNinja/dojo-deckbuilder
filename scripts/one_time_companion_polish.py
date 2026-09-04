from pathlib import Path

app_path = Path("app/companion-app.tsx")
app = app_path.read_text()

replacements = {
    '<div className="download-row"><span>Official field file</span><a className="button ghost" href={DOWNLOADS.quickStart} download>Download Quick Start (.docx)</a></div>\n': '',
    '<div className="download-row"><span>Stamped for offline arguments</span><a className="button ghost" href={DOWNLOADS.fullRules} download>Download Full Rules (.docx)</a></div>\n': '',
    '<div className="download-row"><span>For filters and suspiciously serious review</span><a className="button ghost" href={DOWNLOADS.cardCatalog} download>Download Card Catalog (.xlsx)</a></div>\n': '',
    '<div className="download-row"><span>Editable Paper-Fu source cards, with separate GIMP layers</span><a className="button ghost" href={DOWNLOADS.defenseEquipmentSources} download>Defense Equipment sources (.ora.zip)</a><a className="button ghost" href={DOWNLOADS.consumableSources} download>Consumable sources (.ora.zip)</a></div>\n': '',
    '<div className="download-row"><span>Portable argument ammunition</span><a className="button ghost" href={DOWNLOADS.glossary} download>Download Glossary (.docx)</a></div>': '',
    '{ id: "home", label: "Home", detail: "Return to the field test." },': '{ id: "home", label: "Home", detail: "Return to the Dojo Desk." },',
}
for old, new in replacements.items():
    if old not in app:
        raise SystemExit(f"Missing expected companion source fragment: {old[:100]}")
    app = app.replace(old, new, 1)
app_path.write_text(app)

css_path = Path("app/globals.css")
css = css_path.read_text()
mobile_rule = '''

/* Mobile route cards renumber after the desktop-only Play route is hidden. */
@media (max-width: 840px) {
  .route-grid { counter-reset: mobile-route; }
  .route-grid .route-card:not(.route-playtest) { counter-increment: mobile-route; }
  .route-grid .route-card:not(.route-playtest) > span { font-size: 0; }
  .route-grid .route-card:not(.route-playtest) > span::after {
    content: "0" counter(mobile-route);
    font-size: 14px;
  }
}
'''
if "counter-reset: mobile-route" not in css:
    css += mobile_rule
css_path.write_text(css)

test_path = Path("tests/mobile-responsive.test.mjs")
tests = test_path.read_text()
regression = r'''

test("public companion keeps downloads out of the visitor experience and renumbers mobile routes", async () => {
  const [app, css] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.doesNotMatch(app, /className="download-row"/);
  assert.doesNotMatch(app, />Download (?:Quick Start|Full Rules|Card Catalog|Glossary)/);
  assert.doesNotMatch(app, />Defense Equipment sources \(\.ora\.zip\)/);
  assert.doesNotMatch(app, />Consumable sources \(\.ora\.zip\)/);
  assert.match(app, /detail: "Return to the Dojo Desk\."/);
  assert.match(css, /counter-reset: mobile-route/);
  assert.match(css, /counter-increment: mobile-route/);
});
'''
if "public companion keeps downloads out of the visitor experience" not in tests:
    tests += regression
test_path.write_text(tests)
