import React, { useState, useEffect, useRef } from 'react';

export default function HelpTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span className="help-tooltip-wrap" ref={ref}>
      <button
        className="help-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="ヘルプ"
      >
        ?
      </button>
      {open && <span className="help-popup">{text}</span>}
    </span>
  );
}
