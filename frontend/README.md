# Next.js Application

This is a Next.js application that includes a product grid, a swiper component, and various other UI elements.

## Getting Started

### Prerequisites

- Node.js (v14.x or later)
- npm (v6.x or later)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
    ```
2. Install the dependencies:
3. ```bash
   npm install
   ```
4. Start the development server:
   ```bash
    npm run dev
    ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.
6. To build the application for production, run:
   ```bash
   npm run build
   ```
7. To start the production server, run:
   ```bash
    npm run start
    ```
8. To run the linter, run:
9. ```bash
   npm run lint
   ```
10. To run the tests, run:
11. ```bash
    npm run test
    ```

### Tauri build

- Change to `output: 'export', // use for tauri only`

```bash
bun run tauri build
```