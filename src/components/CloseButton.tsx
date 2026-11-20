/**
 * The × in the corner of a viewer (the case study, a piece of work, a photo, the camera, the sketchbook). Only on
 * touch screens: with a mouse, a click outside or Escape closes them, but a phone has no Escape, and often hardly
 * anything outside to tap. See .viewer-close.
 */
export default function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="viewer-close"
      aria-label="Close"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden>
        <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  )
}
