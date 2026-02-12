# Contributing to WorkLedger

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/gruberb/workledger.git
cd workledger
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run `npm run lint` and `npm run build` to verify everything works
5. Commit your changes with a clear message
6. Push to your fork and open a pull request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Describe what your PR does and why
- Make sure `npm run lint` and `npm run build` pass
- Update the README if your change affects usage

## Reporting Bugs

Open an [issue](https://github.com/gruberb/workledger/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS

## Suggesting Features

Open an [issue](https://github.com/gruberb/workledger/issues) describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Code Style

- TypeScript with strict mode
- React functional components with hooks
- Tailwind CSS for styling
- ESLint handles formatting -- run `npm run lint` before committing
