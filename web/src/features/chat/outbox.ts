export interface Outbox {
  text: string;
  files: File[];
  autoSend: boolean;
}

let current: Outbox | null = null;

export function setOutbox(outbox: Outbox): void {
  current = outbox;
}

export function takeOutbox(): Outbox | null {
  const outbox = current;
  current = null;
  return outbox;
}
