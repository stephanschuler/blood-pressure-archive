import type { ConfigContext, ExpoConfig } from 'expo/config';

// Android meldet sich als „Version-Commit", etwa 0.0.1-81551eb. GIT_HASH setzt das Makefile:
// gebaut wird in einem Docker-Volume ohne .git.
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: { ...config.android, version: process.env.GIT_HASH ? `${config.version}-${process.env.GIT_HASH}` : config.version },
  }) as ExpoConfig;
