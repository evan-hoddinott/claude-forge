export interface BundleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  color: string;
  contextContent: string;
  constraintsContent?: string;
  suggestedInputs: { label: string; value: string }[];
}

export const BUILT_IN_BUNDLES: BundleTemplate[] = [
  {
    id: 'nextjs-fullstack',
    name: 'Next.js Full-Stack',
    description: 'App router, Prisma ORM, TypeScript, Tailwind CSS',
    category: 'web',
    tags: ['nextjs', 'typescript', 'react', 'prisma', 'tailwind'],
    icon: '▲',
    color: '#000000',
    suggestedInputs: [
      { label: 'Tech Stack', value: 'Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL' },
      { label: 'Architecture', value: 'App Router with Server Components by default. Use Client Components only when needed for interactivity. API routes in app/api/.' },
      { label: 'Patterns', value: 'Server Actions for mutations. Zod for validation. next-auth for authentication. shadcn/ui for UI components.' },
      { label: 'Database', value: 'Prisma with PostgreSQL. Run `npx prisma generate` after schema changes. Migrations with `npx prisma migrate dev`.' },
    ],
    contextContent: `# Next.js Full-Stack Project

## Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Prisma ORM + PostgreSQL
- next-auth for authentication

## Architecture
- Use Server Components by default
- Client Components only for interactivity (add 'use client' directive)
- Server Actions for form mutations and data writes
- API routes in \`app/api/\` for external consumers

## Patterns
- Zod schemas for all input validation
- shadcn/ui component library
- Error boundaries around major sections
- Loading UI with \`loading.tsx\` files
- \`@/\` path alias for src imports

## Database
- Prisma ORM with PostgreSQL
- Run \`npx prisma generate\` after schema changes
- \`npx prisma migrate dev\` for dev migrations
- \`npx prisma studio\` to browse data

## Coding Standards
- TypeScript strict mode everywhere
- No \`any\` types
- Functional components only
- Named exports for page components
- Co-locate components with their route when single-use

## Commands
- \`npm run dev\` — development server
- \`npm run build\` — production build
- \`npm run lint\` — ESLint
- \`npx prisma migrate dev\` — run migrations`,
  },

  {
    id: 'esp32-iot',
    name: 'ESP32 IoT Project',
    description: 'Embedded firmware with hardware constraints and pin layouts',
    category: 'embedded',
    tags: ['esp32', 'embedded', 'iot', 'c', 'esp-idf'],
    icon: '⚡',
    color: '#E7352C',
    suggestedInputs: [
      { label: 'Hardware Platform', value: 'ESP32 (Xtensa LX6 dual-core, 240MHz, 2MB RAM, 4MB Flash)' },
      { label: 'Framework', value: 'ESP-IDF 5.x with FreeRTOS' },
      { label: 'Pin Layout', value: 'GPIO2: Built-in LED, GPIO4: User button (active low), GPIO21: SDA, GPIO22: SCL' },
      { label: 'Constraints', value: 'No dynamic memory allocation after init. Max task stack: 4096 bytes. All strings in PROGMEM. Binary must fit in 1.5MB.' },
    ],
    contextContent: `# ESP32 IoT Project

## Hardware
- Platform: ESP32 (Xtensa LX6 dual-core 240MHz)
- Memory: 2MB RAM, 4MB Flash
- Framework: ESP-IDF 5.x with FreeRTOS

## Pin Layout
- GPIO2: Built-in LED (active high)
- GPIO4: User button (active low, use internal pullup)
- GPIO21: I2C SDA
- GPIO22: I2C SCL

## Hard Constraints
- NEVER use dynamic memory allocation (malloc/new) after initialization
- All strings must be stored in PROGMEM / flash
- Maximum FreeRTOS task stack: 4096 bytes
- Total binary size must fit within 1.5MB partition
- No floating point math in interrupt handlers
- ISRs must be marked IRAM_ATTR

## Code Patterns
- Use esp_err_t return codes, check with ESP_ERROR_CHECK()
- Log with ESP_LOGI/ESP_LOGE/ESP_LOGD (not printf)
- Use esp_timer for non-blocking delays
- FreeRTOS queues for inter-task communication
- NVS for persistent configuration storage

## Commands
- \`idf.py build\` — compile firmware
- \`idf.py flash monitor\` — flash and open serial monitor
- \`idf.py menuconfig\` — configure project
- \`idf.py size\` — check binary size`,
    constraintsContent: JSON.stringify({
      hardware: {
        platform: 'ESP32',
        cpu: 'Xtensa LX6 dual-core 240MHz',
        memory: '2MB RAM, 4MB Flash',
        pins: {
          GPIO2: 'Built-in LED (active high)',
          GPIO4: 'User button (active low)',
          GPIO21: 'I2C SDA',
          GPIO22: 'I2C SCL',
        },
        voltage: '3.3V logic',
      },
      software: {
        maxBinarySize: '1.5MB',
        noFloatingPoint: true,
        targetFramework: 'ESP-IDF 5.x',
        rtos: 'FreeRTOS',
      },
      rules: [
        'Never use dynamic memory allocation after initialization',
        'All strings must be stored in PROGMEM',
        'Maximum FreeRTOS task stack size: 4096 bytes',
        'ISRs must be marked IRAM_ATTR',
        'No floating point in interrupt handlers',
      ],
    }, null, 2),
  },

  {
    id: 'react-native-mobile',
    name: 'React Native Mobile',
    description: 'Cross-platform iOS/Android with Expo and navigation',
    category: 'mobile',
    tags: ['react-native', 'expo', 'mobile', 'typescript', 'ios', 'android'],
    icon: '📱',
    color: '#61DAFB',
    suggestedInputs: [
      { label: 'Tech Stack', value: 'React Native with Expo SDK, TypeScript, Expo Router' },
      { label: 'Navigation', value: 'Expo Router (file-based). Tabs in app/(tabs)/. Stack screens in app/.' },
      { label: 'State Management', value: 'Zustand for global state. React Query for server state. AsyncStorage for persistence.' },
      { label: 'Platform Notes', value: 'Test on both iOS and Android. Use Platform.OS checks sparingly. Prefer platform-agnostic components.' },
    ],
    contextContent: `# React Native Mobile App

## Tech Stack
- React Native + Expo SDK
- TypeScript (strict mode)
- Expo Router (file-based routing)
- Zustand for state management
- React Query for server state
- AsyncStorage for local persistence

## Navigation (Expo Router)
- File-based routing in \`app/\` directory
- Tab navigator: \`app/(tabs)/\`
- Modal screens: \`app/modal.tsx\`
- Deep links configured in \`app.json\`

## Platform Patterns
- Use \`Platform.OS\` checks sparingly — prefer cross-platform components
- Test on BOTH iOS simulator and Android emulator
- Use \`KeyboardAvoidingView\` for forms
- \`SafeAreaView\` on all screens
- Use \`@expo/vector-icons\` for icons

## Styling
- StyleSheet.create() for all styles
- No inline styles except for dynamic values
- Use \`useColorScheme()\` for dark mode
- Dimensions.get('window') for responsive sizing

## Commands
- \`npx expo start\` — development server
- \`npx expo run:ios\` — iOS simulator
- \`npx expo run:android\` — Android emulator
- \`eas build\` — production build
- \`eas submit\` — app store submission`,
  },

  {
    id: 'python-gui',
    name: 'Python GUI App',
    description: 'PyQt6 or Tkinter desktop application with packaging',
    category: 'desktop',
    tags: ['python', 'gui', 'pyqt6', 'desktop', 'packaging'],
    icon: '🐍',
    color: '#3776AB',
    suggestedInputs: [
      { label: 'Tech Stack', value: 'Python 3.11+, PyQt6, packaging with PyInstaller' },
      { label: 'UI Pattern', value: 'MVC architecture. Separate UI (views/) from business logic (models/, controllers/).' },
      { label: 'Packaging', value: 'PyInstaller for distribution. Single-file executable target. Bundle assets with --add-data.' },
      { label: 'Python Standards', value: 'Type hints everywhere. Dataclasses for data models. pathlib for paths. logging module (not print).' },
    ],
    contextContent: `# Python GUI Application

## Tech Stack
- Python 3.11+
- PyQt6 for UI
- PyInstaller for packaging

## Architecture (MVC)
- \`views/\` — Qt widgets and windows
- \`models/\` — data models and business logic
- \`controllers/\` — event handling and coordination
- \`utils/\` — shared helpers
- \`assets/\` — icons, images, resources

## Python Standards
- Type hints on all function signatures
- Dataclasses for data models
- \`pathlib.Path\` for all file operations (not os.path)
- \`logging\` module for output (not print)
- \`__all__\` in each module for explicit exports

## Qt Patterns
- Signals/slots for component communication
- QThread for background work (never block the main thread)
- QSettings for user preferences
- Resource files (.qrc) for bundled assets

## Packaging
- PyInstaller for Windows/Linux/macOS executables
- \`--onefile\` for single-file builds
- \`--add-data\` for bundled resources
- Spec file for reproducible builds

## Commands
- \`python main.py\` — run application
- \`pip install -r requirements.txt\` — install deps
- \`pyinstaller main.spec\` — build executable
- \`python -m pytest\` — run tests`,
  },

  {
    id: 'cli-tool',
    name: 'CLI Tool',
    description: 'Node.js command-line tool with Commander.js and testing',
    category: 'cli',
    tags: ['nodejs', 'cli', 'commander', 'typescript', 'npm'],
    icon: '>_',
    color: '#4CAF50',
    suggestedInputs: [
      { label: 'Tech Stack', value: 'Node.js, TypeScript, Commander.js, Inquirer.js for prompts' },
      { label: 'Distribution', value: 'npm package with bin entry. Global install via npm install -g or npx.' },
      { label: 'Testing', value: 'Vitest for unit tests. Integration tests against real CLI invocations.' },
      { label: 'Patterns', value: 'Each subcommand in src/commands/. Shared utilities in src/utils/. Config in ~/.config/tool-name/.' },
    ],
    contextContent: `# CLI Tool

## Tech Stack
- Node.js 18+
- TypeScript (compiled to ESM)
- Commander.js for argument parsing
- Inquirer.js for interactive prompts
- Chalk for colored output
- ora for spinners

## Structure
- \`src/commands/\` — one file per subcommand
- \`src/utils/\` — shared helpers (config, http, formatting)
- \`src/index.ts\` — entry point, registers commands
- \`bin/\` — executable shim

## Patterns
- Commander.js action handlers call into service functions
- Interactive prompts with Inquirer when args are missing
- User config in \`~/.config/<tool-name>/config.json\`
- Respect \`--json\` flag for machine-readable output
- Exit codes: 0 success, 1 user error, 2 system error

## Publishing
- Package.json \`bin\` field points to compiled output
- \`files\` array includes only \`dist/\` and \`bin/\`
- Semantic versioning with changesets

## Commands
- \`npm run dev\` — watch mode compilation
- \`npm run build\` — compile TypeScript
- \`npm test\` — run Vitest
- \`npm link\` — install locally for testing`,
  },

  {
    id: 'chrome-extension',
    name: 'Chrome Extension',
    description: 'Manifest v3 extension with content scripts and popup',
    category: 'browser',
    tags: ['chrome', 'extension', 'manifest-v3', 'javascript', 'browser'],
    icon: '🧩',
    color: '#4285F4',
    suggestedInputs: [
      { label: 'Tech Stack', value: 'Chrome Extension Manifest V3, TypeScript, Vite build system' },
      { label: 'Components', value: 'Popup (popup.html), Background service worker (background.ts), Content scripts (content.ts)' },
      { label: 'Permissions', value: 'Declare only minimum required permissions. Use optional permissions for sensitive APIs.' },
      { label: 'Patterns', value: 'Message passing between popup, background, and content scripts. chrome.storage.sync for user settings.' },
    ],
    contextContent: `# Chrome Extension (Manifest V3)

## Structure
- \`manifest.json\` — extension manifest
- \`src/popup/\` — popup UI (HTML + React/vanilla JS)
- \`src/background/\` — service worker (background.ts)
- \`src/content/\` — content scripts injected into pages
- \`src/shared/\` — shared types and utilities

## Manifest V3 Rules
- Background runs as a service worker (not persistent page)
- No inline scripts in HTML (CSP restriction)
- Use declarativeNetRequest instead of webRequest for blocking
- Declare MINIMUM required permissions
- Use optional_permissions for sensitive APIs

## Message Passing
\`\`\`typescript
// From popup/content to background
chrome.runtime.sendMessage({ type: 'DO_THING', data: {} });

// From background to specific tab
chrome.tabs.sendMessage(tabId, { type: 'UPDATE_PAGE' });

// Listen
chrome.runtime.onMessage.addListener((msg, sender, respond) => {});
\`\`\`

## Storage
- \`chrome.storage.sync\` — user settings (synced across devices)
- \`chrome.storage.local\` — larger local data

## Build & Deploy
- \`npm run build\` — compile to \`dist/\`
- Load unpacked: chrome://extensions → Load unpacked → select dist/
- \`npm run zip\` — create .zip for Chrome Web Store
- Chrome Web Store review typically takes 1-3 days`,
  },
];
