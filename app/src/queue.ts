import { useEffect, useRef, useState } from 'react';

import { hasMesspunkt } from './db';
import type { Reading } from './erkennung/messwerte';
import { discard, recognize, type Foto } from './foto';

export type Offen = { foto: Foto; reading: Reading | null };
/** Ausgang je Foto eines Durchgangs; schonDa: ohne Bestätigung übersprungen, siehe bekannt. */
export type Bilanz = { uebernommen: number; schonDa: number; verworfen: number };
const LEER: Bilanz = { uebernommen: 0, schonDa: 0, verworfen: 0 };

/** Schon gespeichert, etwa bei einem zweiten Import desselben Fotos: keine Bestätigung nötig. */
const bekannt = (foto: Foto, { values: [sys, dia, puls] }: Reading) =>
  sys !== null && dia !== null && puls !== null && hasMesspunkt({ zeit: foto.zeit.toISOString(), sys, dia, puls });

let fehler: string | null = null;
/** Letzter Fehler der Erkennung seit App-Start: sonst sähe ein Ausfall nur wie schlechtes Lesen aus. */
export const erkennungsfehler = () => fehler;

/** Erkennt alle Fotos sofort und legt sie nacheinander zur Bestätigung vor; onDone nach jedem erledigten. */
export function useQueue(onDone: () => void) {
  const [queue, setQueue] = useState<Foto[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [erkannt, setErkannt] = useState(new Set<Foto>());
  const bilanz = useRef(LEER);
  // nur nach einem Import aus der Galerie, nicht nach einer Aufnahme
  const [importBilanz, setImportBilanz] = useState<Bilanz | null>(null);
  // Foto in Arbeit; ein Erkennungsergebnis für ein schon verworfenes Foto wird ignoriert
  const active = useRef<Foto | null>(null);
  const readings = useRef(new Map<Foto, Promise<Reading>>());
  const recognizeOnce = (foto: Foto) => {
    let p = readings.current.get(foto);
    if (!p) {
      p = recognize(foto).catch((e) => {
        fehler = String(e);
        return { values: [null, null, null], uncertain: [false, false, false] };
      });
      readings.current.set(foto, p);
      p.then(() => setErkannt((s) => new Set(s).add(foto)));
    }
    return p;
  };

  useEffect(() => {
    queue.forEach(recognizeOnce);
    if (offen || !queue.length) return;
    const foto = queue[0];
    active.current = foto;
    setOffen({ foto, reading: null });
    recognizeOnce(foto).then((reading) => {
      if (active.current !== foto) return;
      if (bekannt(foto, reading)) drop(foto, 'schonDa');
      else setOffen({ foto, reading });
    });
  }, [queue, offen]);

  const drop = (foto: Foto, ausgang: keyof Bilanz) => {
    discard(foto);
    bilanz.current = { ...bilanz.current, [ausgang]: bilanz.current[ausgang] + 1 };
    if (queue.length === 1 && !foto.temporaer) setImportBilanz(bilanz.current);
    readings.current.delete(foto);
    active.current = null;
    setOffen(null);
    setQueue((q) => q.slice(1));
    onDone();
  };

  return {
    offen,
    nr: gesamt - queue.length + 1,
    gesamt,
    bereit: queue.filter((f) => erkannt.has(f)).length,
    next: (ausgang: 'uebernommen' | 'verworfen') => offen && drop(offen.foto, ausgang),
    importBilanz,
    quittieren: () => setImportBilanz(null),
    enqueue: (fotos: Foto[]) => {
      bilanz.current = LEER;
      setImportBilanz(null);
      setGesamt(fotos.length);
      setErkannt(new Set());
      setQueue(fotos);
    },
  };
}
