import '@/styles/components/tap-hand-hint.css';
import { TAP_HAND_SRC, type TapHandPosition } from '@/lib/ui/tapHandHint';

export default function TapHandHint({
  visible,
  position,
  className = '',
}: {
  visible: boolean;
  position: TapHandPosition | null;
  className?: string;
}) {
  if (!visible || !position) return null;

  return (
    <div
      className={`tap-hand-hint ${className}`.trim()}
      style={{ top: position.top, left: position.left }}
      aria-hidden="true"
      data-tap-hand-hint=""
    >
      <img
        className="tap-hand-hint__hand"
        src={TAP_HAND_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </div>
  );
}
