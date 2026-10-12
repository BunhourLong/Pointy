/** First-visit help dialog (index.html); reopened from the toolbar's "?" button. */
export class Onboarding {
  private readonly dialog: HTMLDialogElement;
  private readonly seenKey: string;

  constructor(dialog: HTMLDialogElement, seenKey: string) {
    this.dialog = dialog;
    this.seenKey = seenKey;
    dialog.addEventListener('close', this.onClose);
  }

  /** Shows the dialog unless this browser has dismissed it before. */
  showFirstTime(): void {
    if (!readFlag(this.seenKey)) this.show();
  }

  show(): void {
    if (!this.dialog.open) this.dialog.showModal();
  }

  dispose(): void {
    this.dialog.removeEventListener('close', this.onClose);
  }

  private onClose = (): void => {
    try {
      localStorage.setItem(this.seenKey, '1');
    } catch {
      // Storage blocked: the dialog just shows again next visit.
    }
  };
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
