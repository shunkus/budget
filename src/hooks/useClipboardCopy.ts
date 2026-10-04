'use client';

import { useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'failed';

const RESET_MS = 2000;

// Copy text and expose a short-lived status for button labels ("Copied!" / "Copy failed")
export function useClipboardCopy() {
  const [status, setStatus] = useState<CopyStatus>('idle');

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    setTimeout(() => setStatus('idle'), RESET_MS);
  };

  return { status, copy };
}
