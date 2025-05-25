# TidyJS Coding Guidelines

## Build/Test/Lint Commands
- Build: `npm run compile` 
- Watch: `npm run watch`
- Lint: `npm run lint`
- Fix lint issues: `npm run lint:fix`
- Type check: `npm run check-types`
- Run all tests: `npm run test:unit`
- Run single test: `jest test/unit/file-name.test.ts -t "test description"`

## Code Style
- TypeScript with strict typing - use explicit return types
- Single quotes for strings
- 4-space indentation
- Semicolons required
- Import sorting priority: side effects → default → named → type default → type named
- Use camelCase for variables and functions
- Format imports with TidyJS style (aligned 'from' keywords, grouped imports)
- Imports follow group pattern defined in ConfigManager
- Proper error handling with detailed logging via utils/log.ts

## Organization
- Parser: Analyzes and organizes imports
- Formatter: Handles alignment and visual formatting
- Extension: VS Code integration
- Utils: Configuration, logging, and helpers