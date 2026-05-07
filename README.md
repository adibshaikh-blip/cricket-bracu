# Cricket BracU (v0.1)

React + Firebase Realtime Database + Firebase Auth.

## Architecture (MVC-ish)
- `src/mvc/models/`: types + Firebase repositories (Realtime DB reads/writes)
- `src/mvc/controllers/`: auth context, route guards, tournament creation controller
- `src/mvc/views/`: React pages/forms (Admin login, Player login/register, dashboards)

## Version 0.1 Features
- Authentication for `Admin` and `Player`
- Admin login (no admin registration in the UI)
- Admin dashboard: create tournaments
- Player dashboard: placeholder only

## Firebase Setup
Create a Firebase project and enable:
- Authentication (Email/Password)
- Realtime Database

Add a `.env` file (use the template in `.env.example`).

### Realtime Database schema (minimum)
- `/roles/{uid}`: `"admin"` or `"player"`
- `/players/{uid}`: `{ name, email, createdAt }`
- `/tournaments/{autoId}`: tournament records created by the admin

### Admin notes
The website does not offer admin registration. For an admin to be able to log in:
1. The admin must exist in Firebase Auth (Email/Password).
2. The admin's `uid` must be written to `/roles/{uid}` as `"admin"`.

## Run locally
```bash
npm install
npm run dev
```

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
