import { useState } from "react";

// Every dialog in this app is conditionally rendered ({trigger && <Dialog/>}),
// which means React removes it from the DOM the instant the trigger becomes
// falsy — no CSS exit animation can play. This hook keeps the last non-empty
// trigger value around during the exit animation and only lets the caller
// unmount once that animation's `animationend` actually fires, so every
// dialog that fades/slides in also fades/slides back out instead of just
// vanishing.
//
// `trigger` can be an object/string (null/"" = closed), a boolean, or an
// array (empty = closed) — e.g. `deckDialog`, `isLoginOpen`, `pendingImportCards`.
export function useDialogTransition(trigger) {
  const isOpen = Array.isArray(trigger) ? trigger.length > 0 : Boolean(trigger);
  const [displayValue, setDisplayValue] = useState(trigger);
  const [isClosing, setIsClosing] = useState(false);
  const [lastTrigger, setLastTrigger] = useState(trigger);

  // Derive state from a changed prop during render instead of in an effect
  // (React's recommended "adjusting state during render" pattern) — avoids
  // an extra commit-then-effect round trip for what is otherwise a plain
  // "trigger changed" comparison.
  if (trigger !== lastTrigger) {
    setLastTrigger(trigger);

    if (isOpen) {
      setDisplayValue(trigger);
      setIsClosing(false);
    } else {
      const wasOpen = Array.isArray(displayValue) ? displayValue.length > 0 : Boolean(displayValue);
      if (wasOpen) setIsClosing(true);
    }
  }

  function handleAnimationEnd(event) {
    // Ignore animations bubbling up from inner elements (e.g. spinners) —
    // only the dialog's own root animation should trigger the unmount.
    if (event.target !== event.currentTarget) return;
    if (isClosing) {
      setIsClosing(false);
      setDisplayValue(Array.isArray(trigger) ? [] : null);
    }
  }

  return { displayValue, isClosing, handleAnimationEnd };
}
