import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';

export function GardenNameForm({ name: initial, onSave }: { name: string; onSave: (name: string) => string | null }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(onSave(name) ?? '');
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="garden-name" label="Garden name" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} />
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="submit">Save name</Button>
    </form>
  );
}
