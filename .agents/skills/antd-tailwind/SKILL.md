---
name: antd-tailwind
description: Integrate Ant Design 6.x with Tailwind CSS v4 or v3 in React applications. Use when adding Tailwind to an antd project, fixing preflight or specificity conflicts, bridging design tokens into Tailwind, or styling antd component internals with classNames and styles.
---

# Ant Design 6 + Tailwind CSS

## Scope

- antd 6.x with React 18 or 19.
- Tailwind CSS v4 is the default target; Tailwind v3 notes are included.
- This repository uses Vite, antd 6, CSS Modules, and custom variables in `web/src/styles/tokens.css`. Tailwind is not installed yet.

## Styling boundary

- Tailwind owns layout, spacing, sizing, responsive behavior, typography, and one-off visual adjustments.
- antd owns components, colors, radii, motion, interaction states, and dark mode.
- Customize antd through `classNames`, `styles`, `ConfigProvider` tokens, and CSS variables.
- Do not use `!important`, do not target `.ant-*` internals from global CSS, and do not use `@apply` with antd class names.

## Install Tailwind v4 with Vite

```bash
npm install tailwindcss @tailwindcss/vite
```

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Import Tailwind once from the application entry stylesheet. In this repository that is `web/src/styles/global.css`.

## Required layer order

```css
@layer theme, base, antd, components, utilities;

@import 'tailwindcss';
```

Optional antd reset:

```css
@import 'antd/dist/reset.css' layer(base);
```

Rules:

- `base` contains Tailwind Preflight and must come before `antd`.
- `antd` contains antd component styles.
- `utilities` must come last so Tailwind classes supplied through `classNames` win.
- Keep the layer declaration before any `@layer` block is used. In SSR, emit the declaration before antd injects styles.

## Runtime mode

antd 6 still generates styles at runtime by default, even though CSS variables are enabled. Lower antd specificity with a layer:

```tsx
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider layer>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </StyleProvider>
  );
}
```

Wrap the provider that actually renders antd components. In this repository, place `StyleProvider` outside the existing `XProvider` and `AntdApp` tree in `web/src/app/providers.tsx`.

## Zero-runtime mode

Zero-runtime mode removes runtime style generation and requires a static stylesheet:

```tsx
import 'antd/dist/antd.css';

<ConfigProvider theme={{ zeroRuntime: true }}>
  <App />
</ConfigProvider>;
```

When layers are enabled, both the static file and the reset must be placed in their layers:

```css
@layer theme, base, antd, components, utilities;

@import 'tailwindcss';
@import 'antd/dist/reset.css' layer(base);
@import 'antd/dist/antd.css' layer(antd);
```

Use `App.useApp()` instead of static `message`, `notification`, or `Modal` methods. Static methods cannot consume provider context and commonly lose icon and theme styles in zero-runtime mode.

## Tailwind v3

```css
@layer tailwind-base, antd;

@layer tailwind-base {
  @tailwind base;
}

@tailwind components;
@tailwind utilities;
```

Continue to use `<StyleProvider layer>` in runtime mode, or place the static antd stylesheet in `layer(antd)`.

## Style antd with classNames and styles

```tsx
<Button
  classNames={{
    root: 'rounded-xl',
    icon: 'opacity-80',
  }}
  styles={{
    root: { borderWidth: 2 },
  }}
  icon={<GiftOutlined />}
>
  Save
</Button>
```

Prefer this over selectors such as `.ant-btn` or inline `!important`. For component-wide changes, use `ConfigProvider` component tokens or CSS variables first.

## Bridge design tokens

Official antd guidance does not provide automatic token synchronization with Tailwind. Choose one source of truth and map it explicitly.

Preferred approach for this repository: keep `web/src/styles/tokens.css` as the source of truth and expose the stable values to Tailwind.

```css
@theme {
  --color-brand: var(--brand-600);
  --color-brand-strong: var(--brand-500);
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-ink: var(--ink-900);
  --color-ink-muted: var(--ink-600);
  --color-line: var(--line);
}
```

Then use `bg-brand`, `text-ink`, `border-line`, and similar utilities.

Avoid mapping a Tailwind theme variable to an identically named custom property. For example, do not write `--radius-md: var(--radius-md)`, because `@theme` also emits `--radius-md` and the declaration becomes circular. Rename the key or use an arbitrary value.

If antd CSS variables are the source, reference them directly:

```css
@theme {
  --color-primary: var(--ant-color-primary);
  --color-bg-layout: var(--ant-color-bg-layout);
}
```

Caveats:

- antd 6 scopes CSS variables to a hashed class by default, so they are not guaranteed to exist on arbitrary DOM outside an antd component subtree.
- Do not use `cssVar: { key: '_,:root' }`. It is an unsupported workaround and can break component styles.
- `theme.token` values must be static values. Do not pass `var(--...)` into `ConfigProvider` tokens.

## Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| antd buttons and inputs look reset | Preflight is loaded after antd | Keep `base` before `antd` in the layer order |
| Tailwind utility on an antd component has no effect | antd styles have higher cascade priority | Add `StyleProvider layer` or put `antd.css` in `layer(antd)` |
| Tailwind utility works on a wrapper but not inside a component | The class targets the antd root only | Use the component's `classNames` map to reach internal slots |
| Theme variables do not resolve in Tailwind | antd variables are scoped or named differently | Map from `tokens.css`, or pass explicit values into `@theme` |
| `message` icons lose color in zero-runtime mode | Static method bypasses provider context | Use `App.useApp()` |
| Popup or dropdown content is unstyled | Portal is outside the themed subtree | Use `ConfigProvider getPopupContainer` or render through `App` |

## Repository checklist

1. Add `tailwindcss` and `@tailwindcss/vite`, then register the plugin in `web/vite.config.ts`.
2. Add the layer declaration and `@import 'tailwindcss'` at the top of `web/src/styles/global.css`.
3. Wrap the provider tree in `web/src/app/providers.tsx` with `StyleProvider layer`.
4. Map only stable tokens from `web/src/styles/tokens.css` into `@theme`.
5. Keep existing CSS Modules and migrate incrementally. Do not rewrite the whole `web/src` tree in one change.
6. Verify a page that uses `Table`, `Modal`, `Select`, and `Button`, because those expose preflight, portal, and specificity problems early.
