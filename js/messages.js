import { state, dom } from './state.js';

export function showMessage(text, type, dur = 3.2) {
  dom.messageEl.textContent = text; dom.messageEl.className = `show ${type}`; state.messageExpiry = state.time + dur;
}
