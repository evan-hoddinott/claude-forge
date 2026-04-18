import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';
import path from 'node:path';

const iconDir = path.resolve(__dirname, 'assets', 'icons');

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Caboo',
    executableName: 'caboo',
    // electron-packager resolves platform-specific extensions automatically:
    //   macOS → icon.icns, Windows → icon.ico, Linux → icon.png
    icon: path.join(iconDir, 'icon'),
    appBundleId: 'com.evanhoddinott.caboo',
    appCategoryType: 'public.app-category.developer-tools',
    extraResource: [path.join(iconDir, 'icon.png')],
  },
  rebuildConfig: {},
  makers: [
    // macOS — .dmg installer
    new MakerDMG({
      format: 'ULFO',
      icon: path.join(iconDir, 'icon.png'),
    }),
    // macOS — .zip fallback (for auto-updater on macOS)
    new MakerZIP({}, ['darwin']),
    // Windows — Squirrel .exe installer
    new MakerSquirrel({
      name: 'Caboo',
      setupIcon: path.join(iconDir, 'icon.ico'),
      iconUrl: 'https://raw.githubusercontent.com/evan-hoddinott/claude-forge/master/assets/icons/icon.ico',
      description: 'Multi-agent AI coding orchestrator',
    }),
    // Linux — .deb package
    new MakerDeb({
      options: {
        name: 'caboo',
        productName: 'Caboo',
        genericName: 'AI Coding Orchestrator',
        description: 'Multi-agent AI coding orchestrator',
        categories: ['Development', 'Utility'],
        icon: path.join(iconDir, 'icon.png'),
        section: 'devel',
        maintainer: 'evan-hoddinott',
      },
    }),
    // Linux — .rpm package
    new MakerRpm({
      options: {
        name: 'caboo',
        productName: 'Caboo',
        genericName: 'AI Coding Orchestrator',
        description: 'Multi-agent AI coding orchestrator',
        categories: ['Development', 'Utility'],
        icon: path.join(iconDir, 'icon.png'),
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses harden the Electron binary at package time
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'evan-hoddinott',
        name: 'claude-forge',
      },
      prerelease: false,
      draft: true,
    }),
  ],
};

export default config;
