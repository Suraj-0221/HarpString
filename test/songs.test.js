import { describe, it, expect } from 'vitest';
import { SONGS } from '../src/songs.js';

describe('Song Melodies & Interval Verification', () => {
  it('contains all 6 public domain melodies', () => {
    const ids = SONGS.map(s => s.id);
    expect(ids).toContain('twinkle');
    expect(ids).toContain('ode_to_joy');
    expect(ids).toContain('greensleeves');
    expect(ids).toContain('auld_lang_syne');
    expect(ids).toContain('scarborough_fair');
    expect(ids).toContain('fur_elise');
  });

  it('verifies Twinkle Twinkle Little Star melody intervals', () => {
    const twinkle = SONGS.find(s => s.id === 'twinkle');
    expect(twinkle).toBeDefined();

    // 0 0 7 7 9 9 7(2) 5 5 4 4 2 2 0(2)
    const semitones = twinkle.notes.map(n => n.semitone);
    expect(semitones).toEqual([0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0]);

    // Check long final notes
    expect(twinkle.notes[6].beats).toBe(2);
    expect(twinkle.notes[13].beats).toBe(2);
  });

  it('verifies Ode to Joy melody intervals', () => {
    const ode = SONGS.find(s => s.id === 'ode_to_joy');
    expect(ode).toBeDefined();

    const semitones = ode.notes.map(n => n.semitone);
    // Phrase 1 starts with 4 4 5 7 7 5 4 2 0 0 2 4
    expect(semitones.slice(0, 12)).toEqual([4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4]);
  });

  it('verifies Für Elise opening phrase intervals', () => {
    const elise = SONGS.find(s => s.id === 'fur_elise');
    expect(elise).toBeDefined();

    const semitones = elise.notes.map(n => n.semitone);
    expect(semitones).toEqual([7, 6, 7, 6, 7, 2, 5, 3, 0]);
  });
});
