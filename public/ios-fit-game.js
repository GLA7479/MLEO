/*! ios-fit-game.js – auto-fit .game-container height on iOS (Safari) */
(function () {
  var ua = navigator.userAgent || "";
  var isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (!isIOS) return;

  function fitOne(el) {
    if (!el) return;
    try {
      var vvH = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      var rect = el.getBoundingClientRect();
      var top = rect.top; // distance from top of viewport
      // Height available from element's top to bottom of viewport (ignores page scroll)
      var h = Math.max(0, Math.floor(vvH - top));

      // Apply height to container
      el.style.minHeight = h + "px";
      el.style.height = h + "px";

      // If there's a canvas inside, scale it precisely
      var canvas = el.querySelector("canvas");
      if (canvas) {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var cssW = el.clientWidth;
        var cssH = el.clientHeight;
        if (cssW > 0 && cssH > 0) {
          var targetW = Math.floor(cssW * dpr);
          var targetH = Math.floor(cssH * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            var ctx = canvas.getContext("2d");
            if (ctx && ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
        }
      }
    } catch (e) {
      // no-op
    }
  }

  function fitAll() {
    var nodes = document.querySelectorAll(".game-container");
    for (var i = 0; i < nodes.length; i++) fitOne(nodes[i]);
  }

  // Run on load and respond to viewport changes
  var scheduled = null;
  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(function () {
      scheduled = null;
      fitAll();
    });
  }

  document.addEventListener("DOMContentLoaded", schedule, { passive: true });
  window.addEventListener("load", schedule, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", schedule, { passive: true });
    window.visualViewport.addEventListener("scroll", schedule, { passive: true });
  }

  window.addEventListener("orientationchange", function () {
    setTimeout(fitAll, 350);
  });

  // Also observe DOM mutations in case the game container mounts later
  try {
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
  } catch (_) {}
})();
