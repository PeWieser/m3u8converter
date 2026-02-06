

# Plan: Unterstützung für große Dateien (>1.5GB) im MP4 Editor

## Problemanalyse

Der Fehler `File could not be read! Code=-1` tritt bei Dateien über ~1.5GB auf wegen:

1. **WebAssembly Speicherlimit**: FFmpeg.wasm hat standardmäßig ein 2GB Speicherlimit
2. **Doppelter Speicherverbrauch**: Die Datei existiert gleichzeitig als JavaScript File-Objekt UND im FFmpeg virtuellen Dateisystem
3. **fetchFile lädt alles auf einmal**: Die gesamte Datei wird in einem Schritt in den Speicher geladen

## Lösungsansatz

Da wir für Metadaten-Einbettung nur die Header der MP4-Datei modifizieren (`-c copy`), können wir einen **Streaming/Chunked-Ansatz** verwenden:

### 1. Chunked File Reading (Neue Utility-Funktion)

Statt `fetchFile(videoFile)` implementieren wir eine eigene Funktion, die die Datei in Chunks liest:

```text
+-----------------------------------+
|  readFileInChunks(file, ffmpeg)   |
+-----------------------------------+
           |
           v
+-----------------------------------+
|  FileReader.slice(offset, chunk)  |
|  -> ffmpeg.writeFile (append)     |
|  -> Fortschritt anzeigen          |
+-----------------------------------+
           |
           v (wiederholen bis EOF)
+-----------------------------------+
|  Speicher freigeben nach Chunk    |
+-----------------------------------+
```

### 2. Konfigurierbare Speicherverwaltung

Neue Einstellungen, die der Nutzer anpassen kann:

| Einstellung | Beschreibung | Standard |
|-------------|--------------|----------|
| Chunk-Größe | Größe der Chunks beim Lesen | 64 MB |
| Max Dateigröße | Warnung bei Überschreitung | 2 GB |
| Speicher-Modus | Normal / Sparsam | Normal |

### 3. UI-Komponente für Speichereinstellungen

Neues Settings-Panel im MP4 Editor:
- Slider für Chunk-Größe (16MB - 256MB)
- Toggle für "Sparsamen Modus"
- Warnung bei großen Dateien mit Größenanzeige

## Technische Details

### Datei: `src/lib/chunked-file-reader.ts` (neu)

```text
Funktionen:
- readFileAsChunkedUint8Array(file, chunkSize, onProgress)
- Liest Datei in Chunks
- Gibt fortlaufend Speicher frei
- Meldet Fortschritt zurück
```

### Datei: `src/hooks/useFFmpegEditor.ts` (modifizieren)

Änderungen:
1. `fetchFile` durch `readFileAsChunkedUint8Array` ersetzen
2. Fortschrittsanzeige während des Dateilesens
3. Speicherbereinigung vor und nach der Verarbeitung
4. Abfangen von Speicherfehlern mit hilfreicher Meldung

### Datei: `src/components/converter/MemorySettings.tsx` (neu)

UI-Komponente:
- Chunk-Größe Slider
- Speicherwarnungen
- Cookie-basierte Persistenz

### Datei: `src/pages/Index.tsx` (modifizieren)

Integration der Memory-Settings in beide Editoren.

## Ablauf bei großen Dateien

```text
1. Nutzer wählt große Datei (z.B. 2.5GB)
           |
           v
2. Warnung anzeigen: "Große Datei erkannt"
   - Empfehlung: Sparsamer Modus aktivieren
   - Option: Trotzdem fortfahren
           |
           v
3. Chunked Reading mit Fortschritt:
   [████████░░░░░░░░] 50% - Chunk 8/16
           |
           v
4. FFmpeg Verarbeitung (schnell, nur Metadaten)
           |
           v
5. Chunked Output Reading mit Fortschritt
           |
           v
6. Download anbieten
```

## Grenzen der Lösung

- Dateien über 3-4GB werden im Browser weiterhin problematisch sein (WebAssembly-Limit)
- Bei sehr alten Geräten mit wenig RAM kann es trotzdem zu Problemen kommen
- Empfehlung für sehr große Dateien: Desktop-FFmpeg verwenden

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/lib/chunked-file-reader.ts` | Neu erstellen |
| `src/hooks/useFFmpegEditor.ts` | Modifizieren |
| `src/hooks/useFFmpeg.ts` | Modifizieren (M3U8 Converter) |
| `src/components/converter/MemorySettings.tsx` | Neu erstellen |
| `src/components/converter/MP4Editor.tsx` | Modifizieren |
| `src/components/converter/BatchMP4Editor.tsx` | Modifizieren |
| `src/pages/Index.tsx` | Modifizieren |

