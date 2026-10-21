// A damped height field. Pointer strokes inject small waves; idle surfaces settle.
export class LiquidField {
  constructor(width = 80, height = 50) {
    this.width = width;
    this.height = height;
    this.current = new Float32Array(width * height);
    this.previous = new Float32Array(width * height);
    this.pixels = new Uint8Array(width * height * 4);
    this.energy = 0;
    this.writePixels();
  }

  disturb(u, v, strength = 0.7) {
    const x = u * (this.width - 1);
    const y = v * (this.height - 1);
    const radius = 3.8;
    for (
      let row = Math.max(1, Math.floor(y - radius * 2));
      row < Math.min(this.height - 1, y + radius * 2);
      row++
    ) {
      for (
        let col = Math.max(1, Math.floor(x - radius * 2));
        col < Math.min(this.width - 1, x + radius * 2);
        col++
      ) {
        const distance = ((col - x) ** 2 + (row - y) ** 2) / (radius * radius);
        const index = row * this.width + col;
        const impulse = strength * Math.exp(-distance * 1.6);
        // Add displacement to both time levels rather than injecting unbounded velocity.
        this.current[index] = Math.max(-1.8, Math.min(1.8, this.current[index] + impulse));
        this.previous[index] = Math.max(-1.8, Math.min(1.8, this.previous[index] + impulse * 0.8));
      }
    }
    this.energy = 1;
  }

  step() {
    if (this.energy < 0.002) return false;
    const { current, previous, width, height } = this;
    let peak = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const laplacian =
          current[i - 1] +
          current[i + 1] +
          current[i - width] +
          current[i + width] -
          4 * current[i];
        const next = (current[i] * 1.955 - previous[i] * 0.955 + laplacian * 0.22) * 0.992;
        previous[i] = next;
        peak = Math.max(peak, Math.abs(next), Math.abs(next - current[i]) * 3);
      }
    }
    this.previous = current;
    this.current = previous;
    this.energy = peak;
    if (peak < 0.002) this.clear();
    else this.writePixels();
    return true;
  }

  writePixels() {
    for (let i = 0; i < this.current.length; i++) {
      const value = Math.round(128 + Math.max(-1.9, Math.min(1.9, this.current[i])) * 64);
      this.pixels[i * 4] = value;
      this.pixels[i * 4 + 1] = value;
      this.pixels[i * 4 + 2] = value;
      this.pixels[i * 4 + 3] = 255;
    }
  }

  clear() {
    this.current.fill(0);
    this.previous.fill(0);
    this.energy = 0;
    this.writePixels();
  }
}

export const wrapIndex = (value, count) => ((value % count) + count) % count;
