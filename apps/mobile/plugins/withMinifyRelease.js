const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Turns R8 on for release builds. app/build.gradle reads this property and
// defaults it to false, so nothing was ever renamed and Play reported the app
// as ~2% obfuscated, below the 25% it warns about. android/ is generated, so
// this has to be set from a plugin - editing gradle.properties by hand would
// be thrown away by the next prebuild.
const PROPERTY = 'android.enableMinifyInReleaseBuilds';
const MARKER = '# minify-release: see plugins/withMinifyRelease.js';

// R8 holds the whole program graph in memory at once. The generated default of
// 2048m is not enough for an app this size: the daemon is OOM-killed part way
// through and Gradle reports only "build daemon disappeared unexpectedly",
// which reads like a crash rather than a memory limit.
const JVM_ARGS_PROPERTY = 'org.gradle.jvmargs';
const JVM_ARGS = '-Xmx6144m -XX:MaxMetaspaceSize=1024m';

// R8 removes and renames anything it cannot see a reference to. A React Native
// app reaches a great deal of native code by name from JS, which R8 cannot
// follow, so those entry points have to be kept explicitly. A missing rule
// does not fail the build: it fails at runtime, in release only, usually as a
// single broken feature rather than a crash on launch.
const RULES = `
${MARKER}

# The bridge looks modules and view managers up by name from JS.
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# Expo resolves its modules by name at startup.
-keep class expo.modules.** { *; }

# Hermes and the JNI layer are reached from native code.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Dropping these breaks reflection and generic type lookups at runtime.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Keep the line numbers in crash reports useful; without this every release
# stack trace comes back as unreadable renamed frames.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
`;

function setProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

function withMinifyProperty(config) {
  return withGradleProperties(config, (config) => {
    setProperty(config.modResults, PROPERTY, 'true');
    setProperty(config.modResults, JVM_ARGS_PROPERTY, JVM_ARGS);
    return config;
  });
}

function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const contents = fs.readFileSync(file, 'utf8');
      if (!contents.includes(MARKER)) {
        fs.writeFileSync(file, `${contents}${RULES}`);
      }
      return config;
    },
  ]);
}

module.exports = (config) => withProguardRules(withMinifyProperty(config));
