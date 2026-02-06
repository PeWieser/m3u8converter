

# Plan: PC-Bridge Modul für lokale FFmpeg-Verarbeitung

## Übersicht

Eine neue Komponente die als Schnittstelle ("Bridge") zum lokalen PC-Addon fungiert. Diese ermöglicht die Verarbeitung von Dateien jeder Größe ohne Browser-Limitierungen, da FFmpeg direkt auf dem PC läuft.

## Architektur

```text
+-----------------------------+        +---------------------------+
|   Browser (React-App)       |        |   Lokaler PC              |
|                             |        |                           |
|  +----------------------+   |  HTTP  |  +---------------------+  |
|  | LocalBridge.tsx      |<--------->|  | ffmpegserver.exe    |  |
|  +----------------------+   |        |  | (localhost:5000)    |  |
|  | - Status-Check       |   |        |  +---------------------+  |
|  | - Datei auswählen    |   |        |  | /select-file        |  |
|  | - Verarbeitung       |   |        |  | /convert            |  |
|  | - Download           |   |        |  | /status (optional)  |  |
|  +----------------------+   |        |  +---------------------+  |
+-----------------------------+        +---------------------------+
```

## Neue Komponente: `src/components/converter/LocalBridge.tsx`

### UI-Elemente

| Element | Beschreibung |
|---------|--------------|
| Verbindungsstatus | Badge: "Verbunden" (grün) oder "Nicht verbunden" (rot/gelb) |
| Download-Button | "PC-Modul herunterladen" - Link zu `ffmpegserver.exe` im Repo |
| Start-Button | "Modul öffnen" - Custom Protocol `my-converter://` |
| Datei-Button | "Lokale Datei auswählen" - ruft `/select-file` auf |
| Pfad-Anzeige | Zeigt den ausgewählten Systempfad an |
| Start-Button | "Verarbeitung starten" - ruft `/convert` auf |
| Status-Textfeld | Zeigt aktuellen Status (Verbunden, Pfad, Verarbeite...) |

### Zustände

```text
1. NICHT VERBUNDEN
   ├── Download-Hinweis anzeigen
   ├── "Modul herunterladen" Button
   └── "Modul starten" Button (my-converter://)

2. VERBUNDEN (localhost:5000 erreichbar)
   ├── "Lokale Datei auswählen" Button
   ├── Pfad-Anzeige (wenn Datei gewählt)
   ├── Metadaten-Felder (wie im MP4 Editor)
   └── "Verarbeitung starten" Button

3. VERARBEITUNG LÄUFT
   ├── Fortschrittsanzeige
   └── Status-Updates
```

### API-Kommunikation

```text
Verbindungsprüfung:
GET http://localhost:5000/
→ Wenn erreichbar: connected = true
→ Wenn Fehler (CORS, Network): connected = false

Datei auswählen:
GET http://localhost:5000/select-file
→ Response: { "path": "C:/Videos/example.mp4" }
→ UI aktualisiert Pfad-Anzeige

Verarbeitung starten:
POST http://localhost:5000/convert
Body: { 
  "path": "C:/Videos/example.mp4",
  "metadata": { title, author, show, season, episode, ... },
  "coverPath": "optional",
  "outputPath": "optional"
}
→ Response: { "status": "success", "outputPath": "..." }
```

## Integration in bestehende UI

### Datei: `src/pages/Index.tsx`

Neuer Tab im "editor" Tab-Bereich:

```text
Tabs:
├── M3U8 Converter (bestehend)
└── MP4 Editor (bestehend)
    ├── Single File Editor (MP4Editor.tsx)
    ├── Batch Editor (BatchMP4Editor.tsx)
    └── [NEU] PC-Modul (LocalBridge.tsx)
```

Oder als separate Sektion unterhalb des MP4 Editors mit einem Toggle.

## Custom Hook: `src/hooks/useLocalBridge.ts`

| Funktion | Beschreibung |
|----------|--------------|
| `checkConnection()` | Prüft ob localhost:5000 erreichbar ist |
| `selectFile()` | Ruft `/select-file` auf, speichert Pfad |
| `startConversion()` | Sendet Metadaten an `/convert` |
| `connected` | Boolean Status |
| `filePath` | Ausgewählter Dateipfad |
| `status` | Aktueller Status-String |
| `processing` | Boolean |

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/converter/LocalBridge.tsx` | Neu erstellen |
| `src/hooks/useLocalBridge.ts` | Neu erstellen |
| `src/pages/Index.tsx` | Integration als neuer Bereich |

## Design

Die Komponente nutzt das bestehende Glassmorphism-Design:
- `glass` Klasse für Container
- Gradient-Buttons für Aktionen
- Amber/Orange für Warnungen (nicht verbunden)
- Grün für verbunden
- Bestehende Icon-Library (lucide-react)

## Hinweise

- Die `ffmpegserver.exe` muss CORS-Header setzen (`Access-Control-Allow-Origin: *`)
- Der Custom Protocol Handler `my-converter://` muss vom EXE bei Installation registriert werden
- Für die TMDB-Metadaten können die bestehenden Hooks wiederverwendet werden

