import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Persona = 'renter' | 'buyer';

interface PersonaState {
  persona: Persona;
  setPersona: (p: Persona) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      persona: 'renter',
      setPersona: (persona) => set({ persona }),
    }),
    { name: 'wharescore-persona' },
  ),
);
