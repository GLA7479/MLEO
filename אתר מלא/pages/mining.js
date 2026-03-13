// pages/mining.js
import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const BG_URL = "/images/games-hero.jpg";

// Terms management
const TERMS_VERSION = "1.1";
const TERMS_KEY = "mleo_terms_accepted_v" + TERMS_VERSION;

function isTermsAccepted() {
  if (typeof window === "undefined") return false;
  try {
    const accepted = localStorage.getItem(TERMS_KEY);
    return accepted === "true";
  } catch {
    return false;
  }
}

function acceptTerms() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TERMS_KEY, "true");
  } catch {}
}

function Modal({ open, title, children, onClose, showAcceptButton = false, onAccept }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl bg-white border border-gray-300 shadow-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300">
            <h3 className="text-lg md:text-xl font-bold text-black">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-gray-600 hover:text-black hover:bg-gray-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4 text-black leading-relaxed overflow-y-auto flex-1">{children}</div>
          <div className="px-5 pb-5">
            {showAcceptButton ? (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gray-500 hover:bg-gray-400 text-white font-extrabold px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={onAccept}
                  className="flex-1 rounded-xl bg-green-600 hover:bg-green-500 text-white font-extrabold px-4 py-2"
                >
                  I Agree
                </button>
              </div>
            ) : (
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-4 py-2"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamesHub() {
  const [modal, setModal] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const open = (id) => setModal(id);
  const close = () => setModal(null);

  // Check terms on mount
  useEffect(() => {
    setMounted(true);
    const accepted = isTermsAccepted();
    setTermsAccepted(accepted);
  }, []);

  const handleAcceptTerms = () => {
    acceptTerms();
    setTermsAccepted(true);
    setModal(null);
  };

  return (
    <Layout title="MLEO — Games">
      <main
        className="min-h-screen relative text-white"
        style={{
          backgroundImage: `linear-gradient(180deg, #0b0b0d 0%, #000 100%), url('${BG_URL}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundBlendMode: "soft-light",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
     {/* Top bar: Back + Wallet connect */}
<div className="flex justify-between items-center mb-6">
  {/* Back button */}
 <Link
  href="/"
  className="rounded-full px-4 py-2 text-sm font-bold 
             bg-red-500/15 text-red-300 border border-red-500/30"
>
  ← BACK
</Link>


  {/* Wallet connect */}
  <ConnectButton
    showBalance={false}
    accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
    chainStatus="none"
  />
</div>



          {/* Header */}
          <header className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-amber-300 text-xs font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Live Testnet • Earn in-game MLEO
            </div>
            <h1 className="text-[28px] md:text-[40px] font-extrabold tracking-tight mt-3">
              Choose Your Game
            </h1>
            <p className="text-zinc-300 mt-2 max-w-2xl mx-auto">
              Two modes, one Vault. Play actively with upgrades (Miners) or let
              passive accrual run (Token Rush). You can switch anytime.
            </p>
          </header>

          {/* Cards */}
<section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 items-stretch max-w-[900px] mx-auto">
  {/* MINERS */}
  <article className="rounded-2xl border border-white/10 bg-black/5 backdrop-blur-md shadow-xl p-5 flex flex-col w-full sm:max-w-[360px] min-h-[300px]">
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-[20px] sm:text-2xl font-extrabold">MLEO — Miners</h2>
        <p className="text-[14px] sm:text-sm text-zinc-300 mt-1 leading-6 break-words hyphens-auto">
          Idle & upgrades with tap gifts and boosts. Vault integration +
          on-chain CLAIM for steady, hands-on progress.
        </p>
      </div>
      <span className="ml-3 mt-1 rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        Active
      </span>
    </div>

    <div className="mt-auto">
      <div className="flex flex-wrap gap-2 mb-3 justify-center">
        <button
          onClick={() => open("miners-how")}
          className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs sm:text-sm font-bold shadow"
        >
          HOW TO PLAY
        </button>
        <button
          onClick={() => open("miners-terms")}
          className="px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-xs sm:text-sm font-bold shadow"
        >
          TERMS
        </button>
      </div>

      <div className="border-t border-zinc-800/80 pt-3">
        {termsAccepted ? (
          <Link
            href="/mleo-miners"
            className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-lg"
          >
            Play Miners
          </Link>
        ) : (
          <button
            onClick={() => open("miners-terms")}
            className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl bg-gray-500 text-gray-300 font-extrabold shadow-lg cursor-not-allowed"
            disabled
          >
            🔒 Accept Terms to Play
          </button>
        )}
      </div>
    </div>
  </article>

  {/* TOKEN RUSH */}
  <article className="rounded-2xl border border-white/5 bg-black/10 backdrop-blur-md shadow-xl p-5 flex flex-col w-full sm:max-w-[360px] min-h-[300px]">
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-[20px] sm:text-2xl font-extrabold">MLEO — Rush</h2>
        <p className="text-[14px] sm:text-sm text-zinc-300 mt-1 leading-6 break-words hyphens-auto">
          Passive online mining with automatic offline accrual (time-capped).
          Same Vault + CLAIM flow for background gains.
        </p>
      </div>
      <span className="ml-3 mt-1 rounded-full px-2.5 py-1 text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
        Passive
      </span>
    </div>

    <div className="mt-auto">
      <div className="flex flex-wrap gap-2 mb-3 justify-center">
        <button
          onClick={() => open("rush-how")}
          className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs sm:text-sm font-bold shadow"
        >
          HOW TO PLAY
        </button>
        <button
          onClick={() => open("rush-terms")}
          className="px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-xs sm:text-sm font-bold shadow"
        >
          TERMS
        </button>
      </div>

      <div className="border-t border-zinc-800/80 pt-3">
        {termsAccepted ? (
          <Link
            href="/mleo-token-rush"
            className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-extrabold shadow-lg"
          >
            Play Token Rush
          </Link>
        ) : (
          <button
            onClick={() => open("rush-terms")}
            className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl bg-gray-500 text-gray-300 font-extrabold shadow-lg"
          >
            🔒 Accept Terms to Play
          </button>
        )}
      </div>
    </div>
  </article>
</section>

        </div>
      </main>

      {/* Modals */}
      {modal === "miners-how" && (
        <Modal open={true} title="How to Play" onClose={close}>
          <div className="space-y-4 text-sm text-black">
            <section>
              <h3 className="font-bold text-black mb-1">Goal</h3>
              <p>
                Merge dogs (miners), break rocks, and earn <b>Coins</b>. Coins are an in-game
                resource used for upgrades and buying more miners. Some activity in the
                game can also accrue <b>MLEO</b> (see "Mining & Tokens" below).
              </p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">Board & Merging</h3>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Tap <b>ADD</b> on an empty slot to place a dog. Cost rises over time.</li>
                <li>Drag two dogs of the same level together to merge into a higher level.</li>
                <li>Each dog adds damage per second (DPS) to its lane. When a rock breaks you receive Coins.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">Upgrades & Bonuses</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>DPS</b> upgrades make rocks break faster.</li>
                <li><b>GOLD</b> upgrades increase the Coins you receive from each rock by 10% per upgrade.</li>
                <li>Gifts, auto-dogs and other bonuses may appear from time to time. Exact timings, drop types and balance values are dynamic and may change without notice.</li>
                <li>Diamonds can be collected and spent for special rewards. Availability and rewards are not guaranteed.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">Mining & Tokens (MLEO)</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>How MLEO is accrued:</b> Only breaking rocks can generate MLEO. A portion of the Coins you earn from rock breaks may convert into MLEO at a variable rate that is subject to in-game balancing, daily limits and anti-abuse protections.</li>
                <li><b>Daily limits & tapering:</b> To keep things fair, daily accrual may taper as you approach your personal limit for the day. Limits and calculations are internal and can change.</li>
                <li><b>Offline progress:</b> Limited offline progress is simulated at a reduced efficiency compared to active play. Exact values are internal and may change.</li>
                <li><b>CLAIM:</b> Your accrued MLEO appears as a balance. Claiming moves it into your in-game <b>Vault</b>. If/when on-chain claims become available, additional unlock windows and restrictions may apply.</li>
                <li><b>No value promise:</b> MLEO in this game is a <u>utility token for entertainment</u>. It has no intrinsic or guaranteed monetary value. Nothing here is an offer, solicitation, or promise of future value.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">Good to Know</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Game balance, drop rates, limits and schedules are dynamic and may be changed, paused or reset at any time for stability, fairness or maintenance.</li>
                <li>Progress may be adjusted to address bugs, exploits or abuse.</li>
                <li>This is a casual game for fun. It is not financial advice and not an investment product.</li>
              </ul>
            </section>
          </div>
        </Modal>
      )}

      {modal === "miners-terms" && (
        <Modal 
          open={true} 
          title="Terms & Conditions - MLEO Miners" 
          onClose={close}
          showAcceptButton={!termsAccepted}
          onAccept={handleAcceptTerms}
        >
          <div className="text-sm text-black space-y-4 text-left">
            <section>
              <h3 className="font-bold text-black mb-1">1) Acceptance of Terms</h3>
              <p>By accessing or using the game, you agree to these Terms & Conditions ("Terms"). We may update them in-app; continued use is acceptance.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">2) Entertainment-Only; No Monetary Value</h3>
              <p>Coins and "MLEO" are utility features for gameplay. They are not money, securities, or financial instruments, and carry no promise of price, liquidity, profit or future value.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">3) No Financial Advice</h3>
              <p>Nothing here is investment, legal, accounting or tax advice. You are solely responsible for your decisions.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">4) Gameplay, Balancing & Progress</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Rates/limits/drop tables/schedules/offline behavior are internal and may change, pause or reset at any time.</li>
                <li>We may adjust/rollback progress to address bugs, exploits or irregular activity.</li>
                <li>Feature availability may depend on time, region, device or account status.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">5) Mining, Vault & Claims</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Only certain actions (e.g., breaking rocks) may accrue MLEO under variable, capped rules.</li>
                <li>"CLAIM" moves accrued MLEO to your in-game <b>Vault</b>. If on-chain claims open later, they may be subject to unlock windows, rate limits, eligibility checks and other restrictions.</li>
                <li>We may change, delay or discontinue vaulting and/or on-chain claiming at any time.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">6) Wallets & Third-Party Services</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Wallet connection is optional and via third parties outside our control. Keep your devices, keys and wallets secure.</li>
                <li>Blockchain transactions are irreversible and may incur network fees. We are not responsible for losses due to user error, phishing, gas volatility, forks/reorgs, downtime or smart-contract risks.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">7) Fair Play & Prohibited Conduct</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>No bots, automation, multi-account abuse, exploits, reverse engineering or service interference.</li>
                <li>We may suspend, reset or terminate access and remove balances obtained through prohibited behavior.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">8) Availability, Data & Updates</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Service may be unavailable, interrupted or updated at any time.</li>
                <li>We may modify/discontinue features, wipe test data or migrate saves.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">9) Airdrops, Promotions & Rewards</h3>
              <p>Any events or rewards are discretionary, may change, and can have eligibility requirements. Participation does not guarantee receipt or value.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">10) Taxes</h3>
              <p>You are solely responsible for any taxes related to your use of the game and any rewards you may receive.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">11) Limitation of Liability</h3>
              <p>To the maximum extent permitted by law, we are not liable for indirect/special/consequential damages or loss of data/tokens/profits/opportunities.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">12) Indemnity</h3>
              <p>You agree to indemnify and hold us harmless from claims or expenses arising from your use of the game or violation of these Terms.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">13) Governing Law & Disputes</h3>
              <p>These Terms are governed by the laws of <b>[insert jurisdiction]</b>. Disputes resolved exclusively in <b>[insert venue]</b>.</p>
            </section>

            <section>
              <h3 className="font-bold text-black mb-1">14) Contact</h3>
              <p>Questions? <b>[insert contact email]</b>.</p>
            </section>
          </div>
        </Modal>
      )}

      {modal === "rush-how" && (
        <Modal open={true} title="How to Play" onClose={close}>
          <div className="space-y-4 text-sm text-black">
            <section>
              <h3 className="font-bold text-black mb-1">Goal</h3>
              <p>
                Merge dogs (miners), break rocks, and earn <b>Coins</b>. Coins are an in-game
                resource used for upgrades and buying more miners. Some activity in the
                game can also accrue <b>MLEO</b> (see "Mining & Tokens" below).
              </p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">Board & Merging</h3>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Tap <b>ADD</b> on an empty slot to place a dog. Cost rises over time.</li>
                <li>Drag two dogs of the same level together to merge into a higher level.</li>
                <li>Each dog adds damage per second (DPS) to its lane. When a rock breaks you receive Coins.</li>
              </ol>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">Upgrades & Bonuses</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>DPS</b> upgrades make rocks break faster.</li>
                <li><b>GOLD</b> upgrades increase the Coins you receive from each rock by 10% per upgrade.</li>
                <li>Gifts, auto-dogs and other bonuses may appear from time to time. Exact timings, drop types and balance values are dynamic and may change without notice.</li>
                <li>Diamonds can be collected and spent for special rewards. Availability and rewards are not guaranteed.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">Mining & Tokens (MLEO)</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>How MLEO is accrued:</b> Only breaking rocks can generate MLEO. A portion of the Coins you earn from rock breaks may convert into MLEO at a variable rate that is subject to in-game balancing, daily limits and anti-abuse protections.</li>
                <li><b>Daily limits & tapering:</b> To keep things fair, daily accrual may taper as you approach your personal limit for the day. Limits and calculations are internal and can change.</li>
                <li><b>Offline progress:</b> Limited offline progress is simulated at a reduced efficiency compared to active play. Exact values are internal and may change.</li>
                <li><b>CLAIM:</b> Your accrued MLEO appears as a balance. Claiming moves it into your in-app <b>Vault</b>. If/when on-chain claims become available, additional unlock windows and restrictions may apply.</li>
                <li><b>No value promise:</b> MLEO in this game is a <u>utility token for entertainment</u>. It has no intrinsic or guaranteed monetary value. Nothing here is an offer, solicitation, or promise of future value.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">Good to Know</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Game balance, drop rates, limits and schedules are dynamic and may be changed, paused or reset at any time for stability, fairness or maintenance.</li>
                <li>Progress may be adjusted to address bugs, exploits or abuse.</li>
                <li>This is a casual game for fun. It is not financial advice and not an investment product.</li>
              </ul>
            </section>
          </div>
        </Modal>
      )}

      {modal === "rush-terms" && (
        <Modal 
          open={true} 
          title="Terms & Conditions - MLEO Rush" 
          onClose={close}
          showAcceptButton={!termsAccepted}
          onAccept={handleAcceptTerms}
        >
          <div className="text-sm text-black space-y-4 text-left">
            {/* Same terms content as Miners */}
            <section>
              <h3 className="font-bold text-black mb-1">1) Acceptance of Terms</h3>
              <p>By accessing or using the game, you agree to these Terms & Conditions ("Terms"). We may update them in-app; continued use is acceptance.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">2) Entertainment-Only; No Monetary Value</h3>
              <p>Coins and "MLEO" are utility features for gameplay. They are not money, securities, or financial instruments, and carry no promise of price, liquidity, profit or future value.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">3) No Financial Advice</h3>
              <p>Nothing here is investment, legal, accounting or tax advice. You are solely responsible for your decisions.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">4) Gameplay, Balancing & Progress</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Rates/limits/drop tables/schedules/offline behavior are internal and may change, pause or reset at any time.</li>
                <li>We may adjust/rollback progress to address bugs, exploits or irregular activity.</li>
                <li>Feature availability may depend on time, region, device or account status.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">5) Mining, Vault & Claims</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Only certain actions (e.g., breaking rocks) may accrue MLEO under variable, capped rules.</li>
                <li>"CLAIM" moves accrued MLEO to your in-app <b>Vault</b>. If on-chain claims open later, they may be subject to unlock windows, rate limits, eligibility checks and other restrictions.</li>
                <li>We may change, delay or discontinue vaulting and/or on-chain claiming at any time.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">6) Wallets & Third-Party Services</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Wallet connection is optional and via third parties outside our control. Keep your devices, keys and wallets secure.</li>
                <li>Blockchain transactions are irreversible and may incur network fees. We are not responsible for losses due to user error, phishing, gas volatility, forks/reorgs, downtime or smart-contract risks.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">7) Fair Play & Prohibited Conduct</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>No bots, automation, multi-account abuse, exploits, reverse engineering or service interference.</li>
                <li>We may suspend, reset or terminate access and remove balances obtained through prohibited behavior.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">8) Availability, Data & Updates</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Service may be unavailable, interrupted or updated at any time.</li>
                <li>We may modify/discontinue features, wipe test data or migrate saves.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">9) Airdrops, Promotions & Rewards</h3>
              <p>Any events or rewards are discretionary, may change, and can have eligibility requirements. Participation does not guarantee receipt or value.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">10) Taxes</h3>
              <p>You are solely responsible for any taxes related to your use of the game and any rewards you may receive.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">11) Limitation of Liability</h3>
              <p>To the maximum extent permitted by law, we are not liable for indirect/special/consequential damages or loss of data/tokens/profits/opportunities.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">12) Indemnity</h3>
              <p>You agree to indemnify and hold us harmless from claims or expenses arising from your use of the game or violation of these Terms.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">13) Governing Law & Disputes</h3>
              <p>These Terms are governed by the laws of <b>[insert jurisdiction]</b>. Disputes resolved exclusively in <b>[insert venue]</b>.</p>
            </section>
            <section>
              <h3 className="font-bold text-black mb-1">14) Contact</h3>
              <p>Questions? <b>[insert contact email]</b>.</p>
            </section>
          </div>
        </Modal>
      )}
    </Layout>
  );
}