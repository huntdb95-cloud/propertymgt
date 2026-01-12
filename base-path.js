// base-path.js
// Resolves correct base URL for GitHub Pages (user site or project site) and local dev.
// Usage: assetUrl("rental-tracker.js") -> absolute URL to that asset
(function () {
  function getBaseUrl() {
    // If deployed as a GitHub Project Page, pathname is usually "/REPO_NAME/..."
    // If deployed as a User/Org Page, pathname is usually "/..."
    // We detect if the first segment matches a repo-like root by checking if we are NOT on localhost
    // and whether the site likely includes a repo segment.
    const { hostname, pathname } = window.location;

    // local dev or firebase hosting root behaves like user page root
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return new URL("./", window.location.href);
    }

    // Normalize
    const parts = pathname.split("/").filter(Boolean);

    // If URL includes "index.html" or another html file, base should be that folder.
    // new URL("./", href) already does that correctly.
    return new URL("./", window.location.href);
  }

  window.assetUrl = function assetUrl(file) {
    return new URL(file, getBaseUrl()).toString();
  };
})();
