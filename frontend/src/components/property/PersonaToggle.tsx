'use client';

import { usePersonaStore, type Persona } from '@/stores/personaStore';
import { Home, Key } from 'lucide-react';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';

const OPTIONS: { value: Persona; label: string; Icon: typeof Home }[] = [
  { value: 'renter', label: "I'm renting", Icon: Key },
  { value: 'buyer', label: "I'm buying", Icon: Home },
];

export function PersonaToggle() {
  const hydrated = useStoreHydrated();
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.setPersona);

  return (
    <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = hydrated && persona === value;
        return (
          <button
            key={value}
            onClick={() => setPersona(value)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
              active
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
