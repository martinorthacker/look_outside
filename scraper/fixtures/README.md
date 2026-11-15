# Test-Fixtures (nur lokal)

Die gespeicherten HTML-Seiten sind Kopien von GeoSphere-, ORF- und
bergfex-Seiten und werden deshalb **nicht** ins öffentliche Repo committet
(ROADMAP #10, `.gitignore`).

Erzeugen bzw. erneuern (holt die Live-Seiten, bereinigt sie, speichert die
erwartete Parser-Ausgabe als `<id>.expected.json`):

    ./dev.sh node tools/update-fixtures.js            # alle Quellen
    ./dev.sh node tools/update-fixtures.js orf        # nur ORF
    ./dev.sh node tools/update-fixtures.js --reparse  # nur Snapshots neu aus vorhandenem HTML

Ohne Fixtures überspringt `npm test` die Fixture-Tests (z.B. in CI). Die
committeten Tests in `test/` verwenden synthetisches Markup, das die Struktur
der Quellen nachbildet.
