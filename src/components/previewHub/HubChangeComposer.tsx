import {
  HUB_CHANGES_ATTACHMENT,
  HUB_CHANGES_BODY,
  HUB_CHANGES_CANCEL,
  HUB_CHANGES_PAGE,
  HUB_CHANGES_PAGES,
  HUB_CHANGES_SAVE_DRAFT,
  HUB_CHANGES_SENDING,
} from '@/lib/freePreview/hubCopy';
import { HUB_CHANGE_PAGES } from '@/lib/freePreview/hubChanges.shared';
import { HubUploader } from './HubUploader';
import type { HubChangeDraftForm } from './useHubChanges';

export function HubChangeComposer(props: {
  token: string;
  apiBase?: string;
  composer: HubChangeDraftForm;
  setComposer: (next: HubChangeDraftForm) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { composer } = props;
  return (
    <form
      className="hub-card ks-glass-card hub-change-form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
    >
      <label>
        {HUB_CHANGES_PAGE}
        <select
          className="input"
          data-testid="hub-change-page"
          value={composer.page}
          onChange={(event) =>
            props.setComposer({ ...composer, page: event.target.value as HubChangeDraftForm['page'] })
          }
        >
          {HUB_CHANGE_PAGES.map((page) => (
            <option key={page} value={page}>
              {HUB_CHANGES_PAGES[page]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {HUB_CHANGES_BODY}
        <textarea
          className="textarea"
          data-testid="hub-change-body"
          required
          maxLength={2000}
          value={composer.body}
          onChange={(event) => props.setComposer({ ...composer, body: event.target.value })}
        />
      </label>
      <div>
        <p className="field__hint">{HUB_CHANGES_ATTACHMENT}</p>
        <HubUploader
          token={props.token}
          apiBase={props.apiBase}
          kind="CHANGE_ATTACHMENT"
          compact
          remaining={1}
          onUploaded={(asset) => props.setComposer({ ...composer, attachmentId: asset.id })}
        />
      </div>
      <div className="hub-review-card__actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={props.onCancel} disabled={props.busy}>
          {HUB_CHANGES_CANCEL}
        </button>
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          data-testid="hub-save-draft"
          disabled={props.busy || !composer.body.trim()}
        >
          {props.busy ? HUB_CHANGES_SENDING : HUB_CHANGES_SAVE_DRAFT}
        </button>
      </div>
    </form>
  );
}
