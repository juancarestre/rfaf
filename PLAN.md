# rfaf — Read Fast As F*ck

> CLI/TUI para lectura rapida de cualquier contenido textual. Inspirado en ReadFast.ai pero open-source, local-first, y potenciado por LLMs configurables.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Runtime + Build | **Bun** (`bun build --compile` para binario standalone) |
| TUI Framework | **Ink** (React para terminal) + **fullscreen-ink** (alternate screen) |
| UI Components | **ink-ui** (select, spinner, progress bar) |
| CLI Parsing | **yargs** |
| PDF Parsing | **pdf-parse** |
| HTML/Web scraping | **@mozilla/readability** + **linkedom** |
| Markdown | **marked** |
| EPUB | **epub2** |
| LLM Integration | **AI SDK** de Vercel (OpenAI, Anthropic, Ollama, etc.) |
| Config | **~/.rfaf/config.yaml** |
| Lenguaje | **TypeScript** estricto |

## Arquitectura de Modulos

```
rfaf/
├── src/
│   ├── cli/                    # Entry point + argument parsing
│   │   ├── index.tsx           # Main entry, flag parsing
│   │   └── commands/           # Subcommands
│   │       ├── read.tsx        # Default: read content
│   │       ├── config.tsx      # Configure LLM, defaults
│   │       └── history.tsx     # Reading history/stats
│   │
│   ├── ingest/                 # Content ingestion layer
│   │   ├── types.ts            # Document interface
│   │   ├── pdf.ts              # PDF -> texto plano
│   │   ├── url.ts              # URL -> readable text (Readability)
│   │   ├── epub.ts             # EPUB -> texto
│   │   ├── markdown.ts         # Markdown -> texto
│   │   ├── plaintext.ts        # .txt files
│   │   ├── clipboard.ts        # Leer desde stdin/clipboard
│   │   └── detect.ts           # Auto-detect format
│   │
│   ├── processor/              # Text processing pipeline
│   │   ├── tokenizer.ts        # Texto -> words/chunks
│   │   ├── chunker.ts          # Agrupar palabras (1, 3-5, parrafos)
│   │   ├── pacer.ts            # WPM calculation + pacing logic
│   │   ├── bionic.ts           # Bionic reading transformation
│   │   └── highlighter.ts      # Emphasis on key words
│   │
│   ├── llm/                    # LLM integration layer
│   │   ├── provider.ts         # Multi-provider abstraction (AI SDK)
│   │   ├── summarize.ts        # Resumen con compression slider
│   │   ├── translate.ts        # Traduccion
│   │   ├── analyze.ts          # Analizar documento -> reading strategy
│   │   ├── quiz.ts             # Generar preguntas de comprension
│   │   └── key-phrases.ts      # Extraer frases clave para emphasis
│   │
│   ├── ui/                     # TUI components (Ink/React)
│   │   ├── App.tsx             # Root component, router
│   │   ├── screens/
│   │   │   ├── RSVPScreen.tsx      # Modo RSVP (una palabra)
│   │   │   ├── ChunkedScreen.tsx   # Modo chunks (3-5 palabras)
│   │   │   ├── BionicScreen.tsx    # Modo bionic reading
│   │   │   ├── ScrollScreen.tsx    # Modo scroll clasico con pacer
│   │   │   ├── QuizScreen.tsx      # Pantalla de quiz post-lectura
│   │   │   └── SummaryScreen.tsx   # Mostrar resumen
│   │   ├── components/
│   │   │   ├── WordDisplay.tsx     # Renderizar palabra/chunk con focus point
│   │   │   ├── SpeedControl.tsx    # Barra de velocidad WPM
│   │   │   ├── ProgressBar.tsx     # Progreso de lectura
│   │   │   ├── StatusBar.tsx       # Info: WPM, tiempo restante, progreso %
│   │   │   └── ModeSelector.tsx    # Selector de modo de lectura
│   │   └── hooks/
│   │       ├── useTimer.ts         # Timer para pacing
│   │       ├── useReader.ts        # Core reading state machine
│   │       └── useKeyBindings.ts   # Keybindings globales
│   │
│   ├── engine/                 # Reading engine (state machine)
│   │   ├── reader.ts           # Core: avanzar, pausar, retroceder
│   │   ├── speed.ts            # Speed ramping algorithms
│   │   └── session.ts          # Session tracking (tiempo, WPM, progreso)
│   │
│   └── config/                 # Configuration
│       ├── schema.ts           # Config type definitions
│       ├── defaults.ts         # Default settings
│       └── store.ts            # Read/write config file
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── build.ts                    # Build script for compilation
```

## Modos de Lectura

### 1. RSVP (Rapid Serial Visual Presentation)

- Una palabra a la vez, centrada en el **ORP** (Optimal Recognition Point)
- Velocidad ajustable: 200-1000+ WPM
- Pausa automatica en puntuacion (. , ; : !)
- Coloreado del punto focal (letra central resaltada)

### 2. Chunked Reading

- Grupos de 3-5 palabras
- Respeta limites de frases/clausulas
- Mas natural que RSVP, menor velocidad maxima
- Ideal para textos tecnicos

### 3. Bionic Reading

- Texto completo visible
- Primeras letras de cada palabra en **bold**
- Auto-scroll con velocidad controlada
- Combina velocidad con contexto visual

### 4. Guided Scroll

- Texto completo con linea de enfoque resaltada
- Pacer visual que avanza automaticamente
- Similar a karaoke pero para lectura

## Flags y Comandos

```bash
# Uso basico
rfaf myfile.pdf                          # Lee archivo con modo default
rfaf https://example.com/article         # Lee URL
cat text.txt | rfaf                      # Lee desde stdin
rfaf --clipboard                         # Lee desde clipboard

# Modos de lectura
rfaf myfile.pdf --mode rsvp              # RSVP (default)
rfaf myfile.pdf --mode chunked           # Chunks de 3-5 palabras
rfaf myfile.pdf --mode bionic            # Bionic reading
rfaf myfile.pdf --mode scroll            # Guided scroll

# Velocidad
rfaf myfile.pdf --wpm 350               # Velocidad fija
rfaf myfile.pdf --ramp 200-500          # Rampa progresiva
rfaf myfile.pdf --adaptive              # LLM decide pace segun dificultad

# LLM features
rfaf myfile.pdf --summarize             # Resumen antes de leer
rfaf myfile.pdf --summarize --level 3   # Nivel de compresion (1-5)
rfaf myfile.pdf --translate-to spanish  # Traducir contenido
rfaf myfile.pdf --key-phrases           # Resaltar frases clave (LLM)
rfaf myfile.pdf --quiz                  # Quiz de comprension al final
rfaf myfile.pdf --strategy              # LLM sugiere mejor modo de lectura

# Configuracion
rfaf config                              # TUI de configuracion
rfaf config --set llm.provider openai
rfaf config --set llm.model gpt-4o-mini
rfaf config --set default.wpm 300
rfaf config --set default.mode rsvp

# Historial
rfaf history                             # Ver sesiones anteriores
rfaf history --stats                     # Estadisticas agregadas
```

## Config File (`~/.rfaf/config.yaml`)

```toml
[defaults]
mode = "rsvp"
wpm = 300
chunk_size = 4
pause_on_punctuation = true
ramp_enabled = false

[llm]
provider = "openai"          # openai | anthropic | ollama | groq
model = "gpt-4o-mini"
api_key_env = "OPENAI_API_KEY"  # lee de env var
base_url = ""                # para Ollama u otros

[llm.ollama]
model = "llama3.1"
base_url = "http://localhost:11434"

[display]
theme = "dark"               # dark | light | minimal
show_progress = true
show_wpm = true
show_time_remaining = true
focus_color = "#FF6B6B"

[reading]
pause_multiplier_period = 2.0    # multiplicador de pausa en '.'
pause_multiplier_comma = 1.3     # multiplicador en ','
pause_multiplier_paragraph = 3.0 # pausa entre parrafos
```

## Keybindings (durante lectura)

| Tecla | Accion |
|-------|--------|
| `Space` | Pausar / Reanudar |
| `->` / `l` | Avanzar una palabra/chunk |
| `<-` / `h` | Retroceder una palabra/chunk |
| `Up` / `k` | Aumentar WPM (+25) |
| `Down` / `j` | Disminuir WPM (-25) |
| `1-4` | Cambiar modo (1=RSVP, 2=Chunked, 3=Bionic, 4=Scroll) |
| `s` | Mostrar resumen (LLM) |
| `t` | Traducir (LLM) |
| `q` | Salir |
| `r` | Reiniciar desde el inicio |
| `p` | Saltar al siguiente parrafo |
| `b` | Volver al parrafo anterior |
| `?` | Mostrar ayuda de keybindings |

## UX del modo RSVP (pantalla principal)

```
+-----------------------------------------------------+
|                                                     |
|                                                     |
|                                                     |
|                   und|er|standing                    |
|                                                     |
|                                                     |
|                                                     |
|  ############### ---------------------  42%         |
|  350 WPM  |  3:24 remaining  |  RSVP  |  > Playing |
|  [Space] Pause  [Up/Down] Speed  [1-4] Mode  [?]   |
+-----------------------------------------------------+
```

La letra central se resalta en un color diferente como punto focal ORP.

## Dependencias

```json
{
  "dependencies": {
    "ink": "^5.0.0",
    "fullscreen-ink": "^1.0.0",
    "ink-ui": "latest",
    "react": "^18.0.0",
    "ai": "^3.0.0",
    "@ai-sdk/openai": "latest",
    "@ai-sdk/anthropic": "latest",
    "pdf-parse": "^1.1.1",
    "@mozilla/readability": "^0.5.0",
    "linkedom": "^0.16.0",
    "marked": "^12.0.0",
    "epub2": "^3.0.0",
    "yargs": "^17.0.0",
    "toml": "^3.0.0"
  }
}
```

## Fases de Implementacion

### Fase 1: Core MVP

1. CLI entry point con Bun + yargs
2. Ingest: plaintext + PDF
3. Tokenizer + pacer basico
4. Modo RSVP con Ink fullscreen
5. Controles: pause, speed up/down, quit
6. Progress bar + status bar

### Fase 2: Modos adicionales

7. Modo Chunked
8. Modo Bionic Reading
9. Modo Guided Scroll
10. Mode switching en runtime

### Fase 3: Mas fuentes

11. URL ingestion (Readability)
12. Stdin / clipboard
13. EPUB support
14. Markdown rendering

### Fase 4: LLM Integration

15. Provider abstraction (AI SDK)
16. `--summarize` con compression levels
17. `--translate-to`
18. `--strategy` (LLM analiza y sugiere modo)
19. `--key-phrases` (emphasis inteligente)
20. `--quiz` post-lectura

### Fase 5: Polish

21. Config file (~/.rfaf/config.yaml)
22. Session history + stats
23. Speed ramping algorithms
24. `bun build --compile` para distribucion
25. Adaptive pacing (pausa en oraciones complejas)
