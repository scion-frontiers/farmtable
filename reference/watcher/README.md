# 👁️ Watcher for Beads

<p align="center">
  <em>A beautiful, native macOS graphical interface for <a href="https://github.com/steveyegge/beads">Steve Yegge's beads (bd)</a> issue tracker.</em>
</p>

<img width="969" height="746" alt="Image" src="https://github.com/user-attachments/assets/dfa3196f-374b-458c-8b1f-74ec5a0df2a5" />

---

**Watcher** is a desktop application built specifically for macOS that brings your local `bd` repositories to life. It reads directly from your `.beads` databases and provides a rich, visual way to manage your tasks, bugs, and epics without leaving the comfort of a native UI.

## ✨ Features

- **🍎 Native macOS Design:** Built with `macos_ui`, Watcher feels right at home on your Mac. It features glassmorphic sidebars, native segmented controls, and deep integration with light/dark modes.
- **⚡️ Live Reloading:** Watcher watches your local `.beads` directories. If you (or an AI agent) update a task using the `bd` CLI, the UI updates instantly. No refresh button required.
- **🗂️ Multi-Project Management:** Add as many local repositories as you want to the sidebar. Seamlessly jump between contexts in milliseconds.
- **🌳 Hierarchical Tree View:** Visualize your Epics, Tasks, and Subtasks exactly how they relate to each other, complete with native disclosure triangles to expand or collapse complex trees. Blocked issues surface a red indicator; hub issues show how many others depend on them.
- **📋 Kanban Board:** See the flow of your work at a glance with automatically organized columns for Open, In Progress, and Closed issues. Blocked cards show a live "Blocked by N" badge.
- **✅ Ready Queue:** A flat, priority-sorted list of only the actionable issues right now — open, unblocked, nothing waiting on them. Mirrors `bd ready`.
- **🚫 Blocked View:** Every impediment in one place with its open blockers listed inline, so you can triage what to unblock first. Mirrors `bd blocked`.
- **🕸️ Dependency Graph:** Visualize the `blocks` DAG — which issues are in critical-path chains and which are indirect impediments — including edges that cross epic boundaries.
- **🔍 Issue Inspector:** Click any issue to slide out a detailed inspector panel. Shows Hierarchy (parent/children), Blocked By / Blocks, Related and Discovered-from links, and lets you add new dependency edges directly from the UI.
- **🤖 AI Terminal Orchestration:** Run AI Health Assessments and Planners transparently! Watcher seamlessly orchestrates `tmux` sessions in the background and can launch your preferred terminal emulator (Ghostty, iTerm2, or Terminal.app) so you can watch the AI agent work in real-time, approve commands, and retain context across sessions.
- **🤖 Native AI Integration:** Direct integration with Gemini via Firebase AI Logic (Vertex AI backend) for background task summarization and future voice mode features.

## 🚀 Getting Started

### Prerequisites

1. Ensure you have the [beads (`bd`) CLI](https://github.com/steveyegge/beads) installed and initialized in at least one local repository.
2. Install the [Flutter SDK](https://docs.flutter.dev/get-started/install/macos).
3. Ensure you have `tmux` installed (`brew install tmux`) for AI Terminal Orchestration features.
4. Ensure you have `icu4c` installed (`brew install icu4c`) for compiling the Go daemon with the latest `beads` dependency. (The `Makefile` dynamically locates it using `brew --prefix icu4c` to support custom Homebrew installation paths).

### 🤖 Firebase & AI Setup

Watcher uses **Firebase AI Logic** with the **Vertex AI** backend for native Gemini integration.

1.  **Install Firebase CLI:**
    ```bash
    npm install -g firebase-tools
    ```
2.  **Configure Firebase:**
    In the project root, run:
    ```bash
    flutterfire configure --project=YOUR_GCP_PROJECT_ID
    ```
    Select `macos` as the supported platform. This will generate `lib/firebase_options.dart`.
3.  **Enable APIs:**
    Ensure the **Vertex AI API** is enabled in your Google Cloud Console for the selected project.
4.  **Configure Watcher:**
    - Open Watcher Settings (`Cmd + ,`).
    - Enter your **GCP Project ID**.
    - Watcher defaults to **Gemini 3.5 Flash** in the `global` region. You can add additional models or change the default from the Settings panel.

### Installation

Clone this repository and get the dependencies:

```bash
git clone https://github.com/yourusername/watcher.git
cd watcher
flutter pub get
```

**To install the app on your Mac:**

We strongly recommend using the included `Makefile` to install Watcher directly to your `/Applications` folder. This process automatically builds the release version, strips Gatekeeper quarantine flags, and recursively applies an ad-hoc code signature to all embedded frameworks. This prevents macOS from silently crashing the app on launch due to Apple Mobile File Integrity (AMFI) policies.

```bash
make install
```

**To run the app in development mode:**

```bash
flutter run -d macos
```

### Usage

1. Open Watcher.
2. Click **+ Add Project** in the bottom left of the sidebar.
3. Select a local directory that has been initialized with `bd` (i.e., it contains a `.beads` folder).
4. Watch your tasks populate instantly!

## 🧠 How it Works

Watcher relies on a unified hybrid architecture to manage issue data quickly and native macOS system integration robustly.

### The `watcher-daemon` RPC Server
Instead of direct, slow CLI shell-outs for data queries, Watcher packages and bundles a custom Go binary (`watcher-daemon`) located inside the `Watcher.app/Contents/Resources` bundle. 
* **JSON-RPC 2.0**: The Flutter frontend communicates with the daemon via standard I/O (`stdin`/`stdout`) streams using JSON-RPC 2.0.
* **macOS PATH Fallback Protection**: Because macOS GUI applications (launched via Finder or Spotlight) do not inherit the user's shell profile `$PATH`, the Go daemon explicitly injects a robust default developer environment (`PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`) on all child processes to guarantee that the `bd` CLI, `git`, and external commands are always fully resolvable.

### Real-time Synchronization
To keep the UI beautifully snappy and fully synchronized, Watcher implements two reactive synchronization loops:
1. **OS-Level File Watching**: An active file watcher monitors the project's `.beads/backup/` directory. Whenever changes occur (triggered by either direct GUI inputs or local CLI mutations), Watcher catches the modification instantly, debounces for `100ms` to wait out disk I/O, and refreshes.
2. **Safety Heartbeat**: As an active fallback, a configurable safety heartbeat periodically re-queries the database to ensure no filesystem events were dropped. The interval can be customized under Global Settings (`Every 10 seconds`, `Every 30 seconds`, `Every minute`, `Every 5 minutes`, or `Disabled`).

### AI Terminal Orchestration

Watcher leverages a unique "Asynchronous Handoff" architecture to provide AI assistance without hiding the agent's work. 
1. When you trigger an AI action, Watcher ensures a detached `tmux` session exists for the current project.
2. It constructs a shell command that runs `gemini`, uses `tee` to write the output to a `.beads/ai_out.md` file, and `touch`es a `.beads/ai_done` lockfile upon completion.
3. Watcher injects this command into the `tmux` session and tells macOS to launch your Preferred Terminal (configured in Global Settings).
4. You get to watch the AI work in a beautiful, native terminal. If the AI asks for permission to execute a shell command, you can interact with it directly!
5. Meanwhile, Watcher's UI polls for the `.beads/ai_done` file. Once the AI finishes, Watcher reads the generated plan back into the GUI for you to review and apply.

## 🛠️ Contributing

We welcome contributions! If you're an AI agent or a human developer looking to help out, please check out our `GEMINI.md` and `docs/ARCHITECTURE.md` files for core architectural decisions, styling guidelines, and UI quirks specific to this codebase.

Note: All issue tracking for Watcher is done internally using `bd`. Run `bd list` to see what needs doing!

---
*Built with Flutter, `macos_ui`, and love.*