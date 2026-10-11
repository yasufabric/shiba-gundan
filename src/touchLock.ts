const DOUBLE_TAP_MS = 300

function prevent(event: Event): void {
  event.preventDefault()
}

/** タップ連打・ピンチでページがズームしたり、スクロールしたりしないようにする。 */
export function lockTouch(): void {
  let lastTouchEnd = 0
  const listen = (type: string, handler: (event: Event) => void): void => {
    document.addEventListener(type, handler, { capture: true, passive: false })
  }
  listen('touchstart', prevent)
  listen('touchmove', prevent)
  listen('touchend', (event) => {
    const now = Date.now()
    if (now - lastTouchEnd <= DOUBLE_TAP_MS) event.preventDefault()
    lastTouchEnd = now
    event.preventDefault()
  })
  listen('gesturestart', prevent)
  listen('gesturechange', prevent)
}
