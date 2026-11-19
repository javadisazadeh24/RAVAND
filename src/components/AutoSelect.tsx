'use client';
import type { ReactNode } from 'react';
/** <select> that submits its parent form when changed */
export default function AutoSelect({ name, defaultValue, children }: { name: string; defaultValue: string; children: ReactNode }) {
  return <select name={name} defaultValue={defaultValue} onChange={(e) => e.currentTarget.form?.requestSubmit()}>{children}</select>;
}
