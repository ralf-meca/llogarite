# Mobile app conventions

## Icons

All icons in this app come from **`phosphor-react-native`**. Do not import icons from
`@expo/vector-icons`, `react-native-vector-icons`, or any other icon library — this app
used to mix Ionicons and MaterialCommunityIcons and was fully migrated off them, so keep
it to a single icon source.

Import icons from the package root, e.g.:

```tsx
import { HouseIcon, TrashIcon } from 'phosphor-react-native';

<HouseIcon size={20} color={colors.primary} />
```

Icon component names are the Phosphor icon name + `Icon` suffix (e.g. `House` → `HouseIcon`).
Browse available icons and their exact names at https://phosphoricons.com.

Use the `weight` prop to match the old Ionicons filled/outline distinction where it mattered
(e.g. a checked vs. unchecked state, an active vs. inactive indicator):
- `weight="fill"` or `weight="bold"` for what used to be a solid/filled Ionicons glyph
- default (`"regular"`) for what used to be an `-outline` suffixed glyph

For a category/nav-item list whose icon varies per entry (e.g. `CATEGORIES` in
`lib/categories.ts`, `NAV_ITEMS` in `SideDrawer.tsx`), store the actual icon **component**
(typed as Phosphor's `Icon` type) in the data array, not a string name — then render it as
`<item.icon size={20} color={...} />`.

**Known tradeoff:** importing from the package root (`phosphor-react-native`) pulls in
Metro's module graph for the *entire* ~1500-icon set, since Metro doesn't tree-shake unused
named exports from a barrel. The package also exposes per-icon deep imports
(`phosphor-react-native/src/icons/House`) for real tree-shaking, but this path does **not**
typecheck in this project, at any `react-native-svg` version (tried upgrading 15.12.1 →
15.15.5, the latest published release — no change). Root cause: `phosphor-react-native`'s
own `src/lib/icon-base.tsx` unconditionally passes a `className` prop to react-native-svg's
`Svg` component, and `Svg`'s TypeScript props have never declared `className` in any
published react-native-svg version (it's presumably meant for a NativeWind-augmented type,
which this project doesn't use). This is a bug/assumption in `phosphor-react-native` itself,
not a version-compatibility gap — don't attempt the react-native-svg upgrade again on the
assumption that a newer version will fix it. Stick with the package-root import.

## EAS production builds

Before submitting a `production` profile build to EAS, validate the release build **locally
first**:

```bash
npx expo prebuild --platform android --clean --no-install
cd android && ./gradlew bundleRelease
```

This runs the exact same Gradle task (`:app:bundleRelease`) that EAS's cloud build runs, so it
catches Gradle-level failures — dependency/variant resolution errors, Kotlin version mismatches,
signing config issues — in a couple of minutes with full local output, instead of discovering
them after a 30-90 minute EAS free-tier queue wait. Only run `eas build` once the local
`bundleRelease` succeeds.

Delete the local `android/` folder (`rm -rf android`) after finishing this check — it's
gitignored and safe to remove, but if left in place it can balloon to 1-2 GB of Gradle build
output and get swept into the *next* `eas build`'s upload archive, which has caused a build
failure before (Gradle couldn't resolve any native module's release variant when this happened).
`expo prebuild` regenerates it fresh in seconds whenever it's needed again.

### versionCode

`eas.json` has `"appVersionSource": "remote"`, so `eas build` auto-increments versionCode
using a counter EAS tracks on its own servers — but that counter is only consulted by
`eas build` itself. A local build (`expo prebuild` + `gradlew bundleRelease`, e.g. to produce
an `.aab` to upload to Play Console directly without waiting on EAS's queue) does **not** touch
that counter at all, and `app.json` has no `android.versionCode` set, so an un-set local build
defaults to versionCode 1 — which Play Console will reject as not higher than whatever was
last uploaded.

**Every time you produce a build meant for actual upload — local or via EAS — bump the
versionCode first**, and keep it ahead of both (a) whatever was last actually uploaded to Play
Console and (b) EAS's own remote counter (check the highest `Version code` from recent
`eas build:list`), so the two paths never collide once you switch back to `eas build`. For a
local build, set `expo.android.versionCode` explicitly in `app.json` before running
`expo prebuild`.
