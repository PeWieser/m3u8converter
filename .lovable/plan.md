# Plan: Unterstützung für große Dateien (>1.5GB) im MP4 Editor

## Status: ✅ Implementiert

### Implementierte Lösungen

1. **Chunked File Reader** (`src/lib/chunked-file-reader.ts`)
   - Liest große Dateien in konfigurierbaren Chunks (16-256 MB)
   - Fortschrittsanzeige während des Lesens
   - Automatischer Fallback bei Speicherfehlern

2. **Memory Settings UI** (`src/components/converter/MemorySettings.tsx`)
   - Chunk-Größe Slider (16-256 MB)
   - "Sparsamer Modus" Toggle für große Dateien
   - Automatische Warnungen bei großen Dateien
   - Einstellungen werden in localStorage gespeichert

3. **Hook-Integration** (`src/hooks/useFFmpegEditor.ts`)
   - Automatische Erkennung großer Dateien (>500MB)
   - Chunked Reading für große Dateien
   - Fallback zu Chunked Reading bei Fehlern
   - Hilfreich Fehlermeldungen bei Speicherproblemen

4. **UI-Integration**
   - Memory Settings in MP4Editor und BatchMP4Editor
   - Fortschrittsanzeige während Datei-Lesen
   - Warnungen bei großen Dateien

### Grenzen

- Dateien über 3-4GB können im Browser weiterhin problematisch sein (WebAssembly-Limit)
- Empfehlung für sehr große Dateien: Desktop-FFmpeg verwenden
