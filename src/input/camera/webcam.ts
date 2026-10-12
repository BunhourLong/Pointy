export class Webcam {
  private stream: MediaStream | null = null;
  private readonly video: HTMLVideoElement;
  private readonly width: number;
  private readonly height: number;

  constructor(video: HTMLVideoElement, width: number, height: number) {
    this.video = video;
    this.width = width;
    this.height = height;
  }

  /** Starts the camera and resolves once the video has dimensions. */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: this.width }, height: { ideal: this.height }, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  dispose(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
