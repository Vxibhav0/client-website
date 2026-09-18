/**
 * Page transition overlay.
 *
 * Whenever the visitor moves to another page on this site (clicking a link,
 * or a script navigating with pageTransition.goTo), a translucent "please
 * wait" screen with a spinning coffee cup is shown for HOLD_MS before the
 * browser actually navigates.
 *
 * Include this on every page, alongside transition.css.
 */
(function () {
  var HOLD_MS = 2000;

  var overlay = document.createElement("div");
  overlay.className = "page-transition-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<div class="page-transition-cup-wrap">' +
      '<span class="page-transition-ring"></span>' +
      '<span class="page-transition-cup">☕</span>' +
    "</div>" +
    '<p class="page-transition-text">Please wait<span class="pt-dots"><span>.</span><span>.</span><span>.</span></span></p>';

  function mount() {
    if (document.body && !overlay.parentNode) {
      document.body.appendChild(overlay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  function show() {
    overlay.classList.add("show");
  }

  function hide() {
    overlay.classList.remove("show");
  }

  function goTo(href) {
    show();
    window.setTimeout(function () {
      window.location.href = href;
    }, HOLD_MS);
  }

  window.pageTransition = { show: show, hide: hide, goTo: goTo };

  // Catch normal <a> clicks that lead to another page on this same site and
  // route them through the overlay instead of navigating instantly.
  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) return;

    var href = link.getAttribute("href");

    if (
      !href ||
      href.charAt(0) === "#" ||
      href.indexOf("mailto:") === 0 ||
      href.indexOf("tel:") === 0 ||
      href.indexOf("javascript:") === 0 ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    ) {
      return;
    }

    var target;
    try {
      target = new URL(href, window.location.href);
    } catch (e) {
      return;
    }

    // Leave external links alone — only intercept navigation within the site.
    if (target.origin !== window.location.origin) return;

    event.preventDefault();
    goTo(target.href);
  });

  // If the page is restored from the back/forward cache, make sure the
  // overlay isn't left stuck on screen.
  window.addEventListener("pageshow", hide);
})();
