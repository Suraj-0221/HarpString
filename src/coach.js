// Context-aware onboarding coach.
// Steps:
// 1: "Pinch with both hands and pull apart."
// 2: "Release your fingers to lock the string in place."
// 3: "Now flick a fingertip through it."
// 4: "Swipe an open palm across the camera to switch sounds."
// 5: "Clap your hands together or tap Vibes to change the mood."
// Each step shows once ever (stored in localStorage via safe storage).
// After step 3, stays hidden unless idle for 20s with fewer than 2 strings,
// then quietly offers: "Want a head start? Try Vibes." with a button.

import { storage } from './storage.js';

export const COACH_STEPS = [
  { id: 'pinch', text: 'Pinch with both hands and pull apart.' },
  { id: 'lock', text: 'Release your fingers to lock the string in place.' },
  { id: 'pluck', text: 'Now flick a fingertip through it.' },
  { id: 'swipe', text: 'Swipe an open palm across the camera to switch sounds.' },
  { id: 'vibe', text: 'Clap hands together or tap Vibes to change the mood.' },
];

export class Coach {
  constructor(containerEl, onTriggerVibes) {
    this.container = containerEl;
    this.onTriggerVibes = onTriggerVibes;

    this.completedSteps = new Set(storage.get('coach_completed_steps', []));
    this.currentStepIdx = 0;
    this.findNextStep();

    this.idleTimer = null;
    this.isSuggestingVibes = false;

    this.render();
  }

  findNextStep() {
    for (let i = 0; i < COACH_STEPS.length; i++) {
      if (!this.completedSteps.has(COACH_STEPS[i].id)) {
        this.currentStepIdx = i;
        return;
      }
    }
    this.currentStepIdx = COACH_STEPS.length; // all completed
  }

  completeStep(stepId) {
    if (!this.completedSteps.has(stepId)) {
      this.completedSteps.add(stepId);
      storage.set('coach_completed_steps', Array.from(this.completedSteps));
      this.isSuggestingVibes = false;
      this.findNextStep();
      this.render();
    }
  }

  updateActivity(stringCount) {
    clearTimeout(this.idleTimer);

    // If past step 3 (plucked) and user is idle for 20s with < 2 strings, offer Vibes
    if (this.currentStepIdx >= 3 && stringCount < 2 && !this.isSuggestingVibes) {
      this.idleTimer = setTimeout(() => {
        this.isSuggestingVibes = true;
        this.render();
      }, 20000);
    } else {
      if (this.isSuggestingVibes && stringCount >= 2) {
        this.isSuggestingVibes = false;
        this.render();
      }
    }
  }

  render() {
    if (!this.container) return;

    if (this.isSuggestingVibes) {
      this.container.innerHTML = `
        <div class="coach-card">
          <span>Want a head start? Try Vibes.</span>
          <button class="coach-btn" id="btn-coach-vibes">Try Vibes</button>
        </div>
      `;
      const btn = this.container.querySelector('#btn-coach-vibes');
      if (btn) {
        btn.addEventListener('click', () => {
          this.isSuggestingVibes = false;
          this.render();
          if (this.onTriggerVibes) this.onTriggerVibes();
        });
      }
      this.container.classList.remove('hidden');
      return;
    }

    if (this.currentStepIdx >= COACH_STEPS.length) {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      return;
    }

    const step = COACH_STEPS[this.currentStepIdx];
    const dotsHtml = COACH_STEPS.map((s, i) => {
      const cls = i < this.currentStepIdx ? 'dot completed' : (i === this.currentStepIdx ? 'dot active' : 'dot');
      return `<span class="${cls}"></span>`;
    }).join('');

    this.container.innerHTML = `
      <div class="coach-card">
        <span class="coach-text">${step.text}</span>
        <div class="coach-dots" aria-hidden="true">${dotsHtml}</div>
      </div>
    `;
    this.container.classList.remove('hidden');
  }
}
