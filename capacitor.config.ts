import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.warroompicks.app",
  appName: "War Room Pick'Em",
  webDir: "public",
  server: {
    url: "https://www.war-room-picks.com",
    cleartext: false,
    allowNavigation: ["www.war-room-picks.com", "war-room-picks.com"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#020b07",
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 350,
      backgroundColor: "#020b07",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#020b07",
      overlaysWebView: false,
    },
  },
};

export default config;
