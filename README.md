# Echo

<div align="center">

**Offline API Mock and Patch Engine for Browser Requests**

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/Slogllykop/Echo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-orange.svg)](https://chrome.google.com/webstore)

</div>

---

## Overview

**Echo** is a powerful Chrome extension that intercepts HTTP requests (`fetch` and `XMLHttpRequest`) in web pages, enabling developers to:

- **Mock API responses** without modifying application code
- **Modify request/response data** on-the-fly for testing edge cases
- **Simulate network conditions** with configurable delays
- **Test error scenarios** by injecting custom status codes
- **Work offline** with mocked responses when APIs are unavailable

Perfect for frontend development, API testing, debugging production issues, and rapid prototyping.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [Creating Rules](#creating-rules)
  - [Rule Matching](#rule-matching)
  - [Rule Actions](#rule-actions)
  - [Import/Export](#importexport)
- [Development](#development)
- [Building](#building)
- [Project Structure](#project-structure)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Capabilities

- 🎭 **Request Interception**: Captures all `fetch` and `XMLHttpRequest` calls in web pages
- 🔧 **Mock Responses**: Return custom JSON/text responses without hitting real APIs
- ✏️ **Request/Response Modification**: Patch headers, body, or status codes
- 🎯 **Advanced Matching**: Filter requests by URL (exact, contains, regex) and HTTP method
- 📝 **JSON Deep Merge**: Intelligently merge response bodies without replacing entire payloads
- ⏱️ **Delay Simulation**: Add configurable delays to simulate network latency
- 💾 **Persistent Storage**: Rules stored in IndexedDB with instant sync
- 📦 **Import/Export**: Share rules via JSON files
- 🔄 **Rule Ordering**: First-match-wins evaluation with drag-and-drop reordering
- 🚦 **Master Toggle**: Enable/disable all rules with a single switch
- 🔍 **Request Simulator**: Test rules without leaving the extension

### User Interface

- Modern React 19 + TypeScript implementation
- Tailwind CSS with shadcn/ui components
- CodeMirror-powered JSON editor with syntax highlighting
- Real-time validation and error handling
- Responsive design optimized for the extension popup

---

## Architecture

Echo uses a **multi-layer architecture** to ensure reliable request interception:

```
┌─────────────────────────────────────────────────────────┐
│                     Web Page (DOM)                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  fetch() / XMLHttpRequest (Intercepted)           │  │
│  └───────────────┬───────────────────────────────────┘  │
│                  │                                        │
│  ┌───────────────▼───────────────────────────────────┐  │
│  │  Page Interceptor (MAIN world)                    │  │
│  │  - Wraps native fetch/XHR                         │  │
│  │  - Sends requests to Content Bridge               │  │
│  └───────────────┬───────────────────────────────────┘  │
└──────────────────┼────────────────────────────────────────┘
                   │ postMessage
┌──────────────────▼────────────────────────────────────────┐
│  Content Bridge (ISOLATED world)                          │
│  - Relays messages between page and background            │
└──────────────────┬────────────────────────────────────────┘
                   │ chrome.runtime.sendMessage
┌──────────────────▼────────────────────────────────────────┐
│  Background Service Worker                                 │
│  - Evaluates rules against requests                        │
│  - Manages IndexedDB storage                               │
│  - Returns intercept decisions (mock/modify/pass-through)  │
└────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **Background Worker** | `src/background.ts` | Rule evaluation engine and storage manager |
| **Page Interceptor** | `src/page-interceptor.ts` | Hooks into native fetch/XHR in page context |
| **Content Bridge** | `src/content-bridge.ts` | Message relay between page and extension |
| **Popup UI** | `src/App.tsx` | Main extension interface |
| **Rule Engine** | `src/lib/rule-engine.ts` | Rule matching and decision logic |
| **Database** | `src/lib/db.ts` | IndexedDB operations for rule persistence |

---

## Installation

### From Source (Development)

1. **Prerequisites**
   ```bash
   node >= 18.x
   pnpm >= 8.x
   ```

2. **Clone and Install**
   ```bash
   git clone https://github.com/Slogllykop/Echo.git
   cd Echo
   pnpm install
   ```

3. **Build the Extension**
   ```bash
   pnpm build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### From Chrome Web Store

*Coming soon*

---

## Quick Start

### 1. Create Your First Rule

1. Click the Echo extension icon in your browser toolbar
2. Click **"New Rule"** button
3. Configure the rule:
   - **Name**: "Mock User API"
   - **URL Pattern**: `https://api.example.com/user`
   - **Match Type**: "Contains"
   - **HTTP Method**: `GET`
   - **Action**: "Mock Response"
   - **Status Code**: `200`
   - **Response Body**:
     ```json
     {
       "id": 1,
       "name": "John Doe",
       "email": "john@example.com"
     }
     ```
4. Click **"Save Rule"**

### 2. Enable the Extension

Toggle the **"Extension"** switch to ON in the header.

### 3. Test It

Visit a page that makes requests to `https://api.example.com/user`. Echo will intercept the request and return your mocked response.

---

## Usage Guide

### Creating Rules

Rules define how Echo handles intercepted requests. Each rule consists of:

#### Match Configuration
- **URL Pattern**: String to match against request URLs
- **Match Type**:
  - `contains`: URL contains the pattern (case-insensitive)
  - `exact`: URL exactly matches the pattern
  - `regex`: URL matches the regex pattern
- **HTTP Method**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `*` (any)

#### Rule Actions

**Mock Response** - Return a fake response without hitting the API
- Status Code (e.g., `200`, `404`, `500`)
- Response Headers (optional)
- Response Body (JSON or plain text)
- Delay (milliseconds)

**Modify Request/Response** - Patch real requests/responses
- Modify Request Headers
- Modify Request Body
- Modify Response Headers
- Modify Response Body
- Modify Status Code
- Body Patch Strategy: `none`, `replace`, `merge-json`

### Rule Matching

Rules are evaluated in **order from top to bottom**. The **first matching rule** wins.

**Match Logic**:
1. URL pattern matches
2. HTTP method matches (or is `*`)
3. Rule is enabled

**Reorder Rules**: Drag and drop rules using the ↑↓ buttons to change evaluation priority.

### Body Patch Strategies

| Strategy | Behavior |
|----------|----------|
| `none` | Don't modify the body |
| `replace` | Replace entire body with new value |
| `merge-json` | Deep merge JSON objects (keeps existing keys) |

**Example: Merge JSON**

Original Response:
```json
{
  "user": { "name": "Alice", "age": 30 },
  "posts": []
}
```

Merge Patch:
```json
{
  "user": { "age": 31, "city": "NYC" }
}
```

Result:
```json
{
  "user": { "name": "Alice", "age": 31, "city": "NYC" },
  "posts": []
}
```

### Import/Export

**Export Rules**
1. Click **"Export"** button
2. Rules are downloaded as `echo-rules-YYYY-MM-DD.json`

**Import Rules**
1. Click **"Import"** button
2. Select a valid Echo JSON file
3. Confirm to replace existing rules

**Export File Format**:
```json
{
  "version": "1.0.1",
  "exportedAt": "2026-02-20T01:35:33.000Z",
  "rules": [
    {
      "id": "uuid",
      "name": "Rule Name",
      "enabled": true,
      "order": 0,
      "match": { ... },
      "action": { ... }
    }
  ]
}
```

---

## Development

### Setup Development Environment

```bash
# Install dependencies
pnpm install

# Start dev server with HMR
pnpm dev
```

**Load Extension in Development Mode**:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project **root directory** (not `dist`)
5. Keep `pnpm dev` running for hot module replacement

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server with HMR |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Fix linting issues |
| `pnpm format` | Format code with Biome |
| `pnpm release` | Create a new version with standard-version |

### Tech Stack

- **Framework**: React 19
- **Language**: TypeScript 5.9
- **Build Tool**: Vite 7 with `@crxjs/vite-plugin`
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Code Editor**: CodeMirror 6
- **Linting**: Biome
- **Storage**: IndexedDB (via custom wrapper)
- **Versioning**: standard-version

---

## Building

### Production Build

```bash
# Build optimized extension
pnpm build

# Output: dist/
# ├── manifest.json
# ├── index.html
# ├── assets/
# └── src/ (transpiled background/content scripts)
```

### Load Production Build

1. Open `chrome://extensions/`
2. Click "Load unpacked"
3. Select the `dist/` folder

### Publishing

```bash
# Create a new version
pnpm release

# Manually zip dist/ folder for Chrome Web Store upload
cd dist
zip -r ../echo-extension.zip .
```

---

## Project Structure

```
echo/
├── public/
│   └── icons/              # Extension icons (16, 32, 48, 128)
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui base components
│   │   ├── rule-editor.tsx
│   │   ├── request-simulator.tsx
│   │   └── code-editor.tsx
│   ├── lib/
│   │   ├── types.ts       # TypeScript type definitions
│   │   ├── rule-engine.ts # Rule matching logic
│   │   ├── db.ts          # IndexedDB operations
│   │   ├── runtime.ts     # Chrome runtime messaging
│   │   └── utils.ts       # Utility functions
│   ├── App.tsx            # Main popup UI
│   ├── main.tsx           # React app entry point
│   ├── background.ts      # Background service worker
│   ├── page-interceptor.ts # Page-level fetch/XHR hooks
│   ├── content-bridge.ts  # Content script bridge
│   └── index.css          # Global styles
├── manifest.json          # Chrome extension manifest
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Biome linter config
└── package.json
```

---

## Technical Details

### Request Interception

Echo intercepts requests using **dual injection**:

1. **Page Interceptor** (MAIN world)
   - Runs in the same JavaScript context as the web page
   - Wraps `window.fetch` and `window.XMLHttpRequest` prototypes
   - Sends intercepted request details via `postMessage`

2. **Content Bridge** (ISOLATED world)
   - Runs in isolated content script context
   - Listens for `postMessage` from page interceptor
   - Relays messages to background worker via `chrome.runtime.sendMessage`

This architecture ensures:
- ✅ All requests are captured (even from inline scripts)
- ✅ Extension code is isolated from page scripts
- ✅ No CORS issues with chrome extension APIs

### Rule Evaluation

```typescript
// Pseudo-code evaluation flow
function evaluateRules(rules: EchoRule[], request: InterceptRequest) {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    if (matchesUrl(rule.match.urlPattern, request.url, rule.match.matchType) &&
        matchesMethod(rule.match.method, request.method)) {
      
      if (rule.action.kind === 'mock') {
        return { type: 'mock', ...rule.action.mock };
      } else {
        return { type: 'modify', ...rule.action.modify };
      }
    }
  }
  
  return { type: 'pass-through' };
}
```

### Storage Schema

**IndexedDB Database**: `echo-rules-db`

**Object Store**: `rules`
- **Key**: `rule.id` (UUID)
- **Value**: `EchoRule` object
- **Index**: `order` (for sorting)

**Chrome Storage**: `chrome.storage.local`
- `echo:enabled` (boolean) - Extension master toggle
- `echo:rules-cache` (EchoRule[]) - Cached rules for performance

---

## Troubleshooting

### Service Worker Registration Failed (Status Code: 3)

**Cause**: Chrome is trying to load source files instead of built files.

**Solution**:
- **Dev Mode**: Run `pnpm dev` and keep it running, load unpacked from **root directory**
- **Production Mode**: Run `pnpm build`, load unpacked from **dist/** directory

### Extension Icon Not Visible

**Cause**: Extension not pinned to toolbar.

**Solution**:
1. Click the puzzle piece icon in Chrome toolbar
2. Find "Echo"
3. Click the pin icon

### Rules Not Applying

**Checklist**:
- ✅ Extension toggle is ON
- ✅ Rule is enabled (checkbox)
- ✅ URL pattern matches the request URL
- ✅ HTTP method matches (or is set to `*`)
- ✅ Rule order is correct (first match wins)
- ✅ Page is refreshed after creating/editing rules

**Debug**:
1. Open DevTools → Network tab
2. Check if requests are being made
3. Open Echo popup → Request Simulator
4. Paste request URL and test rule matching

### JSON Parsing Errors

**Cause**: Invalid JSON in response body or body patch.

**Solution**:
- Use the **Format** button in the code editor
- Validate JSON using a JSON validator
- Check for trailing commas, missing quotes, etc.

### Changes Not Persisting

**Cause**: IndexedDB storage quota exceeded or browser issue.

**Solution**:
1. Open `chrome://settings/content/all`
2. Search for your site
3. Clear storage and data
4. Export rules before clearing
5. Re-import after clearing

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards

- Use TypeScript for all new code
- Follow the existing code style (enforced by Biome)
- Add JSDoc comments for public APIs
- Write meaningful commit messages

### Running Tests

```bash
# Lint and format
pnpm lint
pnpm format

# Build and verify
pnpm build
```

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with [React](https://react.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Tabler Icons](https://tabler.io/icons)
- Code editor powered by [CodeMirror](https://codemirror.net/)

---

<div align="center">

**Made with ❤️ by the Echo team**

[Report Bug](https://github.com/Slogllykop/Echo/issues) · [Request Feature](https://github.com/Slogllykop/Echo/issues) · [Documentation](https://github.com/Slogllykop/Echo/wiki)

</div>
