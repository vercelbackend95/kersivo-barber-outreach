import { Config } from '@remotion/cli/config';

Config.setPublicDir('../public/reel-assets');
Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setOffthreadVideoCacheSizeInBytes(1024 * 1024 * 512);
