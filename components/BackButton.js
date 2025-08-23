import React from "react";
import { useRouter } from "next/router";

export default function BackButton() {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      router.replace("/"); // אם אין היסטוריה – חזרה לדף הבית
    }
  };

  return (
    <button
      onClick={handleBack}
      className="fixed left-4 top-[calc(env(safe-area-inset-top,0px)+8px)] 
                 z-50 rounded-xl bg-yellow-400 px-4 py-2 font-semibold shadow"
    >
      ← Back
    </button>
  );
}
