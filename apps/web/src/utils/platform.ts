type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export function isIosBrowserMode() {
  return isIosDevice() && !isStandaloneDisplayMode();
}
