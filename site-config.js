// site-config.js
(function () {
  // Base URL of the *current* origin (works on localhost, GitHub Pages, custom domains)
  const ORIGIN = window.location.origin;

  // Base path = directory of the current page (works if app is hosted at / or a subfolder)
  const BASE = new URL("./", window.location.href);

  // For cases where you need absolute page URLs
  window.SITE = {
    origin: ORIGIN,
    baseUrl: BASE.toString(),
    pageUrl: (file) => new URL(file, BASE).toString(),
    assetUrl: (file) => new URL(file, BASE).toString(),
    hostname: window.location.hostname
  };
})();
