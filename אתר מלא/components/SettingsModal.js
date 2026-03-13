// components/SettingsModal.js
import { useEffect, useMemo, useRef, useState } from "react";

const LS_SETTINGS_KEY = "appSettings_v1";
const LS_USER_KEY = "appUser_v1";

// Safe LS helpers
function readLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function SettingsModal({ open, onClose }) {
  // --- Settings ---
  const [musicEnabled, setMusicEnabled]   = useState(false);
  const [sfxEnabled, setSfxEnabled]       = useState(true);
  const [vibrationEnabled, setVibration]  = useState(false);
  const [musicVolume, setMusicVolume]     = useState(0.5);

  // --- Temporary Registration ---
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");

  // Load settings/user on open
  useEffect(() => {
    if (!open) return;
    const s = readLS(LS_SETTINGS_KEY, null);
    if (s) {
      setMusicEnabled(!!s.musicEnabled);
      setSfxEnabled(s.sfxEnabled !== false);
      setVibration(!!s.vibrationEnabled);
      setMusicVolume(typeof s.musicVolume === "number" ? s.musicVolume : 0.5);
    }
    const u = readLS(LS_USER_KEY, null);
    if (u) { setName(u.name || ""); setEmail(u.email || ""); }
  }, [open]);

  // Persist + broadcast (no global audio element here)
  const persistAndBroadcast = (next) => {
    writeLS(LS_SETTINGS_KEY, next);
    try {
      window.dispatchEvent(new CustomEvent("app:settings-changed", { detail: next }));
    } catch {}
  };

  // Toggle handlers
  const onToggleMusic = (val) => {
    setMusicEnabled(val);
    persistAndBroadcast({ musicEnabled: val, sfxEnabled, vibrationEnabled, musicVolume });
  };
  const onToggleSfx = (val) => {
    setSfxEnabled(val);
    persistAndBroadcast({ musicEnabled, sfxEnabled: val, vibrationEnabled, musicVolume });
  };
  const onToggleVibration = (val) => {
    setVibration(val);
    persistAndBroadcast({ musicEnabled, sfxEnabled, vibrationEnabled: val, musicVolume });
    if (val && navigator.vibrate) navigator.vibrate(12);
  };
  const onVolume = (v) => {
    const vol = Math.max(0, Math.min(1, parseFloat(v || 0)));
    setMusicVolume(vol);
    persistAndBroadcast({ musicEnabled, sfxEnabled, vibrationEnabled, musicVolume: vol });
  };

  // Temporary registration
  const onTempRegister = () => {
    writeLS(LS_USER_KEY, { name: name.trim(), email: email.trim() });
    alert("Saved locally (temporary registration).");
  };

  // Wallet (future)
  const onConnectWallet = () => {
    alert("🔗 Wallet connection — coming soon.");
  };

  // Close with ESC / overlay click
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl text-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xl">⚙️</span>
            <h3 className="text-lg font-extrabold">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 bg-yellow-400 text-black font-bold hover:bg-yellow-300 active:scale-95"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-6">
          {/* Account */}
          <section>
            <h4 className="font-bold mb-2">Account</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={onConnectWallet}
                className="w-full rounded-xl bg-yellow-400 text-black font-extrabold px-4 py-3 hover:bg-yellow-300 active:scale-95"
              >
                🪙 Connect Wallet (Future)
              </button>
              <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                <label className="block text-sm mb-1 opacity-80">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-black"
                  placeholder="Your name"
                />
                <label className="block text-sm mt-2 mb-1 opacity-80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-black"
                  placeholder="name@mail.com"
                />
                <button
                  onClick={onTempRegister}
                  className="mt-3 w-full rounded-lg bg-yellow-400 text-black font-bold px-3 py-2 hover:bg-yellow-300 active:scale-95"
                >
                  Save temporary registration
                </button>
              </div>
            </div>
          </section>

          {/* Audio & Vibration */}
          <section>
            <h4 className="font-bold mb-2">Audio & Vibration</h4>
            <div className="space-y-3">
              <ToggleRow
                label="Background music"
                checked={musicEnabled}
                onChange={onToggleMusic}
              />
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <span className="text-sm opacity-80">Music volume</span>
                <input
                  type="range"
                  min="0" max="1" step="0.01"
                  value={musicVolume}
                  onChange={(e) => onVolume(e.target.value)}
                  className="w-48 accent-yellow-400"
                />
              </div>
              <ToggleRow
                label="Sound effects (SFX)"
                checked={sfxEnabled}
                onChange={onToggleSfx}
              />
              <ToggleRow
                label="Vibration"
                checked={vibrationEnabled}
                onChange={onToggleVibration}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-xs opacity-75">
          Preferences are saved in your browser (localStorage). Games read these to mute/unmute their own audio.
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-14 items-center rounded-full transition
          ${checked ? "bg-yellow-400" : "bg-white/20"}`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-black transition
            ${checked ? "translate-x-7" : "translate-x-1"}`}
        />
      </button>
    </label>
  );
}
