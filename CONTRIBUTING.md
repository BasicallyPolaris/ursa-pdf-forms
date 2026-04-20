# Contributing to Ursa PDF Forms

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Ursa PDF Forms. These are mostly guidelines, not rules. Use your best judgment and feel free to propose changes to this document in a pull request.

## Tech Stack

Before diving in, please note the core technologies used:

- **Runtime:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend:** React 19, TypeScript
- **Styling:** TailwindCSS 4
- **Package Manager:** [Bun](https://bun.sh/)

## Getting Started

### Prerequisites

1.  **Rust:** You need the latest stable Rust. [Install Rust](https://www.rust-lang.org/tools/install).
2.  **Bun:** We use Bun for package management and script running. [Install Bun](https://bun.sh/).
3.  **System Deps:** If you are on Linux, ensure you have the WebKit/GTK dependencies installed. See [Tauri Linux Setup](https://tauri.app/start/prerequisites/#linux).

### Local Development

1.  **Clone the repository**

    ```bash
    git clone https://github.com/BasicallyPolaris/ursa-pdf-forms.git
    cd ursa-pdf-forms
    ```

2.  **Install dependencies**

    ```bash
    bun install
    ```

3.  **Run the development server**
    This command will start the React frontend and compile the Rust backend.
    ```bash
    bun run tauri dev
    ```

## Project Structure

- `src-tauri/`: Contains the Rust backend code.
  - `src/lib.rs`: Main entry point for Tauri commands.
  - `src/main.rs`: Binary entry point.
  - `build.rs`: Build script for custom steps.
  - `Cargo.toml`: Rust package manifest.
  - `Cargo.lock`: Dependency lockfile.
  - `capabilities/`: Tauri permission configurations.
  - `icons/`: Icon assets for different platforms.
  - `target/`: Build output directory (auto-generated).
- `src/`: Contains the React frontend code.
  - `components/`: React UI components (canvas overlay, sidebar, properties panel, etc.).
  - `hooks/`: Custom React hooks.
  - `lib/`: Pure functions and domain logic (no store dependencies).
  - `stores/`: Zustand stores with undo/redo support.
- `tests/`: Test files mirroring `src/` structure.
  - `lib/`: Unit tests for lib/ modules.
  - `app.test.tsx`: Integration tests.

## Making Changes

### Branching Strategy

- **main**: This is the production branch.
- **Feature Branches**: Create a new branch for your feature or fix (e.g., `feat/new-field-type` or `fix/canvas-bug`).

### Code Style

- No comments in code unless explicitly requested.
- Use `@/` path aliases for imports.
- Pure functions in `lib/` with no store dependencies are preferred.
- Components read from store via `useEditorStore()` hook selector pattern.

### Running Tests

```bash
bun run test
```

### Submitting a Pull Request

1.  Push your branch to your fork.
2.  Submit a Pull Request to the `main` branch.
3.  Describe your changes clearly. If it fixes a bug, link the issue number.
4.  Include screenshots if you changed the UI!

## Reporting Bugs

Bugs happen! If you find one, please open an issue and include:

1.  Your operating system (Windows, macOS, or Linux).
2.  Steps to reproduce the bug.
3.  Expected vs. actual behavior.

## License

By contributing, you agree that your contributions will be licensed under the GPLv3 License.
