import React from 'react';
import type { TimeBlock } from './barbersTypes';

type BarberBlocksEditorProps = {
  barberName: string;
  blocks: TimeBlock[];
  blockTitle: string;
  blockStartAt: string;
  blockEndAt: string;
  successMessage: string;
  errorMessage: string;
  onChangeTitle: (value: string) => void;
  onChangeStartAt: (value: string) => void;
  onChangeEndAt: (value: string) => void;
  onCreate: () => void;
  onDelete: (blockId: string) => void;
  formatRange: (startAt: string, endAt: string) => string;
};

export default function BarberBlocksEditor({
  barberName,
  blocks,
  blockTitle,
  blockStartAt,
  blockEndAt,
  successMessage,
  errorMessage,
  onChangeTitle,
  onChangeStartAt,
  onChangeEndAt,
  onCreate,
  onDelete,
  formatRange
}: BarberBlocksEditorProps) {
  return (
    <section className="admin-settings-panel">
      <h3>Blocks</h3>
      <p className="muted">Create and manage unavailable time for {barberName}.</p>
      <div className="admin-profile-block-form">
        <input type="text" value={blockTitle} onChange={(event) => onChangeTitle(event.target.value)} placeholder="e.g. Lunch" />
        <input type="datetime-local" value={blockStartAt} onChange={(event) => onChangeStartAt(event.target.value)} />
        <input type="datetime-local" value={blockEndAt} onChange={(event) => onChangeEndAt(event.target.value)} />
        <button type="button" className="btn btn--secondary" onClick={onCreate}>Create block</button>
      </div>
      {successMessage ? <p className="admin-inline-success">{successMessage}</p> : null}
      {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
      <ul className="admin-blocks-list">
        {blocks.length === 0 ? <li className="muted">No blocks for this barber yet.</li> : blocks.map((block) => (
          <li key={block.id}>
            <div>
              <strong>{block.title}</strong>
              <p className="muted">{formatRange(block.startAt, block.endAt)}</p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => onDelete(block.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
