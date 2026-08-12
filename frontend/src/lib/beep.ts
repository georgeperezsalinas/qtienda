// src/lib/beep.ts — beep corto sintetizado con Web Audio API (sin archivo de
// audio). Dos notas ascendentes tipo "ding", <500ms. Usado para avisar de un
// pedido nuevo sin depender de un asset binario.

export function playNewOrderBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1175]; // A5 → D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // El navegador puede bloquear audio sin interacción previa — silencioso.
  }
}
