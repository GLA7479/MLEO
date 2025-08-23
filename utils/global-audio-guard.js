// utils/global-audio-guard.js
(function () {
  const KEY = "mleo_settings_v1";
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  let settings = { master:true, music:true, sfx:true, haptics:true, ...read() };

  const isMusicSrc = (src="") => {
    const s = (src || "").toLowerCase();
    return s.includes("/music/") || s.includes("bgm") || s.includes("music=");
  };

  const applyToAudioEl = (el) => {
    if (!el) return;
    const music = isMusicSrc(el.currentSrc || el.src);
    const allowed = settings.master && (music ? settings.music : settings.sfx);
    try {
      el.muted = !allowed;
      if (!allowed) { el.pause?.(); el.currentTime = el.currentTime; } // “freeze” without throwing
      else { /* לא מפעיל אוטומטית כדי לא לשבור אינטראקציות */ }
      // שמירת ווליום רך: מוזיקה טיפה יותר חלש
      if (allowed) el.volume = music ? Math.min(el.volume || 1, 0.8) : (el.volume || 1);
    } catch {}
  };

  // כל האודיואים הקיימים
  const rescan = () => { document.querySelectorAll("audio").forEach(applyToAudioEl); };

  // מאזין לשינויים ב-DOM
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (n && n.nodeType === 1) {
          if (n.tagName === "AUDIO") applyToAudioEl(n);
          n.querySelectorAll && n.querySelectorAll("audio").forEach(applyToAudioEl);
        }
      });
      if (m.type === "attributes" && m.target?.tagName === "AUDIO" && m.attributeName === "src") {
        applyToAudioEl(m.target);
      }
    }
  });
  try { mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["src"] }); } catch {}

  // עוטף את window.Audio עבור new Audio()
  try {
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const el = new NativeAudio(...args);
      try { setTimeout(() => applyToAudioEl(el), 0); } catch {}
      return el;
    };
    window.Audio.prototype = NativeAudio.prototype;
  } catch {}

  // רטט/Haptics
  const nativeVibrate = navigator.vibrate?.bind(navigator);
  navigator.vibrate = function (pattern) {
    if (!settings.haptics || !settings.master) return false;
    return nativeVibrate ? nativeVibrate(pattern) : false;
  };

  // Capacitor Haptics (אם קיים נטען מאוחר יותר)
  (async () => {
    try {
      const mod = await import("@capacitor/haptics");
      const origImpact = mod?.Haptics?.impact?.bind(mod.Haptics);
      if (origImpact) {
        mod.Haptics.impact = async (...a) => {
          if (!settings.haptics || !settings.master) return;
          try { await origImpact(...a); } catch {}
        };
      }
    } catch {}
  })();

  // קבלת עדכונים מה-Provider
  window.addEventListener("mleo:settings", (ev) => {
    settings = { ...settings, ...(ev.detail || {}) };
    rescan();
  });

  // שינוי ידני ב-localStorage (לשוניות אחרות)
  window.addEventListener("storage", (ev) => {
    if (ev.key === KEY) {
      settings = { ...settings, ...(read()) };
      rescan();
    }
  });

  // הפעלה ראשונית
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rescan, { once:true });
  } else {
    rescan();
  }
})();
