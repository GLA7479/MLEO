// utils/global-audio-guard.js
if (typeof window !== "undefined" && typeof document !== "undefined") {
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
        if (!allowed) { el.pause?.(); el.currentTime = el.currentTime; }
        if (allowed) el.volume = music ? Math.min(el.volume || 1, 0.8) : (el.volume || 1);
      } catch {}
    };

    const rescan = () => { document.querySelectorAll("audio").forEach(applyToAudioEl); };

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

    try {
      const NativeAudio = window.Audio;
      window.Audio = function (...args) {
        const el = new NativeAudio(...args);
        try { setTimeout(() => applyToAudioEl(el), 0); } catch {}
        return el;
      };
      window.Audio.prototype = NativeAudio.prototype;
    } catch {}

    const nativeVibrate = navigator.vibrate?.bind(navigator);
    navigator.vibrate = function (pattern) {
      if (!settings.haptics || !settings.master) return false;
      return nativeVibrate ? nativeVibrate(pattern) : false;
    };

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

    window.addEventListener("mleo:settings", (ev) => {
      settings = { ...settings, ...(ev.detail || {}) };
      rescan();
    });

    window.addEventListener("storage", (ev) => {
      if (ev.key === KEY) {
        settings = { ...settings, ...(read()) };
        rescan();
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", rescan, { once:true });
    } else {
      rescan();
    }
  })();
}
