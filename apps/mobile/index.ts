// First, before anything that builds a style sheet: see lib/nightMode.ts.
import './lib/nightMode';

import { registerRootComponent } from 'expo';

import Root from './Root';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
