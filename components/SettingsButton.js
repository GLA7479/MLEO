// components/SettingsButton.js
import React, { useState } from "react";
import { useSettings } from "./SettingsContext";

export default function SettingsButton({ topOffset = 76, rightOffsetPx = 16 }) {
  const { settings, toggle, set, reset } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
        // === שיהיה בדיוק כמו FullscreenButton ===
        style={{
          top: `${topOffset}px`,
          right: `${rightOffsetPx}px`,
        }}
        className="fixed z-[10000] w-10 h-10 flex items-center justify-center
                   rounded-full bg-yellow-400 shadow hover:bg-yellow-300 active:scale-95"
      >
        {/* אייקון שחור באותו גודל כמו FULL */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="black"
          className="w-7 h-7"
        >
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 00.12-.65l-1.93-3.34a.5.5 0 00-.61-.2l-2.4.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.72a.5.5 0 00-.5.42l-.36 2.54a7.03 7.03 0 00-1.62.94l-2.4-.96a.5.5 0 00-.61.2L2.71 8.48a.5.5 0 00.12.65l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 00-.12.65l1.93 3.34c.14.24.43.34.7.24l2.4-.96c.48.39 1.03.7 1.62.94l.36 2.54c.05.25.25.42.5.42h3.72c.25 0 .45-.17.5-.42l.36-2.54c.59-.24 1.14-.55 1.62-.94l2.4.96c.27.1.56 0 .7-.24l1.93-3.34a.5.5 0 00-.12-.65l-2.03-1.58zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[90%] max-w-sm rounded-2xl bg-[#0d0f14] text-white border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-lg">Settings</h3>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <Row label="Master"  desc="Mute/unmute everything" v={settings.master}  on={() => toggle("master")} />
              <Row label="Music"   desc="Background music"       v={settings.music}   on={() => toggle("music")}   disabled={!settings.master}/>
              <Row label="SFX"     desc="Sound effects"          v={settings.sfx}     on={() => toggle("sfx")}     disabled={!settings.master}/>
              <Row label="Haptics" desc="Vibration/Impact"       v={settings.haptics} on={() => toggle("haptics")} />
              <div className="pt-2 flex gap-3">
                <button className="flex-1 rounded-lg bg-yellow-400 text-black font-semibold py-2"
                        onClick={() => set({ master:false, music:false, sfx:false })}>Mute All</button>
                <button className="flex-1 rounded-lg bg-gray-700 text-white font-semibold py-2" onClick={reset}>Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, desc, v, on, disabled }) {
  return (
    <div className={"flex items-center justify-between gap-3 opacity-[.95] " + (disabled ? "opacity-40" : "")}>
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-white/60">{desc}</div>
      </div>
      <label className={"relative inline-flex items-center cursor-pointer " + (disabled ? "cursor-not-allowed" : "")}>
        <input type="checkbox" className="sr-only peer" checked={!!v} onChange={on} disabled={disabled}/>
        <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:bg-yellow-400 transition" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition" />
      </label>
    </div>
  );
}
