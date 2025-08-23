// components/SettingsButton.js
import React, { useState } from "react";
import { useSettings } from "./SettingsContext";

export default function SettingsButton({ topOffset = 76 }) {
  const { settings, toggle, set, reset } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ top: `calc(env(safe-area-inset-top,0px) + ${topOffset}px)` }}
        className="fixed right-16 z-[9999] rounded-xl bg-black/60 text-white px-3 py-2
                   border border-white/20 backdrop-blur shadow active:scale-95"
        aria-label="Settings"
        title="Settings"
      >⚙️</button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-[90%] max-w-sm rounded-2xl bg-[#0d0f14] text-white border border-white/15 shadow-2xl"
               onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-lg">Settings</h3>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white" aria-label="Close">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <Row label="Master" desc="Mute/unmute everything" v={settings.master} on={() => toggle("master")} />
              <Row label="Music"  desc="Background music"       v={settings.music}  on={() => toggle("music")}  disabled={!settings.master}/>
              <Row label="SFX"    desc="Sound effects"          v={settings.sfx}    on={() => toggle("sfx")}    disabled={!settings.master}/>
              <Row label="Haptics"desc="Vibration/Impact"       v={settings.haptics}on={() => toggle("haptics")}/>
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
    <div className="flex items-center justify-between gap-3 opacity-[.95]">
      <div><div className="font-semibold">{label}</div><div className="text-xs text-white/60">{desc}</div></div>
      <label className={"relative inline-flex items-center cursor-pointer " + (disabled ? "opacity-40 cursor-not-allowed" : "")}>
        <input type="checkbox" className="sr-only peer" checked={!!v} onChange={on} disabled={disabled}/>
        <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:bg-yellow-400 transition" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition" />
      </label>
    </div>
  );
}
