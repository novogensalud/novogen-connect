import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'original-mobile.spec.ts',workers:1,use:{headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}}});
